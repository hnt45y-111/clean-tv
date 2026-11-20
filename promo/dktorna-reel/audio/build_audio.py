"""Builds the full soundtrack for the Dktorna reel.

Music: original score in maqam Hijaz on D — santur-style hammered strings
(the instrument of Iraqi maqam), frame drum (daf) in a maqsum rhythm, warm
drone. Sound design: impacts, clay stamps, UI taps, chime, risers.
ElevenLabs assets: voiceover (vo.mp3), whoosh, door, clock.
Output: public/audio/mix.wav (48 kHz stereo).
"""
import subprocess
import numpy as np
from scipy import signal

SR = 48000
DUR = 38.0
N = int(SR * DUR)
VO_OFFSET = 0.3
rng = np.random.default_rng(7)
ROOT = __file__.rsplit("/audio/", 1)[0]


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)


def buf():
    return np.zeros((N, 2))


def place(dst, src, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if src.ndim == 1:
        l, r = np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)
        src = np.stack([src * l * 1.414, src * r * 1.414], 1)
    j = min(N, i + len(src))
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

# ---------------------------------------------------------------- music
BPM = 96
BEAT = 60 / BPM
DROP = 9.38  # "دكتورنا"
music = buf()

D3 = 50
# Hijaz on D: D Eb F# G A Bb C
H = [0, 1, 4, 5, 7, 8, 10]


def deg(d, base=D3 + 12):
    o, i = divmod(d, 7)
    return base + 12 * o + H[i]


# --- intro (0..DROP): drone + sparse santur, tension
drone = pad([hz(38), hz(45), hz(50)], DROP + 0.6, 0.16)
drone *= np.minimum(1, np.arange(len(drone)) / (SR * 2.5))[:, None]
fade = np.ones(len(drone))
fade[-int(1.2 * SR):] = np.linspace(1, 0, int(1.2 * SR))
place(music, drone * fade[:, None], 0)
intro_notes = [(0.25, 0), (1.5, 2), (2.4, 1), (3.6, 4), (4.9, 3), (5.5, 2), (6.5, 1), (7.3, 0)]
for t0, d in intro_notes:
    place(music, santur(hz(deg(d)), 2.6, 0.75), t0, pan=rng.uniform(-0.4, 0.4))
    place(music, santur(hz(deg(d) - 12), 2.6, 0.35), t0 + 0.004)
# low heartbeat while waiting
for k in range(6):
    t0 = 4.1 + k * 0.62
    place(music, daf_dum(0.35), t0)
    place(music, daf_dum(0.22), t0 + 0.2)

# --- main groove (DROP..34.9)
END_GROOVE = 31.0
chords = [  # (root degree) — Hijaz cadences
    [0, 2, 4], [6 - 7, 1, 3], [0, 2, 4], [3, 5, 0 + 7], [4, 6, 1 + 7], [3, 5, 7], [1, 3, 5], [0, 2, 4],
]
bar = BEAT * 4
t = DROP
ci = 0
while t < END_GROOVE - 0.01:
    ch = chords[ci % len(chords)]
    # santur 16th-note figure (tremolo arpeggio)
    patt = [0, 1, 2, 1, 2, 0, 1, 2, 3, 2, 1, 2, 0, 2, 1, 0]
    for s in range(16):
        nt = t + s * BEAT / 4
        if nt >= END_GROOVE:
            break
        idx = patt[s]
        d = ch[idx % 3] + (7 if idx == 3 else 0)
        vel = 0.85 if s % 4 == 0 else 0.5
        place(music, santur(hz(deg(d)), 1.4, vel), nt + rng.uniform(-0.004, 0.004), pan=0.25 if s % 2 else -0.25)
    # bass doubling (santur low course)
    place(music, santur(hz(deg(ch[0]) - 24), 2.4, 0.9), t)
    place(music, santur(hz(deg(ch[0]) - 24), 2.0, 0.6), t + 2 * BEAT)
    # maqsum: D T . T D . T .
    for e, kind in enumerate("DT.TD.T."):
        et = t + e * BEAT / 2
        if et >= END_GROOVE:
            break
        if kind == "D":
            place(music, daf_dum(1.0), et)
        elif kind == "T":
            place(music, daf_tak(0.9), et, pan=0.15)
    t += bar
    ci += 1

# sustain pad under groove
gp = pad([hz(38), hz(50), hz(57)], END_GROOVE - DROP + 1.5, 0.09)
gp *= np.minimum(1, np.arange(len(gp)) / (SR * 0.4))[:, None]
gp[-int(1.5 * SR):] *= np.linspace(1, 0, int(1.5 * SR))[:, None]
place(music, gp, DROP)

# --- finale: "نزّل دكتورنا" 31.72 -> resolve on D
FIN = 31.72
for i, d in enumerate([4, 3, 2, 1, 0]):  # descending hijaz run into the hit
    place(music, santur(hz(deg(d + 7)), 1.2, 0.7), 31.05 + i * 0.12, pan=0.2)
for d in (0, 2, 4, 7):
    place(music, santur(hz(deg(d)), 5.5, 0.9), FIN + d * 0.012)
    place(music, santur(hz(deg(d) - 12), 5.5, 0.6), FIN + 0.01)
place(music, daf_dum(1.2), FIN)
end_pad = pad([hz(38), hz(45), hz(50), hz(54)], 6.3, 0.14)
end_pad[: int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))[:, None]
end_pad[-int(3.0 * SR):] *= np.linspace(1, 0, int(3.0 * SR))[:, None]
place(music, end_pad, FIN)
# gentle santur sparkle on "الحكيم موجود"
for i, d in enumerate([0, 2, 4, 7, 9, 11, 14]):
    place(music, santur(hz(deg(d)), 2.5, 0.45), 33.15 + i * 0.09, pan=-0.5 + i * 0.16)

music = reverb(music, IR_HALL, 0.22)

# ---------------------------------------------------------------- sfx track
sfx = buf()
whoosh = load(f"{ROOT}/public/audio/src/whoosh.mp3")
door = load(f"{ROOT}/public/audio/src/door.mp3")
clock = load(f"{ROOT}/public/audio/src/clock.mp3")


def whoosh_at(t, g=0.55):
    # align the whoosh peak to t
    env = np.abs(whoosh).sum(1)
    pk = np.argmax(np.convolve(env, np.ones(2000), "same")) / SR
    place(sfx, whoosh, t - pk, g)


# clock ticking through the "waiting" part
ck = clock[: int(4.2 * SR)].copy()
ck[: int(0.3 * SR)] *= np.linspace(0, 1, int(0.3 * SR))[:, None]
ck[-int(0.6 * SR):] *= np.linspace(1, 0, int(0.6 * SR))[:, None]
place(sfx, ck, 3.95, 0.55)

# hook word taps
for tt in (0.45, 1.35, 3.25):
    place(sfx, tap(1.0, 0.8), tt)
whoosh_at(4.1, 0.5)
# counter flicker ticks (queue numbers rolling)
for k in range(14):
    place(sfx, tick_click(0.6), 5.3 + k * 0.13)

# reveal
place(sfx, riser(1.25), 7.0, 0.8)
place(sfx, door[: int(4.5 * SR)], 8.35, 0.45)
place(sfx, reverse_swell(0.9), DROP - 0.9, 0.8)
place(sfx, impact(1.0), DROP, 1.0)
for i in range(4):  # four nails stamped into the arch
    place(sfx, stamp(0.75), 9.62 + i * 0.13, pan=[-0.5, 0.5, -0.2, 0.2][i])
place(sfx, stamp(0.9), 10.25)  # threshold
place(sfx, tap(0.8, 0.6), 10.45)

whoosh_at(12.85)
for k in range(9):  # typing in search bar
    place(sfx, tap(1.3 + 0.05 * (k % 3), 0.45), 13.2 + k * 0.085)
for k, tt in enumerate((14.05, 14.4, 14.75)):
    place(sfx, tap(0.9, 0.7), tt)

whoosh_at(16.15)
place(sfx, stamp(0.5), 16.55)
for k in range(10):  # number counting up to 12
    place(sfx, tick_click(0.7), 18.4 + k * 0.06)
place(sfx, tap(0.7, 0.9), 19.05)
# barcode scan beep
n = int(0.12 * SR)
beep = np.sin(2 * np.pi * 1850 * np.arange(n) / SR) * np.hanning(n) * 0.08
place(sfx, beep, 20.2)

whoosh_at(21.05, 0.45)
place(sfx, chime(), 21.3, 0.9)

whoosh_at(24.0, 0.45)
for k in range(4):
    place(sfx, tap(1.1, 0.55), 24.75 + k * 0.33)

whoosh_at(27.2, 0.45)
place(sfx, stamp(1.1), 28.05)  # verification seal
place(sfx, tap(1.0, 0.6), 29.2)
place(sfx, tap(1.2, 0.6), 29.9)

place(sfx, riser(0.75), 31.0, 0.6)
place(sfx, impact(0.85), FIN, 0.9)
place(sfx, chime(), 33.15, 0.55)
place(sfx, tap(0.9, 0.7), 35.2)

# ---------------------------------------------------------------- voice & mix
vo = load(f"{ROOT}/public/audio/vo.mp3")
vo = hp(vo, 80)
# gentle presence lift
vo = vo + bp(vo, 2500, 5000) * 0.25
voice = buf()
place(voice, vo, VO_OFFSET, 1.0)

# sidechain ducking of the music by the voice envelope
env = np.abs(voice).max(1)
win = int(0.05 * SR)
env = np.convolve(env, np.ones(win) / win, "same")
env = env / (env.max() + 1e-9)
duck_db = -8.5 * np.clip(env * 4, 0, 1)
# smooth (attack/release)
duck = 10 ** (duck_db / 20)
b, a = signal.butter(1, 3 / (SR / 2))
duck = signal.filtfilt(b, a, duck)
music *= duck[:, None]


def norm_peak(x, db):
    return x / (np.abs(x).max() + 1e-9) * 10 ** (db / 20)


music = norm_peak(music, -9.5)
sfx = norm_peak(sfx, -6.0)
voice = norm_peak(voice, -2.5)
mix = music + sfx + voice

# master: soft clip + fade out
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
fo = int(1.2 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = norm_peak(mix, -1.0)

out = f"{ROOT}/public/audio/mix.wav"
pcm = (mix * 32767).astype(np.int16)
import wave

with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", out)
