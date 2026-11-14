set -e
D=app/src/main/assets/fonts; mkdir -p $D
G=https://raw.githubusercontent.com/google/fonts/main
get(){ curl -sfL --retry 3 "$G/$2" -o "$D/$1" || true; }
get ReemKufi.ttf 'ofl/reemkufi/ReemKufi%5Bwght%5D.ttf'
get PlexArabic-Regular.ttf ofl/ibmplexsansarabic/IBMPlexSansArabic-Regular.ttf
get PlexArabic-SemiBold.ttf ofl/ibmplexsansarabic/IBMPlexSansArabic-SemiBold.ttf
get Tajawal-Regular.ttf ofl/tajawal/Tajawal-Regular.ttf
ls -la $D
