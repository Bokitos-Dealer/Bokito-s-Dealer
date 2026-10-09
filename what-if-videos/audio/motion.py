"""Motion-driven sound design: sounds built from the motion they accompany, not recorded.

A paper stack flips over: the air whooshes through a band whose centre rides the flip's speed, and
the landing is a slap plus a thump that gets deeper the bigger the stack is. A camera cut gets a
swell that peaks on the cut. The counter races up one pitch step per fold. Hand folds get paper
foley (fibres crackling, a snap, a thumbnail along the crease, a creak under strain, a spring back).

Everything is synthesised from noise and oscillators with a per-cue seed, so a re-render is identical.
Cue fields common to all of them: t / t0,t1 (seconds), level, pan, verb (reverb send), seed, fx (True:
ducked under the voice with the shared effects duck), keys ([[t, gain], ...] absolute time).

Registered into synth.py's CUES at import: flip, sweep, count, rustle, snap, slide, creak, spring,
sparkle, impact, flyby.
"""
import numpy as np
from scipy import signal

SR = 44100
A_MINOR_PENTATONIC = (9, 0, 2, 4, 7)      # A C D E G (the music is in A minor)


def sec(t):
    return int(round(t * SR))


def rng_of(c):
    return np.random.default_rng(int(c.get('seed', 0)) * 7919 + 13)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, min(hi, SR * 0.45)], 'bandpass', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'lowpass', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'highpass', fs=SR, output='sos'), x)


def sweep_bp(x, fc, q=1.4, block=256):
    """Band-pass x with a centre frequency that changes over time (fc: one value per sample)."""
    y = np.empty_like(x)
    zi = np.zeros(2)
    for i in range(0, len(x), block):
        f = float(np.clip(fc[min(i + block // 2, len(x) - 1)], 40.0, SR * 0.45))
        w = 2 * np.pi * f / SR
        al = np.sin(w) / (2 * q)
        b = np.array([al, 0.0, -al]) / (1 + al)
        a = np.array([1.0, -2 * np.cos(w) / (1 + al), (1 - al) / (1 + al)])
        y[i:i + block], zi = signal.lfilter(b, a, x[i:i + block], zi=zi)
    return y


def pan_gains(p):
    p = np.clip(p, -1, 1)
    return np.cos((p + 1) * np.pi / 4) * 1.414, np.sin((p + 1) * np.pi / 4) * 1.414


def to_stereo(x, p0=0.0, p1=None):
    """Mono to stereo; the pan can travel from p0 to p1 over the sound."""
    p = np.full(len(x), p0) if p1 is None else np.linspace(p0, p1, len(x))
    l, r = pan_gains(p)
    return np.stack([x * l, x * r], axis=1)


def norm(x, peak=1.0):
    return x / (np.abs(x).max() + 1e-9) * peak


def fadeio(x, fin=0.004, fout=0.01):
    x = x.copy()
    a, b = min(len(x), sec(fin)), min(len(x), sec(fout))
    if a > 1: x[:a] *= (np.linspace(0, 1, a) if x.ndim == 1 else np.linspace(0, 1, a)[:, None])
    if b > 1: x[-b:] *= (np.linspace(1, 0, b) if x.ndim == 1 else np.linspace(1, 0, b)[:, None])
    return x


def place(m, t, y, c, verb=0.15):
    """Apply keys / level / fade to a rendered (n, 2) sound and add it to the mix at t."""
    if 'keys' in c:
        k = np.array(c['keys'], dtype=float)
        y = y * np.interp(t + np.arange(len(y)) / SR, k[:, 0], k[:, 1])[:, None]
    m.add(t, fadeio(y), c.get('level', 1.0), verb=c.get('verb', verb))


def crackle(r, n, rate, lo=1800, hi=7500, decay=0.0025):
    """Sparse random clicks, each a tiny decaying burst of noise (paper fibres): `rate` per second,
    a number or one value per sample."""
    p = np.asarray(rate, dtype=float) / SR
    imp = (r.random(n) < p) * r.uniform(0.25, 1.0, n)
    burst = signal.lfilter([1.0], [1.0, -np.exp(-1.0 / (decay * SR))], imp)
    return bp(burst * r.standard_normal(n), lo, hi)


def quantize(f, scale=A_MINOR_PENTATONIC):
    """Nearest pitch of the scale (pitch classes) to f Hz."""
    midi = 69 + 12 * np.log2(f / 440.0)
    best = min((m for m in range(int(midi) - 3, int(midi) + 4) if m % 12 in scale), key=lambda m: abs(m - midi))
    return 440.0 * 2 ** ((best - 69) / 12)


# ---------------------------------------------------------------- the flip
def c_flip(m, c):
    """A stack of paper flips over. size 0 (a sheet on a picnic blanket) .. 1 (a thing hundreds of km tall):
    the air whoosh drops in pitch and gains weight with size; the landing is a slap and a thump (and a
    sub boom when it is huge). d = flight time, accent adds a bigger boom on the landing."""
    r = rng_of(c)
    t0, d, size = c['t'], c['d'], float(c.get('size', 0.0))
    acc = float(c.get('accent', 0.0))
    n = sec(d)
    k = np.arange(n) / SR / d
    v = 4 * k * (1 - k)                              # flip speed: zero at both ends, fastest mid-flip
    env = v ** 1.25
    base = 2300 * 2 ** (-1.7 * size)
    fc = base * (0.5 + 1.7 * v)                      # the band rides the speed: up through the middle, down as it settles
    air = np.stack([sweep_bp(r.standard_normal(n), fc, q=2.0), sweep_bp(r.standard_normal(n), fc * 1.04, q=2.0)], axis=1)
    air = norm(air) * env[:, None]
    sgn = c.get('dir', 1)
    pan = c.get('pan', 0.0)
    l, rr = pan_gains(np.linspace(pan - 0.35 * sgn, pan + 0.35 * sgn, n))
    air[:, 0] *= l / 1.414; air[:, 1] *= rr / 1.414
    out = air * 0.85
    if size < 0.7:                                   # paper flutter
        w = (1 - size) ** 1.5
        fl = hp(crackle(r, n, 700, 1500, 9000, 0.0015), 1500) * env
        out += to_stereo(norm(fl, 0.5 * w), pan - 0.1 * sgn, pan + 0.1 * sgn)
    if size > 0.15:                                  # weight
        f = 62 * 2 ** (-0.7 * size) * (0.85 + 0.4 * v)
        sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * (v ** 0.9)
        out += to_stereo(sub * 0.55 * size ** 1.1, pan)
    place(m, t0, out, c, verb=0.12 + 0.25 * size)
    # landing
    if c.get('land', True):
        nl = sec(0.25 + 1.4 * size + 0.8 * acc)
        tl = np.arange(nl) / SR
        slap = bp(r.standard_normal(nl), 450 * 2 ** (-1.5 * size), 3400 * 2 ** (-1.3 * size)) * np.exp(-tl / (0.018 + 0.03 * size))
        f0 = 150 * 2 ** (-2.0 * size)
        thump = np.sin(2 * np.pi * np.cumsum(f0 * (0.55 + 0.45 * np.exp(-tl / 0.05))) / SR) * np.exp(-tl / (0.07 + 0.3 * size))
        land = norm(slap) * 0.8 + norm(thump) * (0.45 + 0.5 * size)
        big = max(0.0, size - 0.35) * 1.3 + acc
        if big > 0:
            sub = np.sin(2 * np.pi * np.cumsum(47 * (1 + 0.55 * np.exp(-tl / 0.14))) / SR) * np.exp(-tl / (0.25 + 0.55 * size + 0.4 * acc))
            land = land + norm(sub) * 0.75 * min(big, 1.0)
            tail = lp(r.standard_normal(nl), 600) * np.exp(-tl / (0.2 + 0.4 * size))
            land = land + norm(tail) * 0.35 * min(big, 1.0)
        lc = dict(c); lc['level'] = c.get('level', 1.0) * (0.55 + 0.6 * size + 0.3 * acc)
        place(m, t0 + d, to_stereo(norm(land, 0.95), pan * 0.5), lc, verb=0.1 + 0.4 * size)


# ---------------------------------------------------------------- a swell into a cut
def c_sweep(m, c):
    """Filtered-noise swell that peaks exactly at t (the cut) and falls away. f = [from, to] Hz (a falling
    pair makes a downward sweep), pre/post = seconds before/after t, hit = a thump on the cut, tone = a
    gliding tone riding the sweep."""
    r = rng_of(c)
    t1 = c['t']
    pre, post = c.get('pre', 0.6), c.get('post', 0.22)
    f0, f1 = c.get('f', [320, 6000])
    n = sec(pre + post)
    tt = np.arange(n) / SR - pre
    k = np.clip((tt + pre) / pre, 0, 1.15)
    fc = f0 * (f1 / f0) ** (np.minimum(k, 1.15) ** 1.2)
    env = np.where(tt < 0, np.clip((tt + pre) / pre, 0, 1) ** c.get('curve', 2.2), np.exp(-np.clip(tt, 0, None) / (post * 0.4)))
    y = np.stack([sweep_bp(r.standard_normal(n), fc, c.get('q', 1.5)), sweep_bp(r.standard_normal(n), fc * 1.03, c.get('q', 1.5))], axis=1)
    y = norm(y) * env[:, None]
    if c.get('tone', 0):
        ph = np.cumsum(fc * 0.5) / SR
        tone = (np.sin(2 * np.pi * ph) + 0.4 * np.sin(4 * np.pi * ph)) * env
        y += to_stereo(tone * c['tone'] * 0.5, 0)
    l, rr = pan_gains(np.linspace(c.get('pan', [-0.5, 0.5])[0], c.get('pan', [-0.5, 0.5])[1], n))
    y[:, 0] *= l / 1.414; y[:, 1] *= rr / 1.414
    place(m, t1 - pre, y, c, verb=c.get('verb', 0.3))
    if c.get('hit', 0):
        nh = sec(0.5)
        th = np.arange(nh) / SR
        body = np.sin(2 * np.pi * np.cumsum(46 + 70 * np.exp(-th / 0.07)) / SR) * np.exp(-th / 0.2)
        click = bp(r.standard_normal(nh), 900, 5000) * np.exp(-th / 0.012)
        h = norm(body) * 0.9 + norm(click) * 0.35
        hc = dict(c); hc['level'] = c.get('level', 1.0) * c['hit']
        place(m, t1, to_stereo(norm(h, 0.95), 0), hc, verb=0.2)


# ---------------------------------------------------------------- the counter
def c_count(m, c):
    """The counter races from `from` to `to` folds between t0 and t1. A tone glides up half a semitone per fold, one
    ping per fold lands on a note of the music's scale, and a bell arrives on the last fold."""
    r = rng_of(c)
    t0, t1 = c['t0'], c['t1']
    a, b = c['from'], c['to']
    f_of = lambda nfold: c.get('f0', 220.0) * 2 ** ((nfold - 30) * c.get('semi', 0.5) / 12)
    n = sec(t1 - t0 + 0.6)
    tt = np.arange(n) / SR
    k = np.clip(tt / (t1 - t0), 0, 1)
    nf = a + (b - a) * k
    f = f_of(nf)
    swell = (k ** 0.7) * np.clip((t1 - t0 + 0.05 - tt) / 0.25, 0, 1)
    ph = np.cumsum(f) / SR
    tone = (np.sin(2 * np.pi * ph) + 0.35 * np.sin(4 * np.pi * ph + 0.4) + 0.12 * np.sin(6 * np.pi * ph)) * swell
    shimmer = sweep_bp(r.standard_normal(n), f * 5, 3.0) * swell * 0.5
    y = to_stereo(norm(tone + shimmer, 0.55), -0.1, 0.1)
    # one ping per fold
    for i, nfold in enumerate(range(a + 1, b + 1)):
        tp = (nfold - a) / (b - a) * (t1 - t0)
        fp = quantize(f_of(nfold) * 2)
        npg = sec(0.16)
        tg = np.arange(npg) / SR
        ping = (np.sin(2 * np.pi * fp * tg) + 0.3 * np.sin(2 * np.pi * fp * 2.01 * tg)) * np.exp(-tg / 0.045)
        i0 = sec(tp)
        g = to_stereo(ping, 0.3 if i % 2 else -0.3) * (0.28 + 0.2 * k[min(i0, n - 1)])
        j = min(n, i0 + npg)
        if j > i0: y[i0:j] += g[: j - i0]
    # the bell on the last fold
    fb = quantize(f_of(b))
    nb = sec(0.55)
    tb = np.arange(nb) / SR
    bell = sum(np.sin(2 * np.pi * fb * rt * tb) * am * np.exp(-tb / dc) for rt, am, dc in [(1, 1.0, 0.35), (2.0, 0.5, 0.25), (3.01, 0.3, 0.18), (4.2, 0.12, 0.12)])
    i0 = sec(t1 - t0)
    j = min(n, i0 + nb)
    y[i0:j] += to_stereo(norm(bell, 0.5), 0)[: j - i0]
    place(m, t0, y, c, verb=c.get('verb', 0.3))


# ---------------------------------------------------------------- paper foley
def c_rustle(m, c):
    """Paper rustling as it is lifted / carried: fibres crackling, quickening, with a breath of hiss."""
    r = rng_of(c)
    t0, t1 = c['t0'], c['t1']
    n = sec(t1 - t0)
    k = np.arange(n) / n
    env = np.sin(np.pi * k) ** 0.8
    rate = c.get('rate', [60, 170])
    cr = [crackle(r, n, np.linspace(rate[0], rate[1], n), 1800, 8000, 0.002) for _ in range(2)]
    hiss = bp(r.standard_normal(n), 3000, 9000) * 0.12
    y = np.stack([cr[0] + hiss, cr[1] + hiss * 0.9], axis=1)
    y = norm(y) * env[:, None]
    place(m, t0, y * 0.9, c, verb=0.08)


def c_snap(m, c):
    """Paper laid down flat: a pat of air, a click of fibres, a soft thump on the table. size 0..1 for heavier blocks."""
    r = rng_of(c)
    size = float(c.get('size', 0.0))
    n = sec(0.28 + 0.4 * size)
    tt = np.arange(n) / SR
    click = bp(r.standard_normal(n), 1200, 6500) * np.exp(-tt / 0.006)
    pat = bp(r.standard_normal(n), 300, 2200) * np.exp(-tt / (0.022 + 0.02 * size))
    thump = np.sin(2 * np.pi * np.cumsum(170 * 2 ** (-1.2 * size) * (0.5 + 0.5 * np.exp(-tt / 0.04))) / SR) * np.exp(-tt / (0.06 + 0.12 * size))
    y = norm(click) * 0.55 + norm(pat) * 0.7 + norm(thump) * (0.35 + 0.35 * size)
    place(m, c['t'], to_stereo(norm(y, 0.95), c.get('pan', 0.0)), c, verb=0.1)


def c_slide(m, c):
    """A thumb or palm pressed along a crease: a rising 'zzzip' of fine noise."""
    r = rng_of(c)
    t0, t1 = c['t0'], c['t1']
    n = sec(t1 - t0)
    k = np.arange(n) / n
    fc = 1500 * (3800 / 1500) ** k
    y = sweep_bp(r.standard_normal(n), fc, 2.2) + crackle(r, n, 90, 2500, 8000, 0.0015) * 0.6
    env = np.clip(k / 0.12, 0, 1) * np.clip((1 - k) / 0.25, 0, 1)
    place(m, t0, to_stereo(norm(y) * env, c.get('pan', 0.0) - 0.15, c.get('pan', 0.0) + 0.15), c, verb=0.08)


def c_creak(m, c):
    """Paper straining against a hand: a wavering resonance (the fibres give), crackles that quicken as it holds."""
    r = rng_of(c)
    t0, t1 = c['t0'], c['t1']
    n = sec(t1 - t0)
    tt = np.arange(n) / SR
    k = tt / (t1 - t0)
    wob = np.interp(np.arange(n), np.linspace(0, n, max(4, int((t1 - t0) * 7)) + 1), r.uniform(-1, 1, max(4, int((t1 - t0) * 7)) + 1))
    fc = 380 + 330 * wob + 420 * k ** 1.5
    am = 0.55 + 0.45 * np.sin(2 * np.pi * (6 + 7 * k) * tt)
    cr = crackle(r, n, 25 + 130 * k ** 2, 1600, 6500, 0.002)
    y = sweep_bp(r.standard_normal(n), fc, 7.0) * am * (0.25 + 0.75 * k) * 0.8 + cr * (0.3 + 0.7 * k)
    env = np.clip(tt / 0.1, 0, 1) * np.clip((t1 - t0 - tt) / 0.06, 0, 1)
    place(m, t0, to_stereo(norm(y) * env, c.get('pan', 0.0)), c, verb=0.1)


def c_spring(m, c):
    """The paper springing back: a quick falling squeal and a soft flap."""
    r = rng_of(c)
    n = sec(0.4)
    tt = np.arange(n) / SR
    fc = 3600 * (450 / 3600) ** np.clip(tt / 0.18, 0, 1)
    sq = sweep_bp(r.standard_normal(n), fc, 3.0) * np.exp(-tt / 0.07)
    boing = np.sin(2 * np.pi * np.cumsum(330 * (0.5 + 0.5 * np.exp(-tt / 0.05))) / SR) * np.exp(-tt / 0.09) * 0.4
    flap = bp(r.standard_normal(n), 400, 2500) * np.exp(-tt / 0.03)
    place(m, c['t'], to_stereo(norm(norm(sq) * 0.8 + boing + norm(flap) * 0.4, 0.95), c.get('pan', 0.0)), c, verb=0.12)


# ---------------------------------------------------------------- magic, impact, fly-by
def c_sparkle(m, c):
    """A run of bright pings up the music's scale: the 'what if you could keep going' lift."""
    r = rng_of(c)
    t0, dur = c['t'], c.get('dur', 0.9)
    cnt = c.get('count', 12)
    n = sec(dur + 0.9)
    y = np.zeros((n, 2))
    notes = [quantize(f) for f in np.geomspace(c.get('f', [880, 5200])[0], c.get('f', [880, 5200])[1], cnt)]
    for i, fq in enumerate(notes):
        tp = dur * (i / cnt) ** 0.85 + r.uniform(0, 0.02)
        ng = sec(0.5)
        tg = np.arange(ng) / SR
        ping = (np.sin(2 * np.pi * fq * tg) + 0.25 * np.sin(2 * np.pi * fq * 3.0 * tg)) * np.exp(-tg / 0.13)
        i0 = sec(tp)
        g = to_stereo(ping, r.uniform(-0.6, 0.6)) * (0.35 + 0.65 * i / cnt)
        j = min(n, i0 + ng)
        y[i0:j] += g[: j - i0]
    place(m, t0, norm(y, 0.8), c, verb=0.5)


def c_impact(m, c):
    """The big hit: a sub drop, a body thump, a crack, a long dark tail, a glassy air."""
    r = rng_of(c)
    n = sec(c.get('dur', 2.2))
    tt = np.arange(n) / SR
    sub = np.sin(2 * np.pi * np.cumsum(34 + 62 * np.exp(-tt / 0.16)) / SR) * np.exp(-tt / 0.6)
    body = np.sin(2 * np.pi * np.cumsum(60 + 110 * np.exp(-tt / 0.05)) / SR) * np.exp(-tt / 0.2)
    crack = bp(r.standard_normal(n), 700, 7000) * np.exp(-tt / 0.03)
    tail = lp(r.standard_normal(n), 900) * np.exp(-tt / 0.4)
    air = sum(np.sin(2 * np.pi * fq * tt + r.uniform(0, 6.28)) * np.exp(-tt / dc) for fq, dc in [(1760, 0.9), (2637, 0.6), (3520, 0.45), (4699, 0.3)]) * 0.12
    y = norm(sub) * 0.9 + norm(body) * 0.7 + norm(crack) * 0.55 + norm(tail) * 0.45 + air
    y = np.tanh(y * 1.2)
    place(m, c['t'], to_stereo(norm(y, 0.97), 0), c, verb=0.45)


def c_flyby(m, c):
    """A jet passing: the band falls through the doppler shift, a faint whine glides down with it."""
    r = rng_of(c)
    t0, d = c['t'], c.get('dur', 2.6)
    n = sec(d)
    k = np.arange(n) / n
    s = k * k * (3 - 2 * k)
    fc = 1900 * (650 / 1900) ** s
    env = np.sin(np.pi * k) ** 2.2
    y = np.stack([sweep_bp(r.standard_normal(n), fc, 2.6), sweep_bp(r.standard_normal(n), fc * 1.02, 2.6)], axis=1)
    whine = np.sin(2 * np.pi * np.cumsum(260 * (150 / 260) ** s) / SR) * 0.18
    y = norm(y) * env[:, None]
    y += to_stereo(whine * env, 0)
    l, rr = pan_gains(np.linspace(c.get('pan', [-0.7, 0.7])[0], c.get('pan', [-0.7, 0.7])[1], n))
    y[:, 0] *= l / 1.414; y[:, 1] *= rr / 1.414
    place(m, t0, y, c, verb=0.3)


CUES = dict(flip=c_flip, sweep=c_sweep, count=c_count, rustle=c_rustle, snap=c_snap, slide=c_slide, creak=c_creak,
            spring=c_spring, sparkle=c_sparkle, impact=c_impact, flyby=c_flyby)
