# -*- coding: utf-8 -*-
# Draws the six depth scenes as SVG: a full picture (bg) and the standout subject alone on a transparent layer (fg), same coordinates.
import math, random, json, sys
W, H = 1920, 1080

def rnd(seed): return random.Random(seed)

def noise_line(r, n, amp, rough=0.55):
    """1-D fractal noise, n points, values in [-amp, amp]"""
    vals = [0.0] * n
    for o in range(1, 7):
        step = max(1, n // (2 ** o)); a = amp * (rough ** (o - 1)) / 1.4
        pts = [r.uniform(-a, a) for _ in range(n // step + 2)]
        for i in range(n):
            k = i / step; i0 = int(k); f = k - i0; f = f * f * (3 - 2 * f)
            vals[i] += pts[i0] * (1 - f) + pts[i0 + 1] * f
    return vals

def ridge(r, base, amp, color, y0=0, rough=0.55, peaks=None, n=240, opacity=1.0, extra=''):
    xs = [W * i / (n - 1) for i in range(n)]
    ns = noise_line(r, n, amp, rough)
    pts = []
    for x, v in zip(xs, ns):
        y = base + v
        if peaks:
            for (px, ph, pw) in peaks: y -= ph * math.exp(-((x - px) / pw) ** 2)
        pts.append((x, y))
    d = 'M0,%d L' % H + ' '.join('%.1f,%.1f' % p for p in pts) + ' L%d,%d Z' % (W, H)
    return '<path d="%s" fill="%s" opacity="%.2f" %s/>' % (d, color, opacity, extra)

def dune(r, base, amp, color, phase=0, opacity=1.0, tilt=0):
    pts = []
    for i in range(0, 241):
        x = W * i / 240
        y = base + amp * math.sin(x / 310 + phase) * 0.7 + amp * 0.45 * math.sin(x / 130 + phase * 1.7) + tilt * (x / W - .5)
        pts.append((x, y))
    d = 'M0,%d L' % H + ' '.join('%.1f,%.1f' % p for p in pts) + ' L%d,%d Z' % (W, H)
    return '<path d="%s" fill="%s" opacity="%.2f"/>' % (d, color, opacity)

def cloud(x, y, w, h, color, op):
    return '<ellipse cx="%d" cy="%d" rx="%d" ry="%d" fill="%s" opacity="%.2f" filter="url(#blur40)"/>' % (x, y, w, h, color, op)

def stars(r, n, ymax):
    o = ''
    for _ in range(n):
        o += '<circle cx="%.0f" cy="%.0f" r="%.1f" fill="#fff" opacity="%.2f"/>' % (r.uniform(0, W), r.uniform(0, ymax), r.uniform(.6, 1.6), r.uniform(.25, .8))
    return o

DEFS = '''<defs>
<filter id="blur40" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="38"/></filter>
<filter id="blur12" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="12"/></filter>
<filter id="blur3"><feGaussianBlur stdDeviation="2.2"/></filter>
<filter id="rough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="4" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="14" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .5 -.12"/></filter>
<radialGradient id="vig" cx="50%" cy="48%" r="75%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".55"/></radialGradient>
</defs>'''

def sky(stops, sun=None, extra=''):
    g = '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">' + ''.join('<stop offset="%s" stop-color="%s"/>' % s for s in stops) + '</linearGradient>'
    o = '<defs>%s</defs><rect width="%d" height="%d" fill="url(#sky)"/>' % (g, W, H)
    if sun:
        cx, cy, rr, c1, c2 = sun
        o += '<defs><radialGradient id="sunglow"><stop offset="0" stop-color="%s" stop-opacity="1"/><stop offset=".18" stop-color="%s" stop-opacity=".85"/><stop offset="1" stop-color="%s" stop-opacity="0"/></radialGradient></defs>' % (c1, c1, c2)
        o += '<circle cx="%d" cy="%d" r="%d" fill="url(#sunglow)"/><circle cx="%d" cy="%d" r="%d" fill="%s" opacity=".95"/>' % (cx, cy, rr * 4.2, cx, cy, rr, '#fff3d6')
    return o + extra

def crenel(x, y, w, n, h, color):
    """small square teeth along a roof edge"""
    cw = w / (2 * n - 1); o = ''
    for i in range(n): o += '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"/>' % (x + i * 2 * cw, y - h, cw, h + 1, color)
    return o

def palm(x, y, h, lean, color, r):
    """a palm: curved trunk and drooping fronds"""
    top = (x + lean, y - h); o = '<path d="M%d,%d Q%d,%d %.1f,%.1f" stroke="%s" stroke-width="%d" fill="none" stroke-linecap="round"/>' % (x, y, x + lean * .2, y - h * .6, top[0], top[1], color, max(5, h / 28))
    for i in range(11):
        a = -math.pi + (i / 10) * math.pi; L = h * .45 * r.uniform(.8, 1.1)
        ex = top[0] + math.cos(a) * L; ey = top[1] + math.sin(a) * L * .35 + L * .38
        o += '<path d="M%.1f,%.1f Q%.1f,%.1f %.1f,%.1f" stroke="%s" stroke-width="%d" fill="none" stroke-linecap="round"/>' % (top[0], top[1], (top[0] + ex) / 2, min(top[1], ey) - L * .2, ex, ey, color, max(3, h / 55))
    return o

def lit_poly(pts, base, light, shade, lightx=-1, id_='p'):
    """a flat-lit solid: warm on the sun side, dark on the other"""
    d = 'M' + ' L'.join('%.1f,%.1f' % p for p in pts) + ' Z'
    xs = [p[0] for p in pts]; x0, x1 = min(xs), max(xs)
    gid = 'lg%s' % id_
    gd = '<defs><linearGradient id="%s" gradientUnits="userSpaceOnUse" x1="%.0f" y1="0" x2="%.0f" y2="0"><stop offset="0" stop-color="%s"/><stop offset=".35" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient></defs>' % (gid, x0 if lightx < 0 else x1, x1 if lightx < 0 else x0, light, base, shade)
    return gd + '<path d="%s" fill="url(#%s)"/>' % (d, gid)

COMMON_TOP = '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">' % (W, H, W, H) + DEFS

def finish(bg, fg_svg, with_fx=True):
    full = COMMON_TOP + bg + fg_svg
    if with_fx: full += '<rect width="%d" height="%d" fill="url(#vig)"/><rect width="%d" height="%d" filter="url(#grain)" opacity=".5"/>' % (W, H, W, H)
    full += '</svg>'
    fg = COMMON_TOP + fg_svg + '</svg>'
    return full, fg

# =============================================================== 1. Tassili: sandstone arch and pillars
def tassili():
    r = rnd(11)
    bg = sky([('0', '#3a2a6e'), ('.35', '#a64a8c'), ('.62', '#f08a5d'), ('1', '#ffc27a')], sun=(1330, 560, 46, '#ffd9a0', '#ff9a5a'))
    bg += cloud(520, 300, 380, 40, '#ffc4a8', .35) + cloud(1450, 220, 300, 30, '#f7a0c0', .3) + stars(r, 60, 260)
    bg += ridge(r, 690, 40, '#7a3f6a', peaks=[(300, 110, 200), (1500, 150, 260)], opacity=.9)
    bg += ridge(r, 760, 36, '#5c2f58', peaks=[(1000, 60, 300)], opacity=.95)
    bg += dune(r, 880, 40, '#8d4a52', 1.0) + dune(r, 940, 36, '#6a3a4a', 2.3)
    # the subject: a great sandstone arch (two pillars joined at the top) with strata
    pil = []
    def rock(pts, id_):
        out = []
        for i in range(len(pts)):
            a, b = pts[i], pts[(i + 1) % len(pts)]
            steps = max(2, int(math.hypot(b[0] - a[0], b[1] - a[1]) / 26))
            for k in range(steps):
                t = k / steps; out.append((a[0] + (b[0] - a[0]) * t + r.uniform(-7, 7), a[1] + (b[1] - a[1]) * t + r.uniform(-6, 6)))
        return lit_poly(out, '#b0562f', '#f2a064', '#4b2431', -1, id_)
    arch = [(640, 1080), (668, 800), (700, 560), (740, 430), (790, 360), (860, 330), (960, 300), (1040, 290), (1100, 320), (1160, 360), (1215, 440), (1260, 600), (1295, 820), (1330, 1080),
            (1190, 1080), (1160, 860), (1140, 700), (1100, 590), (1040, 520), (980, 505), (910, 530), (860, 590), (815, 700), (790, 860), (780, 1080)]
    sub = rock(arch, 'a')
    # strata lines
    for yy in range(330, 1060, 38):
        sub += '<path d="M%d,%d Q960,%d %d,%d" stroke="#3a1c26" stroke-opacity=".22" stroke-width="3" fill="none" clip-path="url(#archclip)"/>' % (640, yy, yy + r.uniform(-14, 14), 1330, yy + r.uniform(-10, 10))
    clip = '<defs><clipPath id="archclip"><path d="M%s Z"/></clipPath></defs>' % ' L'.join('%d,%d' % p for p in arch)
    # small rock stacks beside it
    side = rock([(240, 1080), (270, 840), (330, 700), (400, 650), (470, 720), (520, 860), (560, 1080)], 'b') + rock([(1520, 1080), (1560, 880), (1620, 760), (1700, 720), (1770, 800), (1810, 940), (1850, 1080)], 'c')
    fg = clip + side + sub
    return finish(bg, fg)

# =============================================================== 2. Taghit: dunes and the mud ksar
def taghit():
    r = rnd(21)
    bg = sky([('0', '#2d2060'), ('.3', '#8a3f8e'), ('.58', '#ee7d6a'), ('1', '#ffb36b')], sun=(560, 620, 52, '#ffe2a8', '#ff8f5c'))
    bg += cloud(1300, 260, 420, 36, '#ffb0b0', .33) + cloud(420, 200, 300, 30, '#d58de0', .3) + stars(r, 50, 240)
    bg += dune(r, 700, 70, '#c0605a', .4, .9) + dune(r, 790, 80, '#a64a52', 1.9) + dune(r, 880, 70, '#843a4c', 3.1)
    # subject: a hill crowned with a mud-brick ksar (towers and crenellated walls)
    hill = [(520, 1080), (600, 860), (700, 740), (820, 680), (960, 650), (1100, 680), (1230, 750), (1330, 870), (1420, 1080)]
    sub = lit_poly(hill, '#b55a3a', '#e89a62', '#4d2430', -1, 'h')
    def tower(x, w, top, base, id_, cren=True, door=True):
        o = lit_poly([(x, base), (x, top), (x + w, top), (x + w, base)], '#c0663f', '#f0a56a', '#582b33', -1, id_)
        if cren: o += crenel(x - 2, top, w + 4, max(3, int(w / 26)), 16, '#8a4630')
        if door: o += '<path d="M%.0f,%.0f v-%d a%.0f,%.0f 0 0 1 %.0f,0 v%d z" fill="#2a1420" opacity=".85"/>' % (x + w * .32, base - 6, w * .26, w * .18, w * .18, w * .36, w * .26)
        return o
    sub += tower(840, 110, 520, 740, 't1') + tower(980, 150, 300, 740, 't2') + tower(1170, 100, 470, 760, 't3')
    sub += tower(700, 130, 600, 800, 't4') + tower(1260, 130, 580, 820, 't5') + tower(580, 100, 700, 890, 't6')
    # little windows
    for (wx, wy) in [(1010, 380), (1060, 440), (1010, 520), (870, 590), (1200, 540), (730, 680)]:
        sub += '<rect x="%d" y="%d" width="14" height="26" rx="6" fill="#2a1420" opacity=".8"/>' % (wx, wy)
    sub += '<path d="M470,1080 C640,990 900,1000 1060,1010 C1260,1000 1500,990 1650,1080 Z" fill="#7a3548"/>'
    return finish(bg, sub)

# =============================================================== 3. Djurdjura: jagged snow peak
def djurdjura():
    r = rnd(31)
    bg = sky([('0', '#251c58'), ('.32', '#7b3f93'), ('.6', '#e5718c'), ('1', '#ffbf8a')], sun=(1500, 600, 40, '#fff0d0', '#ff9aa0'))
    bg += cloud(380, 260, 360, 30, '#ffd0e0', .35) + cloud(1200, 180, 420, 34, '#c098f0', .3) + stars(r, 80, 300)
    bg += ridge(r, 640, 70, '#7f4a86', rough=.62, peaks=[(250, 140, 190), (1560, 190, 230)], opacity=.85)
    bg += ridge(r, 730, 60, '#5f3a74', rough=.6, peaks=[(1000, 70, 280)], opacity=.95)
    # subject: the great central peak with a snow cap, and lower slopes
    pk = [(380, 1080), (520, 800), (640, 640), (730, 520), (800, 440), (860, 360), (910, 310), (940, 268), (975, 292), (1010, 330), (1050, 420), (1090, 470), (1150, 560), (1230, 680), (1330, 800), (1500, 1080)]
    out = []
    for i in range(len(pk) - 1):
        a, b = pk[i], pk[i + 1]
        for k in range(5):
            t = k / 5; out.append((a[0] + (b[0] - a[0]) * t + r.uniform(-9, 9), a[1] + (b[1] - a[1]) * t + r.uniform(-8, 8)))
    out.append(pk[-1])
    sub = lit_poly(out, '#6a4690', '#c389b5', '#2c1d4c', -1, 'm')
    snow = [p for p in out if p[1] < 560]
    if snow:
        sd = 'M' + ' L'.join('%.1f,%.1f' % p for p in snow)
        sd += ' L%.1f,%.1f ' % (snow[-1][0] - 30, snow[-1][1] + 70)
        for x in range(int(snow[-1][0]) - 30, int(snow[0][0]), -38): sd += 'L%d,%d ' % (x, 480 + 60 * math.sin(x / 41.0) + r.uniform(-18, 18))
        sd += 'Z'
        sub += '<path d="%s" fill="#ffeef4" opacity=".92"/>' % sd
    # ridges across the slopes (rock gullies)
    for i in range(14):
        x = r.uniform(620, 1260); y = r.uniform(560, 960)
        sub += '<path d="M%.0f,%.0f l%.0f,%.0f" stroke="#2c1d4c" stroke-opacity=".28" stroke-width="%d" stroke-linecap="round"/>' % (x, y, r.uniform(-60, 40), r.uniform(70, 150), r.randint(3, 8))
    sub += '<path d="M0,1080 L0,930 C300,880 520,940 760,990 C1100,1040 1500,930 1920,900 L1920,1080 Z" fill="#33224d"/>'
    return finish(bg, sub)

# =============================================================== 4. Timimoun: the red kasbah, palms
def timimoun():
    r = rnd(41)
    bg = sky([('0', '#33205e'), ('.3', '#9a3f8a'), ('.58', '#f27a6a'), ('1', '#ffb870')], sun=(1380, 640, 50, '#ffe0a0', '#ff8a5a'))
    bg += cloud(520, 250, 400, 34, '#ffb4b4', .34) + cloud(1500, 330, 260, 26, '#e08fd0', .3) + stars(r, 45, 220)
    bg += dune(r, 780, 60, '#b5503f', .3, .9) + dune(r, 880, 60, '#923a3e', 2.0)
    sub = ''
    def kasba(x, w, top, base, id_, tiers=2):
        o = lit_poly([(x, base), (x, top), (x + w, top), (x + w, base)], '#c24b32', '#f08a5a', '#4e1f2e', -1, id_)
        # pointed teeth (the Sudanese style)
        n = max(3, int(w / 34)); tw = w / n
        for i in range(n): o += '<path d="M%.1f,%.1f l%.1f,-%.1f l%.1f,%.1f z" fill="#b5412c"/>' % (x + i * tw, top, tw / 2, tw * 1.2, tw / 2, tw * 1.2)
        for t in range(tiers):
            ty = top + 60 + t * 150
            for k in range(2):
                wx = x + w * (.25 + .4 * k)
                o += '<path d="M%.0f,%.0f v-%d a%d,%d 0 0 1 %d,0 v%d z" fill="#2a1220" opacity=".8"/>' % (wx, ty + 60, 38, 15, 15, 30, 38)
        return o
    sub += kasba(720, 150, 420, 1000, 'k1') + kasba(1060, 170, 300, 1000, 'k2', 3) + kasba(900, 150, 480, 1000, 'k3') + kasba(1250, 150, 540, 1000, 'k4') + kasba(560, 150, 600, 1000, 'k5')
    sub += '<path d="M380,1080 C560,1000 800,980 960,990 C1200,980 1500,1000 1680,1080 Z" fill="#7c2f3e"/>'
    sub += palm(420, 1020, 560, -40, '#2a1a30', r) + palm(1560, 1030, 620, 60, '#2a1a30', r) + palm(1440, 1040, 420, -20, '#3a2038', r) + palm(520, 1040, 380, 30, '#3a2038', r)
    return finish(bg, sub)

# =============================================================== 5. Ghardaia: the M'zab minaret and stepped houses
def ghardaia():
    r = rnd(51)
    bg = sky([('0', '#2c2260'), ('.3', '#8d4396'), ('.6', '#f08a96'), ('1', '#ffc08a')], sun=(520, 560, 44, '#fff0c8', '#ffa0a0'))
    bg += cloud(1380, 240, 400, 32, '#ffc8e0', .34) + cloud(340, 330, 300, 28, '#c8a0f0', .3) + stars(r, 55, 240)
    bg += ridge(r, 760, 50, '#9d5a8c', rough=.5, opacity=.8)
    # stepped hill town in pastel
    hill = [(0, 1080), (0, 900), (260, 830), (520, 760), (760, 700), (960, 680), (1160, 700), (1400, 770), (1660, 840), (1920, 900), (1920, 1080)]
    sub = lit_poly(hill, '#e8a090', '#ffd2b0', '#6a3d58', -1, 'town')
    cols = [('#f7c9b0', '#c7728a'), ('#e9a7b8', '#9a5a86'), ('#f5d9a0', '#c28660'), ('#b9c4e8', '#7f6aa8')]
    for row, y0 in reversed(list(enumerate([930, 860, 800, 750]))):
        x = -20
        while x < W:
            w = r.randint(90, 170); h = r.randint(60, 120); c = cols[r.randint(0, 3)]
            if abs(x - 960) > 120 or row < 2:
                sub += '<rect x="%d" y="%d" width="%d" height="%d" fill="%s"/><rect x="%d" y="%d" width="%d" height="%d" fill="%s" opacity=".55"/>' % (x, y0 - h, w, h + 120, c[0], x + w * .62, y0 - h, w * .38, h + 120, c[1])
                sub += '<rect x="%d" y="%d" width="16" height="26" rx="7" fill="#33203f" opacity=".7"/>' % (x + w * .25, y0 - h + 22)
            x += w - 6
    # the minaret: stepped truncated pyramid with a pinnacle (its body is the standout subject)
    cx = 960
    m = [(cx - 150, 1000), (cx - 120, 760), (cx - 92, 520), (cx - 62, 380), (cx - 28, 300), (cx, 232), (cx + 28, 300), (cx + 62, 380), (cx + 92, 520), (cx + 120, 760), (cx + 150, 1000)]
    sub += lit_poly(m, '#e6b494', '#ffe2c0', '#7a4560', -1, 'mn')
    for i, yy in enumerate([380, 470, 570, 690, 830]):
        hw = 56 + i * 20
        sub += '<path d="M%d,%d L%d,%d" stroke="#8c5a6a" stroke-width="5" stroke-opacity=".5"/>' % (cx - hw, yy, cx + hw, yy)
    for yy in (520, 700, 880): sub += '<path d="M%d,%d v-%d a%d,%d 0 0 1 %d,0 v%d z" fill="#33203f" opacity=".75"/>' % (cx - 15, yy + 40, 42, 15, 15, 30, 42)
    sub += '<circle cx="%d" cy="226" r="12" fill="#fff3da"/><path d="M%d,226 v-28" stroke="#fff3da" stroke-width="4"/>' % (cx, cx)
    sub += '<path d="M0,1080 L0,1000 C400,960 800,1010 1200,980 C1500,960 1700,1000 1920,990 L1920,1080 Z" fill="#40264d"/>'
    return finish(bg, sub)

# =============================================================== 6. Constantine: the bridge over the gorge
def constantine():
    r = rnd(61)
    bg = sky([('0', '#2a2166'), ('.32', '#7e3f9a'), ('.6', '#ee7aa0'), ('1', '#ffbe90')], sun=(1580, 540, 42, '#fff0d0', '#ff98a8'))
    bg += cloud(480, 240, 420, 34, '#ffc4e8', .34) + cloud(1300, 190, 340, 28, '#d0a0f8', .3) + stars(r, 60, 260)
    bg += ridge(r, 700, 60, '#8a4f9a', rough=.55, opacity=.8) + ridge(r, 780, 50, '#6a3d86', opacity=.9)
    # the gorge: two cliffs with houses
    left = [(0, 1080), (0, 640), (220, 600), (420, 640), (520, 760), (580, 1080)]
    right = [(1920, 1080), (1920, 620), (1700, 590), (1500, 650), (1400, 780), (1340, 1080)]
    sub = lit_poly(left, '#7a4a62', '#c98aa0', '#35203e', -1, 'cl') + lit_poly(right, '#7a4a62', '#c98aa0', '#35203e', -1, 'cr')
    for (x0, x1, y0) in [(20, 500, 600), (1430, 1900, 590)]:
        x = x0
        while x < x1:
            w = r.randint(44, 80); h = r.randint(36, 70)
            sub += '<rect x="%d" y="%d" width="%d" height="%d" fill="%s"/>' % (x, y0 - h + 20 + 18 * math.sin(x / 90), w, h, ['#f0c0a8', '#e0a0b8', '#f4d8b0'][r.randint(0, 2)])
            x += w + 4
    # suspension bridge: two pylons, main cable, deck and hangers
    deck = 700
    for px in (700, 1220):
        sub += lit_poly([(px - 34, deck + 30), (px - 28, 330), (px + 28, 330), (px + 34, deck + 30)], '#8a5068', '#e0a0b0', '#3a2244', -1, 'p%d' % px)
        sub += '<rect x="%d" y="320" width="76" height="22" rx="6" fill="#3a2244"/>' % (px - 38)
    cab = 'M0,%d Q350,%d 700,336 Q960,%d 1220,336 Q1570,%d 1920,%d' % (deck - 60, deck - 140, 760, deck - 140, deck - 60)
    sub += '<path d="%s" stroke="#2a1a38" stroke-width="7" fill="none"/>' % cab
    for x in range(40, 1900, 44):
        t = x / 1920.0
        # cable y at x: approximate by interpolation along the shape (piecewise parabola)
        if x < 700: y = (deck - 60) + (336 - (deck - 60)) * ((x / 700.0) ** 1.5)
        elif x < 1220: u = (x - 700) / 520.0; y = 336 + (600 - 336) * 4 * u * (1 - u) * .9
        else: y = 336 + ((deck - 60) - 336) * (((x - 1220) / 700.0) ** 1.5)
        sub += '<path d="M%d,%.0f V%d" stroke="#2a1a38" stroke-width="2.4" stroke-opacity=".75"/>' % (x, y, deck)
    sub += '<rect x="0" y="%d" width="1920" height="22" fill="#34203e"/><rect x="0" y="%d" width="1920" height="8" fill="#9a6080" opacity=".7"/>' % (deck, deck)
    sub += '<path d="M0,1080 L0,1030 C500,1000 900,1040 1300,1010 C1600,990 1800,1020 1920,1030 L1920,1080 Z" fill="#2c1a38"/>'
    return finish(bg, sub)


# =============================================================== Iraq 1. Haibat Sultan (Koya): twin-peaked rocky mountain
def haibat():
    r = rnd(71)
    bg = sky([('0', '#2b2062'), ('.3', '#8b4392'), ('.58', '#f08488'), ('1', '#ffc08a')], sun=(1420, 580, 44, '#fff0d0', '#ffa08a'))
    bg += cloud(420, 250, 420, 34, '#ffc8e0', .34) + cloud(1280, 200, 360, 30, '#c8a0f0', .3) + stars(r, 60, 260)
    bg += ridge(r, 690, 60, '#8a4f86', rough=.58, peaks=[(300, 120, 220), (1580, 150, 260)], opacity=.85)
    pk = [(300, 1080), (460, 840), (580, 640), (680, 500), (760, 400), (830, 330), (880, 300), (920, 330), (960, 390), (1010, 360), (1070, 300), (1130, 320), (1190, 400), (1260, 520), (1360, 700), (1480, 880), (1620, 1080)]
    out = []
    for i in range(len(pk) - 1):
        a, b = pk[i], pk[i + 1]
        for k in range(5):
            t = k / 5; out.append((a[0] + (b[0] - a[0]) * t + r.uniform(-9, 9), a[1] + (b[1] - a[1]) * t + r.uniform(-8, 8)))
    out.append(pk[-1])
    sub = lit_poly(out, '#8a5a6a', '#e0a08c', '#3a2442', -1, 'hb')
    for i in range(22):
        x = r.uniform(520, 1400); y = r.uniform(430, 980)
        sub += '<path d="M%.0f,%.0f l%.0f,%.0f" stroke="#33203f" stroke-opacity=".3" stroke-width="%d" stroke-linecap="round"/>' % (x, y, r.uniform(-50, 40), r.uniform(60, 150), r.randint(3, 8))
    sub += '<path d="M0,1080 L0,940 C300,900 520,960 800,1000 C1100,1040 1500,940 1920,910 L1920,1080 Z" fill="#3b2a44"/>'
    sub += '<path d="M0,1010 C400,980 900,1040 1300,1000 C1600,980 1800,1010 1920,1000 L1920,1080 L0,1080 Z" fill="#4c3a40" opacity=".9"/>'
    return finish(bg, sub)

# =============================================================== Iraq 2. Rawanduz: the gorge with its bridge
def rawanduz():
    r = rnd(72)
    bg = sky([('0', '#2a2064'), ('.32', '#7d4096'), ('.6', '#ee7c98'), ('1', '#ffbe8e')], sun=(960, 560, 46, '#fff0d2', '#ff9aa0'))
    bg += cloud(420, 260, 380, 32, '#ffc0e0', .33) + cloud(1480, 210, 320, 28, '#d0a0f0', .3) + stars(r, 55, 250)
    bg += ridge(r, 720, 50, '#8a4d92', rough=.55, opacity=.8)
    L = [(0, 1080), (0, 420), (150, 380), (330, 440), (470, 560), (560, 720), (620, 1080)]
    R = [(1920, 1080), (1920, 400), (1760, 360), (1590, 430), (1450, 560), (1350, 730), (1300, 1080)]
    sub = lit_poly(L, '#7c4a5e', '#d49aa0', '#33203e', -1, 'rl') + lit_poly(R, '#7c4a5e', '#d49aa0', '#33203e', -1, 'rr')
    for (x0, x1, y0) in [(20, 440, 480), (1480, 1880, 450)]:
        x = x0
        while x < x1:
            w = r.randint(40, 70); h = r.randint(30, 60)
            sub += '<rect x="%d" y="%d" width="%d" height="%d" fill="%s"/>' % (x, y0 - h + 30 * math.sin(x / 80), w, h, ['#f0c0a8', '#e0a0b8', '#f4d8b0'][r.randint(0, 2)])
            x += w + 4
    # an arch bridge across the gorge
    sub += '<path d="M440,600 Q960,100 1480,600 L1480,640 Q960,210 440,640 Z" fill="#33203e"/><rect x="440" y="584" width="1040" height="20" fill="#4a2c4a"/>'
    for x in range(520, 1420, 60):
        u = (x - 440) / 1040.0; top = 600 - 4 * u * (1 - u) * 400
        sub += '<path d="M%d,%.0f V590" stroke="#33203e" stroke-width="6"/>' % (x, top + 20)
    # waterfall glow
    sub += '<path d="M940,720 L980,720 L1000,1080 L920,1080 Z" fill="#f4e0f0" opacity=".55"/>'
    sub += '<path d="M0,1080 L0,1020 C500,990 900,1040 1300,1010 C1600,990 1800,1020 1920,1020 L1920,1080 Z" fill="#2e1c3a"/>'
    return finish(bg, sub)

# =============================================================== Iraq 3. Halgurd: the sharp snow peak
def halgurd():
    r = rnd(73)
    bg = sky([('0', '#231c5a'), ('.3', '#7a3f94'), ('.58', '#e8708c'), ('1', '#ffbc8a')], sun=(420, 600, 40, '#fff2d6', '#ff9aa0'))
    bg += cloud(1380, 250, 420, 32, '#ffd0e4', .34) + cloud(520, 190, 360, 28, '#c8a0f4', .3) + stars(r, 85, 300)
    bg += ridge(r, 650, 80, '#7a4a88', rough=.62, peaks=[(300, 150, 200), (1620, 200, 240)], opacity=.85)
    bg += ridge(r, 740, 60, '#5c3a76', rough=.6, peaks=[(1180, 80, 260)], opacity=.95)
    pk = [(420, 1080), (560, 820), (680, 650), (770, 520), (840, 420), (890, 340), (935, 285), (960, 250), (985, 290), (1030, 360), (1090, 450), (1160, 560), (1240, 690), (1340, 830), (1520, 1080)]
    out = []
    for i in range(len(pk) - 1):
        a, b = pk[i], pk[i + 1]
        for k in range(5):
            t = k / 5; out.append((a[0] + (b[0] - a[0]) * t + r.uniform(-7, 7), a[1] + (b[1] - a[1]) * t + r.uniform(-6, 6)))
    out.append(pk[-1])
    sub = lit_poly(out, '#664a92', '#c493b8', '#2a1c4e', -1, 'hg')
    snow = [p for p in out if p[1] < 640]
    sd = 'M' + ' L'.join('%.1f,%.1f' % p for p in snow) + ' L%.1f,%.1f ' % (snow[-1][0] - 30, snow[-1][1] + 90)
    for x in range(int(snow[-1][0]) - 30, int(snow[0][0]), -34): sd += 'L%d,%d ' % (x, 540 + 70 * math.sin(x / 37.0) + r.uniform(-20, 20))
    sub += '<path d="%sZ" fill="#fff0f6" opacity=".94"/>' % sd
    for i in range(16):
        x = r.uniform(640, 1260); y = r.uniform(600, 980)
        sub += '<path d="M%.0f,%.0f l%.0f,%.0f" stroke="#2a1c4e" stroke-opacity=".28" stroke-width="%d" stroke-linecap="round"/>' % (x, y, r.uniform(-60, 40), r.uniform(70, 150), r.randint(3, 8))
    sub += '<path d="M0,1080 L0,940 C300,890 520,950 780,1000 C1100,1040 1500,930 1920,900 L1920,1080 Z" fill="#33224d"/>'
    return finish(bg, sub)

# =============================================================== Iraq 4. Dukan Dam: the lake and the dam wall
def dukan():
    r = rnd(74)
    bg = sky([('0', '#2a2064'), ('.3', '#8040a0'), ('.58', '#f08aa0'), ('1', '#ffc496')], sun=(1380, 560, 48, '#fff0d0', '#ffa0a0'))
    bg += cloud(480, 240, 400, 32, '#ffc8e8', .34) + cloud(1560, 300, 280, 26, '#d0a8f4', .3) + stars(r, 50, 240)
    bg += ridge(r, 650, 70, '#8c5496', rough=.58, peaks=[(240, 130, 210), (1640, 150, 240)], opacity=.85)
    bg += ridge(r, 720, 46, '#6a4682', opacity=.95)
    # the lake mirrors the sky
    bg += '<defs><linearGradient id="lk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e88aa0"/><stop offset=".5" stop-color="#9a5aa0"/><stop offset="1" stop-color="#4a3068"/></linearGradient></defs><rect x="0" y="760" width="1920" height="320" fill="url(#lk)"/>'
    for i in range(14): bg += '<rect x="%d" y="%d" width="%d" height="3" fill="#fff0e0" opacity="%.2f"/>' % (r.randint(0, 1700), r.randint(780, 1060), r.randint(80, 240), r.uniform(.1, .3))
    # the dam: a long concrete wall with the control tower and spillway gates
    sub = lit_poly([(520, 900), (560, 820), (1360, 820), (1400, 900)], '#c8a8b0', '#f4dcd0', '#5a4060', -1, 'dw')
    sub += '<rect x="560" y="820" width="800" height="14" fill="#8c6a80"/>'
    for gx in range(600, 1330, 90): sub += '<rect x="%d" y="838" width="52" height="64" rx="5" fill="#45304f" opacity=".85"/>' % gx
    sub += lit_poly([(890, 820), (900, 400), (1020, 400), (1030, 820)], '#d8b8b8', '#fbe6d8', '#5c4262', -1, 'tw')
    sub += lit_poly([(850, 400), (860, 290), (1060, 290), (1070, 400)], '#e4c8c4', '#fdeee0', '#604868', -1, 'tw2')
    sub += '<rect x="900" y="312" width="120" height="44" rx="6" fill="#33203f" opacity=".8"/><path d="M960,290 V190" stroke="#33203f" stroke-width="7"/><circle cx="960" cy="186" r="11" fill="#ff8a70"/>'
    sub += '<path d="M0,1080 L0,1000 C500,980 900,1030 1300,1000 C1600,985 1800,1010 1920,1010 L1920,1080 Z" fill="#33203f"/>'
    return finish(bg, sub)

# =============================================================== Iraq 5. Duhok and Amadiya: the town on its rock plateau
def amadiya():
    r = rnd(75)
    bg = sky([('0', '#2a2062'), ('.32', '#8a4496'), ('.6', '#f08894'), ('1', '#ffc08c')], sun=(520, 600, 46, '#fff0d2', '#ffa08c'))
    bg += cloud(1360, 250, 400, 32, '#ffc8e4', .34) + cloud(400, 220, 320, 28, '#c8a0f0', .3) + stars(r, 55, 240)
    bg += ridge(r, 690, 70, '#8a4f90', rough=.56, peaks=[(1700, 160, 220)], opacity=.85) + ridge(r, 780, 44, '#6a4380', opacity=.95)
    rock = [(560, 1080), (590, 760), (640, 640), (760, 600), (960, 590), (1160, 600), (1290, 640), (1340, 760), (1380, 1080)]
    sub = lit_poly(rock, '#94626c', '#e0aa98', '#38203e', -1, 'ar')
    for i in range(10):
        y = 650 + i * 40
        sub += '<path d="M%d,%d q%d,%d %d,%d" stroke="#38203e" stroke-opacity=".25" stroke-width="3" fill="none"/>' % (620, y, 160, r.randint(-10, 10), 700, r.randint(-8, 8))
    # the old town on top: stepped houses, a gate tower and a minaret
    x = 640
    while x < 1280:
        w = r.randint(60, 100); h = r.randint(50, 90)
        sub += '<rect x="%d" y="%d" width="%d" height="%d" fill="%s"/><rect x="%d" y="%d" width="%d" height="%d" fill="#8a5a6a" opacity=".5"/>' % (x, 600 - h, w, h + 10, ['#f4cfb0', '#e6b0b4', '#f7dcb0'][r.randint(0, 2)], x + w * .65, 600 - h, w * .35, h + 10)
        x += w - 4
    sub += lit_poly([(1020, 600), (1034, 300), (1126, 300), (1140, 600)], '#e8c0a8', '#fde4cc', '#5c4260', -1, 'mnr')
    sub += '<path d="M1020,300 L1080,200 L1140,300 Z" fill="#c07080"/><circle cx="1080" cy="190" r="11" fill="#fff3da"/>'
    sub += '<path d="M1056,330 h48 v-30 a24,24 0 0 0 -48,0 z" fill="#33203f" opacity=".7"/><path d="M1056,470 h48 v-30 a24,24 0 0 0 -48,0 z" fill="#33203f" opacity=".7"/>'
    sub += lit_poly([(700, 600), (712, 380), (840, 380), (852, 600)], '#dcae9c', '#f8d4bc', '#5a4060', -1, 'gt') + crenel(706, 380, 140, 6, 16, '#a8707c')
    sub += '<path d="M796,600 v-70 a14,14 0 0 1 28,0 v70 z" fill="#33203f" opacity=".8"/>'
    sub += '<path d="M0,1080 L0,1000 C500,970 900,1030 1300,1000 C1600,985 1800,1010 1920,1010 L1920,1080 Z" fill="#33203f"/>'
    return finish(bg, sub)

# =============================================================== Iraq 6. Shatt al-Arab: river, palms and a dhow
def shatt():
    r = rnd(76)
    bg = sky([('0', '#2c2262'), ('.3', '#8a4294'), ('.58', '#f4846e'), ('1', '#ffb870')], sun=(960, 640, 56, '#fff0c8', '#ff9a68'))
    bg += cloud(420, 260, 420, 32, '#ffc0b0', .34) + cloud(1500, 220, 340, 28, '#e0a0d8', .3) + stars(r, 45, 220)
    bg += ridge(r, 770, 30, '#8a4a70', rough=.4, opacity=.7)
    bg += '<defs><linearGradient id="rv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb070"/><stop offset=".5" stop-color="#d0607a"/><stop offset="1" stop-color="#4a2c5c"/></linearGradient></defs><rect x="0" y="790" width="1920" height="290" fill="url(#rv)"/>'
    for i in range(18): bg += '<rect x="%d" y="%d" width="%d" height="3" fill="#fff0d8" opacity="%.2f"/>' % (r.randint(300, 1500), r.randint(800, 1060), r.randint(60, 260), r.uniform(.12, .35))
    sub = ''
    # tall date palms on both banks
    for (px, py, h, lean) in [(400, 1010, 820, -30), (560, 1020, 560, 30), (1500, 1015, 860, 30), (1360, 1025, 540, -20), (930, 1000, 760, 20)]:
        sub += palm(px, py, h, lean, '#2a1a30', r)
    # a dhow with a lateen sail
    sub += '<path d="M1020,930 Q1200,990 1420,930 L1380,900 L1060,900 Z" fill="#2e1c34"/><path d="M1200,900 V690 L1360,890 Z" fill="#f6d2b0" opacity=".95"/><path d="M1200,900 V690" stroke="#2e1c34" stroke-width="5"/>'
    sub += '<path d="M0,1080 L0,1030 C500,1010 900,1050 1300,1020 C1600,1005 1800,1030 1920,1030 L1920,1080 Z" fill="#2c1a36"/>'
    return finish(bg, sub)

# =============================================================== Iraq 7. The marshes of Dhi Qar: a reed mudhif on the water
def ahwar():
    r = rnd(77)
    bg = sky([('0', '#2a2064'), ('.3', '#8a4496'), ('.58', '#f08a8e'), ('1', '#ffc690')], sun=(1380, 640, 52, '#fff0d0', '#ffa08e'))
    bg += cloud(520, 250, 420, 32, '#ffc8e0', .34) + cloud(1480, 200, 320, 28, '#d4a8f0', .3) + stars(r, 55, 240)
    bg += ridge(r, 790, 22, '#8c5078', rough=.4, opacity=.6)
    bg += '<defs><linearGradient id="mw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4a088"/><stop offset=".5" stop-color="#b86088"/><stop offset="1" stop-color="#4c3064"/></linearGradient></defs><rect x="0" y="800" width="1920" height="280" fill="url(#mw)"/>'
    for i in range(20): bg += '<rect x="%d" y="%d" width="%d" height="3" fill="#fff0d8" opacity="%.2f"/>' % (r.randint(100, 1700), r.randint(810, 1060), r.randint(80, 260), r.uniform(.12, .32))
    sub = ''
    # the mudhif: a barrel-vaulted reed house (ribs of bundled reeds)
    cx, base = 900, 930
    sub += '<path d="M%d,%d C%d,%d %d,%d %d,%d L%d,%d C%d,%d %d,%d %d,%d Z" fill="#b8905a"/>' % (cx - 340, base, cx - 330, 430, cx + 330, 430, cx + 340, base, cx + 340, base + 30, cx + 330, 560, cx - 330, 560, cx - 340, base + 30)
    sub += lit_poly([(cx - 340, base + 30), (cx - 326, 520), (cx - 200, 360), (cx, 290), (cx + 200, 360), (cx + 326, 520), (cx + 340, base + 30)], '#c89a5e', '#f0cc90', '#5a3c48', -1, 'md')
    for i in range(-5, 6):
        x = cx + i * 58
        sub += '<path d="M%d,%d Q%d,%d %d,%d" stroke="#6a4a3a" stroke-width="7" fill="none" opacity=".75"/>' % (x, base + 20, x + i * 8, 560 - abs(i) * 6, x + i * 3, 300 + abs(i) * 30)
    for k in range(6): sub += '<path d="M%d,%d Q%d,%d %d,%d" stroke="#6a4a3a" stroke-width="5" fill="none" opacity=".5"/>' % (cx - 336, 640 + k * 50, cx, 600 + k * 50, cx + 336, 640 + k * 50)
    sub += '<path d="M%d,%d a110,150 0 0 1 220,0 v150 h-220 z" fill="#2e1c34" opacity=".9"/>' % (cx - 110, base - 150)
    # reeds around and a slim boat
    for i in range(46):
        x = r.uniform(80, 1840); h = r.uniform(150, 420); y0 = r.uniform(930, 1030)
        if abs(x - cx) < 360 and y0 < 1000: continue
        sub += '<path d="M%.0f,%.0f q%.0f,%.0f %.0f,%.0f" stroke="#3a2438" stroke-width="%d" fill="none" stroke-linecap="round"/>' % (x, y0, r.uniform(-20, 20), -h * .5, r.uniform(-40, 40), -h, r.randint(3, 6))
    sub += '<path d="M1180,1000 Q1360,1050 1560,990 L1520,970 L1220,972 Z" fill="#2e1c34"/><path d="M1500,975 L1560,900" stroke="#2e1c34" stroke-width="6"/>'
    sub += '<path d="M0,1080 L0,1040 C500,1020 900,1060 1300,1034 C1600,1020 1800,1040 1920,1040 L1920,1080 Z" fill="#2c1a36"/>'
    return finish(bg, sub)

SCENES = [('haibat', 'هيبت سلطان', haibat), ('rawanduz', 'رواندوز', rawanduz), ('halgurd', 'حلگورد', halgurd), ('dukan', 'سد دوكان', dukan), ('amadiya', 'دهوك وعمادية', amadiya), ('shatt', 'شط العرب', shatt), ('ahwar', 'أهوار ذي قار', ahwar), ('tassili', 'طاسيلي', tassili), ('taghit', 'تاغيت', taghit), ('djurdjura', 'جرجرة', djurdjura), ('timimoun', 'تيميمون', timimoun), ('ghardaia', 'غرداية', ghardaia), ('constantine', 'قسنطينة', constantine)]
if __name__ == '__main__':
    import os
    os.makedirs('./svg', exist_ok=True)
    for sid, name, fn in SCENES:
        full, fg = fn()
        open('./svg/%s.svg' % sid, 'w').write(full); open('./svg/%s_fg.svg' % sid, 'w').write(fg)
    print('ok')
