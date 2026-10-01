#!/usr/bin/env bash
# Recopie l'en-tête (menu) et le pied de page communs dans toutes les pages du site.
#
# Modifiez _modeles/entete.html ou _modeles/pied.html, puis lancez depuis Git Bash :
#   bash _outils/synchroniser.sh
#
# Chaque page contient deux zones balisées, remplacées à chaque lancement :
#   <!-- ENTETE:debut --> ... <!-- ENTETE:fin -->
#   <!-- PIED:debut -->   ... <!-- PIED:fin -->
set -euo pipefail
cd "$(dirname "$0")/.."

remplacer() { # $1 = page, $2 = nom de la zone, $3 = fichier modèle
  awk -v zone="$2" -v modele="$3" '
    $0 ~ "<!-- " zone ":debut -->" {
      print
      while ((getline ligne < modele) > 0) print ligne
      close(modele)
      dedans = 1
      next
    }
    $0 ~ "<!-- " zone ":fin -->" { dedans = 0 }
    !dedans { print }
  ' "$1" > "$1.tmp" && mv "$1.tmp" "$1"
}

for page in *.html; do
  if grep -q "<!-- ENTETE:debut -->" "$page"; then remplacer "$page" ENTETE _modeles/entete.html; fi
  if grep -q "<!-- PIED:debut -->" "$page"; then remplacer "$page" PIED _modeles/pied.html; fi
  echo "à jour : $page"
done
