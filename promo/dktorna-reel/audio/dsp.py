"""Shared synthesis + DSP helpers for the Dktorna soundtrack."""

import subprocess
import numpy as np
from scipy import signal

SR = 48000
DUR = 38.0
N = int(SR * DUR)

def set_duration(d):
    global DUR, N
    DUR = d
    N = int(SR * d)
VO_OFFSET = 0.3
rng = np.random.default_rng(7)
ROOT = __file__.rsplit("/audio/", 1)[0]


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)


def buf():
    return np.zeros((N, 2))


def cur_n():
    return N


def place(dst, src, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if src.ndim == 1:
        l, r = np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)
        src = np.stack([src * l * 1.414, src * r * 1.414], 1)
    j = min(N, i + len(src))
    if i < 0:
        src = src[-i:]
        i = 0
        j = min(N, len(src))
    if j > i:
        dst[i:j] += src[: j - i] * gain


def lp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), "low")
    return signal.lfilter(b, a, x, axis=0)


def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), "high")
    return signal.lfilter(b, a, x, axis=0)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], "band")
    return signal.lfilter(b, a, x, axis=0)


def make_ir(seconds, damp=3000, decay=3.0):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    env = np.exp(-decay * t / seconds * 2.2)
    ir = np.stack([rng.standard_normal(n), rng.standard_normal(n)], 1) * env[:, None]
    ir = lp(ir, damp)
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))[:, None]
    return ir / np.sqrt((ir ** 2).sum(0)).max()


def reverb(x, ir, wet=0.3):
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    y = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
    return x * (1 - wet) + y * wet


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


# ---------------------------------------------------------------- instruments
def santur(freq, dur=2.2, vel=1.0):
    """Hammered double-course string: inharmonic partials, two detuned strings, hammer click."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    B = 0.00025
    for k in range(1, 12):
        fk = freq * k * np.sqrt(1 + B * k * k)
        if fk > 15000:
            break
        amp = (1.0 / k ** 1.05) * (1.15 if k in (2, 3) else 1.0)
        dec = 1.6 + 0.9 * k
        for det in (-0.9, 0.9):
            out += amp * np.exp(-dec * t) * np.sin(2 * np.pi * (fk + det * k * 0.5) * t + rng.uniform(0, 6.28))
    click = rng.standard_normal(int(0.004 * SR)) * np.linspace(1, 0, int(0.004 * SR))
    out[: len(click)] += hp(click, 2500) * 0.6
    att = int(0.002 * SR)
    out[:att] *= np.linspace(0, 1, att)
    return out * vel * 0.22


def daf_dum(vel=1.0):
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    f = 62 + 70 * np.exp(-t * 28)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    skin = lp(rng.standard_normal(n) * np.exp(-t * 45), 900) * 0.5
    return (body + skin) * vel * 0.55


def daf_tak(vel=1.0):
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    ring = np.sin(2 * np.pi * 410 * t) * np.exp(-t * 38) * 0.35
    slap = bp(rng.standard_normal(n), 1800, 6500) * np.exp(-t * 60)
    jingle = hp(rng.standard_normal(n), 7000) * np.exp(-t * 18) * 0.25  # daf rings
    return (ring + slap + jingle) * vel * 0.32


def pad(freqs, dur, vol=0.1):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for f in freqs:
        for c, det in enumerate((-0.12, 0.12)):
            ph = rng.uniform(0, 6.28)
            saw = signal.sawtooth(2 * np.pi * f * (1 + det / 100) * t + ph)
            out[:, c] += saw
    out = lp(out, 900)
    lfo = 0.75 + 0.25 * np.sin(2 * np.pi * 0.18 * t)
    return out * lfo[:, None] * vol / len(freqs)


# ---------------------------------------------------------------- sfx
def impact(big=1.0):
    n = int(3.0 * SR)
    t = np.arange(n) / SR
    f = 38 + 85 * np.exp(-t * 9)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.9)
    crack = lp(rng.standard_normal(n), 2600) * np.exp(-t * 16) * 0.55
    clay = bp(rng.standard_normal(n), 250, 1100) * np.exp(-t * 22) * 0.6
    x = (sub + crack + clay) * big
    return reverb(x, IR_HALL, 0.28) * 0.75


def stamp(vel=1.0):
    n = int(0.7 * SR)
    t = np.arange(n) / SR
    thud = np.sin(2 * np.pi * np.cumsum(70 + 120 * np.exp(-t * 40)) / SR) * np.exp(-t * 14)
    knock = bp(rng.standard_normal(n), 400, 2400) * np.exp(-t * 55) * 0.7
    return reverb((thud + knock) * vel * 0.5, IR_ROOM, 0.18)


def tap(pitch=1.0, vel=1.0):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 1300 * pitch * t) * np.exp(-t * 70)
    click = bp(rng.standard_normal(n), 2500, 9000) * np.exp(-t * 260) * 0.5
    return (tone * 0.5 + click) * vel * 0.22


def bell(freq, dur=2.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    parts = [(1, 1, 2.2), (2.0, 0.45, 3.0), (2.76, 0.3, 4.2), (5.4, 0.12, 7), (8.9, 0.05, 9)]
    x = sum(a * np.exp(-d * t) * np.sin(2 * np.pi * freq * r * t) for r, a, d in parts)
    att = int(0.003 * SR)
    x[:att] *= np.linspace(0, 1, att)
    return x * 0.16


def chime():
    x = np.zeros(int(3.0 * SR))
    b1, b2 = bell(hz(81)), bell(hz(86))  # A5 -> D6
    x[: len(b1)] += b1
    o = int(0.13 * SR)
    x[o: o + len(b2)] += b2[: len(x) - o]
    return reverb(x, IR_HALL, 0.3)


def riser(dur=1.4):
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = (t / dur) ** 2.2
    noise = rng.standard_normal(n)
    # sweeping band of noise
    out = np.zeros(n)
    seg = 2048
    for i in range(0, n, seg):
        fc = 300 + 7000 * (i / n) ** 2
        out[i:i + seg] = bp(noise[i:i + seg], fc * 0.7, min(fc * 1.4, 20000))
    tone = np.sin(2 * np.pi * np.cumsum(hz(50) * (1 + 1.0 * (t / dur) ** 2)) / SR) * 0.4
    return reverb((out * 0.6 + tone) * env * 0.5, IR_HALL, 0.25)


def reverse_swell(dur=1.0):
    x = impact(0.6)[: int(dur * SR)][::-1]
    return x * np.linspace(0, 1, len(x))[:, None] ** 2 * 0.6


def tick_click(vel=1.0):
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    return bp(rng.standard_normal(n), 1500, 5000) * np.exp(-t * 180) * vel * 0.25


IR_HALL = make_ir(2.6, 4200)
IR_ROOM = make_ir(0.8, 6000)

