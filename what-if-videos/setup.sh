#!/bin/sh
# One-time setup for a fresh machine or cloud session: node modules, python packages, the Kokoro voice model,
# and the Mixkit music/sound effects (licensed for use in videos, not for redistribution, so not in git).
# usage: sh what-if-videos/setup.sh        (safe to re-run; skips what is already there)
set -e
cd "$(dirname "$0")"
npm install --no-audit --no-fund
pip install -q numpy scipy soundfile pillow kokoro-onnx faster-whisper
mkdir -p assets/tts/voices
HF=https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main
[ -s assets/tts/model.onnx ] || curl -sfL --retry 4 -o assets/tts/model.onnx "$HF/onnx/model.onnx"
for v in af_bella af_heart af_nicole af_sarah af_sky am_adam am_echo am_eric am_liam am_michael am_onyx am_puck bf_emma bf_isabella bm_daniel bm_fable bm_george bm_lewis ; do [ -s assets/tts/voices/$v.bin ] || curl -sfL --retry 4 -o assets/tts/voices/$v.bin "$HF/voices/$v.bin"; done
python3 -I -c "
import numpy as np, glob, os
d = {os.path.basename(f)[:-4]: np.fromfile(f, dtype=np.float32).reshape(-1, 1, 256) for f in sorted(glob.glob('assets/tts/voices/*.bin'))}
np.savez('assets/tts/voices.npz', **d); print('voices:', len(d))"
python3 -I audio/fetch_assets.py
echo "setup done"
