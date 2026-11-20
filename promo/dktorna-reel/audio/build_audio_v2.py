"""Dktorna — full feature film soundtrack + timeline.

1. Cuts the ElevenLabs voiceover into one clip per feature (at the quietest point
   between words), and lays the clips out with breathing room so every
   transition lands on the beat of the score.
2. Writes src/v2/timeline.json (scene windows, word times, cue times) for the video.
3. Scores it: maqam Hijaz on D — santur, daf (maqsum), drone; four sections.
4. Mixes voice + score + sound design → public/audio/mix_v2.wav
"""
import json
import math
import sys
import wave

import numpy as np

sys.path.insert(0, __file__.rsplit("/", 1)[0])
import dsp  # noqa: E402
from dsp import SR, bp, daf_dum, daf_tak, hp, hz, load, lp, pad, santur  # noqa: E402

ROOT = __file__.rsplit("/audio/", 1)[0]
rng = np.random.default_rng(11)
BPM = 96
BEAT = 60 / BPM

words = [w for w in json.load(open(f"{ROOT}/audio/vo_bazzaz_words.json"))["words"] if w["type"] == "word" and not w["text"].startswith("[")]
feats = json.load(open(f"{ROOT}/src/v2/features.json"))["features"]
vo = load(f"{ROOT}/public/audio/vo_bazzaz.mp3")
mono = vo.mean(1)


def clean(s):
    s = s.replace("گ", "ق")  # Iraqi گ is matched against the same word written with ق in features.json
    return "".join(ch for ch in s if ch not in "…،.:؟?!,")


def find_word(text, start_idx=0):
    for i in range(start_idx, len(words)):
        if clean(words[i]["text"]).startswith(clean(text)) or clean(text) in clean(words[i]["text"]):
            return i
    raise ValueError(text)


# ── segment boundaries (index of first word of each segment)
bounds = [("intro1", 0), ("intro2", find_word("من"))]
idx = bounds[-1][1]
for f in feats:
    idx = find_word(f["first"], idx + 1)
    bounds.append((f"f{f['n']}", idx))
bounds.append(("outro", find_word("دكتورنا", idx + 1)))


VO0 = 0.5  # the narration starts here and plays CONTINUOUSLY: never cut, never stretched

segs = []
for k, (name, wi) in enumerate(bounds):
    wj = bounds[k + 1][1] if k + 1 < len(bounds) else len(words)
    # a scene changes in the middle of the natural pause that already exists in the speech
    v0 = 0.0 if k == 0 else (words[wi - 1]["end"] + words[wi]["start"]) / 2
    segs.append({"id": name, "v0": v0, "words": words[wi:wj]})
VO_LEN = len(mono) / SR
for k, sg in enumerate(segs):
    sg["v1"] = segs[k + 1]["v0"] if k + 1 < len(segs) else VO_LEN
    sg["at"] = VO0 + sg["v0"]
    sg["end"] = VO0 + sg["v1"]

intro2 = next(sg for sg in segs if sg["id"] == "intro2")
drop = VO0 + next(w for w in intro2["words"] if "دكتورنا" in w["text"])["start"]

TOTAL = VO0 + VO_LEN + 3.6
dsp.set_duration(TOTAL)
N = dsp.cur_n()


def vt(sg, w):  # word -> video seconds (voice time + fixed offset)
    return round(VO0 + w["start"], 3), round(VO0 + w["end"], 3)


timeline = {"total": round(TOTAL, 3), "drop": round(drop, 3), "beat": BEAT, "segments": [], "features": []}
for sg in segs:
    timeline["segments"].append(
        {"id": sg["id"], "at": round(sg["at"], 3), "end": round(sg["end"], 3), "words": [{"w": w["text"], "s": vt(sg, w)[0], "e": vt(sg, w)[1]} for w in sg["words"]]}
    )
fsegs = [sg for sg in segs if sg["id"].startswith("f")]
outro = segs[-1]
for i, (f, sg) in enumerate(zip(feats, fsegs)):
    start = sg["at"]
    nxt = fsegs[i + 1]["at"] if i + 1 < len(fsegs) else outro["at"]
    cues = []
    last = 0
    for c in f["callouts"]:
        cw = clean(c["word"])
        ws = sg["words"]
        j = next((j for j in range(last, len(ws)) if clean(ws[j]["text"]) == cw), None)
        if j is None:
            j = next((j for j in range(last, len(ws)) if clean(ws[j]["text"]).startswith(cw)), None)
        if j is None:
            j = next(j for j in range(last, len(ws)) if cw in clean(ws[j]["text"]))
        last = j + 1
        cues.append({"label": c["label"], "t": vt(sg, ws[j])[0]})
    first_word = vt(sg, sg["words"][0])[0]
    timeline["features"].append(
        {"n": f["n"], "start": round(start, 3), "end": round(nxt, 3), "voAt": round(max(first_word, start + 0.55), 3), "voEnd": round(sg["end"], 3), "cues": cues}
    )
timeline["introEnd"] = timeline["features"][0]["start"]
timeline["outroStart"] = round(outro["at"], 3)
json.dump(timeline, open(f"{ROOT}/src/v2/timeline.json", "w"), ensure_ascii=False, indent=1)
print("total", TOTAL, "drop", drop, "(voice", round(VO_LEN, 1), "s, no silence inserted)")

# ── voice track: ONE continuous clip, exactly as generated
voice = dsp.buf()
clip = vo.copy()
fi = int(0.01 * SR)
clip[:fi] *= np.linspace(0, 1, fi)[:, None]
dsp.place(voice, clip, VO0)
voice = hp(voice, 70)
# (no extra low-end: keep the approved voice natural)

# ── score
music = dsp.buf()
H = [0, 1, 4, 5, 7, 8, 10]  # Hijaz on D


def deg(d, base=62):
    o, i = divmod(d, 7)
    return base + 12 * o + H[i]


fstarts = [f["start"] for f in timeline["features"]]
SEC_B, SEC_C, SEC_D = fstarts[4], fstarts[8], fstarts[12]
OUT = outro["at"]
FIN = next(w["s"] for w in timeline["segments"][-1]["words"] if "دكتورنا" in w["w"])

# intro: drone + sparse santur + heartbeat
dr = pad([hz(38), hz(45), hz(50)], drop + 0.5, 0.16)
dr *= np.minimum(1, np.arange(len(dr)) / (SR * 2.0))[:, None]
dr[-int(1.0 * SR):] *= np.linspace(1, 0, int(1.0 * SR))[:, None]
dsp.place(music, dr, 0)
for t0, d in [(0.3, 0), (1.4, 2), (2.3, 1), (3.3, 4), (4.3, 3), (5.4, 2), (6.0, 1)]:
    if t0 < drop - 0.8:
        dsp.place(music, santur(hz(deg(d)), 2.8, 0.7), t0, pan=rng.uniform(-0.4, 0.4))
        dsp.place(music, santur(hz(deg(d) - 12), 2.8, 0.3), t0 + 0.004)
for k in range(int((drop - 1.2) / 0.62)):
    t0 = 0.6 + k * 0.62
    dsp.place(music, daf_dum(0.28 + 0.02 * k), t0)
    dsp.place(music, daf_dum(0.18), t0 + 0.2)

chords = [[0, 2, 4], [-1, 1, 3], [0, 2, 4], [3, 5, 7], [4, 6, 8], [3, 5, 7], [1, 3, 5], [0, 2, 4]]
melody = [7, 8, 9, 8, 7, 6, 5, 4, 5, 6, 5, 4, 3, 2, 1, 0]  # hijaz descent for section B/D counter-line
bar = BEAT * 4
t = drop
ci = 0
while t < OUT - 0.01:
    sec = "A" if t < SEC_B else "B" if t < SEC_C else "C" if t < SEC_D else "D"
    ch = chords[ci % len(chords)]
    patt = [0, 1, 2, 1, 2, 0, 1, 2, 3, 2, 1, 2, 0, 2, 1, 0]
    step = 2 if sec == "C" else 1
    for s16 in range(0, 16, step):
        nt = t + s16 * BEAT / 4
        if nt >= OUT:
            break
        ix = patt[s16]
        d = ch[ix % 3] + (7 if ix == 3 else 0)
        vel = (0.85 if s16 % 4 == 0 else 0.5) * (0.8 if sec == "C" else 1)
        dsp.place(music, santur(hz(deg(d)), 1.4, vel), nt + rng.uniform(-0.004, 0.004), pan=0.25 if s16 % 2 else -0.25)
        if sec == "D" and s16 % 4 == 2:
            dsp.place(music, santur(hz(deg(d + 7)), 1.0, 0.35), nt + 0.003, pan=0.5)
    dsp.place(music, santur(hz(deg(ch[0]) - 24), 2.4, 0.9), t)
    dsp.place(music, santur(hz(deg(ch[0]) - 24), 2.0, 0.6), t + 2 * BEAT)
    if sec in ("B", "D"):
        for j in range(4):
            m = melody[(ci * 4 + j) % len(melody)]
            dsp.place(music, santur(hz(deg(m)), 1.6, 0.55), t + j * BEAT + BEAT / 2, pan=-0.45)
    for e, kind in enumerate("DT.TD.T."):
        et = t + e * BEAT / 2
        if et >= OUT:
            break
        if sec == "C":
            if kind == "T":
                dsp.place(music, daf_tak(0.55), et, pan=0.15)
            if e == 0 and ci % 2 == 0:
                dsp.place(music, daf_dum(0.6), et)
            continue
        if kind == "D":
            dsp.place(music, daf_dum(1.0 if sec != "A" else 0.9), et)
        elif kind == "T":
            dsp.place(music, daf_tak(0.9), et, pan=0.15)
        if sec == "D" and kind == ".":
            dsp.place(music, daf_tak(0.4), et, pan=-0.3)
    t += bar
    ci += 1

gp = pad([hz(38), hz(50), hz(57)], OUT - drop + 1.5, 0.085)
gp *= np.minimum(1, np.arange(len(gp)) / (SR * 0.4))[:, None]
gp[-int(1.5 * SR):] *= np.linspace(1, 0, int(1.5 * SR))[:, None]
dsp.place(music, gp, drop)

# finale
for i, d in enumerate([4, 3, 2, 1, 0]):
    dsp.place(music, santur(hz(deg(d + 7)), 1.2, 0.7), FIN - 0.62 + i * 0.12, pan=0.2)
for d in (0, 2, 4, 7):
    dsp.place(music, santur(hz(deg(d)), 6.0, 0.9), FIN + d * 0.012)
    dsp.place(music, santur(hz(deg(d) - 12), 6.0, 0.6), FIN + 0.01)
dsp.place(music, daf_dum(1.2), FIN)
ep = pad([hz(38), hz(45), hz(50), hz(54)], TOTAL - FIN, 0.14)
ep[: int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))[:, None]
ep[-int(3.5 * SR):] *= np.linspace(1, 0, int(3.5 * SR))[:, None]
dsp.place(music, ep, FIN)
# gentle groove under the outro words
for k in range(int((TOTAL - FIN - 3) / BEAT)):
    tt = FIN + (k + 1) * BEAT
    dsp.place(music, santur(hz(deg([0, 2, 4, 2][k % 4])), 1.6, 0.4), tt, pan=-0.3 + 0.2 * (k % 4))
    if k % 2 == 0:
        dsp.place(music, daf_dum(0.5), tt)
last = timeline["segments"][-1]["words"]
hk = next(w["s"] for w in last if "الحكيم" in w["w"])
for i, d in enumerate([0, 2, 4, 7, 9, 11, 14]):
    dsp.place(music, santur(hz(deg(d)), 2.5, 0.45), hk + i * 0.09, pan=-0.5 + i * 0.16)

music = dsp.reverb(music, dsp.IR_HALL, 0.22)

# ── sound design
sfx = dsp.buf()
whoosh = load(f"{ROOT}/public/audio/src/whoosh.mp3")
door = load(f"{ROOT}/public/audio/src/door.mp3")
clock = load(f"{ROOT}/public/audio/src/clock.mp3")
env = np.abs(whoosh).sum(1)
WPK = np.argmax(np.convolve(env, np.ones(2000), "same")) / SR


def whoosh_at(t, g=0.5):
    dsp.place(sfx, whoosh, t - WPK, g)


def tile_ripple(t):
    for k in range(7):
        dsp.place(sfx, dsp.tick_click(0.55 - k * 0.05), t - 0.22 + k * 0.045, pan=-0.6 + k * 0.2)


i1 = timeline["segments"][0]
ck = clock[: int((drop - 1.0) * SR)].copy()
ck[: int(0.4 * SR)] *= np.linspace(0, 1, int(0.4 * SR))[:, None]
ck[-int(0.8 * SR):] *= np.linspace(1, 0, int(0.8 * SR))[:, None]
dsp.place(sfx, ck, 0.2, 0.35)
dsp.place(sfx, dsp.riser(1.3), drop - 1.35, 0.8)
dsp.place(sfx, door[: int(4.5 * SR)], drop - 1.0, 0.4)
dsp.place(sfx, dsp.reverse_swell(0.9), drop - 0.9, 0.8)
dsp.place(sfx, dsp.impact(1.0), drop, 1.0)
for i in range(4):
    dsp.place(sfx, dsp.stamp(0.75), drop + 0.24 + i * 0.13, pan=[-0.5, 0.5, -0.2, 0.2][i])
dsp.place(sfx, dsp.stamp(0.9), drop + 0.87)

for f in timeline["features"]:
    whoosh_at(f["start"], 0.42)
    tile_ripple(f["start"])
    dsp.place(sfx, dsp.stamp(0.55), f["start"] + 0.42)  # number stamped
    for c in f["cues"]:
        dsp.place(sfx, dsp.tap(1.0, 0.55), c["t"])

F = {f["n"]: f for f in timeline["features"]}
# feature-specific touches
n = int(0.12 * SR)
beep = np.sin(2 * np.pi * 1850 * np.arange(n) / SR) * np.hanning(n) * 0.08
dsp.place(sfx, beep, F[4]["cues"][1]["t"] + 0.35)
dsp.place(sfx, beep, F[5]["cues"][1]["t"] + 0.3)
dsp.place(sfx, dsp.chime(), F[11]["cues"][0]["t"], 0.55)
dsp.place(sfx, dsp.chime(), F[11]["cues"][1]["t"], 0.45)
dsp.place(sfx, dsp.chime(), F[6]["cues"][1]["t"], 0.3)
for k, d in enumerate([0, 4, 7]):  # voice assistant "listening" blip
    dsp.place(sfx, dsp.bell(hz(deg(d + 7)), 0.8), F[12]["cues"][0]["t"] - 0.1 + k * 0.07, 0.6)
dsp.place(sfx, dsp.chime(), F[12]["cues"][1]["t"] + 0.2, 0.45)
for k, d in enumerate([0, 2, 4, 7, 9]):  # rewards sparkle
    dsp.place(sfx, dsp.bell(hz(deg(d + 7)), 1.2), F[16]["cues"][0]["t"] + k * 0.06, 0.5)
dsp.place(sfx, dsp.riser(0.9), FIN - 0.95, 0.6)
dsp.place(sfx, dsp.impact(0.9), FIN, 0.9)
dsp.place(sfx, dsp.chime(), hk, 0.5)

# ── mix
envv = np.abs(voice).max(1)
win = int(0.05 * SR)
envv = np.convolve(envv, np.ones(win) / win, "same")
envv /= envv.max() + 1e-9
duck = 10 ** (-8.5 * np.clip(envv * 4, 0, 1) / 20)
from scipy import signal  # noqa: E402

b, a = signal.butter(1, 3 / (SR / 2))
duck = signal.filtfilt(b, a, duck)
music *= duck[:, None]


def norm_peak(x, db):
    return x / (np.abs(x).max() + 1e-9) * 10 ** (db / 20)


mix = norm_peak(music, -10.0) + norm_peak(sfx, -6.5) + norm_peak(voice, -2.0)
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
fo = int(1.5 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = norm_peak(mix, -1.0)
with wave.open(f"{ROOT}/public/audio/mix_v2.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("wrote mix_v2.wav")

# loudness for Instagram (~-14 LUFS, -1 dBTP)
import os  # noqa: E402
import subprocess  # noqa: E402

_src = f"{ROOT}/public/audio/mix_v2.wav"
_tmp = f"{ROOT}/public/audio/mix_v2_ln.wav"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", _src, "-af", "loudnorm=I=-14:TP=-1.0:LRA=11", "-ar", "48000", _tmp], check=True)
os.replace(_tmp, _src)
print("loudness-normalised")
