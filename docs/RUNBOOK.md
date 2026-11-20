# Operational Runbook — Kaláka Szentendre

## 1. Environments & Critical Endpoints
* **Production Domain:** `https://kalakazz.hu` (Cloudflare Pages project: `kalaka-szentendre`)
* **Edge Functions:**
  * `POST /api/radar-push` — Authenticated Web Push dispatcher (expects valid Supabase JWT; must return `401` without auth).
  * `GET /api/hev` — Transit departure proxy with `Cache-Control: public, max-age=30`.
* **Database & Auth:** Supabase managed PostgreSQL (RLS enabled on all public tables).

---

## 2. Deployment Procedure

### Standard (Automated CI/CD)
1. Open a Pull Request or push to `main`.
2. GitHub Actions (`CI/CD Pipeline`) runs `npm ci`, dependency guardrails, `npm audit`, `vite build`, Cloudflare Pages deployment, and post-deploy smoke/security tests.

### Emergency Local Fallback
~~~bash
./ship.sh "hotfix: description"
~~~

---

## 3. Rollback Procedure

### Fast Edge Rollback (< 30 seconds)
1. Open **Cloudflare Dashboard → Workers & Pages → `kalaka-szentendre` → Deployments**.
2. Locate the last known healthy deployment and select **Rollback to this deployment**.

### Git Rollback (Persistent)
~~~bash
git revert <bad-commit-sha>
git push origin main
~~~

---

## 4. Incident Response Playbooks

### A. Frontend Unavailable or CSP Regression
* **Detection:** `Production Health & TLS Monitor` fails on HTTP status or `Content-Security-Policy` check.
* **Action:** Inspect `curl -sSI https://kalakazz.hu/`, review `public/_headers`, and run Fast Edge Rollback if caused by a recent release.

### B. `/api/hev` Edge Proxy Failure
* **Detection:** Health monitor reports non-200 on `/api/hev`.
* **Action:** Tail live logs via `wrangler pages deployment tail --project-name=kalaka-szentendre` and verify upstream transit API status.

### C. `/api/radar-push` Security or Delivery Failure
* **Detection:** Smoke test fails on `401` check, or users report missing notifications.
* **Action:** If unauthenticated requests do not return `401`, roll back immediately and audit `functions/api/radar-push.js`. Verify Cloudflare Pages secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`).

### D. TLS Certificate Expiration Warning (< 14 Days)
* **Detection:** `Production Health & TLS Monitor` fails TLS check.
* **Action:** Verify Universal SSL and DNS records in **Cloudflare Dashboard → SSL/TLS → Edge Certificates**.

---

## 5. Secret Management & Rotation

| Secret | Location | Purpose | Rotation Impact |
| :--- | :--- | :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions Secrets | CI/CD deploy to Cloudflare Pages | Zero user downtime |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions Secrets | Cloudflare target account | Static identifier |
| `VITE_SUPABASE_URL` / `ANON_KEY` | GitHub Actions Secrets | Public frontend build config | Requires rebuild & redeploy |
| `VITE_VAPID_PUBLIC_KEY` | GitHub Actions Secrets | Web Push client subscription | Requires re-subscription |
| `SUPABASE_SERVICE_ROLE_KEY` | Cloudflare Pages Secrets | Server-side push verification | Redeploy Worker |
| `VAPID_PRIVATE_KEY` | Cloudflare Pages Secrets | Signing Web Push requests | Must match public VAPID key |
