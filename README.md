# Kaláka Szentendre — Production Community PWA

[![CI/CD Pipeline](https://github.com/Markosz008/kalaka/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/Markosz008/kalaka/actions/workflows/ci-cd.yml)
[![Health & TLS Monitor](https://github.com/Markosz008/kalaka/actions/workflows/health-monitor.yml/badge.svg)](https://github.com/Markosz008/kalaka/actions/workflows/health-monitor.yml)

**Live Production URL:** [https://kalakazz.hu](https://kalakazz.hu)

A live, invite-gated hyperlocal Progressive Web App for Szentendre (~28k residents) combining neighborhood ride-sharing, local favors, crowdsourced traffic/transit alerts (11-es út & H5 HÉV), and a local service provider directory. Designed, hardened, and operated end-to-end with zero fixed infrastructure cost.

---

## Architecture Overview

~~~mermaid
flowchart LR
    U[Mobile / Desktop PWA<br/>Vite 6 + React 18 + MapLibre GL] -->|HTTPS + CSP + SW| CF[Cloudflare Edge<br/>Pages + Workers Functions]
    CF -->|/api/radar-push<br/>JWT & DB Verification| WP[Web Push Gateways<br/>FCM / Apple Push]
    CF -->|/api/hev<br/>30s Edge Cache| EXT[Transit Upstream API]
    U -->|Auth / Realtime / PostGIS RPC| SB[(Supabase<br/>PostgreSQL + RLS + Storage)]
    CF -->|Service Role Validation| SB
    U -->|Vector Tiles| MAP[OpenFreeMap Bright]
    GHA[GitHub Actions CI/CD] -->|Audit + Build + Smoke Tests| CF
    MON[Scheduled Health Monitor<br/>Every 6h] -->|HTTP + Headers + TLS Check| CF
~~~

---

## DevOps & DevSecOps Highlights

### 1. Automated CI/CD & Release Safety
* **GitHub Actions Pipeline (`.github/workflows/ci-cd.yml`):** Enforces clean lockfile installs (`npm ci`), legacy dependency guardrails, runtime vulnerability scanning (`npm audit --omit=dev --audit-level=high`), production bundling, Cloudflare Pages deployment, and automated post-deploy smoke/security regression checks.
* **Deployment Concurrency Control:** Prevents overlapping production rollouts via GitHub Actions concurrency groups.
* **Synthetic Monitoring (`.github/workflows/health-monitor.yml`):** Scheduled every 6 hours to verify frontend HTTP status/latency, edge API proxy availability (`/api/hev`), security headers, unauthorized endpoint rejection (`401`), and TLS certificate expiration (`>= 14 days` threshold).

### 2. Defense-in-Depth Security Model
* **Database-Level Zero Trust (PostgreSQL RLS):** All client mutations are enforced by Row Level Security policies and `SECURITY DEFINER` RPCs with pinned `search_path`.
* **Privilege Escalation Protection:** Database triggers block client-side modification of sensitive columns (`is_admin`, `beta_approved`, `invited_by`).
* **Concurrency & Quota Integrity:** Beta invite codes and member referral caps use atomic row-level locking (`SELECT ... FOR UPDATE`) to eliminate race conditions.
* **Edge Push Validation:** `/api/radar-push` validates caller JWTs server-side and cross-checks recent database rows before dispatching Web Push notifications, preventing client-side payload spoofing.
* **HTTP Hardening:** Custom `public/_headers` delivering strict `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, and `no-cache, no-store` invalidation rules for the Service Worker (`sw.js`).
* **GDPR Data Lifecycle:** Full self-service account deletion removes Auth credentials, relational records, push subscriptions, and Supabase Storage avatars atomically.

### 3. FinOps & Architecture Decision Record (ADR)
* **Decision:** Serverless Edge + BaaS (Cloudflare Pages/Workers + Supabase) instead of containerized cloud infrastructure (AWS ECS/RDS) for the MVP phase.
* **Rationale:** Keeps fixed operational costs at **$0/month** during community validation while retaining automatic TLS, global CDN caching, and PostgreSQL/PostGIS compatibility.
* **Scale-Out Path to AWS:** Because all business logic resides in standard PostgreSQL SQL/RPCs and stateless frontend/edge functions, migrating to AWS (`CloudFront + S3 + API Gateway/Lambda` or `ECS Fargate + RDS PostgreSQL + AWS WAF`) requires no application rewrite if traffic outgrows managed free tiers.

---

## Operational Documentation

See [`docs/RUNBOOK.md`](docs/RUNBOOK.md) for deployment procedures, instant rollback steps, secret rotation, and incident response playbooks.
