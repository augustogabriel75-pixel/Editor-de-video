#!/usr/bin/env bash
# Gera o instalador do MotionCut para Windows (x64) a partir do Linux:
#   Electron (Windows) + editor (dist/) + FFmpeg (BtbN, GPL) -> desktop/build/MotionCut-Setup-<versão>.exe
# Requisitos: node/npm, curl, unzip, makensis (apt install nsis).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${VERSION:-$(node -p "require('$ROOT/package.json').version")}"
ELECTRON_VERSION="${ELECTRON_VERSION:-44.7.0}"
FFMPEG_ZIP="${FFMPEG_ZIP:-ffmpeg-n8.1-latest-win64-gpl-8.1.zip}"
FFMPEG_BASE="https://github.com/BtbN/FFmpeg-Builds/releases/latest/download"
ELECTRON_BASE="https://github.com/electron/electron/releases/download/v$ELECTRON_VERSION"
CACHE="$ROOT/desktop/.cache"
OUT="$ROOT/desktop/build"
APPDIR="$OUT/win-unpacked"
mkdir -p "$CACHE" "$OUT"

echo "▶ MotionCut $VERSION para Windows (Electron $ELECTRON_VERSION, $FFMPEG_ZIP)"

# 1) editor web
if [ -z "${SKIP_WEB:-}" ]; then (cd "$ROOT" && npx vite build); fi

# 2) downloads com verificação de checksum
fetch() { # url destino
  if [ ! -s "$2" ]; then curl -fL --retry 4 --retry-delay 2 -o "$2.part" "$1" && mv "$2.part" "$2"; fi
}
EZIP="$CACHE/electron-v$ELECTRON_VERSION-win32-x64.zip"
fetch "$ELECTRON_BASE/electron-v$ELECTRON_VERSION-win32-x64.zip" "$EZIP"
fetch "$ELECTRON_BASE/SHASUMS256.txt" "$CACHE/electron-v$ELECTRON_VERSION-SHASUMS256.txt"
(cd "$CACHE" && grep " \*\?electron-v$ELECTRON_VERSION-win32-x64.zip\$" "electron-v$ELECTRON_VERSION-SHASUMS256.txt" | sed 's/ \*/  /' | sha256sum -c -)

FZIP="$CACHE/$FFMPEG_ZIP"
fetch "$FFMPEG_BASE/checksums.sha256" "$CACHE/ffmpeg-checksums.sha256.new"
if ! (cd "$CACHE" && grep " $FFMPEG_ZIP\$" ffmpeg-checksums.sha256.new | sha256sum -c - >/dev/null 2>&1); then
  rm -f "$FZIP" # build novo publicado: baixa de novo
  fetch "$FFMPEG_BASE/$FFMPEG_ZIP" "$FZIP"
fi
(cd "$CACHE" && grep " $FFMPEG_ZIP\$" ffmpeg-checksums.sha256.new | sha256sum -c -)
rm -f "$CACHE/ffmpeg-checksums.sha256.new"

# 3) monta a pasta do app
rm -rf "$APPDIR" && mkdir -p "$APPDIR"
unzip -q "$EZIP" -d "$APPDIR"
mv "$APPDIR/electron.exe" "$APPDIR/MotionCut.exe"
rm -f "$APPDIR/resources/default_app.asar"
APP="$APPDIR/resources/app"
mkdir -p "$APP"
cp "$ROOT/desktop/main.cjs" "$ROOT/desktop/preload.cjs" "$APP/"
node -e "const p=require('$ROOT/desktop/package.json');p.version='$VERSION';require('fs').writeFileSync('$APP/package.json',JSON.stringify(p,null,2))"
cp -r "$ROOT/dist" "$APP/www"
rm -rf "$APP/www/models" # modelos de teste locais, se houver

ICON_SRC="$ROOT/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"
cp "$ICON_SRC" "$APP/icon.png"
cp "$ROOT/desktop/icon.ico" "$APP/icon.ico" # gerado do ícone do Android (16–256 px)

mkdir -p "$APPDIR/resources/ffmpeg"
TMPF="$(mktemp -d)"
unzip -q -j "$FZIP" '*/bin/ffmpeg.exe' '*/LICENSE.txt' -d "$TMPF"
mv "$TMPF/ffmpeg.exe" "$APPDIR/resources/ffmpeg/ffmpeg.exe"
mv "$TMPF/LICENSE.txt" "$APPDIR/resources/ffmpeg/LICENSE-FFmpeg-GPL.txt"
rm -rf "$TMPF"
cat > "$APPDIR/resources/ffmpeg/LEIA-ME.txt" <<TXT
FFmpeg ($FFMPEG_ZIP) compilado por BtbN: https://github.com/BtbN/FFmpeg-Builds
Licença GPL (ver LICENSE-FFmpeg-GPL.txt). Código-fonte: https://ffmpeg.org e o repositório acima.
O MotionCut executa este programa separado apenas para converter vídeos na importação.
TXT

node "$ROOT/desktop/set-exe-resources.mjs" "$APPDIR/MotionCut.exe" "$APP/icon.ico" "$VERSION"

# 4) lista de remoção para o desinstalador (só o que foi instalado)
{
  for f in "$APPDIR"/*; do
    n="$(basename "$f")"
    if [ -d "$f" ]; then echo "  RMDir /r \"\$INSTDIR\\$n\""; else echo "  Delete \"\$INSTDIR\\$n\""; fi
  done
} > "$OUT/uninstall-files.nsh"

# 5) instalador
SETUP="$OUT/MotionCut-Setup-$VERSION.exe"
makensis -V2 -DVERSION="$VERSION" -DAPPDIR="$APPDIR" -DOUTFILE="$SETUP" "$ROOT/desktop/installer.nsi"
echo "✔ Instalador pronto: $SETUP ($(du -h "$SETUP" | cut -f1))"
