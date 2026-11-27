set -e
D=app/src/main/assets/fonts; mkdir -p $D
G=https://raw.githubusercontent.com/google/fonts/main
get(){ curl -sfL --retry 3 "$G/$2" -o "$D/$1" || true; }
get ReemKufi.ttf 'ofl/reemkufi/ReemKufi%5Bwght%5D.ttf'
get PlexArabic-Regular.ttf ofl/ibmplexsansarabic/IBMPlexSansArabic-Regular.ttf
get PlexArabic-SemiBold.ttf ofl/ibmplexsansarabic/IBMPlexSansArabic-SemiBold.ttf
get Tajawal-Regular.ttf ofl/tajawal/Tajawal-Regular.ttf
# the ten identities (brands.js); a font that fails to download only falls back to Tajawal
gx(){ curl -sfL --retry 3 "$G/$2" -o "$D/$1" || true; }
gx Cairo.ttf 'ofl/cairo/Cairo%5Bslnt,wght%5D.ttf'
gx Readex.ttf 'ofl/readexpro/ReadexPro%5BHEXP,wght%5D.ttf'
gx ArefRuqaa-Bold.ttf ofl/arefruqaa/ArefRuqaa-Bold.ttf
gx NotoNaskh.ttf 'ofl/notonaskharabic/NotoNaskhArabic%5Bwght%5D.ttf'
gx Scheherazade-Bold.ttf ofl/scheherazadenew/ScheherazadeNew-Bold.ttf
gx Changa.ttf 'ofl/changa/Changa%5Bwght%5D.ttf'
gx Lalezar.ttf ofl/lalezar/Lalezar-Regular.ttf
gx Almarai-Regular.ttf ofl/almarai/Almarai-Regular.ttf
gx Almarai-Bold.ttf ofl/almarai/Almarai-Bold.ttf
gx NotoKufi.ttf 'ofl/notokufiarabic/NotoKufiArabic%5Bwght%5D.ttf'
gx Markazi.ttf 'ofl/markazitext/MarkaziText%5Bwght%5D.ttf'
gx Mada.ttf 'ofl/mada/Mada%5Bwght%5D.ttf'
gx Tajawal-Medium.ttf ofl/tajawal/Tajawal-Medium.ttf
gx Tajawal-Bold.ttf ofl/tajawal/Tajawal-Bold.ttf
ls -la $D
