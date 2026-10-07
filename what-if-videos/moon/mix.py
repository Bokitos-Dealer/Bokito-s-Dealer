"""Score, sound design and final mix for "What if the Moon suddenly disappeared?".
Writes audio/final_mix.wav (44.1 kHz stereo)."""
import json, os, sys
import numpy as np
import soundfile as sf
from scipy import signal
from scipy.signal import resample_poly

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'audio'))
import synth as S  # noqa: E402  (reuse noise/filters/ambience generators)

SR = S.SR
voice = json.load(open(os.path.join(HERE, 'audio', 'voice_af_heart.json')))
words = json.load(open(os.path.join(HERE, 'audio', 'words_af_heart.json')))['words']
L = {l['id']: l for l in voice['lines']}
def word(text, after=0.0):
    for w in words:
        if w['s'] >= after - 0.05 and ''.join(ch for ch in w['w'].lower() if ch.isalnum()) == text:
            return w['s']
    raise KeyError(text)

END = float(np.ceil(voice['duration'] + 2.4))
N = S.sec(END) + S.SR
rng = np.random.default_rng(11)

# cut points (match comp.js)
CUT = {
    'people': L['L2']['start'] - 0.05, 'city2': L['L3']['start'] - 0.08, 'road': L['L4']['start'] - 0.06, 'milky': L['L5']['start'] - 0.08,
    'ocean': L['L6']['start'] - 0.1, 'earth': L['L7']['start'] - 0.1, 'harbor': L['L8']['start'] - 0.08, 'pool': L['L9']['start'] - 0.08,
    'coral': L['L10']['start'] - 0.08, 'turtles': L['L12']['start'] - 0.1, 'black': L['L13']['start'] - 0.75, 'space': L['L13']['start'] - 0.35,
    'tilt': L['L14']['start'] - 0.1, 'wobble': L['L15']['start'] - 0.08, 'dusk': L['L16']['start'] - 0.1, 'city3': L['L17']['start'] - 0.12,
    'final': L['L17b']['start'] - 0.25,
}
VANISH = word('disappeared') + 0.05
OCEAN_HIT = L['L6b']['start']
STRANGE_HIT = L['L13']['start'] - 0.3
ICE = word('small', L['L15']['start']) + 0.3
DARKEN = 10.15

def st(x):
    return np.stack([x, x], axis=1) if x.ndim == 1 else x

class Bus:
    def __init__(self):
        self.x = np.zeros((N, 2))
    def add(self, t, sig, gain=1.0, pan=0.0):
        sig = st(sig) if sig.ndim == 1 else sig
        if pan:
            sig = sig * np.array([np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)]) * 1.414
        i = S.sec(t)
        if i < 0: sig = sig[-i:]; i = 0
        j = min(N, i + len(sig))
        if j > i: self.x[i:j] += sig[: j - i] * gain

def env(n, t0, keys):
    return S.env_keys(n, t0, keys)

def seg(t0, t1, fin=0.4, fout=0.4):
    n = S.sec(t1 - t0)
    e = np.ones(n)
    a, b = S.sec(fin), S.sec(fout)
    if a: e[:a] = np.linspace(0, 1, a)
    if b: e[-b:] = np.linspace(1, 0, b)
    return n, e

def norm(x):
    return x / (np.abs(x).max() + 1e-9)

# ================================================================ music
music = Bus()
def pad(t0, t1, notes, level, bright=0.3, attack=1.5, release=2.0, detune=0.004):
    n = S.sec(t1 - t0)
    x = np.zeros(n)
    for m in notes:
        f = S.mtof(m)
        for d in (-detune, 0, detune * 1.1):
            x += S.saw(f, n, d)
    lo = S.filt(x, 'lp', 520, 2) * 0.5
    hi = S.filt(x, 'lp', 2600, 2) * 0.18 * bright
    y = lo + hi
    y *= S.lfo(n, 0.09, 0.08)
    y = S.fade(norm(y), attack, release)
    l, r = y, np.roll(y, S.sec(0.017))
    music.add(t0, np.stack([l, r], 1), level)

def sub(t0, t1, m, level):
    n, e = seg(t0, t1, 1.0, 1.5)
    music.add(t0, np.sin(2 * np.pi * S.mtof(m) * np.arange(n) / SR) * e, level)

def piano(t, m, level=0.22, pan=0.0):
    n = S.sec(4.0)
    tt = np.arange(n) / SR
    f = S.mtof(m)
    x = np.zeros(n)
    for k, (a, d) in enumerate([(1.0, 1.6), (0.45, 2.6), (0.22, 3.8), (0.12, 5.0), (0.06, 7.0)]):
        x += np.sin(2 * np.pi * f * (k + 1) * tt * (1 + 0.0004 * k)) * a * np.exp(-tt * d)
    x *= np.minimum(1, tt / 0.004)
    music.add(t, norm(x), level, pan)

def pulse(t0, t1, m, bpm, level, keys):
    step = 60 / bpm / 2
    t = t0
    while t < t1:
        n = S.sec(step * 0.9)
        tt = np.arange(n) / SR
        x = S.filt(S.saw(S.mtof(m), n) + S.saw(S.mtof(m + 12), n) * 0.4, 'lp', 900) * np.exp(-tt * 7)
        k = float(np.interp(t, [a for a, _ in keys], [b for _, b in keys]))
        music.add(t, x * 0.6, level * k)
        t += step

def hit(t, level=0.9, deep=True):
    n = S.sec(5.0)
    tt = np.arange(n) / SR
    f = 32 + 55 * np.exp(-tt * 3.0)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 0.8)
    brass = S.filt(sum(S.saw(S.mtof(m), n, d) for m in (38, 45, 50) for d in (-0.003, 0.003)), 'lp', 700) * np.exp(-tt * 1.1) * 0.25
    noise = S.filt(S.white(n), 'lp', 1800) * np.exp(-tt * 6) * 0.4
    x = np.tanh((body + brass + noise) * 1.5)
    music.add(t, norm(x), level)

def riser(t_end, dur, level=0.35):
    n = S.sec(dur)
    tt = np.arange(n) / SR
    k = tt / dur
    x = S.filt(S.white(n), 'bp', [400, 6000]) * k ** 2.5
    tone = np.sin(2 * np.pi * np.cumsum(200 + 600 * k ** 2) / SR) * k ** 3 * 0.3
    music.add(t_end - dur, norm(x + tone), level)

# Section A: night city, eerie (D minor), the vanish
pad(0.0, CUT['ocean'] - 0.6, [50, 53, 57, 62], 0.22, bright=0.15, attack=0.8)
sub(0.0, CUT['ocean'] - 0.6, 38, 0.18)
riser(VANISH, 1.3, 0.25)
hit(VANISH, 0.85)
for i, (tt, m) in enumerate([(3.2, 74), (4.9, 72), (7.0, 69), (9.4, 74), (12.6, 77), (14.2, 76)]):
    piano(tt, m, 0.16, pan=(-0.3 if i % 2 else 0.3))
# drop to silence before "But the biggest change..." then hit on "is in the ocean"
riser(OCEAN_HIT, 1.2, 0.22)
hit(OCEAN_HIT, 0.75)
# Section B: oceans and life, building pulse (Bb - F - C - Dm)
prog = [(OCEAN_HIT, [46, 50, 53, 58]), (OCEAN_HIT + 7.5, [41, 48, 53, 57]), (OCEAN_HIT + 15, [48, 52, 55, 60]), (OCEAN_HIT + 22.5, [50, 53, 57, 62])]
for i, (t0, notes) in enumerate(prog):
    t1 = prog[i + 1][0] + 1.0 if i + 1 < len(prog) else CUT['black'] + 0.2
    pad(t0, t1, notes, 0.2, bright=0.25 + 0.1 * i, attack=1.2, release=1.4)
sub(OCEAN_HIT, CUT['black'] + 0.2, 34, 0.16)
pulse(OCEAN_HIT + 0.5, CUT['black'], 38, 92, 0.22, [(OCEAN_HIT, 0.3), (CUT['coral'], 0.6), (CUT['turtles'], 0.9), (CUT['black'], 1.0)])
for i, tt in enumerate(np.arange(OCEAN_HIT + 1.0, CUT['black'], 2.6)):
    piano(tt, [62, 65, 69, 67, 65, 62, 64, 65][i % 8], 0.11, pan=(-0.25 if i % 2 else 0.25))
# Section C: the big one - tilt and ice (Dm - Bb - Gm - A)
hit(STRANGE_HIT, 1.0)
progC = [(STRANGE_HIT, [38, 50, 53, 57]), (CUT['tilt'], [46, 50, 53, 58, 62]), (CUT['wobble'], [43, 50, 55, 58]), (ICE - 0.5, [45, 52, 57, 61, 64])]
for i, (t0, notes) in enumerate(progC):
    t1 = progC[i + 1][0] + 1.0 if i + 1 < len(progC) else CUT['dusk'] + 0.6
    pad(t0, t1, notes, 0.26, bright=0.4 + 0.15 * i, attack=0.6, release=1.2)
sub(STRANGE_HIT, CUT['dusk'] + 0.4, 38, 0.22)
pulse(CUT['tilt'], CUT['dusk'], 38, 92, 0.24, [(CUT['tilt'], 0.6), (ICE, 1.0), (CUT['dusk'], 1.0)])
hit(CUT['tilt'], 0.45)
hit(ICE - 0.2, 0.55)
# Section D: resolution (F - C - Dm ... D major lift at the end)
pad(CUT['dusk'] - 0.3, CUT['final'] + 0.6, [41, 53, 57, 60], 0.22, bright=0.25, attack=1.5)
for i, (tt, m) in enumerate([(CUT['dusk'] + 0.5, 69), (CUT['dusk'] + 2.5, 72), (CUT['dusk'] + 4.5, 74), (CUT['city3'] + 0.3, 77), (CUT['city3'] + 2.0, 76)]):
    piano(tt, m, 0.15, pan=(-0.3 if i % 2 else 0.3))
riser(CUT['final'] + 0.3, 1.4, 0.22)
pad(CUT['final'] + 0.2, END - 0.2, [38, 50, 54, 57, 62, 66], 0.3, bright=0.5, attack=0.4, release=3.0)
sub(CUT['final'] + 0.2, END - 0.2, 26, 0.22)
hit(CUT['final'] + 0.3, 0.7)
piano(CUT['final'] + 0.35, 74, 0.2); piano(CUT['final'] + 0.35, 78, 0.12); piano(CUT['final'] + 0.35, 81, 0.1)

# silences: the music drops out before the two big reveals
gate = np.ones(N)
def silence(t0, t1, fo=0.25, fi=0.02):
    a, b = S.sec(t0), S.sec(t1)
    gate[a - S.sec(fo):a] = np.minimum(gate[a - S.sec(fo):a], np.linspace(1, 0, S.sec(fo)))
    gate[a:b] = 0
    gate[b:b + S.sec(fi)] = np.minimum(gate[b:b + S.sec(fi)], np.linspace(0, 1, S.sec(fi)))
silence(CUT['ocean'] - 0.35, OCEAN_HIT - 1.2)       # silence, then the riser into the hit
silence(CUT['black'] - 0.15, STRANGE_HIT - 0.04)  # dead air under the dip to black, then the hit

# ================================================================ sound design
sfx = Bus()
def amb(kind, t0, t1, level, **kw):
    m = S.Mix(t1 - t0 + 1)
    S.c_ambience(m, dict(kind=kind, t0=0, t1=t1 - t0, level=1.0, **kw))
    x = m.dry[: S.sec(t1 - t0)]
    sfx.add(t0, x, level)

def crowd(t0, t1, level):
    n, e = seg(t0, t1, 0.3, 0.6)
    x = np.zeros(n)
    for k in range(14):  # many distant voices: band-limited noise with syllable-rate wobble
        syl = (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(3, 6) * np.arange(n) / SR + rng.uniform(0, 6))) ** 2
        x += S.filt(S.white(n), 'bp', [rng.uniform(250, 400), rng.uniform(1200, 2400)]) * syl * rng.uniform(0.4, 1)
    sfx.add(t0, np.stack([norm(x), np.roll(norm(x), S.sec(0.02))], 1) * e[:, None], level)

def shutter(t, level=0.18, pan=0.0):
    n = S.sec(0.12)
    tt = np.arange(n) / SR
    x = S.filt(S.white(n), 'bp', [1500, 7000]) * (np.exp(-tt * 120) + 0.7 * np.exp(-np.maximum(0, tt - 0.05) * 140) * (tt > 0.05))
    sfx.add(t, norm(x), level, pan)

def wave_crash(t, level, dur=3.2, pan=0.0):
    n = S.sec(dur)
    tt = np.arange(n) / SR
    e = np.minimum(1, tt / 0.35) * np.exp(-np.maximum(0, tt - 0.35) * 1.4)
    x = S.filt(S.pink(n), 'lp', 2500) * e + S.filt(S.brown(n), 'lp', 200) * e * 0.8
    sfx.add(t, norm(x), level, pan)

def whoosh(t, level=0.25, dur=0.9, rise=True, pan=0.0):
    m = S.Mix(dur + 1)
    S.c_whoosh(m, dict(t=0, dur=dur, level=1.0, rise=rise, pan=pan))
    sfx.add(t, m.dry[: S.sec(dur)], level)

def drone(t0, t1, level, base=55):
    n, e = seg(t0, t1, 0.8, 0.8)
    tt = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * base * h * tt * (1 + 0.002 * np.sin(2 * np.pi * 0.1 * tt + h))) / h for h in (1, 1.5, 2, 3))
    x = x * 0.3 + S.filt(S.brown(n), 'lp', 120) * 0.6
    sfx.add(t0, st(norm(x) * e), level)

def dim_whomp(t, level):
    n = S.sec(1.6)
    tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * np.cumsum(140 * np.exp(-tt * 1.6) + 30) / SR) * np.exp(-tt * 2.2)
    sfx.add(t, norm(x), level)

def gulls(t0, t1, level):
    n = S.sec(t1 - t0)
    sfx.add(t0, S.gulls(n, 0.9), level)

# 0 - city at night: water lapping, distant traffic
amb('night-city', 0, CUT['road'] + 0.3, 0.32)
lap = S.Mix(CUT['road'] + 1); S.c_water(lap, dict(t0=0, t1=CUT['road'] + 0.3, level=1.0, rush=0.05)); sfx.add(0, lap.dry[: S.sec(CUT['road'] + 0.3)], 0.22)
crowd(CUT['people'] - 0.1, CUT['city2'] + 0.2, 0.2)
for tt, p in [(CUT['people'] + 0.6, -0.4), (CUT['people'] + 1.4, 0.5), (CUT['people'] + 2.3, 0.1)]: shutter(tt, 0.16, p)
# countryside, darkening
amb('night-quiet', CUT['road'] - 0.2, CUT['ocean'] + 0.2, 0.42)
dim_whomp(DARKEN, 0.35)
# ocean
wave_crash(CUT['ocean'] - 0.05, 0.6, 3.6, -0.2)
amb('wind', CUT['ocean'], CUT['earth'] + 0.4, 0.25)
# space / tides
drone(CUT['earth'] - 0.2, CUT['harbor'] + 0.2, 0.22, 49)
whoosh(word('without', L['L7']['start']) - 0.2, 0.22, 1.2, rise=False)
# harbor: gulls, drips, light wind
amb('wind', CUT['harbor'], CUT['pool'] + 0.3, 0.18)
gulls(CUT['harbor'], CUT['pool'] + 0.2, 0.55)
# tide pool: lapping water + bubbles
pool = S.Mix(CUT['coral'] - CUT['pool'] + 1); S.c_water(pool, dict(t0=0, t1=CUT['coral'] - CUT['pool'] + 0.3, level=1.0, rush=0.1)); sfx.add(CUT['pool'], pool.dry[: S.sec(CUT['coral'] - CUT['pool'] + 0.3)], 0.3)
# underwater reef
amb('underwater', CUT['coral'] - 0.1, CUT['turtles'] + 0.3, 0.32)
# night beach
for tt in np.arange(CUT['turtles'] + 0.3, CUT['black'], 3.4): wave_crash(tt, 0.22, 3.6, rng.uniform(-0.5, 0.5))
amb('night-quiet', CUT['turtles'], CUT['black'] + 0.1, 0.3)
# space: deep drone, wobble rumble, icy wind
drone(CUT['space'], CUT['dusk'] + 0.3, 0.3, 41)
rum = S.Mix(CUT['dusk'] - CUT['wobble'] + 1); S.c_rumble(rum, dict(t0=0, t1=CUT['dusk'] - CUT['wobble'] + 0.3, level=1.0, cut=90, swell=[[0, 0], [1.2, 0.8], [ICE - CUT['wobble'], 1.0], [CUT['dusk'] - CUT['wobble'], 0.6]])); sfx.add(CUT['wobble'], rum.dry[: S.sec(CUT['dusk'] - CUT['wobble'] + 0.3)], 0.35)
icy = S.Mix(CUT['dusk'] - ICE + 2); S.c_ambience(icy, dict(kind='wind', t0=0, t1=CUT['dusk'] - ICE + 0.8, level=1.0, swell=[[0, 0], [1.5, 1], [CUT['dusk'] - ICE + 0.8, 0.7]])); sfx.add(ICE - 0.3, icy.dry[: S.sec(CUT['dusk'] - ICE + 0.8)], 0.45)
# dusk tide pools
dusk = S.Mix(CUT['city3'] - CUT['dusk'] + 1); S.c_water(dusk, dict(t0=0, t1=CUT['city3'] - CUT['dusk'] + 0.3, level=1.0, rush=0.2)); sfx.add(CUT['dusk'], dusk.dry[: S.sec(CUT['city3'] - CUT['dusk'] + 0.3)], 0.28)
# back to the city, then deep space
amb('night-city', CUT['city3'] - 0.1, CUT['final'] + 0.3, 0.26)
drone(CUT['final'], END, 0.25, 41)
# transitions
for k in ('people', 'city2', 'road', 'milky', 'earth', 'harbor', 'pool', 'coral', 'turtles', 'tilt', 'wobble', 'dusk', 'city3', 'final'):
    whoosh(CUT[k] - 0.35, 0.12, 0.7, rise=True, pan=rng.uniform(-0.4, 0.4))

# ================================================================ voice
v, vsr = sf.read(os.path.join(HERE, 'audio', 'voice_af_heart.wav'), dtype='float64')
v = resample_poly(v, SR, vsr)
v = norm(S.filt(v, 'hp', 85))
# presence lift + gentle compression
pres = S.filt(v, 'bp', [2500, 6000]) * 0.35
v = v + pres
envv = np.maximum(S.filt(np.abs(v), 'lp', 20), 0.0)
gain = np.minimum(1.0, (0.12 / (envv + 1e-4)) ** 0.35)
v = v * gain
v = norm(v)
vbus = np.zeros((N, 2))
vbus[: len(v)] += st(v)
# short room for a little air
ir = S.reverb_ir(rt=0.7, bright=5000)
vw = np.stack([signal.fftconvolve(vbus[:, 0], ir[:, 0])[:N], signal.fftconvolve(vbus[:, 1], ir[:, 1])[:N]], 1)
vbus = vbus + vw * 0.06

# ================================================================ mix
# music reverb + ducking under the voice
mir = S.reverb_ir(rt=3.4)
mus = music.x * gate[:, None]
mus = mus + np.stack([signal.fftconvolve(mus[:, 0], mir[:, 0])[:N], signal.fftconvolve(mus[:, 1], mir[:, 1])[:N]], 1) * 0.35
vlev = S.filt(np.abs(vbus[:, 0]), 'lp', 6)
duck = 1 - 0.55 * np.clip(vlev / (np.percentile(vlev, 95) + 1e-9), 0, 1)
duck = S.filt(duck, 'lp', 3)
mus *= duck[:, None]
sfxr = sfx.x + np.stack([signal.fftconvolve(sfx.x[:, 0], mir[:, 0])[:N], signal.fftconvolve(sfx.x[:, 1], mir[:, 1])[:N]], 1) * 0.12
sfxr *= (0.55 + 0.45 * duck)[:, None]

def rms(x): return np.sqrt(np.mean(x ** 2) + 1e-12)
mix = vbus / rms(vbus[S.sec(0.1):S.sec(voice['duration'])]) * 0.18
mix += norm(mus) * 0.6
mix += norm(sfxr) * 0.44
mix = mix[: S.sec(END)]
mix = S.filt(mix.T, 'hp', 28).T
mix = mix / (np.abs(mix).max() + 1e-9) * 1.25
mix = np.tanh(mix) / np.tanh(1.25) * 0.93
mix[-S.sec(1.2):] *= np.linspace(1, 0, S.sec(1.2))[:, None]
sf.write(os.path.join(HERE, 'audio', 'mix_raw.wav'), mix.astype(np.float32), SR)
print('mix', round(END, 2), 's; cuts', {k: round(v_, 2) for k, v_ in CUT.items()})

# balance report: level of each stem while the narrator is speaking
speak = np.zeros(S.sec(END), bool)
for l in voice['lines']: speak[S.sec(l['start']):S.sec(l['end'])] = True
def db(x): return 20 * np.log10(np.sqrt(np.mean(x[speak[: len(x)]] ** 2)) + 1e-9)
vv = (vbus / rms(vbus[S.sec(0.1):S.sec(voice['duration'])]) * 0.18)[: S.sec(END)]
mm = (norm(mus) * 0.6)[: S.sec(END)]
ss = (norm(sfxr) * 0.44)[: S.sec(END)]
print(f'while speaking: voice {db(vv):.1f} dB, music {db(mm):.1f} dB, sfx {db(ss):.1f} dB')
