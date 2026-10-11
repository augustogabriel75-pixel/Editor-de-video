#!/usr/bin/env bash
# Gera o APK Android do MotionCut sem Gradle/AndroidX, usando apenas:
#   aapt2, dx (ou d8), zipalign, apksigner  (Ubuntu: apt install aapt dalvik-exchange zipalign apksigner)
#   JDK 17+ e o android.jar da plataforma (baixado automaticamente se ANDROID_JAR não existir)
#
# Uso:  npm run apk            (ou)  VERSION_CODE=5 bash scripts/build-apk.sh
# Saída: android/build/MotionCut-<versão>.apk
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/android/app/src/main"
OUT="$ROOT/android/build"
APP_ID="com.motioncut.app"
MIN_SDK=24
TARGET_SDK=35
VERSION_NAME="${VERSION_NAME:-$(node -p "require('$ROOT/package.json').version")}"
VERSION_CODE="${VERSION_CODE:-$(git -C "$ROOT" rev-list --count HEAD 2>/dev/null || echo 1)}"

# ---------------------------------------------------------------- ferramentas
find_tool() {
  local name="$1"
  if [ -n "${ANDROID_HOME:-}" ] && [ -d "$ANDROID_HOME/build-tools" ]; then
    local bt
    bt="$(ls -d "$ANDROID_HOME"/build-tools/*/ 2>/dev/null | sort -V | tail -1)"
    if [ -n "$bt" ] && [ -x "$bt$name" ]; then echo "$bt$name"; return; fi
  fi
  if [ -x "/usr/lib/android-sdk/build-tools/debian/$name" ]; then echo "/usr/lib/android-sdk/build-tools/debian/$name"; return; fi
  command -v "$name" || true
}
AAPT2="$(find_tool aapt2)"
D8="$(find_tool d8)"
DX="$(find_tool dx)"
ZIPALIGN="$(find_tool zipalign)"
APKSIGNER="$(find_tool apksigner)"
for t in AAPT2 ZIPALIGN APKSIGNER; do
  [ -n "${!t}" ] || { echo "✗ ferramenta ausente: $t (apt install aapt dalvik-exchange zipalign apksigner)"; exit 1; }
done
[ -n "$D8" ] || [ -n "$DX" ] || { echo "✗ d8/dx ausente"; exit 1; }

# android.jar de uma API: SDK local (ANDROID_HOME) ou download em cache (espelho do SDK no GitHub).
platform_jar() {
  local api="$1"
  if [ -n "${ANDROID_HOME:-}" ] && [ -f "$ANDROID_HOME/platforms/android-$api/android.jar" ]; then
    echo "$ANDROID_HOME/platforms/android-$api/android.jar"; return
  fi
  local jar="$HOME/.cache/motioncut/android-$api.jar"
  if [ ! -f "$jar" ]; then
    echo "↓ baixando android.jar (API $api)…" >&2
    mkdir -p "$(dirname "$jar")"
    curl -fsSL -o "$jar.tmp" "https://raw.githubusercontent.com/Sable/android-platforms/master/android-$api/android.jar"
    mv "$jar.tmp" "$jar"
  fi
  echo "$jar"
}
ANDROID_JAR="${ANDROID_JAR:-$(platform_jar "$TARGET_SDK")}"

KEYSTORE="${KEYSTORE:-$ROOT/android/keystore/motioncut-test.keystore}"
KS_PASS="${KS_PASS:-motioncut}"
KS_ALIAS="${KS_ALIAS:-motioncut}"
if [ ! -f "$KEYSTORE" ]; then
  echo "🔑 criando keystore de teste em $KEYSTORE"
  mkdir -p "$(dirname "$KEYSTORE")"
  keytool -genkeypair -keystore "$KEYSTORE" -storepass "$KS_PASS" -keypass "$KS_PASS" -alias "$KS_ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=MotionCut Test, O=MotionCut, C=BR" >/dev/null 2>&1
fi

echo "▶ MotionCut $VERSION_NAME (code $VERSION_CODE) · minSdk $MIN_SDK · targetSdk $TARGET_SDK"

# ---------------------------------------------------------------- web
if [ "${SKIP_WEB:-0}" != "1" ]; then
  echo "▶ build web (vite)"
  (cd "$ROOT" && npm run build --silent)
fi
rm -rf "$OUT"
mkdir -p "$OUT/assets/www" "$OUT/classes" "$OUT/dex"
cp -R "$ROOT/dist/." "$OUT/assets/www/"

# ---------------------------------------------------------------- recursos + manifest
echo "▶ aapt2 compile/link"
"$AAPT2" compile --dir "$APP/res" -o "$OUT/res.zip"
sed "s#<manifest #<manifest package=\"$APP_ID\" #" "$APP/AndroidManifest.xml" > "$OUT/AndroidManifest.xml"
link() {
  "$AAPT2" link -o "$OUT/unaligned.apk" -I "$1" \
    --manifest "$OUT/AndroidManifest.xml" \
    --min-sdk-version "$MIN_SDK" --target-sdk-version "$TARGET_SDK" \
    --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
    -A "$OUT/assets" --auto-add-overlay "$OUT/res.zip"
}
# aapt2 antigos (ex.: o do Ubuntu) não leem a tabela compacta do API 35+: linka contra o API 34.
if ! link "$ANDROID_JAR" 2>"$OUT/link.log"; then
  echo "  (aapt2 não leu android-$TARGET_SDK; linkando recursos contra android-34)"
  link "$(platform_jar 34)"
fi

# ---------------------------------------------------------------- código
echo "▶ javac + dex"
find "$APP/java" -name '*.java' > "$OUT/sources.txt"
javac -nowarn -Xlint:-options -source 8 -target 8 -encoding UTF-8 -bootclasspath "$ANDROID_JAR" -d "$OUT/classes" @"$OUT/sources.txt"
if [ -n "$D8" ]; then
  "$D8" --min-api "$MIN_SDK" --lib "$ANDROID_JAR" --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')
else
  "$DX" --dex --min-sdk-version="$MIN_SDK" --output="$OUT/dex/classes.dex" "$OUT/classes"
fi
python3 - "$OUT/unaligned.apk" "$OUT/dex/classes.dex" <<'PY'
import sys, zipfile
with zipfile.ZipFile(sys.argv[1], 'a', zipfile.ZIP_DEFLATED) as z:
    z.write(sys.argv[2], 'classes.dex')
PY

# ---------------------------------------------------------------- alinhar + assinar
echo "▶ zipalign + apksigner"
"$ZIPALIGN" -p -f 4 "$OUT/unaligned.apk" "$OUT/aligned.apk"
APK="$OUT/MotionCut-$VERSION_NAME.apk"
"$APKSIGNER" sign --ks "$KEYSTORE" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" --ks-key-alias "$KS_ALIAS" \
  --min-sdk-version "$MIN_SDK" --out "$APK" "$OUT/aligned.apk"
"$APKSIGNER" verify --min-sdk-version "$MIN_SDK" "$APK"
rm -f "$OUT/unaligned.apk" "$OUT/aligned.apk" "$APK.idsig"
echo "✔ APK pronto: $APK ($(du -h "$APK" | cut -f1))"
