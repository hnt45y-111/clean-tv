"""Replace the first sentence of the narration with a newly generated one.

The rest of the narration is left exactly as generated (no cuts inside speech):
new opening + a short natural pause + the original audio from the word «من» on.
Writes public/audio/vo_final.wav and audio/vo_final_words.json.
"""
import json
import sys
import wave

import numpy as np

HERE = __file__.rsplit("/", 1)[0]
ROOT = HERE.rsplit("/audio", 1)[0] if HERE.endswith("/audio") else HERE
sys.path.insert(0, HERE)
from dsp import SR, load  # noqa: E402

opening = sys.argv[1] if len(sys.argv) > 1 else "opening_B"
GAP = 0.30

old = load(f"{ROOT}/public/audio/vo_bazzaz.mp3")
old_words = json.load(open(f"{ROOT}/audio/vo_bazzaz_words.json"))["words"]
new = load(f"{ROOT}/public/audio/{opening}.mp3")
new_words = json.load(open(f"{ROOT}/audio/{opening}_words.json"))["words"]

i_min = next(i for i, w in enumerate(old_words) if w["text"].startswith("من"))
old_cut = old_words[i_min]["start"] - 0.06
tail = old[int(old_cut * SR):].copy()

# match loudness of the new opening to the old narration's speech level
def speech_rms(x):
    m = x.mean(1)
    thr = 0.2 * np.sqrt((m ** 2).mean()) * 3
    v = m[np.abs(m) > thr]
    return float(np.sqrt((v ** 2).mean())) if len(v) else 1e-9

gain = speech_rms(old[: int(old_words[i_min - 1]["end"] * SR)]) / speech_rms(new)
new = new * gain
fo = int(0.015 * SR)
new[-fo:] *= np.linspace(1, 0, fo)[:, None]
fi = int(0.006 * SR)
tail[:fi] *= np.linspace(0, 1, fi)[:, None]

gap = np.zeros((int(GAP * SR), 2))
out = np.concatenate([new, gap, tail])
shift = len(new) / SR + GAP - old_cut

words = [dict(w) for w in new_words]
for w in old_words[i_min:]:
    w2 = dict(w)
    w2["start"] = round(w["start"] + shift, 3)
    w2["end"] = round(w["end"] + shift, 3)
    words.append(w2)

out = out / max(1.0, np.abs(out).max() / 0.98)
with wave.open(f"{ROOT}/public/audio/vo_final.wav", "wb") as f:
    f.setnchannels(2)
    f.setsampwidth(2)
    f.setframerate(SR)
    f.writeframes((out * 32767).astype(np.int16).tobytes())
json.dump({"words": words}, open(f"{ROOT}/audio/vo_final_words.json", "w"), ensure_ascii=False, indent=1)
print(f"opening gain x{gain:.2f}; new total {len(out)/SR:.2f}s (was {len(old)/SR:.2f}s); words {len(words)}; shift {shift:+.3f}s")
print("first words:", " ".join(w["text"] for w in words[:10]))
