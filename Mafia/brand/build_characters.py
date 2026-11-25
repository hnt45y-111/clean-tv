"""يقصّ الشخصيات الـ12 من لوحة المصدر ويصدّر مكتبة الصور للعبة.
الاستعمال: python3 brand/build_characters.py   (من مجلد Mafia)"""
from PIL import Image, ImageFilter
import os

SRC = 'brand/source/characters-sheet.png'
OUT = 'client/assets/characters'
COLS = [(18, 326), (337, 614), (621, 907), (914, 1212)]
ROWS = [(20, 419), (436, 838), (855, 1257)]
NAMES = [['mafia', 'doctor', 'mafia_doctor', 'detective'],
         ['sniper', 'citizen', 'super_citizen', 'narrator'],
         ['negotiator', 'bodyguard', 'witch', 'mayor']]
# مركز الوجه (x%, y%) وحجم مربع الوجه نسبةً لعرض البطاقة
FACE = {'mafia': (.50, .19, .46), 'doctor': (.55, .18, .44), 'mafia_doctor': (.52, .17, .44), 'detective': (.55, .20, .42),
        'sniper': (.38, .19, .44), 'citizen': (.47, .19, .44), 'super_citizen': (.52, .17, .44), 'narrator': (.48, .17, .44),
        'negotiator': (.50, .19, .46), 'bodyguard': (.53, .15, .44), 'witch': (.48, .21, .44), 'mayor': (.55, .16, .44)}

def up(img, size):
    img = img.resize(size, Image.LANCZOS)
    return img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))

def main():
    sheet = Image.open(SRC).convert('RGB')
    for r, (y0, y1) in enumerate(ROWS):
        for c, (x0, x1) in enumerate(COLS):
            n = NAMES[r][c]
            card = sheet.crop((x0, y0, x1, y1)); w, h = card.size
            # بطاقة كاملة: ارتفاع 820 على لوحة شفافة موحدة 640×820
            k = 820 / h; cw = round(w * k); big = up(card, (cw, 820))
            canvas = Image.new('RGBA', (640, 820), (0, 0, 0, 0)); canvas.paste(big, ((640 - cw) // 2, 0))
            canvas.save(f'{OUT}/cards/{n}.webp', quality=86, method=6)
            # صورة بلا شريط الاسم (أعلى 79%)
            art = card.crop((6, 6, w - 6, int(h * 0.79)))
            aw, ah = art.size; k2 = 700 / ah
            up(art, (round(aw * k2), 700)).save(f'{OUT}/portraits/{n}.webp', quality=86, method=6)
            # صورة رمزية مربعة للوجه
            fx, fy, fs = FACE[n]; s = int(w * fs); cx, cy = int(w * fx), int(h * fy)
            top = max(0, cy - s // 2)
            up(card.crop((cx - s // 2, top, cx + s // 2, top + s)), (256, 256)).save(f'{OUT}/avatars/{n}.webp', quality=88, method=6)
    print('ok')

if __name__ == '__main__':
    main()
