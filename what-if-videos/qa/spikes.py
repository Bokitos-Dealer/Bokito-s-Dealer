"""Flag sudden frame-to-frame jumps away from shot cuts (popping lights, flicker, a limb snapping round).

usage: python3 qa/spikes.py output/<id>/frames cuts.json
cuts.json: {"cuts": [shot start times, s], "HERE": s}  (node qa/cuts.mjs <scenario> writes it)
"""
import numpy as np, glob, sys, os, json
from PIL import Image

spec = json.load(open(sys.argv[2]))
cuts = spec['cuts'] + ([spec['HERE']] if 'HERE' in spec else [])
fs = {int(os.path.basename(f)[:5]): f for f in glob.glob(sys.argv[1] + '/*.jpg')}
small = {}
def get(i):
    if i not in small: small[i] = np.asarray(Image.open(fs[i]).convert('L').resize((108, 192)), dtype=np.float32)
    return small[i]
d = {i: np.abs(get(i) - get(i - 1)).mean() for i in sorted(fs) if i - 1 in fs}
print('frames', len(fs), 'pairs', len(d))
for i in sorted(d):
    t = i / 30
    if any(abs(t - c) < 0.07 for c in cuts): continue
    nb = [d[j] for j in range(i - 6, i + 7) if j != i and j in d]
    if not nb: continue
    med = np.median(nb) + 0.3
    if d[i] > 3 * med and d[i] > 2.0: print(f"spike t={t:.2f} frame {i} diff {d[i]:.1f} (neighbour median {med:.1f})")
