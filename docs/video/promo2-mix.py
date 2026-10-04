# Philindo One promo v2: music + sound effects (+ an optional voice-over), one 48 kHz stereo track for the 61.4 s video.
# Voice: off by default (Oliver, 4 Oct 2026: no voice-over). VOICE=on adds the 14 lines (vo0..vo13.wav), each trimmed
# to its last word and placed on its scene.
# Music: Mixkit "Better Times are Coming" (Mixkit free licence), dipped under the voice when there is one.
# Sound effects: made here from scratch (no samples), timed to the animation.
import json, os, subprocess, sys
import numpy as np

FF = os.environ.get('FF') or __import__('imageio_ffmpeg').get_ffmpeg_exe()
SR, T = 48000, 61.4
N = int(SR * T)
rng = np.random.default_rng(7)
VOICE = os.environ.get('VOICE', 'off') == 'on'

def load(path, *af):
    cmd = [FF, '-nostdin', '-v', 'error', '-i', path]
    if af: cmd += ['-af', ','.join(af)]
    raw = subprocess.run(cmd + ['-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()

def place(buf, x, t, gain=1.0):
    i = int(round(t * SR))
    if i >= len(buf): return
    x = x[: len(buf) - i]
    buf[i:i + len(x)] += x * gain

def db(v): return 10 ** (v / 20)

# ---------- voice ----------
# end of the last word (+0.22 s), measured with Whisper on the start-trimmed lines
END = [1.68, 1.78, 3.66, 2.12, 2.2, 5.86, 3.44, 3.18, 5.2, 4.76, 3.54, 3.26, 1.96, 2.9]
AT = [1.6, 5.5, 8.5, 12.4, 18.1, 21.7, 28.0, 31.9, 35.4, 40.85, 46.0, 50.1, 53.7, 57.3]
vo = np.zeros((N, 2), np.float32)
for i, (end, at) in enumerate(zip(END, AT) if VOICE else []):
    L = end + 0.13
    x = load(f'vo{i}.wav', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02',
             f'atrim=0:{L:.3f}', f'afade=t=out:st={L - 0.12:.3f}:d=0.12', 'afade=t=in:d=0.01')
    rms = np.sqrt(np.mean(x[np.abs(x).max(1) > 0.01] ** 2))
    place(vo, x, at, db(-19) / max(rms, 1e-4))          # every line at the same loudness
    print(f'vo{i}: {at:5.2f}-{at + len(x) / SR:5.2f}s')

# ---------- music, dipped under the voice (stays level when there is none) ----------
m = load('music173.mp3', f'atrim=0:{T}', *(['equalizer=f=3000:t=q:w=1.5:g=-6'] if VOICE else []),   # a dip where the voice's consonants sit
         'afade=t=in:d=0.4', f'afade=t=out:st={T - 2.6}:d=2.6')
m = np.pad(m, ((0, max(0, N - len(m))), (0, 0)))[:N]
m *= db(-22) / np.sqrt(np.mean(m ** 2))
hop = SR // 100                                          # 100 control steps a second
env = np.sqrt(np.mean(vo[: N // hop * hop, 0].reshape(-1, hop) ** 2, 1))
on = (env > db(-45)).astype(float)
on = np.max([np.roll(on, s) for s in range(-15, 41)], 0)   # start 0.15 s before each word, hold 0.4 s after (pauses stay dipped)
g = np.zeros_like(on); s = 0.0
for k, v in enumerate(on):                               # fast down (60 ms), slow back up (450 ms)
    a = 1 - np.exp(-1 / (0.06 * 100)) if v > s else 1 - np.exp(-1 / (0.45 * 100))
    s += (v - s) * a; g[k] = s
gain = 1 - 0.8 * g                                       # about -14 dB while she speaks
gain = np.interp(np.arange(N), np.arange(len(gain)) * hop + hop / 2, gain)
m *= gain[:, None]

# ---------- sound effects ----------
fx = np.zeros((N, 2), np.float32)

def bandsweep(n, f0, f1, q=1.1):
    """White noise through a band-pass whose centre glides from f0 to f1 (one biquad, updated per sample)."""
    x = rng.standard_normal(n)
    fc = np.geomspace(f0, f1, n)
    y = np.zeros(n); x1 = x2 = y1 = y2 = 0.0
    for i in range(n):
        w = 2 * np.pi * fc[i] / SR; al = np.sin(w) / (2 * q); c = np.cos(w); a0 = 1 + al
        b0, b2, a1, a2 = al / a0, -al / a0, -2 * c / a0, (1 - al) / a0
        yi = b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, x[i], y1, yi; y[i] = yi
    return y

def stereo(y, pan_from=0.0, pan_to=0.0):
    p = np.linspace(pan_from, pan_to, len(y))
    return np.stack([y * np.cos((p + 1) * np.pi / 4), y * np.sin((p + 1) * np.pi / 4)], 1) * np.sqrt(2)

def norm(y): return y / (np.abs(y).max() + 1e-9)

def whoosh(dur=0.55, f0=350, f1=2600, peak=0.6, rev=False):
    n = int(dur * SR); y = bandsweep(n, f0, f1)
    t = np.linspace(0, 1, n)
    e = np.where(t < peak, (t / peak) ** 2, ((1 - t) / (1 - peak)) ** 1.6)
    y = norm(y * e)
    if rev: y = y[::-1]
    return stereo(y, -0.5, 0.5)

def thump(dur=0.6):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 42 + 70 * np.exp(-t * 18)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    y += 0.25 * norm(bandsweep(n, 2500, 800)) * np.exp(-t * 40)
    return stereo(norm(y))

def pop(pitch=1.0):
    n = int(0.12 * SR); t = np.arange(n) / SR
    f = (520 + 520 * np.exp(-t * 60)) * pitch
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 38) * np.minimum(1, t * SR / 24)
    y += 0.15 * rng.standard_normal(n) * np.exp(-t * 400)
    return stereo(norm(y))

def bell(freqs, gap=0.07, dur=0.9, decay=5.5):
    n = int((dur + gap * len(freqs)) * SR); y = np.zeros(n)
    for k, f in enumerate(freqs):
        i = int(k * gap * SR); t = np.arange(n - i) / SR
        y[i:] += (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) + 0.08 * np.sin(2 * np.pi * 3 * f * t)) \
            * np.exp(-t * decay) * np.minimum(1, t * SR / 48)
    return stereo(norm(y))

def tick():
    n = int(0.018 * SR); t = np.arange(n) / SR
    y = rng.standard_normal(n); y = np.diff(np.concatenate([[0], y])) * np.exp(-t * 500)
    return stereo(norm(y) * rng.uniform(0.6, 1.0), rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2))

def click():
    out = np.zeros((int(0.08 * SR), 2))
    for k, (dt, a) in enumerate([(0.0, 1.0), (0.045, 0.6)]):
        c = tick() * a; i = int(dt * SR); out[i:i + len(c)] += c
    return out

def shimmer(dur=1.8):
    n = int(dur * SR); t = np.arange(n) / SR; y = np.zeros(n)
    for f in (2093, 2637, 3136, 4186):
        y += np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(5, 9) * t))
    y *= np.sin(np.pi * t / dur) ** 2
    return stereo(norm(y), -0.4, 0.4)

# scene changes (the old scene lifts away while the next rises)
for t in [5.1, 8.2, 12.0, 18.4, 21.2, 27.6, 35.0, 40.4, 45.6, 49.8, 53.2, 56.4]:
    place(fx, whoosh(), t - 0.25, db(-17))
place(fx, whoosh(0.65, 2400, 300, rev=True), 16.35, db(-15))        # the eight app names fly into one
place(fx, thump(), 17.0, db(-9))                                   # ...and land as one ring
# pops: icons, chips and the logo arriving
pops = [1.15, 1.3, 1.45, 1.6, 1.75, 1.9, 6.1, 6.35, 9.2, 9.8] + [12.9 + i * 0.13 for i in range(8)] + [17.05, 18.8, 53.55, 56.9, 36.3, 36.6]
for k, t in enumerate(pops):
    place(fx, pop(rng.uniform(0.9, 1.25)), t, db(-20))
# typing the BL number in the search box
for k in range(15):
    place(fx, tick(), 22.1 + k * 0.0733 + rng.uniform(-0.01, 0.01), db(-21))
place(fx, whoosh(0.45, 600, 1800), 28.55, db(-25))                  # the form scrolls
place(fx, click(), 31.45, db(-13))                                  # the click on Send
place(fx, bell([1047, 1319, 1568], 0.075, 0.9), 31.85, db(-17))     # sent to Finance
place(fx, whoosh(0.45, 600, 1800), 37.55, db(-25))                  # Finance desk scrolls
for t in [41.7, 42.95, 44.1]:                                       # flicking from one handler to the next
    place(fx, whoosh(0.4, 500, 2200, 0.45), t - 0.05, db(-23))
for k, t in enumerate([46.6, 46.95, 47.3, 47.65, 48.0]):            # updates landing round the phone
    place(fx, bell([1568 if k % 2 else 1319, 2093], 0.06, 0.45, 9), t, db(-22))
place(fx, shimmer(), 56.7, db(-24))                                 # the end card

mix = vo + m + fx
print('peak before loudness', float(np.abs(mix).max()))
mix.astype(np.float32).tofile('mix.f32')
args = ['-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', 'mix.f32']
meas = subprocess.run([FF, '-nostdin', '-hide_banner', *args, '-af', 'loudnorm=I=-14:TP=-2:LRA=11:print_format=json', '-f', 'null', '-'],
                      capture_output=True, text=True).stderr
j = json.loads(meas[meas.rindex('{'):meas.rindex('}') + 1])
ln = (f"loudnorm=I=-14:TP=-2:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
      f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
subprocess.run([FF, '-nostdin', '-v', 'error', '-y', *args, '-af', ln + ',aresample=48000', '-c:a', 'pcm_s16le', 'mix.wav'], check=True)
os.remove('mix.f32')
print('loudness in', j['input_i'], 'LUFS; written mix.wav')
