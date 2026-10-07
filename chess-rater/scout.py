#!/usr/bin/env python3
"""scout - gather what you need to write a chessrate project for a clip.

    python scout.py clips/scene.mp4 --from 120 --to 250

Writes next to the clip:
  <clip>.scout.txt   transcript with timestamps (needs faster-whisper) + shot cuts
  <clip>.shots.png   one frame per shot with a 10x10 grid, for placing
                     labels and badges (x/y are fractions of the frame)
"""
import argparse
import io
import os
import re
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

from chessrate import detect_bars, font


def shot_cuts(path, t0, t1, threshold):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-ss", f"{t0}", "-i", path, "-t", f"{t1 - t0}", "-an",
                          "-vf", f"scale=480:-2,select='gt(scene\\,{threshold})',showinfo", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    cuts = [round(t0 + float(x), 2) for x in re.findall(r"pts_time:([0-9.]+)", err)]
    return [c for c in cuts if t0 + 0.1 < c < t1 - 0.1]


def transcribe(path, t0, t1, model):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return None
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t0}", "-i", path, "-t", f"{t1 - t0}", "-vn",
                          "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    audio = np.frombuffer(raw, np.float32)
    segments, _ = WhisperModel(model, device="cpu", compute_type="int8").transcribe(
        audio, word_timestamps=True, beam_size=5, condition_on_previous_text=False)
    lines = []
    try:
        for s in segments:
            words = " ".join(f"{w.word.strip()}[{w.end + t0:.2f}]" for w in (s.words or []))
            lines.append(f"[{s.start + t0:7.2f} - {s.end + t0:7.2f}] {s.text.strip()}\n            {words}")
    except IndexError:  # faster-whisper occasionally fails aligning the final segment
        pass
    return lines


def contact_sheet(path, bounds, crop, out):
    tiles = []
    for i, (a, b) in enumerate(zip(bounds, bounds[1:]), 1):
        vf = ("crop={}:{}:{}:{},".format(*crop) if crop else "") + "scale=384:-2"
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{(a + b) / 2:.2f}", "-i", path, "-frames:v", "1",
                              "-vf", vf, "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True).stdout
        if not raw:
            continue
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        d = ImageDraw.Draw(img)
        for k in range(1, 10):
            d.line([(img.width * k / 10, 0), (img.width * k / 10, img.height)], fill=(255, 220, 0), width=1)
            d.line([(0, img.height * k / 10), (img.width, img.height * k / 10)], fill=(255, 220, 0), width=1)
        d.rectangle((0, 0, 200, 20), fill=(0, 0, 0))
        d.text((4, 2), f"{i}  {a:.2f}-{b:.2f}", font=font("Bold", 15), fill=(255, 255, 255))
        tiles.append(img)
    if not tiles:
        return
    cols = 4
    w, h = tiles[0].size
    sheet = Image.new("RGB", (w * cols, h * ((len(tiles) + cols - 1) // cols)), (20, 20, 20))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % cols) * w, (i // cols) * h))
    sheet.save(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("clip")
    ap.add_argument("--from", dest="t0", type=float, default=0.0, help="start time (s)")
    ap.add_argument("--to", dest="t1", type=float, help="end time (s, default: end of clip)")
    ap.add_argument("--model", default="small.en", help="whisper model (tiny.en, base.en, small.en, medium.en)")
    ap.add_argument("--threshold", type=float, default=0.25, help="shot-cut sensitivity (lower = more cuts)")
    args = ap.parse_args()

    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                                args.clip], capture_output=True, text=True, check=True).stdout)
    t1 = min(args.t1 or dur, dur)
    base = os.path.splitext(args.clip)[0]
    crop = detect_bars(args.clip, args.t0)
    print("detecting shot cuts...")
    cuts = shot_cuts(args.clip, args.t0, t1, args.threshold)
    print("transcribing...")
    lines = transcribe(args.clip, args.t0, t1, args.model)
    with open(base + ".scout.txt", "w") as f:
        f.write(f"clip {args.clip}  range {args.t0:.2f}-{t1:.2f}  letterbox crop {crop}\n\n")
        f.write("SHOTS (numbers match the contact sheet)\n")
        bounds = [args.t0] + cuts + [t1]
        for i, (a, b) in enumerate(zip(bounds, bounds[1:]), 1):
            f.write(f"  {i:3d}  {a:8.2f} - {b:8.2f}\n")
        f.write("\nTRANSCRIPT (word[end time])\n")
        if lines is None:
            f.write("  install faster-whisper for a transcript: pip install faster-whisper\n")
        else:
            f.write("\n".join(lines) + "\n")
    print("making contact sheet...")
    contact_sheet(args.clip, bounds, crop, base + ".shots.png")
    print(f"wrote {base}.scout.txt and {base}.shots.png")


if __name__ == "__main__":
    sys.exit(main())
