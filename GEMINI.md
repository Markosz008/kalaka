# Kalaka Szentendre — Engineering & Operations Guide

## Architecture & Stack
- **Frontend:** Vite 6, React 18, Tailwind CSS, MapLibre GL JS (OpenFreeMap Bright tiles, lazy-loaded map views).
- **Backend & Data:** Supabase (PostgreSQL with Row Level Security, Auth, RPCs, Storage).
- **Edge & Hosting:** Cloudflare Pages & Pages Functions (`/api/health`, `/api/hev`, `/api/radar-push`, `/api/geocode`), Resend email fallback.

## Security & Reliability
- Strict `Content-Security-Policy` in `public/_headers` (no `unsafe-inline` or `unsafe-eval` in `script-src`).
- Database-enforced access control via PostgreSQL RLS (`is_beta_member()`), unique display-name indexing, and IP-hashed rate limiting on invite validation.
- Automated GitHub Actions pipelines: Gitleaks secret scanning, Vitest API tests, production build gate, and scheduled `/api/health` + TLS monitoring.

## Workflow & Conventions
- **Deploy:** Always release via `./ship.sh "commit message"` (runs preflight checks, production build, Git push, and Cloudflare Pages deploy).
- **UI Copy:** Everyday, natural Hungarian without technical jargon.
- **Database (`rides`):** Departure timestamp is stored in `departure_at` (ISO), display schedule in `schedule_label`.
