"""Build the moonless version of the hook plate: remove disc + halo, dim the moon path on the water."""
import numpy as np
from PIL import Image
from scipy import ndimage

im = np.asarray(Image.open('plates/moon_city.jpg').convert('RGB'), dtype=np.float32) / 255.0
H, W, _ = im.shape
lum = im @ np.array([0.299, 0.587, 0.114])

# --- locate the moon: largest bright blob in the upper part
bright = (lum > 0.55)
bright[int(H * 0.5):] = False
lab, n = ndimage.label(bright)
sizes = ndimage.sum(bright, lab, range(1, n + 1))
k = int(np.argmax(sizes)) + 1
ys, xs = np.where(lab == k)
# bounding-box centre/radius: the bottom may be hidden behind a tower, so use top/left/right
R = (xs.max() - xs.min()) / 2 + 2
cx = (xs.max() + xs.min()) / 2
cy = ys.min() + R - 2
print('moon at', round(cx), round(cy), 'radius', round(R))

yy, xx = np.mgrid[0:H, 0:W]
rr = np.hypot(xx - cx, yy - cy)

# --- skyline: per column, first row (from top) below the moon that is "building" (bright windows or opaque).
# sky is smooth & dark-blue; mark sky as pixels whose local variance is low and are above the waterline.
water_y = None
row_mean = lum.mean(axis=1)
# waterline: strongest dark->texture change below the city lights band; use known band from layout
water_y = int(H * 0.565)
sky = np.zeros((H, W), bool)
blur = ndimage.gaussian_filter(lum, 2)
var = ndimage.gaussian_filter((lum - blur) ** 2, 3)
sky[:water_y] = (var[:water_y] < 0.0004)
# the moon disc itself is "sky" for our purposes (we will replace it); buildings inside the disc are not
inside = rr < R + 8
# towers can only overlap the lower part of the disc; everything else inside is moon
tower = (lum < 0.3) & (yy > cy + 0.55 * R)
moon_px = inside & ~tower
sky |= moon_px
sky = ndimage.binary_opening(sky, iterations=2)

# --- background for the sky: low-order polynomial fit to clean sky around the moon
fit = sky & (rr > R * 2.0) & (rr < R * 5.5) & (yy < water_y - 40)
fy, fx = np.where(fit)
sel = np.random.default_rng(0).choice(len(fy), size=min(40000, len(fy)), replace=False)
fy, fx = fy[sel], fx[sel]
def basis(x, y):
    x = (x - cx) / (R * 4); y = (y - cy) / (R * 4)
    return np.stack([np.ones_like(x), x, y, x*x, x*y, y*y, x**3, x*x*y, x*y*y, y**3], axis=-1)
A = basis(fx.astype(np.float64), fy.astype(np.float64))
bg = np.zeros_like(im)
Bfull = basis(xx.astype(np.float64), yy.astype(np.float64))
for c in range(3):
    coef, *_ = np.linalg.lstsq(A, im[fy, fx, c], rcond=None)
    bg[..., c] = (Bfull @ coef).astype(np.float32)
# halo = what the moon added to the sky around it; remove it (only on sky pixels), and fully replace the disc
out = im.copy()
halo_mask = sky & (rr < R * 3.2)
t_ = np.clip((rr - R * 2.0) / (R * 1.2), 0, 1)
fade = t_ * t_ * (3 - 2 * t_)  # full sky replacement inside 2R, blending out by 3.2R
for c in range(3):
    ch = out[..., c]
    rep = bg[..., c] + (ch - bg[..., c]) * 0.0
    soft = np.clip(1 - fade, 0, 1)
    ch[halo_mask] = (ch * (1 - soft) + bg[..., c] * soft)[halo_mask]
    edge = np.clip((R + 8 - rr) / 4.0, 0, 1)  # feather the last 4 px
    blend = np.where(moon_px, edge, 0)
    ch[:] = ch * (1 - blend) + bg[..., c] * blend
# buildings near the moon were lit by its glow: dim them slightly
near_build = (~sky) & (~moon_px) & (rr < R * 2.2) & (yy < water_y)
out[near_build] *= (0.88 + 0.12 * np.clip((rr[near_build] - R) / (R * 1.2), 0, 1))[:, None]

# a few faint stars in the replaced sky
rng = np.random.default_rng(3)
for _ in range(90):
    x, y = rng.integers(0, W), rng.integers(0, water_y - 60)
    if sky[y, x] and rr[y, x] < R * 3.2:
        b = rng.uniform(0.15, 0.45)
        out[y, x] = np.clip(out[y, x] + b, 0, 1)

# --- the moon path on the water: compress highlights in a soft column under the moon
col = np.exp(-((xx - cx) / (R * 1.25)) ** 2) * (yy > water_y)
row_med = np.median(np.where(np.abs(xx - cx) > R * 2.2, lum, np.nan)[water_y:], axis=1) if False else None
water = im[water_y:]
# local water level estimated from columns away from the path
side = np.concatenate([water[:, : int(max(1, cx - R * 2.4))], water[:, int(min(W - 1, cx + R * 2.4)):int(min(W, cx + R * 3.2))]], axis=1)
level = np.median(side, axis=1)  # per-row RGB
lev = np.broadcast_to(level[:, None, :], water.shape)
k = col[water_y:][..., None]
excess = np.clip(water - lev, 0, None)
out[water_y:] = water - excess * k * 0.88
Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save('plates/moon_city_nomoon.jpg', quality=95)
# moon matte for the vanish effect (disc + halo strength)
matte = np.clip(1.15 - rr / (R * 1.05), 0, 1)
Image.fromarray((matte * 255).astype(np.uint8)).save('plates/moon_city_matte.png')
print('saved; water_y', water_y)
