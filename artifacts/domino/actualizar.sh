#!/bin/sh
# ------------------------------------------------------------
# actualizar.sh - descarga la ultima version de DOMINO #1
# desde GitHub y la pone en artifacts/domino (donde vive la app).
# Antes de reemplazar cada archivo, guarda una copia en
# ~/respaldo-domino/ por si algo sale mal.
# ------------------------------------------------------------
BASE="${DOMINO_BASE:-https://raw.githubusercontent.com/Brody5xx/Domino-Score-Keeper/main/artifacts/domino}"
DIR="${DOMINO_DIR:-$HOME/workspace/artifacts/domino}"
T=$(date +%s)
R="$HOME/respaldo-domino/$(date +%Y%m%d-%H%M%S)"

cd "$DIR" || { echo "No encontre la carpeta $DIR"; exit 1; }

LISTA=$(curl -fsSL "$BASE/archivos.txt?t=$T") || { echo "No pude conectar con GitHub. Revisa tu internet."; exit 1; }

OK=0; MAL=0
for f in $LISTA; do
  mkdir -p "$(dirname "$f")"
  if curl -fsSL "$BASE/$f?t=$T" -o "$f.tmp" && [ -s "$f.tmp" ]; then
    if [ -f "$f" ]; then
      mkdir -p "$R/$(dirname "$f")"
      cp "$f" "$R/$f"
    fi
    mv "$f.tmp" "$f"; echo "  OK  $f"; OK=$((OK+1))
  else
    rm -f "$f.tmp"; echo "  X   No se pudo descargar $f"; MAL=$((MAL+1))
  fi
done

# Archivos viejos que ya no se usan
VIEJOS=$(curl -fsSL "$BASE/eliminar.txt?t=$T" 2>/dev/null)
for f in $VIEJOS; do
  if [ -f "$f" ]; then
    mkdir -p "$R/$(dirname "$f")"
    cp "$f" "$R/$f"
    rm -f "$f"; echo "  --  $f (ya no se usa)"
  fi
done

echo ""
if [ "$MAL" -eq 0 ]; then
  echo "Listo! $OK archivo(s) actualizado(s)."
  [ -d "$R" ] && echo "Copia de lo anterior en: $R"
else
  echo "Hubo $MAL archivo(s) con problemas. Intenta de nuevo en un minuto."
fi
