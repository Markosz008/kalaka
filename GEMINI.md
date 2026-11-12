# Kaláka Szentendre MVP – Projekt szabályok
- Stack: Vite + React, Tailwind CSS, Leaflet, Supabase (PostgreSQL), Cloudflare Pages (`kalaka-szentendre`).
- Deploy parancs: `npm run build && npx wrangler pages deploy dist --project-name=kalaka-szentendre`
- Adatbázis (`rides` tábla): az indulási idő oszlopa `departure_at` (ISO timestamp), az ütemezés `schedule_label`.
- Kommunikáció: magyar nyelvű UI szövegek, rövid, lényegre törő válaszok.
