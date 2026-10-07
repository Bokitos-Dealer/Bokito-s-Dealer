"""Prepare plates: upscale shots to 1080x1920, depth maps, and the moonless hook plate."""
import os, sys, glob
import numpy as np
from PIL import Image, ImageFilter
import onnxruntime as ort
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS, OUT = os.path.join(HERE, 'shots'), os.path.join(HERE, 'plates')
sess = ort.InferenceSession(os.path.join(HERE, '..', 'models', 'depth_anything_v2_small.onnx'), providers=['CPUExecutionProvider'])

def depth(img):
    w, h = 518, 924  # multiples of 14, ~9:16
    x = np.asarray(img.convert('RGB').resize((w, h), Image.BICUBIC), dtype=np.float32) / 255.0
    x = (x - np.array([0.485, 0.456, 0.406])) / np.array([0.229, 0.224, 0.225])
    x = x.transpose(2, 0, 1)[None].astype(np.float32)
    d = sess.run(None, {'pixel_values': x})[0][0]
    d = (d - d.min()) / (d.max() - d.min() + 1e-6)          # 1 = near, 0 = far (relative inverse depth)
    d = ndimage.gaussian_filter(d, 1.2)
    return Image.fromarray((d * 255).astype(np.uint8)).resize((540, 960), Image.BICUBIC)

for f in sorted(glob.glob(os.path.join(SHOTS, '*.png'))):
    name = os.path.splitext(os.path.basename(f))[0]
    im = Image.open(f).convert('RGB')
    big = im.resize((1080, 1935), Image.LANCZOS).crop((0, 7, 1080, 1927))  # 768x1376 -> 1080x1920
    big = big.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
    big.save(os.path.join(OUT, name + '.jpg'), quality=95)
    depth(big).save(os.path.join(OUT, name + '_depth.png'))
    print('plate', name)
