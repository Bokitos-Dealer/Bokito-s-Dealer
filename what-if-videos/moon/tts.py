"""Render each script line with Kokoro and stitch them with controlled pauses.
Writes audio/voice.wav and audio/voice_timeline.json (start/end per line)."""
import json, sys, os
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, '..', 'models')
script = json.load(open(os.path.join(HERE, 'script.json')))
voice = sys.argv[1] if len(sys.argv) > 1 else script['voice']
kokoro = Kokoro(os.path.join(MODELS, 'kokoro-v1.0.onnx'), os.path.join(MODELS, 'voices-v1.0.bin'))
SR = 24000
lead = 0.12
pieces, timeline, t = [np.zeros(int(lead * SR), dtype=np.float32)], [], lead
for ln in script['lines']:
    samples, sr = kokoro.create(ln['text'], voice=voice, speed=script['speed'], lang='en-us')
    assert sr == SR
    # trim leading/trailing silence so our gaps are exact
    a = np.abs(samples)
    idx = np.where(a > 0.01)[0]
    s0, s1 = (max(0, idx[0] - 240), min(len(samples), idx[-1] + 1200)) if len(idx) else (0, len(samples))
    seg = samples[s0:s1].astype(np.float32)
    pieces.append(seg)
    timeline.append({'id': ln['id'], 'text': ln['text'], 'start': round(t, 3), 'end': round(t + len(seg) / SR, 3)})
    t += len(seg) / SR
    gap = np.zeros(int(ln['gap'] * SR), dtype=np.float32)
    pieces.append(gap)
    t += ln['gap']
out = np.concatenate(pieces)
os.makedirs(os.path.join(HERE, 'audio'), exist_ok=True)
sf.write(os.path.join(HERE, 'audio', f'voice_{voice}.wav'), out, SR)
json.dump({'voice': voice, 'duration': round(t, 3), 'lines': timeline}, open(os.path.join(HERE, 'audio', f'voice_{voice}.json'), 'w'), indent=1)
print(voice, 'duration', round(t, 2))
