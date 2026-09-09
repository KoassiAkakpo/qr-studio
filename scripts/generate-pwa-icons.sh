#!/usr/bin/env bash
# Régénère les icônes PWA à partir de app/icon.svg, qui reste la source unique.
# À relancer après toute modification du SVG, comme app/favicon.ico.
#
#   ./scripts/generate-pwa-icons.sh
#
# Les rendus passent par UN grand raster downsamplé en `-filter box`, et non par
# un rendu direct à la taille cible : le moteur SVG d'ImageMagick perd le fond
# arrondi en petit format, et le filtre par défaut adoucit le bord de chaque
# module. Les tailles choisies divisent toutes le raster intermédiaire, donc le
# moyennage par blocs est exact.
set -euo pipefail
cd "$(dirname "$0")/.."

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# 1536 = 8 x 192 = 3 x 512. Densité 4608 = 96 (défaut) x 48, pour un viewBox 32.
magick -density 4608 -background none app/icon.svg -depth 8 PNG32:"$tmp/any.png"
for s in 192 512; do
  magick "$tmp/any.png" -filter box -resize ${s}x${s} -depth 8 PNG32:"public/icon-${s}.png"
done

# Variante maskable : la plateforme applique son propre masque et rogne jusqu'à
# 20 % du bord, donc le fond est plein cadre (pas de `rx`) et le motif est réduit
# pour tenir dans la zone sûre. 0.625 = 5/8 garde les modules sur des pixels
# entiers, et la diagonale du motif (396px à 512) reste sous le cercle sûr (410px).
sed -e 's|<rect width="32" height="32" rx="6"|<rect width="32" height="32"|' \
    -e 's|\(<rect x="2" y="2"\)|<g transform="translate(16,16) scale(0.625) translate(-16,-16)">\1|' \
    -e 's|</svg>|</g></svg>|' \
    app/icon.svg > "$tmp/maskable.svg"
magick -density 4608 -background "#228be6" "$tmp/maskable.svg" -flatten -depth 8 PNG32:"$tmp/mask.png"
magick "$tmp/mask.png" -filter box -resize 512x512 -depth 8 PNG32:public/icon-maskable-512.png

# apple-icon : iOS ignore le manifeste et arrondit lui-même les coins, donc fond
# plein cadre là aussi. 1440 = 8 x 180.
magick -density 4320 -background "#228be6" "$tmp/maskable.svg" -flatten -depth 8 PNG32:"$tmp/apple.png"
magick "$tmp/apple.png" -filter box -resize 180x180 -depth 8 PNG32:app/apple-icon.png

echo "OK :"
ls -l public/icon-192.png public/icon-512.png public/icon-maskable-512.png app/apple-icon.png
