#!/usr/bin/env python3
"""chessrate - render "I rated <scene> like a chess game" short-form videos.

Takes a source clip plus a project file describing the "moves" (timestamps,
classifications, commentary) and renders a 1080x1920 MP4 in the style of
chess.com game-review edits: hook title, player tags, eval bar, move badges,
freeze-frame commentary cards read by an AI voice, and a final Game Review.

    python chessrate.py projects/suits-mike-rachel.json -o out/suits.mp4
    python chessrate.py projects/suits-mike-rachel.json --timeline
    python chessrate.py projects/suits-mike-rachel.json --preview 4.5,31,62

See README.md for the project file format.
"""
import argparse
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
import wave
from dataclasses import dataclass, field

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS, SR = 1080, 1920, 30, 48000

KOKORO_URLS = {
    "kokoro-v1.0.onnx": "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx",
    "voices-v1.0.bin": "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin",
}

# key: (label, card phrase, colour, glyph, accuracy score)
CLASSES = {
    "brilliant": ("Brilliant", "is brilliant", "#26c2a3", "!!", 100),
    "great": ("Great", "is a great move", "#749bbf", "!", 100),
    "best": ("Best", "is best", "#81b64c", "star", 100),
    "excellent": ("Excellent", "is excellent", "#81b64c", "thumb", 92),
    "good": ("Good", "is good", "#95b776", "check", 80),
    "book": ("Book", "is a book move", "#d5a47d", "book", 100),
    "inaccuracy": ("Inaccuracy", "is an inaccuracy", "#f7c631", "?!", 60),
    "mistake": ("Mistake", "is a mistake", "#ffa459", "?", 40),
    "miss": ("Miss", "is a miss", "#ff7769", "x", 30),
    "blunder": ("Blunder", "is a blunder", "#fa412d", "??", 15),
}

LEAD_IN = "Right."  # spoken first and cut off; the model reliably pauses after it
# the series narrator: a blend of two Kokoro voices, raised two semitones to suit the pawn coach
SERIES_VOICE = "am_puck:0.5+am_fenrir:0.5"
COACH_DIR = os.path.join(HERE, "assets", "coach")

POSITIVE = {"brilliant", "great", "best", "excellent", "good", "book"}

# official chess.com sound theme, fetched on first use (not redistributed with this repo)
SOUND_URL = "https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/{}.mp3"

WHITE = (255, 255, 255, 255)
ACCENT = "#f2242b"
SAFE_RIGHT = 96  # px kept clear on the right for the TikTok / Reels like-comment-share rail

# --------------------------------------------------------------------------
# fonts and drawing helpers

FONT_DIR = os.path.join(HERE, "fonts")
INTER = {w: os.path.join(FONT_DIR, f"Inter-{w}.otf") for w in ("Medium", "SemiBold", "Bold", "ExtraBold")}
MONO_CANDIDATES = [
    os.path.join(FONT_DIR, "LiberationMono-Regular.ttf"),
    "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationMono-Regular.ttf",
    "/System/Library/Fonts/Supplemental/Courier New.ttf",
    "C:/Windows/Fonts/cour.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
]
_font_cache = {}


def font(weight, size):
    key = (weight, size)
    if key not in _font_cache:
        if weight == "mono":
            path = next((p for p in MONO_CANDIDATES if os.path.exists(p)), INTER["Medium"])
        else:
            path = INTER[weight]
        _font_cache[key] = ImageFont.truetype(path, size)
    return _font_cache[key]


def hex_rgba(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def clamp(v, lo, hi):
    return lo if v < lo else hi if v > hi else v


def ease_out(x):
    x = clamp(x, 0.0, 1.0)
    return 1 - (1 - x) ** 3


def ease_in_out(x):
    x = clamp(x, 0.0, 1.0)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def alpha_paste(dst, src, pos):
    """alpha_composite that tolerates `src` hanging off any edge of `dst`."""
    x, y = int(round(pos[0])), int(round(pos[1]))
    sx0, sy0 = max(0, -x), max(0, -y)
    sx1, sy1 = min(src.width, dst.width - x), min(src.height, dst.height - y)
    if sx1 <= sx0 or sy1 <= sy0:
        return
    if (sx0, sy0, sx1, sy1) != (0, 0, src.width, src.height):
        src = src.crop((sx0, sy0, sx1, sy1))
    dst.alpha_composite(src, (x + sx0, y + sy0))


def paint(dst, mask, pos, color):
    """Composite a solid `color` through the L-mode `mask` onto RGBA `dst`."""
    if color[3] != 255:
        mask = mask.point(lambda v, a=color[3]: v * a // 255)
    solid = Image.new("RGBA", mask.size, color[:3] + (0,))
    solid.putalpha(mask)
    alpha_paste(dst, solid, pos)


def text_mask(text, fnt, stroke=0):
    l, t, r, b = fnt.getbbox(text, stroke_width=stroke)
    mask = Image.new("L", (max(1, r - l), max(1, b - t)), 0)
    ImageDraw.Draw(mask).text((-l, -t), text, font=fnt, fill=255, stroke_width=stroke, stroke_fill=255)
    return mask, (l, t)


def draw_text(dst, xy, text, fnt, color, shadow=0):
    """Draw text with its origin at xy (Pillow's left/ascender anchor)."""
    if shadow:
        m, (l, t) = text_mask(text, fnt, stroke=2)
        pad = shadow * 2
        sh = Image.new("L", (m.width + pad * 2, m.height + pad * 2), 0)
        sh.paste(m, (pad, pad))
        sh = sh.filter(ImageFilter.GaussianBlur(shadow))
        paint(dst, sh, (xy[0] + l - pad, xy[1] + t - pad + 2), (0, 0, 0, 200))
    m, (l, t) = text_mask(text, fnt)
    paint(dst, m, (xy[0] + l, xy[1] + t), color)


def rounded_mask(w, h, r, ss=3):
    m = Image.new("L", (w * ss, h * ss), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w * ss - 1, h * ss - 1), r * ss, fill=255)
    return m.resize((w, h), Image.LANCZOS)


def rounded_box(w, h, r, color):
    img = Image.new("RGBA", (w, h), color[:3] + (0,))
    m = rounded_mask(w, h, r)
    if color[3] != 255:
        m = m.point(lambda v, a=color[3]: v * a // 255)
    img.putalpha(m)
    return img


def with_shadow(img, blur=8, alpha=140, dy=3):
    """Return `img` padded by 2*blur px on each side with a soft drop shadow."""
    pad = blur * 2
    out = Image.new("RGBA", (img.width + pad * 2, img.height + pad * 2 + dy), (0, 0, 0, 0))
    sh = Image.new("L", out.size, 0)
    sh.paste(img.getchannel("A"), (pad, pad + dy))
    sh = sh.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: v * alpha // 255)
    shadow = Image.new("RGBA", out.size, (0, 0, 0, 0))
    shadow.putalpha(sh)
    out.alpha_composite(shadow)
    out.alpha_composite(img, (pad, pad))
    return out


def fade(img, a):
    if a >= 0.999:
        return img
    out = img.copy()
    out.putalpha(img.getchannel("A").point(lambda v: int(v * a)))
    return out


def wrap_words(words, fnt, max_w):
    lines, cur = [], []
    space = fnt.getlength(" ")
    width = 0.0
    for i, w in enumerate(words):
        wl = fnt.getlength(w)
        if cur and width + space + wl > max_w:
            lines.append(cur)
            cur, width = [], 0.0
        width = wl if not cur else width + space + wl
        cur.append(i)
    if cur:
        lines.append(cur)
    return lines


# --------------------------------------------------------------------------
# move badges (vector glyphs, supersampled)

GLYPH_POLYS = {  # 24x24 icon grid
    "check": [[(9, 16.17), (4.83, 12), (3.41, 13.41), (9, 19), (21, 7), (19.59, 5.59)]],
    "x": [[(19, 6.41), (17.59, 5), (12, 10.59), (6.41, 5), (5, 6.41), (10.59, 12), (5, 17.59),
           (6.41, 19), (12, 13.41), (17.59, 19), (19, 17.59), (13.41, 12)]],
    "thumb": [[(1, 9), (5, 9), (5, 21), (1, 21)],
              [(7, 9), (7.59, 7.59), (14.17, 1), (15.23, 2.05), (15.67, 3.11), (14.69, 8), (21, 8), (23, 10),
               (23, 12), (22.86, 12.73), (19.84, 19.78), (18, 21), (9, 21), (7, 19)]],
    "book": [[(1.5, 4.5), (11, 6.2), (11, 20.5), (1.5, 18.8)],
             [(13, 6.2), (22.5, 4.5), (22.5, 18.8), (13, 20.5)]],
}


def _star(cx, cy, ro, ri):
    pts = []
    for k in range(10):
        a = -math.pi / 2 + k * math.pi / 5
        r = ro if k % 2 == 0 else ri
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


_badge_cache = {}


def badge(cls, d):
    """Coloured classification disc with a white glyph, `d` px across."""
    key = (cls, d)
    if key in _badge_cache:
        return _badge_cache[key]
    ss = 4
    D = d * ss
    img = Image.new("RGBA", (D, D), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    dr.ellipse((0, 0, D - 1, D - 1), fill=hex_rgba(CLASSES[cls][2]))
    g = CLASSES[cls][3]
    if g in ("!!", "!", "?!", "?", "??"):
        fnt = font("ExtraBold", int(D * (0.5 if len(g) > 1 else 0.6)))
        dr.text((D / 2, D / 2 + D * 0.015), g, font=fnt, fill=WHITE, anchor="mm")
    elif g == "star":
        dr.polygon(_star(D / 2, D * 0.52, D * 0.31, D * 0.13), fill=WHITE)
    else:
        scale = {"thumb": 0.5, "check": 0.62, "x": 0.66, "book": 0.56}[g] * D / 24
        cx, cy = {"thumb": (12, 11), "check": (12, 12.3), "x": (12, 12), "book": (12, 12.5)}[g]
        for poly in GLYPH_POLYS[g]:
            dr.polygon([(D / 2 + (x - cx) * scale, D / 2 + (y - cy) * scale) for x, y in poly], fill=WHITE)
    img = img.resize((d, d), Image.LANCZOS)
    _badge_cache[key] = img
    return img


# --------------------------------------------------------------------------
# media helpers

def run(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def probe(path):
    out = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
               "stream=width,height:format=duration", "-of", "json", path], capture_output=True).stdout
    info = json.loads(out)
    st = info["streams"][0]
    return st["width"], st["height"], float(info["format"]["duration"])


def grab_frame(path, t, crop=None):
    """Full-resolution RGB frame at `t`, optionally cropped (w, h, x, y)."""
    w, h, _ = probe(path)
    vf = []
    if crop:
        vf = ["-vf", "crop={}:{}:{}:{}".format(*crop)]
        w, h = crop[0], crop[1]
    raw = run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", path, "-frames:v", "1", *vf,
               "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    return Image.frombytes("RGB", (w, h), raw[: w * h * 3])


def detect_bars(path, t, dur=20.0):
    """Find letterbox/pillarbox bars with ffmpeg cropdetect; returns (w, h, x, y) or None."""
    err = subprocess.run(["ffmpeg", "-hide_banner", "-ss", f"{t:.2f}", "-i", path, "-t", f"{dur:.2f}", "-an",
                          "-vf", "cropdetect=limit=24:round=2:reset=0", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    found = re.findall(r"crop=(\d+):(\d+):(\d+):(\d+)", err)
    if not found:
        return None
    w, h, x, y = map(int, found[-1])
    sw, sh, _ = probe(path)
    if (w, h) == (sw, sh) or w < sw * 0.6 or h < sh * 0.6:
        return None
    return (w, h, x, y)


def decode_audio(path, s0, s1):
    n = int(round((s1 - s0) * SR))
    raw = run(["ffmpeg", "-v", "error", "-ss", f"{s0:.4f}", "-i", path, "-t", f"{s1 - s0:.4f}", "-vn",
               "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    a = np.frombuffer(raw, np.float32).reshape(-1, 2)
    if len(a) < n:
        a = np.vstack([a, np.zeros((n - len(a), 2), np.float32)])
    return a[:n].copy()


class FrameSource:
    """Sequential frame reader with cheap restarts when the timeline jumps."""

    def __init__(self, path, w, h, crop=None):
        self.path, self.w, self.h = path, w, h
        self.crop = "crop={}:{}:{}:{},".format(*crop) if crop else ""
        self.proc = None
        self.next_t = None
        self.last = None
        self.last_t = None

    def _start(self, t):
        self.close()
        self.proc = subprocess.Popen(
            ["ffmpeg", "-v", "error", "-ss", f"{max(0.0, t):.4f}", "-i", self.path, "-an",
             "-vf", f"{self.crop}fps={FPS},scale={self.w}:{self.h}:flags=lanczos", "-f", "rawvideo",
             "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
        self.next_t = t

    def _read(self):
        n = self.w * self.h * 3
        buf = self.proc.stdout.read(n)
        if len(buf) < n:
            return False
        self.last = np.frombuffer(buf, np.uint8).reshape(self.h, self.w, 3)
        self.last_t = self.next_t
        self.next_t += 1.0 / FPS
        return True

    def get(self, t):
        if self.last is not None and abs(t - self.last_t) < 1e-4:
            return self.last
        if self.proc is None or not (self.next_t - 0.5 / FPS <= t < self.next_t + 2.0):
            self._start(t)
        while self.next_t <= t + 0.5 / FPS:
            if not self._read():
                break
        if self.last is None:
            self.last = np.zeros((self.h, self.w, 3), np.uint8)
            self.last_t = t
        return self.last

    def close(self):
        if self.proc:
            self.proc.kill()  # before closing the pipe, so ffmpeg doesn't log a broken-pipe error
            self.proc.wait()
            self.proc.stdout.close()
            self.proc = None
            self.last = None


# --------------------------------------------------------------------------
# voice-over (Kokoro TTS, runs locally)

ABBREV = r"(?<!\bMr)(?<!\bMrs)(?<!\bMs)(?<!\bDr)(?<!\bSt)"


def split_sentences(text):
    return [s for s in re.split(ABBREV + r"(?<=[.!?])\s+", text.strip()) if s]


def speakable(text):
    t = re.sub(r"\bMr\.", "Mister", text)
    t = re.sub(r"\bMrs\.", "Missus", t)
    t = re.sub(r"\bMs\.", "Miz", t)
    t = t.replace("&", "and").replace("·", ",").replace("—", ", ").replace("…", "...")
    t = re.sub(r"\bis an inaccuracy", "is, an inaccuracy", t)  # otherwise heard as "isn't an accuracy"
    t = re.sub(r"\b1-0\b", "one, nothing", t)
    t = re.sub(r"\b0-1\b", "nothing, one", t)
    return t


class Voice:
    def __init__(self, cfg, models_dir, enabled, cache_dir):
        self.voice = cfg.get("voice", SERIES_VOICE)
        self.speed = float(cfg.get("speed", 1.12))
        self.pitch = float(cfg.get("pitch", 2.0 if self.voice == SERIES_VOICE else 0.0))
        self.lang = cfg.get("lang", "en-us")
        self.cache_dir = cache_dir
        self.kokoro = None
        self.enabled = enabled
        if not enabled:
            return
        try:
            from kokoro_onnx import Kokoro
        except ImportError:
            print("! kokoro-onnx is not installed (pip install -r requirements.txt); rendering without voice-over")
            self.enabled = False
            return
        os.makedirs(models_dir, exist_ok=True)
        for name, url in KOKORO_URLS.items():
            dest = os.path.join(models_dir, name)
            if not os.path.exists(dest):
                print(f"downloading {name} (one time, ~{'310' if name.endswith('onnx') else '27'} MB)...")
                urllib.request.urlretrieve(url, dest + ".part")
                os.replace(dest + ".part", dest)
        self.kokoro = Kokoro(os.path.join(models_dir, "kokoro-v1.0.onnx"), os.path.join(models_dir, "voices-v1.0.bin"))
        self.style = self.voice
        if ":" in self.voice:  # weighted blend of Kokoro voices, e.g. "am_puck:0.5+am_fenrir:0.5"
            parts = [p.split(":") for p in self.voice.split("+")]
            self.style = sum(float(w) * self.kokoro.get_voice_style(v) for v, w in parts)

    def shift_pitch(self, audio):
        if abs(self.pitch) < 0.01:
            return audio
        out = run(["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                   "-af", f"rubberband=pitch={2 ** (self.pitch / 12):.5f}:formant=preserved",
                   "-f", "f32le", "-ar", str(SR), "-ac", "1", "-"], input=audio.tobytes(), capture_output=True).stdout
        shifted = np.frombuffer(out, np.float32)
        return np.pad(shifted, (0, max(0, len(audio) - len(shifted))))[:len(audio)].copy()

    def say(self, text):
        """Return (mono float32 samples at SR, [(start, end)] per sentence in seconds)."""
        sentences = split_sentences(speakable(text))
        if not self.enabled:
            spans, t = [], 0.0
            for s in sentences:
                d = max(0.6, len(s.split()) / 2.7)
                spans.append((t, t + d))
                t += d + 0.25
            return np.zeros(int(t * SR), np.float32), spans
        key = hashlib.sha1(json.dumps([3, self.voice, self.speed, self.pitch, self.lang, sentences]).encode()).hexdigest()[:16]
        cache = os.path.join(self.cache_dir, key)
        if os.path.exists(cache + ".npy"):
            return np.load(cache + ".npy"), json.load(open(cache + ".json"))
        # Kokoro under-articulates the first sound of an utterance ("Bro" comes out as "Row"), so
        # the whole line is spoken in one pass after a throwaway lead-in word, which is cut off
        raw, sr = self.kokoro.create(LEAD_IN + " " + " ".join(sentences), voice=self.style,
                                     speed=self.speed, lang=self.lang)
        raw = np.asarray(raw, np.float32)
        raw = np.interp(np.arange(int(len(raw) * SR / sr)) * (sr / SR), np.arange(len(raw)), raw).astype(np.float32)
        gaps = pauses(raw, 0.06)
        lead = next((g for g in gaps if int(0.12 * SR) <= g[0] <= int(0.6 * SR)), None)
        if lead is None:  # no clear pause after the lead-in: fall back to speaking the line as is
            raw, sr = self.kokoro.create(" ".join(sentences), voice=self.style, speed=self.speed, lang=self.lang)
            raw = np.interp(np.arange(int(len(raw) * SR / sr)) * (sr / SR), np.arange(len(raw)),
                            np.asarray(raw, np.float32)).astype(np.float32)
            cut, gaps = 0, pauses(raw)
        else:
            cut = max(lead[0], lead[1] - int(0.03 * SR))
            gaps = [(a - cut, b - cut) for a, b in pauses(raw) if a > lead[1]]
        audio = raw[cut:]
        loud = np.nonzero(np.abs(audio) > 0.005)[0]
        if len(loud):
            audio = audio[: loud[-1] + int(0.08 * SR)]
        # sentence spans: the longest pauses inside the line separate its sentences
        need = len(sentences) - 1
        inner = [g for g in gaps if g[1] < len(audio)]
        if len(inner) >= need:
            breaks = sorted(sorted(inner, key=lambda g: g[1] - g[0], reverse=True)[:need])
            edges = [0] + [x for g in breaks for x in g] + [len(audio)]
            spans = [(edges[2 * i] / SR, edges[2 * i + 1] / SR) for i in range(len(sentences))]
        else:
            total = sum(len(x) for x in sentences)
            spans, acc = [], 0
            for x in sentences:
                spans.append((len(audio) / SR * acc / total, len(audio) / SR * (acc + len(x)) / total))
                acc += len(x)
        audio = self.shift_pitch(audio)
        peak = float(np.max(np.abs(audio))) or 1.0
        audio = audio * (0.89 / peak)
        os.makedirs(self.cache_dir, exist_ok=True)
        np.save(cache + ".npy", audio)
        json.dump(spans, open(cache + ".json", "w"))
        return audio, spans


def pauses(audio, min_len=0.09):
    """(start, end) sample ranges of the silent stretches inside `audio`."""
    hop = SR // 100
    env = np.sqrt(np.mean(audio[: len(audio) // hop * hop].reshape(-1, hop) ** 2, axis=1))
    quiet = env < 0.08 * (np.percentile(env, 95) + 1e-9)
    out, i = [], 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            if i > 0 and j < len(quiet) and (j - i) * hop >= min_len * SR:
                out.append((i * hop, j * hop))
            i = j
        else:
            i += 1
    return out


def coach_line(move):
    """The Game Review coach's opener, e.g. "In Here is a great move!" or "Nf3 is best." """
    phrase = CLASSES[move["class"]][1]
    end = "!" if move["class"] in ("brilliant", "great", "blunder") else "."
    return f"{move['name'].rstrip('?!.')} {phrase}{end}"


def word_times(display_text, spans):
    """Spread display words over the voice-over's sentence spans (karaoke timing)."""
    sents = split_sentences(display_text)
    if len(sents) != len(spans):
        sents = [display_text]
        spans = [(spans[0][0], spans[-1][1])] if spans else [(0.0, 1.0)]
    times = []
    for s, (a, b) in zip(sents, spans):
        words = s.split()
        weights = [len(w) + 2 + (3 if w[-1] in ",;:" else 0) for w in words]
        total, acc = float(sum(weights)), 0.0
        for wgt in weights:
            times.append(a + (b - a) * acc / total)
            acc += wgt
    return times


# --------------------------------------------------------------------------
# sound effects (chess.com sound theme)

def load_sound(name, folder):
    path = os.path.join(folder, name + ".mp3")
    if not os.path.exists(path):
        os.makedirs(folder, exist_ok=True)
        urllib.request.urlretrieve(SOUND_URL.format(name), path + ".part")
        os.replace(path + ".part", path)
    raw = run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
              capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()


# --------------------------------------------------------------------------
# timeline

@dataclass
class Span:
    kind: str  # play | hold | rewind
    t0: float
    t1: float
    s0: float
    s1: float
    phase: str = "main"  # hook | main | review

    def src(self, t):
        if self.kind == "play":
            return self.s0 + (t - self.t0)
        if self.kind == "rewind":
            u = math.floor(clamp((t - self.t0) / (self.t1 - self.t0), 0, 1) * 14) / 14
            return self.s0 + (self.s1 - self.s0) * ease_in_out(u)
        return self.s0


@dataclass
class Show:
    idx: int
    move: dict
    t0: float
    t1: float
    card: bool
    blur: bool = False
    words: list = field(default_factory=list)  # output time each body word lights up


@dataclass
class Clip:
    t: float
    audio: np.ndarray
    gain: float = 1.0
    duck: bool = False


class Project:
    def __init__(self, path, voice_enabled=True, models_dir=None):
        self.path = path
        self.base = os.path.dirname(os.path.abspath(path))
        self.cfg = cfg = json.load(open(path))
        self.source = os.path.join(self.base, cfg["source"])
        if not os.path.exists(self.source):
            sys.exit(f"source clip not found: {self.source}")
        sw, sh, self.src_dur = probe(self.source)
        self.segments = cfg.get("segments") or [[0, self.src_dur]]
        crop = cfg.get("crop", "auto")
        if crop == "auto":
            crop = detect_bars(self.source, self.segments[0][0])
        self.crop = tuple(crop) if crop else None
        if self.crop:
            sw, sh = self.crop[0], self.crop[1]
        self.clip_w = W
        self.clip_h = int(round(W * sh / sw / 2)) * 2
        self.clip_y = (H - self.clip_h) // 2
        self.players = cfg["players"]
        self.moves = sorted(cfg["moves"], key=lambda m: m["t"])
        for i, m in enumerate(self.moves):
            m["_n"] = i + 1
            if m["class"] not in CLASSES:
                sys.exit(f"move {m.get('name')}: unknown class {m['class']!r}; use one of {', '.join(CLASSES)}")
        self.labels = [l if isinstance(l, dict) else dict(zip(("from", "to", "text", "x", "y"), l))
                       for l in cfg.get("labels", [])]
        self.voice = Voice(cfg, models_dir or os.path.join(HERE, "models"), voice_enabled,
                           os.path.join(HERE, ".cache", "tts"))
        self.build()

    # ---- timeline construction
    def build(self):
        cfg = self.cfg
        self.spans, self.shows, self.clips, self.sfx = [], [], [], []
        self.evals = []  # (t, value, animate)
        t = 0.0

        def play(s0, s1, phase):
            nonlocal t
            if s1 - s0 > 1e-3:
                self.spans.append(Span("play", t, t + (s1 - s0), s0, s1, phase))
                t += s1 - s0

        def hold(s, dur, phase):
            nonlocal t
            sp = Span("hold", t, t + dur, s, s, phase)
            self.spans.append(sp)
            t += dur
            return sp

        coach = cfg.get("coach_intro", True)

        def card_hold(move, phase, vo_text, blur=False):
            intro = coach_line(move) if coach and not blur else ""
            audio, spans = self.voice.say((intro + " " + vo_text).strip())
            if intro:
                spans = spans[len(split_sentences(speakable(intro))):] or spans
            lead, tail = 0.45, 0.7
            sp = hold(move["t"], lead + len(audio) / SR + tail, phase)
            self.clips.append(Clip(sp.t0 + lead, audio))
            words = [sp.t0 + lead + w for w in word_times(move.get("comment", vo_text), spans)]
            show = Show(len(self.shows), move, sp.t0, sp.t1, True, blur, words)
            self.shows.append(show)
            self.sfx.append((sp.t0, self.move_sound(move)))
            if "eval" in move:
                self.evals.append((sp.t0, move["eval"], True))
            return sp

        main_start = self.segments[0][0]
        hook = cfg.get("hook")
        if hook:
            hook_move = self.find_move(hook["move"])
            prior = [m["eval"] for m in self.moves if m["t"] < hook["from"] and "eval" in m]
            self.evals.append((0.0, prior[-1] if prior else 0.0, False))
            play(hook["from"], hook_move["t"], "hook")
            card_hold(hook_move, "hook", hook.get("vo", ""), blur=True)
            self.spans.append(Span("rewind", t, t + 0.8, hook_move["t"], main_start, "hook"))
            self.evals.append((t, 0.0, True))
            self.sfx.append((t, "premove"))
            t += 0.8
        else:
            self.evals.append((0.0, 0.0, False))

        review = cfg.get("review", {})
        last_end = self.segments[-1][1]
        review_at = float(review.get("at", last_end - 2.5))
        self.review_t = None
        for s0, s1 in self.segments:
            cur = s0
            stops = [(m["t"], m) for m in self.moves if m.get("comment") and s0 <= m["t"] <= s1]
            if s0 <= review_at <= s1:
                stops.append((review_at, None))
            for at, m in sorted(stops, key=lambda x: x[0]):
                play(cur, at, "main")
                cur = at
                if m is not None:
                    card_hold(m, "main", m.get("vo", m["comment"]))
                elif self.review_t is None:
                    self.review_t = t
            play(cur, s1, "main")
        if self.review_t is None:
            self.review_t = t
        # main-phase note moves land wherever playback crosses their timestamp
        for m in self.moves:
            if m.get("comment"):
                continue
            ot = self.src_to_out(m["t"])
            if ot is None:
                continue
            self.shows.append(Show(len(self.shows), m, ot, ot + 2.8, False))
            self.sfx.append((ot, self.move_sound(m)))
            if "eval" in m:
                self.evals.append((ot, m["eval"], True))
        # review panel + outro voice-over, then hold on the final frame
        outro = review.get("vo")
        end = t + float(review.get("hold", 2.5))
        if outro:
            audio, _ = self.voice.say(outro)
            at = self.review_t + 1.0
            self.clips.append(Clip(at, audio, duck=True))
            end = max(end, at + len(audio) / SR + 1.2)
        if end > t:
            hold(self.segments[-1][1], end - t, "review")
        for sp in self.spans:
            if sp.t0 >= self.review_t - 1e-6 and sp.phase == "main":
                sp.phase = "review"
        self.duration = t
        self.sfx.append((0.0, "game-start"))
        if not any(name == "game-end" and self.review_t - 4 <= at <= self.review_t for at, name in self.sfx):
            self.sfx.append((self.review_t, "game-end"))
        else:
            self.sfx.append((self.review_t, "notify"))
        # each move stays on screen until the next one appears
        self.shows.sort(key=lambda s: s.t0)
        for a, b in zip(self.shows, self.shows[1:]):
            if not a.card:
                a.t1 = min(a.t1, b.t0)
            elif a.blur:
                a.t1 = min(a.t1, b.t0)
            else:
                a.t1 = min(a.t1 + 0.35, b.t0)
        for s in self.shows:
            s.t1 = min(s.t1, self.review_t)
        self.evals.sort(key=lambda e: e[0])

    @staticmethod
    def move_sound(move):
        if isinstance(move.get("eval"), str) and move["eval"] in ("1-0", "0-1"):
            return "game-end"
        if move.get("comment"):
            return "capture" if move["class"] in POSITIVE else "move-check"
        if move["class"] not in POSITIVE:
            return "move-check" if move["class"] in ("mistake", "blunder") else "move-opponent"
        return "move-self" if move["side"] == "white" else "move-opponent"

    def find_move(self, name):
        for m in self.moves:
            if m.get("name") == name:
                return m
        sys.exit(f"hook move {name!r} not found")

    def src_to_out(self, s):
        for sp in self.spans:
            if sp.kind == "play" and sp.phase == "main" and sp.s0 - 1e-6 <= s < sp.s1:
                return sp.t0 + (s - sp.s0)
        return None

    def span_at(self, t):
        for sp in self.spans:
            if sp.t0 <= t < sp.t1:
                return sp
        return self.spans[-1]

    def accuracy(self, side):
        override = self.cfg.get("review", {}).get("accuracy", {}).get(side)
        if override is not None:
            return float(override)
        scores = [CLASSES[m["class"]][4] for m in self.moves if m["side"] == side]
        return sum(scores) / len(scores) if scores else 0.0

    def counts(self, side):
        c = {k: 0 for k in CLASSES}
        for m in self.moves:
            if m["side"] == side:
                c[m["class"]] += 1
        return c


def eval_numeric(v):
    if isinstance(v, str):
        if v == "1-0":
            return 99.0
        if v == "0-1":
            return -99.0
        if v.startswith("-M"):
            return -50.0
        if v.startswith("M"):
            return 50.0
        return float(v)
    return float(v)


# --------------------------------------------------------------------------
# rendering

class Renderer:
    def __init__(self, project):
        self.p = project
        self.cw, self.ch = project.clip_w, project.clip_h
        self.frames = FrameSource(project.source, self.cw, self.ch, project.crop)
        self.cache = {}
        self.base = self.render_base()
        self.avatars = {side: self.avatar(project.players[side]) for side in ("white", "black")}
        coach = project.cfg.get("coach", {})
        self.coach_h = int(coach.get("size", 190)) if coach.get("enabled", True) else 0
        self.coach = {}
        if self.coach_h:
            for expr in ("hype", "shook"):
                for m in range(3):
                    im = Image.open(os.path.join(COACH_DIR, f"{expr}_{m}.png")).convert("RGBA")
                    im = im.resize((round(im.width * self.coach_h / im.height), self.coach_h), Image.LANCZOS)
                    self.coach[expr, m] = with_shadow(im, 8, 130)
            self.coach_w = self.coach["hype", 0].width - 32
        self.talk = self.talk_levels()
        self.tags = {side: self.player_tag(side) for side in ("white", "black")}

    # ---- static pieces
    def render_base(self):
        base = Image.new("RGBA", (W, H), (0, 0, 0, 255))
        title = self.p.cfg.get("title", {})
        tokens = [(w, WHITE) for w in title.get("text", "").split()]
        tokens += [(w, hex_rgba(title.get("accent_color", ACCENT))) for w in title.get("accent", "").split()]
        size = int(title.get("size", 58))
        fnt = font("Bold", size)
        lines = [[tokens[i] for i in line] for line in wrap_words([w for w, _ in tokens], fnt, W - 90)]
        line_h = int(size * 1.2)
        y = self.p.clip_y - 30 - line_h * len(lines)
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        stroke = Image.new("L", (W, H), 0)
        sd = ImageDraw.Draw(stroke)
        for line in lines:
            widths = [fnt.getlength(w) for w, _ in line]
            space = fnt.getlength(" ")
            x = (W - (sum(widths) + space * (len(line) - 1))) / 2
            for (word, color), wl in zip(line, widths):
                sd.text((x, y), word, font=fnt, fill=255, stroke_width=4, stroke_fill=255)
                draw_text(layer, (x, y), word, fnt, color)
                x += wl + space
            y += line_h
        shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        shadow.putalpha(stroke.filter(ImageFilter.GaussianBlur(3)).point(lambda v: min(255, v * 230 // 255)))
        base.alpha_composite(shadow, (0, 3))
        base.alpha_composite(layer)
        return base.convert("RGB")

    def avatar(self, player, size=88):
        av = player.get("avatar")
        if isinstance(av, str):
            img = Image.open(os.path.join(self.p.base, av)).convert("RGB")
            s = min(img.size)
            img = img.crop(((img.width - s) // 2, (img.height - s) // 2, (img.width + s) // 2, (img.height + s) // 2))
        elif isinstance(av, dict):
            frame = grab_frame(self.p.source, av["t"], self.p.crop)
            fw, fh = frame.size
            s = av.get("size", 0.3) * fh
            cx, cy = av["x"] * fw, av["y"] * fh
            img = frame.crop((int(cx - s / 2), int(cy - s / 2), int(cx + s / 2), int(cy + s / 2)))
        else:
            img = Image.new("RGB", (size, size), (90, 90, 90))
        img = img.resize((size, size), Image.LANCZOS).convert("RGBA")
        img.putalpha(rounded_mask(size, size, size // 7))
        return img

    def player_tag(self, side):
        pl = self.p.players[side]
        name_f, sub_f = font("Bold", 22), font("Medium", 15)
        av = self.avatars[side].resize((48, 48), Image.LANCZOS)
        tw = int(max(name_f.getlength(pl["name"]), sub_f.getlength(side.title())))
        w, h = 10 + 48 + 12 + tw + 14, 64
        img = rounded_box(w, h, 10, (18, 18, 18, 150))
        img.alpha_composite(av, (8, 8))
        draw_text(img, (70, 9), pl["name"], name_f, WHITE)
        draw_text(img, (70, 36), side.title(), sub_f, (176, 176, 176, 255))
        return img

    def label(self, text):
        key = ("label", text)
        if key not in self.cache:
            fnt = font("mono", 26)
            l, t, r, b = fnt.getbbox(text)
            img = Image.new("RGBA", (r - l + 24, b - t + 24), (0, 0, 0, 0))
            draw_text(img, (12 - l, 12 - t), text, fnt, WHITE, shadow=3)
            self.cache[key] = img
        return self.cache[key]

    def note_tag(self, move):
        key = ("note", move["_n"])
        if key not in self.cache:
            cls = CLASSES[move["class"]]
            nf, cf, bf = font("Bold", 21), font("Bold", 21), font("Medium", 17)
            name, verdict, note = move["name"], cls[0], move.get("note", "")
            head_w = nf.getlength(name + " ") + cf.getlength(verdict)
            note_lines = [[note.split()[i] for i in ln] for ln in wrap_words(note.split(), bf, 360)] if note else []
            body_w = max([bf.getlength(" ".join(l)) for l in note_lines] or [0])
            w = int(max(head_w, body_w)) + 30
            h = 16 + 26 + 23 * len(note_lines) + 10
            img = rounded_box(w, h, 8, (22, 22, 22, 225))
            paint(img, Image.new("L", (4, h - 12), 255), (6, 6), hex_rgba(cls[2]))
            draw_text(img, (18, 11), name, nf, WHITE)
            draw_text(img, (18 + nf.getlength(name + " "), 11), verdict, cf, hex_rgba(cls[2]))
            for i, ln in enumerate(note_lines):
                draw_text(img, (18, 39 + 23 * i), " ".join(ln), bf, (206, 206, 206, 255))
            self.cache[key] = with_shadow(img, 8, 120)
        return self.cache[key]

    def shadowed_badge(self, cls, d):
        key = ("badge", cls, d)
        if key not in self.cache:
            self.cache[key] = with_shadow(badge(cls, d), 10, 150)
        return self.cache[key]

    def card(self, show, lit):
        key = ("card", show.idx, lit, show.blur)
        if key in self.cache:
            return self.cache[key]
        move = show.move
        cls = CLASSES[move["class"]]
        color = hex_rgba(cls[2])
        cw = int(self.p.cfg.get("card_width", 660))
        pad = 28
        hf, sf, bf = font("Bold", 31), font("Medium", 18), font("SemiBold", 26)
        words = move["comment"].split()
        lines = wrap_words(words, bf, cw - pad * 2 - 8)
        line_h = 36
        h = 22 + 40 + 30 + line_h * len(lines) + 20
        img = rounded_box(cw, h, 12, (24, 24, 24, 228))
        paint(img, Image.new("L", (5, h - 16), 255), (8, 8), color)
        icon = badge(move["class"], 34)
        img.alpha_composite(icon, (pad, 22))
        x = pad + 34 + 12
        name = move["name"]
        hf_fit = hf
        room = cw - x - pad - (self.coach_w if self.coach_h else 0)
        while hf_fit.size > 20 and hf_fit.getlength(name + " " + cls[1]) > room:
            hf_fit = font("Bold", hf_fit.size - 1)
        draw_text(img, (x, 23 + (31 - hf_fit.size) // 2), name, hf_fit, WHITE)
        draw_text(img, (x + hf_fit.getlength(name + " "), 23 + (31 - hf_fit.size) // 2), cls[1], hf_fit, color)
        side = move["side"]
        sub = f"{move['_n']}. {self.p.players[side].get('short', self.p.players[side]['name'])} · {side.title()}"
        draw_text(img, (pad + 8, 66), sub, sf, (160, 160, 160, 255))
        body = Image.new("RGBA", (cw, line_h * len(lines) + 12), (0, 0, 0, 0))
        space = bf.getlength(" ")
        for li, line in enumerate(lines):
            x = pad + 8
            for wi in line:
                c = WHITE if wi < lit else (255, 255, 255, 165)
                draw_text(body, (x, li * line_h), words[wi], bf, c)
                x += bf.getlength(words[wi]) + space
        img.alpha_composite(body, (0, 98))
        out = with_shadow(img, 12, 150)
        self.cache[key] = out
        return out

    def review_panel(self, rows):
        key = ("review", rows)
        if key in self.cache:
            return self.cache[key]
        p = self.p
        pw, ph = 470, 548
        img = rounded_box(pw, ph, 16, (30, 30, 30, 238))
        tf, nf, lf, cf = font("Bold", 32), font("SemiBold", 16), font("Medium", 19), font("Bold", 19)
        draw_text(img, (pw / 2 - tf.getlength("Game Review") / 2, 22), "Game Review", tf, WHITE)
        col_w, col_i, col_b = 268, 338, 408
        top = 70
        for side, cx in (("white", col_w), ("black", col_b)):
            av = self.avatars[side].resize((46, 46), Image.LANCZOS)
            img.alpha_composite(av, (cx - 23, top))
            short = p.players[side].get("short", p.players[side]["name"])
            draw_text(img, (cx - nf.getlength(short) / 2, top + 52), short, nf, WHITE)
        acc_y = top + 84
        draw_text(img, (30, acc_y + 4), "Accuracy", font("SemiBold", 20), WHITE)
        for side, cx in (("white", col_w), ("black", col_b)):
            box = rounded_box(74, 34, 6, (240, 240, 240, 255))
            txt = f"{p.accuracy(side):.1f}"
            bfnt = font("Bold", 20)
            draw_text(box, (37 - bfnt.getlength(txt) / 2, 6), txt, bfnt, (30, 30, 30, 255))
            img.alpha_composite(box, (cx - 37, acc_y))
        cw_, cb_ = p.counts("white"), p.counts("black")
        row_y, step = acc_y + 48, 30
        for i, k in enumerate(CLASSES):
            if i >= rows:
                break
            label, _, color, _, _ = CLASSES[k]
            y = row_y + i * step
            draw_text(img, (30, y + 3), label, lf, (228, 228, 228, 255))
            for cnt, cx in ((cw_[k], col_w), (cb_[k], col_b)):
                s = str(cnt)
                draw_text(img, (cx - cf.getlength(s) / 2, y + 3), s, cf, hex_rgba(color))
            img.alpha_composite(badge(k, 26), (col_i - 13, y))
        if rows > len(CLASSES):
            result = p.cfg.get("review", {}).get("result", "")
            rf = font("Bold", 20)
            while rf.size > 14 and rf.getlength("Result: " + result) > pw - 40:
                rf = font("Bold", rf.size - 1)
            draw_text(img, (pw / 2 - rf.getlength("Result: " + result) / 2, row_y + len(CLASSES) * step + 10),
                      "Result: " + result, rf, WHITE)
        scale = min(1.0, (self.ch - 40) / ph)
        if scale < 1:
            img = img.resize((int(pw * scale), int(ph * scale)), Image.LANCZOS)
        out = with_shadow(img, 14, 160)
        self.cache[key] = out
        return out

    def rewind_icon(self):
        if "rewind" not in self.cache:
            img = Image.new("RGBA", (220, 140), (0, 0, 0, 0))
            m = Image.new("L", (220 * 3, 140 * 3), 0)
            d = ImageDraw.Draw(m)
            for x0 in (30, 110):
                d.polygon([((x0 + 80) * 3, 20 * 3), ((x0 + 80) * 3, 120 * 3), (x0 * 3, 70 * 3)], fill=255)
            paint(img, m.resize((220, 140), Image.LANCZOS), (0, 0), (255, 255, 255, 235))
            self.cache["rewind"] = with_shadow(img, 10, 170)
        return self.cache["rewind"]

    # ---- per-frame
    def eval_at(self, t):
        prev, cur, kt, animate = 0.0, 0.0, 0.0, False
        for et, v, anim in self.p.evals:
            if et > t:
                break
            prev, cur, kt, animate = cur, v, et, anim
        a, b = eval_numeric(prev), eval_numeric(cur)
        u = ease_in_out((t - kt) / 0.6) if animate else 1.0
        return a + (b - a) * u, cur

    def draw_eval(self, clip, t):
        v, target = self.eval_at(t)
        if abs(v) >= 49:
            frac = 1.0 if v > 0 else 0.0
        else:
            frac = clamp(1 / (1 + math.exp(-0.55 * v)), 0.03, 0.97)
        x0, y0, y1, w = 9, 10, self.ch - 10, 15
        d = ImageDraw.Draw(clip)
        d.rectangle((x0, y0, x0 + w, y1), fill=(64, 61, 57, 255))
        split = y1 - (y1 - y0) * frac
        d.rectangle((x0, split, x0 + w, y1), fill=(241, 241, 241, 255))
        txt = target if isinstance(target, str) else f"{abs(eval_numeric(target)):.1f}"
        f = font("Bold", 11)
        if eval_numeric(target) >= 0:
            draw_text(clip, (x0 + w / 2 - f.getlength(txt) / 2, y1 - 16), txt, f, (40, 40, 40, 255))
        else:
            draw_text(clip, (x0 + w / 2 - f.getlength(txt) / 2, y0 + 4), txt, f, (230, 230, 230, 255))

    def talk_levels(self):
        """Voice-over loudness per pair of frames (0-1), for the coach's lip flap."""
        n = int(self.p.duration * FPS) + 2
        level = np.zeros(n, np.float32)
        hop = SR * 2 // FPS
        for c in self.p.clips:
            a = c.audio
            if len(a) < hop:
                continue
            rms = np.sqrt(np.mean(a[: len(a) // hop * hop].reshape(-1, hop) ** 2, axis=1))
            rms = rms / (np.percentile(rms, 95) + 1e-6)
            f0 = int(round(c.t * FPS))
            for k, v in enumerate(rms):
                for j in (f0 + 2 * k, f0 + 2 * k + 1):
                    if 0 <= j < n:
                        level[j] = max(level[j], v)
        return level

    def draw_coach(self, clip, t, expr, cx, bottom, appear_t, leave_t):
        """The pawn coach, standing with its feet at `bottom`, talking along with the voice-over."""
        if not self.coach_h or not (appear_t <= t < leave_t):
            return
        age = t - appear_t
        lv = self.talk[min(len(self.talk) - 1, int(t * FPS))]
        mouth = 0 if lv < 0.18 else (1 if lv < 0.55 else 2)
        img = self.coach[expr, mouth]
        s = 0.55 + 0.45 * ease_out(age / 0.25) if age < 0.25 else 1.0
        if s < 0.999:
            img = img.resize((max(1, int(img.width * s)), max(1, int(img.height * s))), Image.LANCZOS)
        bob = 3 * math.sin(2 * math.pi * 1.6 * t) if mouth else 0
        a = min(clamp(age / 0.15, 0, 1), clamp((leave_t - t) / 0.2, 0, 1))
        alpha_paste(clip, fade(img, a), (cx - img.width / 2, bottom - img.height + 16 * s + bob))

    def card_side(self, move):
        return move.get("card", "right")

    def bottom_tag_alpha(self, t):
        """Fade the bottom player tag out while a left-hand card covers it."""
        a = 1.0
        for s in self.p.shows:
            if not s.card or self.card_side(s.move) != "left" or not (s.t0 <= t < s.t1 + 0.25):
                continue
            if t < s.t0 + 0.2:
                a = min(a, 1 - (t - s.t0) / 0.2)
            elif t < s.t1:
                a = 0.0
            else:
                a = min(a, (t - s.t1) / 0.25)
        return a

    def draw_show(self, clip, show, t):
        move = show.move
        age, remain = t - show.t0, show.t1 - t
        alpha = clamp(remain / 0.2, 0, 1)
        bx, by = move.get("badge", [0.82, 0.24])
        cx, cy = bx * self.cw, by * self.ch
        d = int(self.p.cfg.get("badge_size", 96))
        if age < 0.12:
            s = 0.4 + 0.75 * ease_out(age / 0.12)
        elif age < 0.26:
            s = 1.15 - 0.15 * ease_in_out((age - 0.12) / 0.14)
        else:
            s = 1.0
        b = self.shadowed_badge(move["class"], d)
        if abs(s - 1) > 1e-3:
            b = b.resize((max(1, int(b.width * s)), max(1, int(b.height * s))), Image.LANCZOS)
        alpha_paste(clip, fade(b, alpha), (cx - b.width / 2, cy - b.height / 2 + 2 * s))
        if show.card:
            lit = len(show.words) if show.blur else sum(1 for wt in show.words if wt <= t)
            img = self.card(show, lit)
            ca = clamp((age - 0.15) / 0.25, 0, 1)
            side = self.card_side(move)
            pad = 24  # shadow padding
            iw, ih = img.width - 2 * pad, img.height - 2 * pad
            # right-hand cards leave room for the TikTok / Reels button rail; left-hand
            # cards cover the bottom player tag, which render() fades out meanwhile
            x = 34 if side == "left" else self.cw - iw - SAFE_RIGHT
            y = max(8, self.ch - 20 - ih) + (1 - ease_out(ca)) * 28
            alpha_paste(clip, fade(img, min(alpha, ca)), (x - pad, y - pad))
            if self.coach_h:
                expr = "hype" if move["class"] in POSITIVE else "shook"
                self.draw_coach(clip, t, expr, x + iw - self.coach_w / 2 - 6, y + 50, show.t0 + 0.2, show.t1)
        elif move.get("note") is not None:
            img = self.note_tag(move)
            ox = oy = 16  # shadow padding
            ta = min(alpha, clamp((age - 0.1) / 0.18, 0, 1))
            iw, ih = img.width - 2 * ox, img.height - 2 * oy
            x = clamp(cx - iw / 2, 30, self.cw - iw - SAFE_RIGHT)
            y = cy + d / 2 + 12
            if y + ih > self.ch - 80:
                y = cy - d / 2 - 12 - ih
            alpha_paste(clip, fade(img, ta), (x - ox, y - oy))

    def render(self, t):
        p = self.p
        sp = p.span_at(t)
        src_t = sp.src(t)
        frame = self.frames.get(src_t)
        in_review = t >= p.review_t
        bright, zoom, blur = 1.0, 1.0, 0.0
        if sp.kind == "hold" and sp.phase != "review":
            k = ease_out((t - sp.t0) / 0.35)
            bright = 1 - 0.16 * k
            zoom = 1 + 0.045 * ease_in_out((t - sp.t0) / max(0.01, sp.t1 - sp.t0))
        elif sp.kind == "rewind":
            bright = 0.72
        if in_review:
            k = ease_out((t - p.review_t) / 0.45)
            bright, blur = 1 - 0.42 * k, 9 * k
        if bright < 0.999:
            frame = (frame * np.float32(bright)).astype(np.uint8)
        img = Image.fromarray(frame)
        if zoom > 1.0005:
            zw, zh = self.cw / zoom, self.ch / zoom
            img = img.resize((self.cw, self.ch), Image.BILINEAR,
                             box=((self.cw - zw) / 2, (self.ch - zh) / 2, (self.cw + zw) / 2, (self.ch + zh) / 2))
        if blur > 0.3:
            img = img.filter(ImageFilter.GaussianBlur(blur))
        clip = img.convert("RGBA")

        if not in_review and sp.kind != "rewind":
            for lb in p.labels:
                if lb["from"] <= src_t < lb["to"]:
                    li = self.label(lb["text"])
                    alpha_paste(clip, li, (lb["x"] * self.cw - li.width / 2, lb["y"] * self.ch - li.height / 2))
        self.draw_eval(clip, t)
        if not in_review:
            alpha_paste(clip, self.tags["black"], (34, 12))
            ta = self.bottom_tag_alpha(t)
            if ta > 0.01:
                alpha_paste(clip, fade(self.tags["white"], ta), (34, self.ch - 12 - self.tags["white"].height))
        for show in p.shows:
            if show.t0 <= t < show.t1:
                self.draw_show(clip, show, t)
        if sp.kind == "rewind":
            ri = self.rewind_icon()
            alpha_paste(clip, ri, ((self.cw - ri.width) / 2, (self.ch - ri.height) / 2))
        if in_review:
            age = t - p.review_t
            rows = int(clamp((age - 0.35) / 0.08, 0, len(CLASSES) + 1))
            panel = self.review_panel(rows)
            a = ease_out(age / 0.35)
            py = (self.ch - (panel.height - 56)) / 2
            alpha_paste(clip, fade(panel, a), (76 - 28, py - 28 + (1 - a) * 20))
            if self.coach_h:
                self.draw_coach(clip, t, "hype", 76 + panel.width - 56 + self.coach_w / 2 + 10,
                                self.ch - 24, p.review_t + 0.6, p.duration + 1)
        out = self.base.copy()
        out.paste(clip.convert("RGB"), (0, p.clip_y))
        return out

    def close(self):
        self.frames.close()


# --------------------------------------------------------------------------
# audio mix + encode

def build_audio(p, t_from, t_to):
    n = int(math.ceil((t_to - t_from) * SR)) + 1
    scene = np.zeros((n, 2), np.float32)
    vo = np.zeros(n, np.float32)
    duck = np.ones(n, np.float32)
    fx = np.zeros(n, np.float32)

    def place(buf, at, data, gain=1.0):
        i = int(round((at - t_from) * SR))
        j0, j1 = max(0, -i), min(len(data), n - i)
        if j1 > j0:
            buf[i + j0: i + j1] += data[j0:j1] * gain

    ramp = int(0.012 * SR)
    for sp in p.spans:
        if sp.kind != "play" or sp.t1 <= t_from or sp.t0 >= t_to:
            continue
        a = decode_audio(p.source, sp.s0, sp.s1)
        if len(a) > 2 * ramp:
            env = np.ones(len(a), np.float32)
            env[:ramp] = np.linspace(0, 1, ramp)
            env[-ramp:] = np.linspace(1, 0, ramp)
            a *= env[:, None]
        place(scene, sp.t0, a)
    for c in p.clips:
        place(vo, c.t, c.audio, c.gain)
        if c.duck:
            env = np.full(len(c.audio) + int(0.6 * SR), 0.3, np.float32)
            r = int(0.15 * SR)
            env[:r] = np.linspace(1, 0.3, r)
            env[-r:] = np.linspace(0.3, 1, r)
            i = int(round((c.t - 0.3 - t_from) * SR))
            j0, j1 = max(0, -i), min(len(env), n - i)
            if j1 > j0:
                duck[i + j0:i + j1] = np.minimum(duck[i + j0:i + j1], env[j0:j1])
    if p.cfg.get("sfx", True):
        folder = os.path.join(p.base, p.cfg["sounds"]) if p.cfg.get("sounds") else os.path.join(HERE, "sounds")
        gain = float(p.cfg.get("sfx_volume", 0.7))
        cache = {}
        for at, name in p.sfx:
            if name not in cache:
                cache[name] = load_sound(name, folder)
            place(fx, at, cache[name], gain)
    mix = scene * duck[:, None] + (vo * 1.0 + fx)[:, None]
    return np.clip(mix, -1, 1)


def write_wav(path, stereo):
    data = (stereo * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def render_video(p, out, fast=False, t_from=0.0, t_to=None):
    t_to = min(t_to or p.duration, p.duration)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="chessrate-")
    wav = os.path.join(tmp, "mix.wav")
    print("mixing audio...")
    write_wav(wav, build_audio(p, t_from, t_to))
    r = Renderer(p)
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
         "-i", "-", "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "libx264",
         "-preset", "veryfast" if fast else "medium", "-crf", "18", "-maxrate", "14M", "-bufsize", "28M",
         "-pix_fmt", "yuv420p", "-profile:v", "high", "-c:a", "aac", "-b:a", "192k",
         "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", str(SR), "-movflags", "+faststart", "-shortest", out],
        stdin=subprocess.PIPE)
    n0, n1 = int(round(t_from * FPS)), int(round(t_to * FPS))
    started = time.time()
    try:
        for i in range(n0, n1):
            enc.stdin.write(r.render(i / FPS).tobytes())
            done = i - n0 + 1
            if done % (FPS * 10) == 0 or i == n1 - 1:
                el = time.time() - started
                print(f"  {i / FPS:6.1f}s / {t_to:.1f}s  ({done / el:.1f} fps)", flush=True)
    finally:
        r.close()
        enc.stdin.close()
        enc.wait()
        shutil.rmtree(tmp, ignore_errors=True)
    if enc.returncode != 0:
        sys.exit("ffmpeg encode failed")
    print(f"wrote {out}  ({t_to - t_from:.1f}s)")


def print_timeline(p):
    print(f"duration {p.duration:.2f}s   clip {p.clip_w}x{p.clip_h} at y={p.clip_y}   crop {p.crop}   "
          f"review at {p.review_t:.2f}s")
    for sp in p.spans:
        print(f"  {sp.t0:7.2f}-{sp.t1:7.2f}  {sp.kind:6s} {sp.phase:6s}  src {sp.s0:8.2f} -> {sp.s1:8.2f}")
    print("moves:")
    for s in p.shows:
        m = s.move
        kind = "CARD" if s.card else "note"
        print(f"  {s.t0:7.2f}-{s.t1:7.2f}  {kind}{' (hook)' if s.blur else ''}  #{m['_n']:<2} {m['side']:5s} "
              f"{m['class']:10s} {m['name']}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project", help="project JSON file")
    ap.add_argument("-o", "--out", help="output MP4 (default: out/<project name>.mp4)")
    ap.add_argument("--preview", help="comma-separated output times (s): write PNG stills instead of a video")
    ap.add_argument("--timeline", action="store_true", help="print the edit timeline and exit")
    ap.add_argument("--range", help="render only part of the output, e.g. 20:45")
    ap.add_argument("--no-voice", action="store_true", help="skip the AI voice-over (silent holds)")
    ap.add_argument("--models", help="folder for the Kokoro TTS model files (default: ./models)")
    ap.add_argument("--fast", action="store_true", help="faster, slightly larger encode")
    args = ap.parse_args()

    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            sys.exit(f"{tool} not found on PATH - install ffmpeg first")
    p = Project(args.project, voice_enabled=not args.no_voice, models_dir=args.models)
    name = os.path.splitext(os.path.basename(args.project))[0]
    if args.timeline:
        print_timeline(p)
        return
    if args.preview:
        r = Renderer(p)
        out_dir = os.path.join(HERE, "out", "preview")
        os.makedirs(out_dir, exist_ok=True)
        for ts in args.preview.split(","):
            path = os.path.join(out_dir, f"{name}_{float(ts):07.2f}.png")
            r.render(float(ts)).save(path)
            print("wrote", path)
        r.close()
        return
    t_from, t_to = 0.0, None
    if args.range:
        a, b = args.range.split(":")
        t_from, t_to = float(a or 0), float(b) if b else None
    render_video(p, args.out or os.path.join(HERE, "out", f"{name}.mp4"), args.fast, t_from, t_to)


if __name__ == "__main__":
    main()
