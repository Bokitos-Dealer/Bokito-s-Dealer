"""faces - find, track and name the people in a clip, so name labels can follow them.

Every face in the footage a project uses is detected (YuNet) and turned into an identity
embedding (SFace). Detections are linked into tracks shot by shot, and each track is named:

- from reference points: each player's avatar spot, plus any "cast" entries in the project
  ({"Undercover Cop": [{"t": 247.0, "x": 0.47, "y": 0.32}]}), which say "the face nearest this
  point at this time is <name>"
- otherwise the track is grouped with look-alike unnamed tracks and becomes "NPC 1", "NPC 2", ...

A label is only drawn while its face is detected, so it disappears when someone walks in front
of the person or they turn away.

The models (about 39 MB) download into models/ on first use. Results are cached in
.cache/faces/, so only the first render of a clip pays for the analysis (about 40 seconds per
minute of footage).
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
VERSION = 4
SAMPLE_FPS = 12          # faces are looked for 12 times a second
DETECT_WIDTH = 960       # frames are scaled to this width for detection
MIN_SCORE = 0.8          # detector confidence; curtains and statues score lower
MIN_FACE = 0.03          # faces smaller than this fraction of the frame height are ignored
SAME_PERSON = 0.36       # SFace cosine similarity above which two faces are the same person
RECOGNISE_PX = 40        # faces need to be this tall (at DETECT_WIDTH) ...
RECOGNISE_SHARP = 25     # ... and this sharp (Laplacian variance) to be recognised; smaller or
                         # blurrier faces still get a label, but only from a pin or as a plain NPC


def ensure_models(models_dir):
    os.makedirs(models_dir, exist_ok=True)
    for name, url in MODEL_URLS.items():
        dest = os.path.join(models_dir, name)
        if not os.path.exists(dest):
            print(f"downloading {name} (one time)...")
            urllib.request.urlretrieve(url, dest + ".part")
            os.replace(dest + ".part", dest)
    return [os.path.join(models_dir, n) for n in MODEL_URLS]


class FaceModels:
    def __init__(self, models_dir):
        import cv2
        self.cv2 = cv2
        det_path, rec_path = ensure_models(models_dir)
        self.det = cv2.FaceDetectorYN.create(det_path, "", (320, 320), 0.6, 0.3, 5000)
        self.rec = cv2.FaceRecognizerSF.create(rec_path, "")

    def detect(self, bgr):
        """[(x, y, w, h, score, embedding or None, good)] in pixels of `bgr`. `good` faces are big
        and sharp enough to recognise a known character; the others only tell extras apart."""
        h, w = bgr.shape[:2]
        self.det.setInputSize((w, h))
        _, faces = self.det.detect(bgr)
        out = []
        for f in faces if faces is not None else []:
            if f[14] < MIN_SCORE or f[3] < MIN_FACE * h:
                continue
            emb, good = None, False
            if f[3] >= 22:
                crop = self.rec.alignCrop(bgr, f)
                emb = self.rec.feature(crop).flatten()
                emb = emb / (np.linalg.norm(emb) + 1e-9)
                gray = self.cv2.cvtColor(crop, self.cv2.COLOR_BGR2GRAY)
                good = f[3] >= RECOGNISE_PX and self.cv2.Laplacian(gray, self.cv2.CV_64F).var() >= RECOGNISE_SHARP
            out.append((float(f[0]), float(f[1]), float(f[2]), float(f[3]), float(f[14]), emb, good))
        return out


def _frames(path, t0, t1, crop, width):
    """Yield (time, bgr frame) at SAMPLE_FPS between t0 and t1."""
    vf = ("crop={}:{}:{}:{},".format(*crop) if crop else "") + f"fps={SAMPLE_FPS},scale={width}:-2"
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                            "-of", "csv=p=0", path], capture_output=True, text=True, check=True).stdout
    sw, sh = map(int, probe.strip().split(",")[:2])
    if crop:
        sw, sh = crop[0], crop[1]
    h = int(round(width * sh / sw / 2)) * 2
    proc = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", f"{t0:.3f}", "-i", path, "-t", f"{t1 - t0:.3f}", "-an",
                             "-vf", vf, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    n, k = width * h * 3, 0
    while True:
        buf = proc.stdout.read(n)
        if len(buf) < n:
            break
        yield t0 + k / SAMPLE_FPS, np.frombuffer(buf, np.uint8).reshape(h, width, 3)
        k += 1
    proc.wait()


def _merge(ranges):
    out = []
    for a, b in sorted(ranges):
        if out and a <= out[-1][1] + 0.5:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return out


def _iou(a, b):
    ax0, ay0, ax1, ay1 = a[0], a[1], a[0] + a[2], a[1] + a[3]
    bx0, by0, bx1, by1 = b[0], b[1], b[0] + b[2], b[1] + b[3]
    iw, ih = max(0.0, min(ax1, bx1) - max(ax0, bx0)), max(0.0, min(ay1, by1) - max(ay0, by0))
    inter = iw * ih
    return inter / (a[2] * a[3] + b[2] * b[3] - inter + 1e-9)


def _unit(vs, ws):
    if not vs:
        return None
    e = np.average(np.array(vs), axis=0, weights=np.array(ws))
    return e / (np.linalg.norm(e) + 1e-9)


def _stitch(tracks):
    """Join pieces of one person's track that broke apart for a moment (a missed detection, a
    hand in front of the face) within the same shot."""
    tracks = sorted(tracks, key=lambda tr: tr["samples"][0][0])
    out = []
    for tr in tracks:
        best, best_gap = None, 1.01
        for prev in out:
            if prev["shot"] != tr["shot"]:
                continue
            gap = tr["samples"][0][0] - prev["samples"][-1][0]
            if not 0 < gap < best_gap:
                continue
            a, b = prev["samples"][-1], tr["samples"][0]
            dist = ((a[1] + a[3] / 2 - b[1] - b[3] / 2) ** 2 + (a[2] + a[4] / 2 - b[2] - b[4] / 2) ** 2) ** 0.5
            if dist > 1.2 * max(a[3], b[3]) or not 0.6 < b[4] / a[4] < 1.6:
                continue
            if prev["_all"] and tr["_all"] and float(np.dot(_unit(prev["_all"], prev["_wa"]),
                                                            _unit(tr["_all"], tr["_wa"]))) < 0.25:
                continue
            best, best_gap = prev, gap
        if best is None:
            out.append(tr)
        else:
            for k in ("samples", "_good", "_wg", "_all", "_wa"):
                best[k] += tr[k]
    return out


def detect_tracks(path, ranges, crop, models_dir, cache_dir):
    """Face tracks in the given clip ranges: [{"emb": unit vector from good views or None, "emb_any": from
    any view or None, "shot": n, "samples": [[t, x, y, w, h], ...]}] with positions as fractions of the
    (cropped) frame. Cached."""
    st = os.stat(path)
    key = hashlib.sha1(json.dumps([VERSION, os.path.abspath(path), st.st_size, int(st.st_mtime), ranges, crop,
                                   SAMPLE_FPS, DETECT_WIDTH, MIN_SCORE, MIN_FACE]).encode()).hexdigest()[:16]
    cache = os.path.join(cache_dir, key)
    if os.path.exists(cache + ".json"):
        saved = json.load(open(cache + ".json"))
        tracks = saved["tracks"]
        embs = np.load(cache + ".npy")
        for tr, (e, ea) in zip(tracks, embs):
            tr["emb"] = e if np.any(e) else None
            tr["emb_any"] = ea if np.any(ea) else None
        return tracks, saved["cuts"]
    models = FaceModels(models_dir)
    print("finding faces...")
    tracks, shot, coarse = [], 0, []

    def add(tr, t, d, fw, fh):
        tr["samples"].append([round(t, 3), d[0] / fw, d[1] / fh, d[2] / fw, d[3] / fh])
        if d[5] is not None:
            tr["_all"].append(d[5])
            tr["_wa"].append(d[3])
            if d[6]:
                tr["_good"].append(d[5])
                tr["_wg"].append(d[3])

    for a, b in _merge(ranges):
        prev_small, live = None, []
        shot += 1
        for t, frame in _frames(path, a, b, crop, DETECT_WIDTH):
            fh, fw = frame.shape[:2]
            small = models.cv2.resize(models.cv2.cvtColor(frame, models.cv2.COLOR_BGR2GRAY), (64, 36)).astype(np.float32)
            if prev_small is not None and float(np.mean(np.abs(small - prev_small))) > 28:
                live = []  # shot cut: nothing carries over
                shot += 1
                coarse.append(t - 0.5 / SAMPLE_FPS)
            prev_small = small
            dets = models.detect(frame)
            used, nxt = set(), []
            for tr in live:
                last = tr["samples"][-1]
                lb = (last[1] * fw, last[2] * fh, last[3] * fw, last[4] * fh)
                best, best_score = None, 0.0
                for i, d in enumerate(dets):
                    if i in used:
                        continue
                    ov = _iou(lb, d)
                    if ov < 0.2:
                        continue
                    if d[5] is not None and tr["_all"] and float(np.dot(d[5], tr["_all"][-1])) < 0.2:
                        continue  # same spot, different person (e.g. reverse shots without a detected cut)
                    if ov > best_score:
                        best, best_score = i, ov
                if best is not None and t - last[0] < 0.5:
                    used.add(best)
                    add(tr, t, dets[best], fw, fh)
                    nxt.append(tr)
                elif t - last[0] < 0.5:
                    nxt.append(tr)  # missed for a moment; it may come back
            for i, d in enumerate(dets):
                if i in used:
                    continue
                tr = {"samples": [], "shot": shot, "_good": [], "_wg": [], "_all": [], "_wa": []}
                add(tr, t, d, fw, fh)
                tracks.append(tr)
                nxt.append(tr)
            live = nxt
    out = []
    for tr in _stitch(tracks):
        tr["samples"].sort(key=lambda r: r[0])
        if len(tr["samples"]) < 3:  # under a quarter second: flicker, not a person
            continue
        out.append({"emb": _unit(tr["_good"], tr["_wg"]), "emb_any": _unit(tr["_all"], tr["_wa"]),
                    "shot": tr["shot"], "samples": tr["samples"]})
    # exact cut times, so labels switch on the cut frame and not a sample early or late
    cuts = []
    for a, b in _merge(ranges):
        cuts += exact_cuts(path, a, b, crop)
    for c in coarse:
        if not any(abs(c - x) < 0.12 for x in cuts):
            cuts.append(round(c, 3))
    cuts.sort()
    os.makedirs(cache_dir, exist_ok=True)
    json.dump({"tracks": [{"samples": tr["samples"], "shot": tr["shot"]} for tr in out], "cuts": cuts},
              open(cache + ".json", "w"))
    z = np.zeros(128)
    np.save(cache + ".npy", np.array([[tr["emb"] if tr["emb"] is not None else z,
                                       tr["emb_any"] if tr["emb_any"] is not None else z] for tr in out]))
    return out, cuts


def exact_cuts(path, t0, t1, crop, threshold=0.25):
    """Shot-cut times (s) between t0 and t1, to the frame."""
    import re
    vf = ("crop={}:{}:{}:{},".format(*crop) if crop else "") + f"scale=480:-2,select='gt(scene\\,{threshold})',showinfo"
    err = subprocess.run(["ffmpeg", "-hide_banner", "-ss", f"{t0:.3f}", "-i", path, "-t", f"{t1 - t0:.3f}", "-an",
                          "-vf", vf, "-f", "null", "-"], capture_output=True, text=True).stderr
    return [round(t0 + float(x), 3) for x in re.findall(r"pts_time:([0-9.]+)", err)]


def assign_shots(tracks, cuts):
    """Give each track the [start, end) of the shot it belongs to (by its middle sample)."""
    import bisect
    for tr in tracks:
        mid = tr["samples"][len(tr["samples"]) // 2][0]
        i = bisect.bisect_right(cuts, mid)
        tr["shot_span"] = (cuts[i - 1] if i > 0 else -1e9, cuts[i] if i < len(cuts) else 1e9)
    return tracks


def reference_embeddings(path, refs, crop, models_dir):
    """{name: [unit embeddings]} from reference points {name: [{"t", "x", "y"}, ...]}."""
    from chessrate import grab_frame
    models = FaceModels(models_dir)
    out = {}
    for name, points in refs.items():
        for pt in points:
            img = np.array(grab_frame(path, pt["t"], crop))[:, :, ::-1].copy()
            h, w = img.shape[:2]
            scale = DETECT_WIDTH / w
            small = models.cv2.resize(img, (DETECT_WIDTH, int(round(h * scale))))
            best, best_d = None, 0.2
            for d in models.detect(small):
                if d[5] is None or not d[6]:
                    continue
                cx, cy = (d[0] + d[2] / 2) / small.shape[1], (d[1] + d[3] / 2) / small.shape[0]
                dist = ((cx - pt["x"]) ** 2 + (cy - pt["y"]) ** 2) ** 0.5
                if dist < best_d:
                    best, best_d = d, dist
            if best is None:
                print(f"! no face near ({pt['x']}, {pt['y']}) at {pt['t']}s for {name}")
                continue
            out.setdefault(name, []).append(best[5])
    return out


def _span(tr):
    return tr["samples"][0][0], tr["samples"][-1][0]


def _overlaps(tr, others):
    a0, a1 = _span(tr)
    return any(b0 < a1 and a0 < b1 for b0, b1 in map(_span, others))


def name_tracks(tracks, refs, pins=(), npc_label="NPC", order=None):
    """Give every track a "name".

    - pins [(name, t, x, y)]: the track whose face is nearest (x, y) at time t gets that name
    - otherwise the best-matching reference embedding (refs: {name: [embeddings]})
    - otherwise look-alike unnamed tracks are grouped and numbered "NPC 1", "NPC 2", ...
      (`order(track)` decides the numbering order; default: clip time)
    The same name is never on two faces at once."""
    for tr in tracks:
        tr["name"] = None
    by_name = {}
    for name, t, x, y in pins:
        best, best_d = None, 0.25
        for tr in tracks:
            a, b = _span(tr)
            if not (a - 0.1 <= t <= b + 0.1):
                continue
            bx = box_at(tr, min(max(t, a), b), max_gap=1.0)
            if bx is None:
                continue
            d = ((bx[0] + bx[2] / 2 - x) ** 2 + (bx[1] + bx[3] / 2 - y) ** 2) ** 0.5
            if d < best_d:
                best, best_d = tr, d
        if best is None:
            print(f"! pin {name!r} at {t}s ({x}, {y}): no face there")
            continue
        best["name"] = name
        by_name.setdefault(name, []).append(best)
    named = {n: np.array(e) for n, e in refs.items() if len(e)}
    candidates = []
    for i, tr in enumerate(tracks):
        if tr["name"] is None and tr["emb"] is not None:
            for n, embs in named.items():
                sim = float(np.max(embs @ tr["emb"]))
                if sim >= SAME_PERSON:
                    candidates.append((sim, i, n))
    for sim, i, n in sorted(candidates, reverse=True):
        tr = tracks[i]
        if tr["name"] is None and not _overlaps(tr, by_name.get(n, [])):
            tr["name"] = n
            by_name.setdefault(n, []).append(tr)
    # everyone else is an extra: look-alikes (blurry faces need a closer match) share a number
    groups = []
    rest = [tr for tr in tracks if tr["name"] is None]
    for tr in sorted(rest, key=order or (lambda tr: tr["samples"][0][0])):
        best, best_sim = None, None
        e = tr["emb"] if tr["emb"] is not None else tr["emb_any"]
        for g in groups:
            if e is None or _overlaps(tr, g):
                continue
            sims = []
            for o in g:
                eo = o["emb"] if o["emb"] is not None else o["emb_any"]
                if eo is not None:
                    both_good = tr["emb"] is not None and o["emb"] is not None
                    sims.append(float(np.dot(e, eo)) - (0 if both_good else 0.08))
            sim = max(sims) if sims else -1
            if sim >= SAME_PERSON + 0.06 and (best_sim is None or sim > best_sim):
                best, best_sim = g, sim
        if best is None:
            groups.append([tr])
        else:
            best.append(tr)
    for k, g in enumerate(groups, 1):
        for tr in g:
            tr["name"] = f"{npc_label} {k}"
    return tracks


def box_at(track, t, max_gap=0.2):
    """Interpolated (x, y, w, h) of a track's face at clip time t, or None if it isn't visible."""
    s = track["samples"]
    a0, b0 = track.get("shot_span", (-1e9, 1e9))
    if not a0 <= t < b0:  # a label never survives its shot's cut
        return None
    if t < s[0][0] - 0.5 / SAMPLE_FPS or t > s[-1][0] + 0.5 / SAMPLE_FPS:
        return None
    lo, hi = 0, len(s) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if s[mid][0] <= t:
            lo = mid
        else:
            hi = mid
    a, b = s[lo], s[hi]
    if t <= a[0]:
        return tuple(a[1:])
    if t >= b[0]:
        return tuple(b[1:]) if t - b[0] <= 0.5 / SAMPLE_FPS else None
    if b[0] - a[0] > max_gap:  # face lost for a while (covered, turned away): no label
        return None
    u = (t - a[0]) / (b[0] - a[0])
    return tuple(a[i] + (b[i] - a[i]) * u for i in range(1, 5))


def smooth(track, k=2):
    """Moving average over +-k samples to take the jitter out of label positions."""
    s = track["samples"]
    out = []
    for i in range(len(s)):
        lo, hi = max(0, i - k), min(len(s), i + k + 1)
        # don't average across gaps
        win = [r for r in s[lo:hi] if abs(r[0] - s[i][0]) <= (k + 0.5) / SAMPLE_FPS]
        out.append([s[i][0]] + [sum(r[j] for r in win) / len(win) for j in range(1, 5)])
    track["samples"] = out
    return track
