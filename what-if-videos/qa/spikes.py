"""Frame QA: find single-frame glitches, big jumps (should only be planned cuts) and dark shards.
usage: python3 -I qa/spikes.py output/<id>/frames"""
import os, sys
import numpy as np
from PIL import Image
d = sys.argv[1]; fs = sorted(f for f in os.listdir(d) if f.endswith('.jpg'))
A = [np.asarray(Image.open(os.path.join(d, f)).convert('L').resize((108, 192))).astype(float) for f in fs]
D = lambda a, b: np.abs(A[a] - A[b]).mean()
iso = sorted(((D(i - 1, i) + D(i, i + 1) - D(i - 1, i + 1), i) for i in range(1, len(A) - 1)), reverse=True)
print('frames', len(A))
print('isolated spikes (frame looks unlike both neighbours; >15 is suspicious):', [(round(s, 1), i, f'{i/30:.2f}s') for s, i in iso[:12]])
big = sorted(((D(i - 1, i), i) for i in range(1, len(A))), reverse=True)
print('largest jumps (should be your cuts):', [(round(s, 1), i, f'{i/30:.2f}s') for s, i in big[:16]])
print('dark shards (>5% near-black pixels):', [i for i, a in enumerate(A) if (a < 12).mean() > 0.05 and a.mean() > 30][:30])
