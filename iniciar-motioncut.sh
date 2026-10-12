#!/usr/bin/env bash
# MotionCut - inicia o editor no navegador (macOS/Linux). Requer Node.js 20.19+ ou 22.12+ (https://nodejs.org)
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Instale o Node.js LTS em https://nodejs.org"; exit 1; }
[ -d node_modules ] || npm install
npm run dev -- --open
