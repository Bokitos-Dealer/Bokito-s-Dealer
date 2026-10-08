"""faces - find, follow and name every person in the footage, so name tags stick to them.

Turned on with "face_labels": true in a project. Every face in the footage the project uses is
found (YuNet) and turned into an identity fingerprint (SFace). Faces are linked into tracks shot
by shot, and each track gets a name:

1. from hints: each player's avatar spot, any "cast" entries
   ({"Receptionist": [{"t": 247.0, "x": 0.47, "y": 0.32}]}: the face nearest this point at this
   time is the Receptionist), and the project's "labels" list, which now only says who is
   roughly where in a shot instead of being drawn as is
2. otherwise by looking like a named track (same fingerprint)
3. otherwise grouped with look-alike unnamed tracks into "NPC 1", "NPC 2", ...

A tag is drawn only while its face is found, so it disappears when someone walks in front of
the person (or they turn fully away) and comes back when they are visible again.

The models (about 39 MB) download into models/ on first use. Results are cached in
.cache/faces/, so only the first render of a clip pays for the analysis.
"""
import hashlib
import json
import os
import subprocess
import urllib.request

import numpy as np

MODEL_URLS = {
    "face_detection_yunet_2023mar.onnx":
        "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/"
        "face_detection_yunet_2023mar.onnx",
    "face_recognition_sface_2021dec.onnx":
        "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_recognition_sface/"
        "face_recognition_sface_2021dec.onnx",
}
VERSION = 2
SAMPLE_FPS = 12          # faces are looked for 12 times a second
DETECT_WIDTH = 960       # frames are scaled to this width for detection
MIN_SCORE = 0.75         # detector confidence; curtains and statues score lower
MIN_FACE = 0.035         # faces smaller than this fraction of the frame height are ignored
MIN_TAG_FACE = 0.06      # background faces smaller than this don't get a tag (too small to tell apart)
SAME_PERSON = 0.36       # fingerprint similarity above which two tracks are the same person
CUT = 0.8                # colour-histogram similarity below which two samples are different shots
MAX_GAP = 0.35           # a face missing longer than this (s) ends its track: it was covered
MIN_TRACK = 0.4          # tracks shorter than this (s) are dropped as noise
MIN_TAG_TRACK = 0.8      # unnamed faces seen for less than this (s) get no tag: it would only flicker
STEADY = 0.3             # tag positions are smoothed over about this long (s)
HIDE = "-"               # a "cast" entry with this name hides the tag on that face


def ensure_models(models_dir):
    os.makedirs(models_dir, exist_ok=True)
    for name, url in MODEL_URLS.items():
        dest = os.path.join(models_dir, name)
        if not os.path.exists(dest):
            print(f"downloading {name} (one time)...")
            urllib.request.urlretrieve(url, dest + ".part")
            os.replace(dest + ".part", dest)
    return [os.path.join(models_dir, n) for n in MODEL_URLS]


def _norm(v):
    return v / (np.linalg.norm(v) + 1e-9)


# --------------------------------------------------------------------------
# 1. detection: sample the footage and find every face

def scan(path, crop, ranges, models_dir):
    """Samples: list of (t, hist, [(x, y, w, h, turn, emb)]) with boxes in 0..1 of the frame."""
    import cv2
    det_path, rec_path = ensure_models(models_dir)
    det = cv2.FaceDetectorYN.create(det_path, "", (320, 320), 0.6, 0.3, 5000)
    rec = cv2.FaceRecognizerSF.create(rec_path, "")
    cw, ch = (crop[0], crop[1]) if crop else _video_size(path)
    fw = DETECT_WIDTH
    fh = int(round(fw * ch / cw / 2)) * 2
    det.setInputSize((fw, fh))
    samples = []
    vf = ("crop={}:{}:{}:{},".format(*crop) if crop else "") + f"fps={SAMPLE_FPS},scale={fw}:{fh}"
    for a, b in ranges:
        proc = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", f"{a:.3f}", "-i", path, "-t", f"{b - a:.3f}",
                                 "-an", "-vf", vf, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                                stdout=subprocess.PIPE)
        i = 0
        while True:
            buf = proc.stdout.read(fw * fh * 3)
            if len(buf) < fw * fh * 3:
                break
            img = np.frombuffer(buf, np.uint8).reshape(fh, fw, 3)
            t = a + i / SAMPLE_FPS
            i += 1
            hsv = cv2.cvtColor(cv2.resize(img, (160, 90)), cv2.COLOR_BGR2HSV)
            hist = cv2.calcHist([hsv], [0, 1], None, [16, 8], [0, 180, 0, 256]).flatten()
            hist = hist / (hist.sum() + 1e-9)
            _, found = det.detect(img)
            faces = []
            for f in found if found is not None else []:
                x, y, w, h, score = f[0], f[1], f[2], f[3], f[14]
                if score < MIN_SCORE or h < MIN_FACE * fh:
                    continue
                emb = _norm(rec.feature(rec.alignCrop(img, f)).flatten())
                # how far the head is turned: 0 facing the camera, 1 in full profile
                eye_l, eye_r, nose = f[4], f[6], f[8]
                turn = abs((nose - eye_l) / (eye_r - eye_l + 1e-6) - 0.5) * 2 if eye_r > eye_l else 1.0
                faces.append((x / fw, y / fh, w / fw, h / fh, float(min(turn, 1.0)), emb))
            samples.append((t, hist, faces))
        proc.wait()
    return samples


def _video_size(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height", "-of", "csv=p=0", path], capture_output=True, text=True).stdout
    w, h = out.strip().split(",")[:2]
    return int(w), int(h)


# --------------------------------------------------------------------------
# 2. tracking: link faces from sample to sample within a shot

class Track:
    def __init__(self, shot):
        self.shot = shot
        self.pts = []  # (t, x, y, w, h)
        self.embs = []
        self.turns = []
        self.name = None

    @property
    def t0(self):
        return self.pts[0][0]

    @property
    def t1(self):
        return self.pts[-1][0]

    def emb(self):
        return _norm(np.mean(self.embs, axis=0))


def _iou(a, b):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    ix = max(0.0, min(ax + aw, bx + bw) - max(ax, bx))
    iy = max(0.0, min(ay + ah, by + bh) - max(ay, by))
    inter = ix * iy
    return inter / (aw * ah + bw * bh - inter + 1e-9)


def build_tracks(samples):
    tracks, live, shot = [], [], 0
    prev_hist, prev_t = None, None
    for t, hist, faces in samples:
        new_shot = prev_hist is None or prev_t is None or t - prev_t > 1.5 / SAMPLE_FPS
        if not new_shot:
            new_shot = float(np.minimum(hist, prev_hist).sum()) < CUT
        if new_shot:
            shot += 1
            live = []
        prev_hist, prev_t = hist, t
        live = [tr for tr in live if t - tr.t1 <= MAX_GAP]
        pairs = []
        for i, f in enumerate(faces):
            for j, tr in enumerate(live):
                _, x, y, w, h = tr.pts[-1]
                iou = _iou(f[:4], (x, y, w, h))
                dist = np.hypot(f[0] + f[2] / 2 - x - w / 2, f[1] + f[3] / 2 - y - h / 2) / max(w, f[2])
                sim = float(f[5] @ tr.embs[-1])
                grow = f[3] / h
                if (iou > 0.15 or dist < 0.6) and 0.7 < grow < 1.4 and sim > 0.2:
                    pairs.append((iou + sim, i, j))
        used_f, used_t = set(), set()
        for _, i, j in sorted(pairs, reverse=True):
            if i in used_f or j in used_t:
                continue
            used_f.add(i)
            used_t.add(j)
            live[j].pts.append((t, *faces[i][:4]))
            live[j].embs.append(faces[i][5])
            live[j].turns.append(faces[i][4])
        for i, f in enumerate(faces):
            if i not in used_f:
                tr = Track(shot)
                tr.pts.append((t, *f[:4]))
                tr.embs.append(f[5])
                tr.turns.append(f[4])
                tracks.append(tr)
                live.append(tr)
    return [tr for tr in tracks if tr.t1 - tr.t0 >= MIN_TRACK - 1e-6 and _face_h(tr) >= MIN_TAG_FACE]


# --------------------------------------------------------------------------
# 3. naming

def _hint_dist(tr, a, b, x, y):
    """How far a hint at (x, y) during a..b is from a track's face, on average over the time they
    overlap: 0 when the point is on the face or in the strip above the head where a tag sits."""
    if b - a < 1.0 / SAMPLE_FPS:  # a single moment: the nearest sample
        pts = [p for p in tr.pts if abs(p[0] - a) <= 0.6 / SAMPLE_FPS]
    else:
        pts = [p for p in tr.pts if a <= p[0] <= b]
    if not pts or len(pts) < min(3, len(tr.pts), round((b - a) * SAMPLE_FPS)):  # the shot before or after
        return None
    return float(np.mean([np.hypot(max(px - x, 0, x - px - pw), max(py - 0.1 - y, 0, y - py - ph))
                          for _, px, py, pw, ph in pts]))


def _overlap(a, b):
    return a.shot == b.shot and a.t0 <= b.t1 and b.t0 <= a.t1


def _face_h(tr):
    return float(np.median([p[4] for p in tr.pts]))


def _clear(tr):
    """Big enough and not cut off by the frame edge, so its fingerprint can be trusted."""
    x, y, w, h = np.median(np.array(tr.pts)[:, 1:], axis=0)
    return h >= 0.08 and (h >= 0.25 or (y > 0.01 and x > 0.005 and x + w < 0.995))


def name_tracks(tracks, hints):
    """hints: [(name, t_from, t_to, x, y, strong)]. Strong hints (avatars, cast) are trusted
    outright; weak ones (old hand-placed labels) vote. Nobody gets two tags at once."""
    conf = {}
    for name, a, b, x, y, strong in hints:
        if strong:
            ds = [(d, tr) for tr in tracks if (d := _hint_dist(tr, a, b, x, y)) is not None and d < 0.12]
            if ds:
                tr = min(ds, key=lambda dt: dt[0])[1]
                tr.name, conf[id(tr)] = name, 3.0
    refs = {}
    for tr in tracks:
        if tr.name and tr.name != HIDE:
            refs.setdefault(tr.name, []).append(tr.emb())
    # weak hints given for the same moment are matched to faces together, one face each,
    # preferring faces that are near the hint and look like the person it names
    votes = {}
    groups = {}
    for name, a, b, x, y, strong in hints:
        if not strong:
            groups.setdefault((a, b), []).append((name, x, y))
    for (a, b), group in groups.items():
        pairs = []
        for hi, (name, x, y) in enumerate(group):
            for tr in tracks:
                d = _hint_dist(tr, a, b, x, y)
                if d is None or d >= 0.12:
                    continue
                sim = max((float(tr.emb() @ r) for r in refs.get(name, [])), default=0.0)
                if name in refs and sim < 0.2 and _clear(tr) and np.median(tr.turns) < 0.4:
                    continue  # a clear, front-on face that isn't them: the hint means someone facing away
                pairs.append((d - 0.3 * sim, hi, tr))
        used_h, used_t = set(), set()
        for _, hi, tr in sorted(pairs, key=lambda p: p[0]):
            if hi in used_h or id(tr) in used_t:
                continue
            used_h.add(hi)
            used_t.add(id(tr))
            v = votes.setdefault(id(tr), {})
            v[group[hi][0]] = v.get(group[hi][0], 0) + (b - a)
    for tr in tracks:
        if tr.name is None and id(tr) in votes:
            v = votes[id(tr)]
            tr.name = max(v, key=v.get)
            sim = max((float(tr.emb() @ r) for r in refs.get(tr.name, [])), default=0.0)
            conf[id(tr)] = 1.15 + (sim if _clear(tr) else min(sim, 0.2))
    # people named somewhere are recognised everywhere else by their fingerprint; small or
    # cut-off faces give unreliable fingerprints, so they neither teach nor get matched
    strong = refs
    refs = {n: list(rs) for n, rs in strong.items()}
    for tr in tracks:
        if tr.name and id(tr) in votes and not tr.name.startswith("NPC") and _clear(tr):
            if tr.name not in strong or max(float(tr.emb() @ r) for r in strong[tr.name]) > SAME_PERSON:
                refs.setdefault(tr.name, []).append(tr.emb())
    for tr in sorted(tracks, key=_face_h, reverse=True):
        if tr.name or not refs or not _clear(tr) or _face_h(tr) < 0.15:
            continue
        e = tr.emb()
        scores = {n: max(float(e @ r) for r in rs) for n, rs in refs.items()}
        n = max(scores, key=scores.get)
        if scores[n] > SAME_PERSON:
            tr.name, conf[id(tr)] = n, 1.0 + scores[n]
            refs[n].append(e)
    # one tag per person at a time: the most certain track keeps the name, the rest are extras
    kept = []
    for tr in sorted([t for t in tracks if t.name], key=lambda t: (-conf.get(id(t), 0), -len(t.pts))):
        if tr.name == HIDE:
            continue
        if any(k.name == tr.name and _overlap(k, tr) for k in kept):
            tr.name = None
        else:
            kept.append(tr)
    # someone who was covered for a moment comes back where they were: same name
    for tr in sorted(tracks, key=lambda t: t.t0):
        if tr.name:
            continue
        _, x, y, w, h = tr.pts[0]
        for o in tracks:
            if o.name and o.shot == tr.shot and 0 < tr.t0 - o.t1 < 2.5 and not any(
                    k.name == o.name and _overlap(k, tr) for k in tracks if k is not o):
                _, ox, oy, ow, oh = o.pts[-1]
                if np.hypot(x + w / 2 - ox - ow / 2, y + h / 2 - oy - oh / 2) < max(h, oh) and 0.6 < h / oh < 1.6 \
                        and float(tr.emb() @ o.emb()) > 0.25:
                    tr.name = o.name
                    break
    # everyone left is an extra: group look-alikes, number them in order of appearance
    npcs = {}
    for tr in tracks:
        if tr.name and tr.name.startswith("NPC"):
            npcs.setdefault(tr.name, []).append(tr)
    taken = {int(n.split()[-1]) for n in npcs if n.split()[-1].isdigit()}
    nxt = 1
    for tr in sorted(tracks, key=lambda tr: tr.t0):
        if tr.name:
            continue
        if tr.t1 - tr.t0 < MIN_TAG_TRACK:
            tr.name = HIDE
            continue
        e = tr.emb()
        scores = {n: max(float(e @ o.emb()) for o in ts) for n, ts in npcs.items()
                  if not any(_overlap(o, tr) for o in ts)}
        n = max(scores, key=scores.get) if scores else None
        if n is None or scores[n] <= SAME_PERSON:
            while nxt in taken:
                nxt += 1
            n = f"NPC {nxt}"
            taken.add(nxt)
            npcs[n] = []
        tr.name = n
        npcs[n].append(tr)
    return tracks


# --------------------------------------------------------------------------
# 4. lookup at render time

class FaceLabels:
    def __init__(self, tracks):
        self.tracks = sorted([tr for tr in tracks if tr.name != HIDE], key=lambda tr: tr.t0)
        self.arrs = [self.steady(np.array(tr.pts)) for tr in self.tracks]

    @staticmethod
    def steady(a):
        """Detections wobble a little from frame to frame. Smooth the boxes, then let the tag stay
        put until the face has really moved, so tags sit still instead of shaking."""
        if len(a) < 3:
            return a
        n = len(a)
        sig = STEADY * SAMPLE_FPS / 2
        k = np.arange(-int(3 * sig), int(3 * sig) + 1)
        wts = np.exp(-0.5 * (k / sig) ** 2)
        out = a.copy()
        for c in range(1, 5):
            col = a[:, c]
            pad = np.concatenate([np.full(len(k), col[0]), col, np.full(len(k), col[-1])])
            out[:, c] = np.convolve(pad, wts / wts.sum(), mode="same")[len(k):len(k) + n]
        # dead zone: the tag only follows once the face drifts more than a fraction of its size
        anchor = out[0, 1:5].copy()
        for i in range(n):
            x, y, w, h = out[i, 1:5]
            cx, cy = x + w / 2, y
            ax, ay = anchor[0] + anchor[2] / 2, anchor[1]
            dzx, dzy = 0.18 * w, 0.12 * h
            if abs(cx - ax) > dzx:
                ax = cx - np.sign(cx - ax) * dzx
            if abs(cy - ay) > dzy:
                ay = cy - np.sign(cy - ay) * dzy
            if abs(h - anchor[3]) > 0.12 * h:
                anchor[2:4] = (w, h)
            anchor[0], anchor[1] = ax - anchor[2] / 2, ay
            out[i, 1:5] = anchor
        return out

    def at(self, t):
        """[(track_id, name, x_center, y_top, face_w, face_h)] for every face visible at source time t."""
        out = []
        for i, (tr, a) in enumerate(zip(self.tracks, self.arrs)):
            if t < tr.t0 - 1e-6 or t > tr.t1 + 1.0 / SAMPLE_FPS:
                continue
            k = int(np.searchsorted(a[:, 0], t))
            if k == 0:
                row = a[0]
            elif k >= len(a):
                row = a[-1]
            else:
                lo, hi = a[k - 1], a[k]
                f = (t - lo[0]) / (hi[0] - lo[0])
                row = lo + (hi - lo) * f
            _, x, y, w, h = row
            out.append((i, tr.name, x + w / 2, y, w, h))
        return out


def load(source, crop, ranges, hints, models_dir, cache_dir):
    st = os.stat(source)
    key = hashlib.sha1(json.dumps([VERSION, os.path.abspath(source), st.st_size, int(st.st_mtime),
                                   crop, ranges]).encode()).hexdigest()[:16]
    os.makedirs(cache_dir, exist_ok=True)
    cache = os.path.join(cache_dir, key + ".npz")
    if os.path.exists(cache):
        z = np.load(cache, allow_pickle=True)
        samples = list(z["samples"])
    else:
        print("finding faces (one time per clip)...")
        samples = scan(source, crop, ranges, models_dir)
        np.savez_compressed(cache, samples=np.array(samples, dtype=object))
    return FaceLabels(name_tracks(build_tracks(samples), hints))
