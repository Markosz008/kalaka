#!/usr/bin/env bash
set -e

MSG="${1:-fix: automatikus ellenorzott frissites}"

echo "🔍 1/3: Kód és függőségek előzetes ellenőrzése..."
if grep -rnI "leaflet" src/ vite.config.js 2>/dev/null; then
  echo "❌ HIBA: Régi leaflet hivatkozás maradt a kódban!"
  exit 1
fi

echo "🏗️ 2/3: Production build tesztelése (vite build)..."
npm run build

echo "🚀 3/3: Build HIBÁTLAN! Git mentés és Cloudflare Pages élesítés..."
git add -A
git commit -m "$MSG" || echo "Nincs új git változás."
git push origin main
npx wrangler pages deploy dist --project-name=kalaka-szentendre
echo "✅ KÉSZ! Sikeresen élesítve."
