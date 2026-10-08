"""Procedural sound design for What-If episodes.

Reads the scenario's audio cue list from meta.json and renders a stereo WAV:
ambience beds, a tension drone, impacts, electrical zaps, water, wind, glass,
and the end-card chime. No samples: everything is synthesised from noise and
oscillators, so every episode can be re-rendered from its timeline.

usage: python3 synth.py output/<id>/meta.json output/<id>/audio.wav
"""
import json
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
rng = np.random.default_rng(7)


# ---------------------------------------------------------------- helpers
def sec(t):
    return int(round(t * SR))


def white(n):
    return rng.standard_normal(n)


def pink(n):
    # Voss-McCartney-ish via filtering white noise (-3 dB/oct)
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, white(n)) * 8


def brown(n):
    x = np.cumsum(white(n))
    x = signal.sosfilt(signal.butter(1, 15, 'hp', fs=SR, output='sos'), x)
    return x / (np.abs(x).max() + 1e-9)


def filt(x, kind, f, order=2):
    if kind == 'bp':
        return signal.sosfilt(signal.butter(order, f, 'bandpass', fs=SR, output='sos'), x)
    return signal.sosfilt(signal.butter(order, f, kind, fs=SR, output='sos'), x)


def env_keys(n, t0, keys):
    """Envelope over n samples starting at t0 from [[t, v], ...] keyframes."""
    t = t0 + np.arange(n) / SR
    k = np.array(keys, dtype=float)
    return np.interp(t, k[:, 0], k[:, 1])


def adsr(n, a=0.01, r=None, curve=4.0):
    e = np.ones(n)
    na = max(1, sec(a))
    e[:na] = np.linspace(0, 1, na)
    if r is None:
        e[na:] = np.exp(-curve * np.linspace(0, 1, n - na))
    return e


def fade(x, fin=0.0, fout=0.0):
    n = len(x)
    shape = (-1, 1) if x.ndim == 2 else (-1,)
    if fin > 0:
        k = min(n, sec(fin)); x[:k] *= np.linspace(0, 1, k).reshape(shape)
    if fout > 0:
        k = min(n, sec(fout)); x[-k:] *= np.linspace(1, 0, k).reshape(shape)
    return x


def lfo(n, rate, depth, phase=0.0, base=1.0):
    t = np.arange(n) / SR
    return base + depth * np.sin(2 * np.pi * rate * t + phase)


def slow_noise(n, rate, seed=0):
    """Smooth random modulation in [-1, 1]."""
    r = np.random.default_rng(seed)
    pts = max(4, int(n / SR * rate) + 4)
    v = r.uniform(-1, 1, pts)
    x = np.linspace(0, pts - 3, n)
    return np.interp(x, np.arange(pts), v)


def saw(freq, n, detune=0.0):
    t = np.arange(n) / SR
    f = freq * (1 + detune)
    return 2 * ((t * f) % 1.0) - 1


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


class Mix:
    def __init__(self, dur):
        self.n = sec(dur) + SR
        self.dry = np.zeros((self.n, 2))
        self.send = np.zeros((self.n, 2))

    def add(self, t, x, gain=1.0, pan=0.0, verb=0.2):
        if x.ndim == 1:
            l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
            x = np.stack([x * l * 1.414, x * r * 1.414], axis=1)
        i = sec(t)
        if i < 0:
            x = x[-i:]; i = 0
        j = min(self.n, i + len(x))
        if j <= i:
            return
        self.dry[i:j] += x[: j - i] * gain
        self.send[i:j] += x[: j - i] * gain * verb


def reverb_ir(rt=3.2, pre=0.02, bright=3500):
    n = sec(rt)
    t = np.arange(n) / SR
    decay = np.exp(-6.9 * t / rt)
    ir = np.stack([filt(white(n), 'lp', bright) * decay, filt(white(n), 'lp', bright) * decay], axis=1)
    ir[: sec(pre)] = 0
    return ir / np.sqrt((ir ** 2).sum(axis=0))


# ---------------------------------------------------------------- cues
def c_ambience(m, c):
    t0, t1, kind = c['t0'], c['t1'], c['kind']
    n = sec(t1 - t0)
    lvl = c.get('level', 0.5)
    out = np.zeros((n, 2))
    wind = filt(pink(n), 'lp', 700) * (0.55 + 0.45 * slow_noise(n, 0.15, 1))
    wind2 = filt(pink(n), 'lp', 700) * (0.55 + 0.45 * slow_noise(n, 0.15, 2))
    if kind in ('night-city', 'day-city'):
        hum = filt(brown(n), 'lp', 180) * 1.4
        hiss = filt(pink(n), 'bp', [250, 1800]) * 0.12
        out[:, 0] += hum + hiss + wind * 0.25
        out[:, 1] += hum + filt(pink(n), 'bp', [250, 1800]) * 0.12 + wind2 * 0.25
        # passing cars
        r = np.random.default_rng(3)
        tt = r.uniform(0.5, 4)
        while tt < (t1 - t0) - 3:
            ln = sec(r.uniform(2.5, 4.5))
            e = np.hanning(ln) ** 2
            car = filt(white(ln), 'bp', [r.uniform(120, 200), r.uniform(700, 1400)]) * e * r.uniform(0.15, 0.35)
            pan = np.linspace(r.uniform(-1, 0), r.uniform(0, 1), ln) * (1 if r.random() < .5 else -1)
            i = sec(tt)
            j = min(n, i + ln)
            out[i:j, 0] += (car * np.cos((pan + 1) * np.pi / 4))[: j - i]
            out[i:j, 1] += (car * np.sin((pan + 1) * np.pi / 4))[: j - i]
            tt += r.uniform(2.0, 6.0)
        if kind == 'day-city':
            out += birds(n, 0.08)[:, None] * np.array([0.8, 1.0])
    elif kind == 'night-quiet':
        out[:, 0] += wind * 0.7; out[:, 1] += wind2 * 0.7
        out += crickets(n, 0.05)
    elif kind == 'coast':
        surf = filt(pink(n), 'lp', 1800) * (0.5 + 0.5 * np.clip(np.sin(2 * np.pi * np.arange(n) / SR / 7.5) * 1.3, -1, 1)) ** 2
        out[:, 0] += surf * 0.6 + wind * 0.3
        out[:, 1] += filt(pink(n), 'lp', 1800) * (0.5 + 0.5 * np.clip(np.sin(2 * np.pi * np.arange(n) / SR / 7.5 + 1.2) * 1.3, -1, 1)) ** 2 * 0.6 + wind2 * 0.3
        if c.get('gulls', 0.12) > 0:
            out += gulls(n, c.get('gulls', 0.12))
    elif kind == 'wind':
        out[:, 0] += wind; out[:, 1] += wind2
    elif kind == 'underwater':
        rumble = filt(brown(n), 'lp', 220)
        out[:, 0] += rumble; out[:, 1] += filt(brown(n), 'lp', 220)
        out += bubbles(n, 0.25)
    out = out / (np.abs(out).max() + 1e-9)
    e = np.ones(n)
    k = sec(min(1.5, (t1 - t0) / 3)); e[:k] = np.linspace(0, 1, k); e[-k:] = np.linspace(1, 0, k)
    if 'swell' in c:
        e *= env_keys(n, t0, c['swell'])
    m.add(t0, out * e[:, None], lvl, verb=0.15)


def birds(n, density):
    out = np.zeros(n)
    r = np.random.default_rng(11)
    t = 0.0
    while t < n / SR - 1:
        f0 = r.uniform(2500, 4500)
        for k in range(r.integers(2, 5)):
            ln = sec(r.uniform(0.05, 0.12))
            tt = np.arange(ln) / SR
            f = f0 * (1 + 0.25 * np.sin(2 * np.pi * r.uniform(15, 30) * tt))
            chirp = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.hanning(ln) * r.uniform(0.05, 0.12)
            i = sec(t + k * 0.13)
            if i + ln < n:
                out[i:i + ln] += chirp
        t += r.exponential(1 / density) if density > 0 else 1e9
    return out


def gulls(n, density):
    out = np.zeros((n, 2))
    r = np.random.default_rng(12)
    t = r.uniform(1, 4)
    while t < n / SR - 2:
        for k in range(r.integers(1, 4)):
            ln = sec(r.uniform(0.25, 0.45))
            tt = np.arange(ln) / SR
            f = np.linspace(r.uniform(1300, 1600), r.uniform(800, 1000), ln)
            ph = 2 * np.pi * np.cumsum(f) / SR
            call = (np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)) * np.hanning(ln) ** 0.7 * r.uniform(0.03, 0.07)
            p = r.uniform(-0.8, 0.8)
            i = sec(t + k * 0.42)
            if i + ln < n:
                out[i:i + ln, 0] += call * np.cos((p + 1) * np.pi / 4)
                out[i:i + ln, 1] += call * np.sin((p + 1) * np.pi / 4)
        t += r.exponential(1 / density)
    return out


def crickets(n, level):
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for k, (f, rate, ph) in enumerate([(4300, 2.7, 0.0), (4700, 3.1, 1.0), (3900, 2.2, 2.0)]):
        gate = (np.sin(2 * np.pi * rate * t + ph) > 0.55).astype(float)
        gate = filt(gate, 'lp', 60)
        trill = np.sin(2 * np.pi * f * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 45 * t))
        out[:, k % 2] += trill * gate * level
    return out


def bubbles(n, density):
    out = np.zeros((n, 2))
    r = np.random.default_rng(21)
    t = 0.0
    while t < n / SR - 0.3:
        ln = sec(r.uniform(0.04, 0.12))
        tt = np.arange(ln) / SR
        f = r.uniform(300, 1200) * (1 + tt * 6)
        b = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 40) * r.uniform(0.05, 0.2)
        p = r.uniform(-1, 1); i = sec(t)
        out[i:i + ln, 0] += b * np.cos((p + 1) * np.pi / 4); out[i:i + ln, 1] += b * np.sin((p + 1) * np.pi / 4)
        t += r.exponential(1 / (density * 20))
    return out


def c_drone(m, c):
    t0, t1 = c['t0'], c['t1']
    n = sec(t1 - t0)
    root = c.get('root', 45)
    swell = env_keys(n, t0, c.get('swell', [[t0, 1], [t1, 1]]))
    chord = c.get('chord', [0, 3, 7, 12])
    dark = np.zeros(n); bright = np.zeros(n)
    for iv in chord:
        f = mtof(root + iv)
        for d in (-0.004, 0.0, 0.0045):
            s = saw(f, n, d)
            dark += s; bright += s
    sub = np.sin(2 * np.pi * mtof(root - 12) * np.arange(n) / SR)
    dark = filt(dark, 'lp', 380, 2) * 0.25
    bright = filt(bright, 'lp', 2200, 2) * 0.12
    x = dark * swell + bright * swell ** 2.2 + sub * 0.35 * swell
    x *= lfo(n, 0.07, 0.12)
    st = np.stack([x, np.roll(x, sec(0.013))], axis=1)
    st = st / (np.abs(st).max() + 1e-9)
    m.add(t0, fade(st, 2.0, 1.5), c.get('level', 0.35), verb=0.5)


def c_boom(m, c):
    n = sec(5.0)
    t = np.arange(n) / SR
    f = 30 + 70 * np.exp(-t * 2.2)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 0.9)
    crack = filt(white(n), 'lp', 900 if c.get('low') else 3000) * np.exp(-t * 4.0)
    x = body + crack * 0.6
    x = np.tanh(x * 1.6)
    m.add(c['t'] + c.get('delay', 0), x / (np.abs(x).max() + 1e-9), c.get('level', 0.7), verb=0.35)


def c_shimmer(m, c):
    t0, t1 = c['t0'], c['t1']
    n = sec(t1 - t0)
    t = np.arange(n) / SR
    swell = env_keys(n, t0, c.get('swell', [[t0, 1], [t1, 1]]))
    base = c.get('root', 73)
    x = np.zeros(n)
    for k, iv in enumerate([0, 7, 12, 14, 19, 24]):
        f = mtof(base + iv)
        trem = 0.5 + 0.5 * np.sin(2 * np.pi * (0.11 + 0.03 * k) * t + k)
        x += np.sin(2 * np.pi * f * t * (1 + 0.0007 * np.sin(2 * np.pi * 0.2 * t + k))) * trem / (1 + k * 0.4)
    air = filt(pink(n), 'bp', [2500, 7000]) * 0.15 * (0.5 + 0.5 * slow_noise(n, 0.3, 5))
    x = x * 0.06 + air * 1.3
    st = np.stack([x, np.roll(x, sec(0.021))], axis=1) * swell[:, None]
    st = st / (np.abs(st).max() + 1e-9)
    m.add(t0, fade(st, 2.5, 2.0), c.get('level', 0.3), verb=0.9)


def c_flicker(m, c):
    t0, t1 = c['t0'], c['t1']
    n = sec(t1 - t0)
    t = np.arange(n) / SR
    buzz = np.sign(np.sin(2 * np.pi * 120 * t)) * 0.5 + np.sin(2 * np.pi * 240 * t) * 0.3
    buzz = filt(buzz, 'bp', [100, 3000])
    gate = (slow_noise(n, 14, 9) > -0.1).astype(float)
    gate = filt(gate, 'lp', 80)
    x = buzz * gate
    m.add(t0, fade(x / (np.abs(x).max() + 1e-9), 0.3, 0.3), c.get('level', 0.25), pan=0.2, verb=0.3)


def c_zap(m, c):
    """Transformer blowout: electrical arc crackle, then a heavy pop/boom."""
    lvl = c.get('level', 0.7)
    dist = c.get('dist', 1.0)
    n = sec(4.0)
    t = np.arange(n) / SR
    # arc: dense random impulses with a 60 Hz buzz, very short
    arc_n = sec(0.45)
    imp = (rng.random(arc_n) < 0.06).astype(float) * rng.uniform(-1, 1, arc_n)
    arc = filt(imp, 'bp', [1500, 9000]) * 2.5 + np.sign(np.sin(2 * np.pi * 120 * t[:arc_n])) * 0.25
    arc *= np.linspace(1, 0.2, arc_n)
    boom = np.sin(2 * np.pi * np.cumsum(40 + 90 * np.exp(-t * 6)) / SR) * np.exp(-t * 2.2)
    noise = filt(white(n), 'lp', 1500 if dist > 0.5 else 4000) * np.exp(-t * 3.5)
    x = boom * 0.9 + noise * 0.8
    x[:arc_n] += arc * (0.6 if dist > 0.5 else 1.0)
    if dist > 0.5:
        x = filt(x, 'lp', 2500)
    x = np.tanh(x * 1.4)
    pan = float(np.clip(c.get('pan', rng.uniform(-0.6, 0.6)), -1, 1))
    m.add(c['t'] + c.get('delay', 0.0), x / (np.abs(x).max() + 1e-9), lvl, pan=pan, verb=0.45)


def c_powerdown(m, c):
    n = sec(3.5)
    t = np.arange(n) / SR
    f = 120 * np.exp(-t * 0.9) + 25
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph)) * np.exp(-t * 1.1)
    thunk = filt(white(sec(0.3)), 'lp', 400) * np.exp(-np.arange(sec(0.3)) / SR * 18)
    x[: len(thunk)] += thunk * 1.5
    m.add(c['t'], x / (np.abs(x).max() + 1e-9), c.get('level', 0.6), verb=0.4)


def c_chime(m, c):
    n = sec(7.0)
    t = np.arange(n) / SR
    f0 = c.get('freq', 659.25)
    x = np.zeros(n)
    for ratio, amp, dec in [(1, 1.0, 1.2), (2.76, 0.45, 2.2), (5.4, 0.25, 3.5), (8.93, 0.12, 5.0), (0.5, 0.35, 0.9)]:
        x += np.sin(2 * np.pi * f0 * ratio * t) * amp * np.exp(-t * dec)
    att = np.minimum(1, t / 0.004)
    x *= att
    pad = np.zeros(n)
    for iv in (0, 7, 12):
        pad += np.sin(2 * np.pi * f0 / 4 * 2 ** (iv / 12) * t)
    pad *= np.minimum(1, t / 1.2) * np.exp(-t * 0.35) * 0.25
    y = x + pad
    m.add(c['t'], y / (np.abs(y).max() + 1e-9), c.get('level', 0.5), verb=0.7)


def c_rumble(m, c):
    """Sustained low rumble (earth, water, wind pressure) following a swell curve."""
    t0, t1 = c['t0'], c['t1']
    n = sec(t1 - t0)
    swell = env_keys(n, t0, c.get('swell', [[t0, 1], [t1, 1]]))
    x = np.stack([filt(brown(n), 'lp', c.get('cut', 140)), filt(brown(n), 'lp', c.get('cut', 140))], axis=1)
    x += np.stack([filt(pink(n), 'bp', [200, 1200]), filt(pink(n), 'bp', [200, 1200])], axis=1) * c.get('grit', 0.15)
    x = x / (np.abs(x).max() + 1e-9)
    m.add(t0, fade(x * swell[:, None], 0.8, 0.8), c.get('level', 0.5), verb=0.2)


def c_whoosh(m, c):
    d = c.get('dur', 1.6)
    n = sec(d)
    t = np.arange(n) / SR
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    x = white(n)
    lo = filt(x, 'bp', [300, 1200]); hi = filt(x, 'bp', [1500, 5000])
    k = t / d
    y = lo * (1 - k) + hi * k if c.get('rise', True) else lo * k + hi * (1 - k)
    m.add(c['t'], y * e / (np.abs(y * e).max() + 1e-9), c.get('level', 0.4), pan=c.get('pan', 0), verb=0.3)


def c_glass(m, c):
    n = sec(2.5)
    t = np.arange(n) / SR
    x = np.zeros(n)
    r = np.random.default_rng(31)
    for k in range(60):
        f = r.uniform(2500, 9000)
        st = sec(abs(r.normal(0, 0.12)))
        ln = sec(r.uniform(0.05, 0.6))
        if st + ln >= n:
            continue
        tt = np.arange(ln) / SR
        x[st:st + ln] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * r.uniform(8, 30)) * r.uniform(0.1, 0.5)
    crack = filt(white(n), 'hp', 2000) * np.exp(-t * 18)
    thud = np.sin(2 * np.pi * 70 * t) * np.exp(-t * 9)
    y = x + crack * 0.9 + thud * 0.8
    m.add(c['t'], y / (np.abs(y).max() + 1e-9), c.get('level', 0.7), verb=0.35)


def c_water(m, c):
    """Lapping / rushing water bed."""
    t0, t1 = c['t0'], c['t1']
    n = sec(t1 - t0)
    swell = env_keys(n, t0, c.get('swell', [[t0, 1], [t1, 1]]))
    tt = np.arange(n) / SR
    lap = (0.5 + 0.5 * np.sin(2 * np.pi * tt / 3.1)) ** 3 + 0.6 * (0.5 + 0.5 * np.sin(2 * np.pi * tt / 4.7 + 1)) ** 3
    x = np.stack([filt(white(n), 'bp', [180, 2400]) * lap, filt(white(n), 'bp', [180, 2400]) * np.roll(lap, sec(0.7))], axis=1)
    rush = np.stack([filt(pink(n), 'lp', 900), filt(pink(n), 'lp', 900)], axis=1) * c.get('rush', 0.3)
    y = (x + rush)
    y = y / (np.abs(y).max() + 1e-9)
    m.add(t0, fade(y * swell[:, None], 1.0, 1.0), c.get('level', 0.4), verb=0.2)


def c_heartbeat(m, c):
    t0, t1 = c['t0'], c['t1']
    bpm = c.get('bpm', 62)
    t = t0
    while t < t1:
        for off, a in ((0, 1.0), (0.28, 0.7)):
            n = sec(0.35)
            tt = np.arange(n) / SR
            x = np.sin(2 * np.pi * 55 * tt) * np.exp(-tt * 18) * a
            m.add(t + off, x, c.get('level', 0.4), verb=0.1)
        t += 60 / bpm


def c_rain(m, c):
    """Heavy rain: dense high hiss, patter on glass, low roar."""
    t0, t1 = c['t0'], c['t1']
    n = sec(t1 - t0)
    swell = env_keys(n, t0, c.get('swell', [[t0, 1], [t1, 1]]))
    hiss = np.stack([filt(white(n), 'bp', [1800, 9000]), filt(white(n), 'bp', [1800, 9000])], axis=1) * 0.35
    roar = np.stack([filt(pink(n), 'bp', [300, 1600]), filt(pink(n), 'bp', [300, 1600])], axis=1) * 0.6
    # individual drops hitting the window
    r = np.random.default_rng(41)
    drops = np.zeros((n, 2))
    k = int((t1 - t0) * 70)
    for _ in range(k):
        i = r.integers(0, max(1, n - 800))
        ln = 600
        tt = np.arange(ln) / SR
        d = np.sin(2 * np.pi * r.uniform(2500, 6000) * tt) * np.exp(-tt * r.uniform(400, 900)) * r.uniform(0.2, 0.7)
        ch = r.integers(0, 2)
        drops[i:i + ln, ch] += d * (swell[i] if i < n else 1)
    x = (hiss + roar) * (0.6 + 0.4 * slow_noise(n, 0.5, 8))[:, None] + drops * 0.5
    x = x / (np.abs(x).max() + 1e-9)
    m.add(t0, fade(x * swell[:, None], 1.0, 1.0), c.get('level', 0.5), verb=0.15)


def c_thunder(m, c):
    """Close crack then a long rolling rumble."""
    n = sec(6.0)
    t = np.arange(n) / SR
    r = np.random.default_rng(int(c['t'] * 100))
    env = np.exp(-t * 0.7) * (0.6 + 0.4 * np.abs(slow_noise(n, 3.0, int(c['t'] * 10))))
    rumble = filt(brown(n), 'lp', 220) * env
    crack = filt(white(n), 'bp', [400, 4000]) * np.exp(-t * 9) * (r.random() * 0.5 + 0.5)
    x = rumble * 1.4 + crack * 0.5
    x = np.tanh(x * 1.2)
    m.add(c['t'] + c.get('delay', 0), x / (np.abs(x).max() + 1e-9), c.get('level', 0.5), pan=c.get('pan', 0), verb=0.45)


def c_creak(m, c):
    """Ice under strain: low groans and sharp cracks."""
    t0, t1 = c['t0'], c['t1']
    r = np.random.default_rng(int(t0 * 10))
    t = t0
    while t < t1 - 0.5:
        if r.random() < 0.55:
            n = sec(r.uniform(0.6, 1.6)); tt = np.arange(n) / SR
            f = r.uniform(70, 160) * (1 + 0.15 * np.sin(2 * np.pi * r.uniform(3, 9) * tt))
            x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.hanning(n) * (0.6 + 0.4 * slow_noise(n, 30, int(t * 7)))
            x = filt(x + filt(white(n), 'bp', [200, 900]) * 0.3 * np.hanning(n), 'lp', 1200)
        else:
            n = sec(r.uniform(0.3, 0.8)); tt = np.arange(n) / SR
            x = filt(white(n), 'bp', [800, 7000]) * np.exp(-tt * 18) + np.sin(2 * np.pi * 90 * tt) * np.exp(-tt * 8) * 0.8
        m.add(t, x / (np.abs(x).max() + 1e-9), c.get('level', 0.4) * r.uniform(0.5, 1.0), pan=float(r.uniform(-0.7, 0.7)), verb=0.5)
        t += r.uniform(0.5, 1.4)


VOWELS = [(730, 1090, 2440), (270, 2290, 3010), (300, 870, 2240), (530, 1840, 2480), (570, 840, 2410), (660, 1720, 2410), (440, 1020, 2240)]


def voice(n, r, f0, rate, breathy=0.35):
    """One talker: a glottal buzz + breath through moving vowel formants, chopped into syllables."""
    t = np.arange(n) / SR
    f = f0 * (1 + 0.06 * slow_noise(n, 1.5, int(r.integers(1e6))) + 0.012 * np.sin(2 * np.pi * 5.5 * t))
    buzz = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR) * (1 - breathy) + white(n) * breathy
    out = np.zeros(n)
    seg = sec(1 / rate)
    for i in range(0, n, seg):
        j = min(n, i + seg)
        F1, F2, F3 = VOWELS[int(r.integers(len(VOWELS)))]
        part = buzz[i:j]
        y = filt(part, 'bp', [F1 * 0.8, F1 * 1.25]) + filt(part, 'bp', [F2 * 0.85, F2 * 1.15]) * 0.6 + filt(part, 'bp', [F3 * 0.9, F3 * 1.1]) * 0.25
        out[i:j] = y * np.hanning(j - i) ** 0.6
    # speech comes in phrases with pauses
    gate = np.clip(slow_noise(n, 0.7, int(r.integers(1e6))) * 2.2 + 0.4, 0, 1)
    return out * gate


def c_crowd(m, c):
    """Babble of a crowd: many talkers at different distances."""
    t0, t1 = c['t0'], c['t1']
    n = sec(t1 - t0)
    r = np.random.default_rng(c.get('seed', 11))
    out = np.zeros((n, 2))
    for k in range(c.get('voices', 18)):
        f0 = r.uniform(95, 140) if r.random() < 0.5 else r.uniform(170, 260)
        v = voice(n, r, f0, r.uniform(3.5, 6.0)) * r.uniform(0.3, 1.0)
        pan = r.uniform(-0.9, 0.9)
        out[:, 0] += v * np.cos((pan + 1) * np.pi / 4); out[:, 1] += v * np.sin((pan + 1) * np.pi / 4)
    out += filt(pink(n), 'bp', [200, 2500])[:, None] * 0.08          # room tone under the voices
    out = filt(out.T, 'lp', 3800).T
    out = out / (np.abs(out).max() + 1e-9)
    e = np.ones(n)
    k = sec(min(0.8, (t1 - t0) / 3)); e[:k] = np.linspace(0, 1, k); e[-k:] = np.linspace(1, 0, k)
    if 'swell' in c:
        e *= env_keys(n, t0, c['swell'])
    m.add(t0, out * e[:, None], c.get('level', 0.4), verb=0.25)


def c_gasp(m, c):
    """A crowd's sharp intake of breath, then a rising, wavering 'ooh'."""
    t = c['t']
    n = sec(2.6)
    r = np.random.default_rng(c.get('seed', 5))
    tt = np.arange(n) / SR
    out = np.zeros((n, 2))
    for k in range(22):
        d = r.uniform(0, 0.25)
        f0 = (r.uniform(110, 150) if r.random() < 0.5 else r.uniform(190, 280)) * (1 + 0.18 * np.clip((tt - d - 0.3) / 0.6, 0, 1))
        buzz = signal.sawtooth(2 * np.pi * np.cumsum(f0) / SR) * 0.5 + white(n) * 0.5
        oo = filt(buzz, 'bp', [260, 380]) + filt(buzz, 'bp', [760, 980]) * 0.5
        inhale = filt(white(n), 'bp', [900, 4500]) * np.exp(-((tt - d - 0.12) / 0.09) ** 2) * 1.6
        env = np.clip((tt - d - 0.25) / 0.35, 0, 1) ** 1.5 * np.exp(-np.clip(tt - d - 0.9, 0, None) * 1.6)
        v = (oo * env + inhale) * r.uniform(0.4, 1.0)
        pan = r.uniform(-0.9, 0.9)
        out[:, 0] += v * np.cos((pan + 1) * np.pi / 4); out[:, 1] += v * np.sin((pan + 1) * np.pi / 4)
    out = out / (np.abs(out).max() + 1e-9)
    m.add(t, out, c.get('level', 0.5), verb=0.4)


def c_siren(m, c):
    """A distant civil-defence siren rising and falling."""
    t0, t1 = c['t0'], c['t1']
    n = sec(t1 - t0)
    tt = np.arange(n) / SR
    f = 420 + 260 * (0.5 - 0.5 * np.cos(2 * np.pi * tt / c.get('period', 6.0)))
    x = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR, 0.5) + 0.4 * signal.sawtooth(2 * np.pi * np.cumsum(f * 1.5) / SR, 0.5)
    x = filt(x, 'lp', 1600) * (0.7 + 0.3 * slow_noise(n, 0.4, 3))
    e = np.ones(n); k = sec(1.5); e[:k] = np.linspace(0, 1, k); e[-k:] = np.linspace(1, 0, k)
    m.add(t0, x * e / (np.abs(x).max() + 1e-9), c.get('level', 0.25), pan=c.get('pan', 0.3), verb=0.7)


CUES = dict(ambience=c_ambience, drone=c_drone, boom=c_boom, shimmer=c_shimmer, flicker=c_flicker, zap=c_zap,
            powerdown=c_powerdown, chime=c_chime, rumble=c_rumble, whoosh=c_whoosh, glass=c_glass, water=c_water,
            heartbeat=c_heartbeat, rain=c_rain, thunder=c_thunder, creak=c_creak,
            crowd=c_crowd, gasp=c_gasp, siren=c_siren)


def main():
    meta = json.load(open(sys.argv[1]))
    dur = meta['duration']
    m = Mix(dur)
    for c in meta['audio']:
        CUES[c['type']](m, c)
    ir = reverb_ir()
    wet = np.stack([signal.fftconvolve(m.send[:, k], ir[:, k])[: m.n] for k in range(2)], axis=1)
    out = m.dry + wet * 0.6
    out = out[: sec(dur)]
    out = filt(out.T, 'hp', 25).T
    # gentle bus compression + soft clip, then normalise to -1 dBFS
    peak = np.abs(out).max() + 1e-9
    out = out / peak * 1.6
    out = np.tanh(out) / np.tanh(1.6)
    out *= 10 ** (-1 / 20)
    out[-sec(0.3):] *= np.linspace(1, 0, sec(0.3))[:, None]
    wavfile.write(sys.argv[2], SR, (out * 32767).astype(np.int16))
    print('audio:', sys.argv[2], f'{dur:.1f}s')


if __name__ == '__main__':
    main()
