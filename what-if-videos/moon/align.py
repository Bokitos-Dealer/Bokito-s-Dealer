"""Transcribe the voiceover with word timestamps (caption timing + intelligibility check)."""
import json, sys
from faster_whisper import WhisperModel
wav, out = sys.argv[1], sys.argv[2]
m = WhisperModel('small.en', device='cpu', compute_type='int8', download_root='../models/whisper')
import soundfile as sf
from scipy.signal import resample_poly
a, sr = sf.read(wav, dtype='float32')
if a.ndim > 1: a = a.mean(axis=1)
a = resample_poly(a, 16000, sr).astype('float32')
segs, info = m.transcribe(a, word_timestamps=True, beam_size=5, vad_filter=False)
words = []
text = []
for s in segs:
    text.append(s.text)
    for w in s.words:
        words.append({'w': w.word.strip(), 's': round(w.start, 3), 'e': round(w.end, 3), 'p': round(w.probability, 3)})
json.dump({'text': ' '.join(text), 'words': words}, open(out, 'w'), indent=1)
print(' '.join(text))
low = [w for w in words if w['p'] < 0.6]
print('low-confidence words:', [(w['w'], w['s'], w['p']) for w in low])
