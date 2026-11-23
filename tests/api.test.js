import { describe, it, expect, vi, afterEach } from 'vitest';
import { onRequestGet as hevGet } from '../functions/api/hev.js';
import { onRequestGet as healthGet } from '../functions/api/health.js';
import {
  onRequestGet as pushGet,
  onRequestPost as pushPost
} from '../functions/api/radar-push.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('HÉV API (graceful degradation)', () => {
  it('BKK API kieséskor automatikusan menetrendi fallbackre vált', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('BKK timeout')));

    const res = await hevGet();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('max-age=30');
    expect(data.ok).toBe(true);
    expect(data.source).toBe('schedule');
    expect(data.departures).toHaveLength(3);
    expect(data.arrivals).toHaveLength(3);
    expect(data.departures[0].timeStr).toMatch(/^\d{2}:\d{2}$/);
    expect(data.arrivals[0].timeStr).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('Health API (observability)', () => {
  it('hiányzó Supabase env esetén 503 degraded választ ad', async () => {
    const res = await healthGet({ env: {} });
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(data.status).toBe('degraded');
    expect(data.checks.supabase.configured).toBe(false);
  });

  it('elérhető Supabase esetén 200 ok választ ad válaszidővel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));

    const res = await healthGet({
      env: {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key',
        VAPID_PUBLIC_KEY: 'pub',
        VAPID_PRIVATE_KEY: 'priv'
      }
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.checks.supabase.ok).toBe(true);
    expect(typeof data.checks.supabase.latencyMs).toBe('number');
    expect(data.checks.webPush.configured).toBe(true);
  });

  it('Supabase 500 hiba esetén 503 degraded státuszra vált', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('err', { status: 500 })));

    const res = await healthGet({
      env: {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key'
      }
    });
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.status).toBe('degraded');
    expect(data.checks.supabase.status).toBe(500);
  });
});

describe('Radar Push API (security gate)', () => {
  it('hiányzó VAPID_PUBLIC_KEY esetén 500-at ad GET-re', async () => {
    const res = await pushGet({ env: {} });
    expect(res.status).toBe(500);
  });

  it('VAPID_PUBLIC_KEY meglétekor no-store headerrel visszaadja a kulcsot', async () => {
    const res = await pushGet({ env: { VAPID_PUBLIC_KEY: 'pub-key-123' } });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(data.publicKey).toBe('pub-key-123');
  });

  it('Authorization Bearer token nélkül 401-gyel elutasítja a POST kérést', async () => {
    const req = new Request('https://kalakazz.hu/api/radar-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'new_ride', ride_id: '123' })
    });

    const res = await pushPost({
      request: req,
      env: {
        VAPID_PUBLIC_KEY: 'pub',
        VAPID_PRIVATE_KEY: 'priv',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-key'
      }
    });

    expect(res.status).toBe(401);
  });
});
