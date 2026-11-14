#!/bin/bash
# Downloads the brand fonts from Google Fonts' GitHub (kept out of the workflow file to stay under GitHub's 500 KB limit).
set -e
D=app/src/main/assets/fonts; mkdir -p $D
G=https://raw.githubusercontent.com/google/fonts/main
get(){ curl -fsSL --retry 3 "$G/$2" -o "$D/$1"; }
get Alexandria.ttf 'ofl/alexandria/Alexandria%5Bwght%5D.ttf'
get PlexArabic-Regular.ttf ofl/ibmplexsansarabic/IBMPlexSansArabic-Regular.ttf
get PlexArabic-SemiBold.ttf ofl/ibmplexsansarabic/IBMPlexSansArabic-SemiBold.ttf
get PlexArabic-Bold.ttf ofl/ibmplexsansarabic/IBMPlexSansArabic-Bold.ttf
get PlexMono-Medium.ttf ofl/ibmplexmono/IBMPlexMono-Medium.ttf
get Tajawal-Regular.ttf ofl/tajawal/Tajawal-Regular.ttf
get Tajawal-Bold.ttf ofl/tajawal/Tajawal-Bold.ttf
ls -la $D
