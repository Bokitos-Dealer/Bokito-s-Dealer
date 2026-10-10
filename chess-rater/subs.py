"""subs - burned-in dialogue subtitles.

The parts of the clip a video uses are transcribed once with faster-whisper (word timings,
character names passed in as a hint so they're spelt right) and cached in .cache/subs/. The
words are grouped into subtitles of a sentence or so, and the renderer shows them small at the
bottom of the picture, like a film's own subtitles. Swear words are masked on screen
("b*llsh*t"); the audio is untouched.
"""
import hashlib
import json
import os
import re
import subprocess

import numpy as np

VERSION = 1
MASK = {"shit", "bullshit", "shitty", "fuck", "fucking", "fucked", "motherfucker", "asshole", "assholes",
        "bitch", "bitches", "dickhead", "dick", "goddamn", "goddamned", "cunt", "pussy", "bastard"}


def available():
    import importlib.util
    return importlib.util.find_spec("faster_whisper") is not None


def _merge(ranges):
    out = []
    for a, b in sorted(ranges):
        if out and a <= out[-1][1] + 0.5:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return out


def transcribe(path, ranges, names, model, cache_dir):
    """[{"w": word, "s": start, "e": end}] in clip time for the given ranges. Cached."""
    st = os.stat(path)
    key = hashlib.sha1(json.dumps([VERSION, os.path.abspath(path), st.st_size, int(st.st_mtime),
                                   _merge(ranges), sorted(names), model]).encode()).hexdigest()[:16]
    cache = os.path.join(cache_dir, key + ".json")
    if os.path.exists(cache):
        return json.load(open(cache))
    from faster_whisper import WhisperModel
    print(f"transcribing dialogue for subtitles ({model})...")
    whisper = WhisperModel(model, device="cpu", compute_type="int8")
    prompt = (", ".join(names) + ".") if names else None
    words = []
    for a, b in _merge(ranges):
        a0 = max(0.0, a - 1.0)  # a little run-up so the first word isn't clipped
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{a0:.3f}", "-i", path, "-t", f"{b - a0 + 0.5:.3f}",
                              "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
        audio = np.frombuffer(raw, np.float32)
        segments, _ = whisper.transcribe(audio, word_timestamps=True, beam_size=5, initial_prompt=prompt,
                                         condition_on_previous_text=False, vad_filter=True)
        try:
            for seg in segments:
                for w in seg.words or []:
                    s, e = a0 + w.start, a0 + w.end
                    if e >= a - 0.05 and s <= b + 0.05 and w.word.strip():
                        words.append({"w": w.word.strip(), "s": round(s, 3), "e": round(e, 3)})
        except IndexError:  # faster-whisper occasionally fails aligning a final segment
            pass
    words.sort(key=lambda w: w["s"])
    # drop duplicates where merged ranges overlapped
    out = []
    for w in words:
        if not out or w["s"] >= out[-1]["s"] + 0.02 or w["w"] != out[-1]["w"]:
            out.append(w)
    os.makedirs(cache_dir, exist_ok=True)
    json.dump(out, open(cache, "w"))
    return out


def mask(word):
    core = re.sub(r"[^A-Za-z]", "", word).lower()
    if core not in MASK:
        return word
    letters = [i for i, c in enumerate(word) if c.isalpha()]
    chars = list(word)
    for i in letters[1:-1]:
        if chars[i].lower() in "aeiou":
            chars[i] = "*"
    if chars == list(word) and len(letters) > 2:
        chars[letters[1]] = "*"
    return "".join(chars)


def apply_fixes(words, fix=None, replace=None):
    """Correct the transcript.

    fix: {"Lewis": "Louis"} replaces a word everywhere. A key matches the word as transcribed
    (with its punctuation, e.g. "fix.") or just its letters, in which case the punctuation is kept.
    replace: [[t0, t1, "new text"], ...] replaces the words that start between t0 and t1 (clip
    time) with new text: word for word on the same timings when the counts match, otherwise
    spread evenly over the same stretch. "" deletes them (for words that were never said)."""
    fix = fix or {}
    lower = {re.sub(r"[^A-Za-z']", "", k).lower(): v for k, v in fix.items()}
    out = []
    for w in words:
        text = w["w"]
        if text in fix:
            text = fix[text]
        else:
            m = re.match(r"^([^A-Za-z']*)([A-Za-z']+)([^A-Za-z']*)$", text)
            if m and m.group(2).lower() in lower:
                text = m.group(1) + lower[m.group(2).lower()] + m.group(3)
        out.append(dict(w, w=text))
    for t0, t1, text in replace or []:
        hit = [i for i, w in enumerate(out) if t0 <= w["s"] < t1]
        new = text.split()
        if hit:
            span = [out[i] for i in hit]
            a, b = span[0]["s"], span[-1]["e"]
            first = hit[0]
            out = out[:first] + out[hit[-1] + 1:]
        else:
            a, b = t0, t1
            first = next((i for i, w in enumerate(out) if w["s"] >= t0), len(out))
            span = []
        if len(new) == len(span):
            ins = [dict(o, w=n) for o, n in zip(span, new)]
        else:
            step = (b - a) / max(1, len(new))
            ins = [{"w": n, "s": round(a + k * step, 3), "e": round(a + (k + 1) * step, 3)} for k, n in enumerate(new)]
        out = out[:first] + ins + out[first:]
    return out


def phrases(words, max_chars=34, max_words=7):
    """Group words into on-screen subtitles: [{"words": [...], "s": start, "e": end}]."""
    joined = []
    for w in words:  # a lone "-" marks someone being cut off: attach it to the word before as a dash
        if w["w"] in ("-", "--", "—") and joined:
            joined[-1] = dict(joined[-1], w=joined[-1]["w"].rstrip(",") + "—")
        elif w["w"] not in ("-", "--", "—"):
            joined.append(w)
    out, cur = [], []
    for w in joined:
        w = dict(w, w=mask(w["w"]))
        text = w["w"]
        if cur:
            gap = w["s"] - cur[-1]["e"]
            length = sum(len(x["w"]) + 1 for x in cur) + len(text)
            ends = cur[-1]["w"].endswith((".", "?", "!", "—"))
            if gap > 0.6 or length > max_chars or len(cur) >= max_words or ends:
                out.append(cur)
                cur = []
        cur.append(w)
    if cur:
        out.append(cur)
    return [{"words": p, "s": p[0]["s"], "e": p[-1]["e"]} for p in out]
