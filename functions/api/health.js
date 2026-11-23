export async function onRequestGet(context) {
  const { env = {} } = context || {};
  const startedAt = Date.now();
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  };

  const supabaseUrl = (env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const apiKey = (env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const pushConfigured = Boolean((env.VAPID_PUBLIC_KEY || '').trim() && (env.VAPID_PRIVATE_KEY || '').trim());
  const emailFallbackConfigured = Boolean((env.RESEND_API_KEY || '').trim());

  const supabaseCheck = {
    ok: false,
    configured: Boolean(supabaseUrl && apiKey),
    status: null,
    latencyMs: null
  };

  if (supabaseCheck.configured) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const pingStart = Date.now();
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
        headers: { apikey: apiKey },
        signal: controller.signal
      });
      supabaseCheck.status = res.status;
      supabaseCheck.ok = res.ok;
    } catch (err) {
      supabaseCheck.error = err?.name === 'AbortError' ? 'timeout' : 'network_error';
    } finally {
      clearTimeout(timeoutId);
      supabaseCheck.latencyMs = Date.now() - pingStart;
    }
  }

  const healthy = supabaseCheck.ok;
  const payload = {
    status: healthy ? 'ok' : 'degraded',
    service: 'kalaka-szentendre',
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    checks: {
      supabase: supabaseCheck,
      webPush: { configured: pushConfigured },
      emailFallback: { configured: emailFallbackConfigured }
    }
  };

  if (!healthy) {
    console.error(JSON.stringify({ event: 'health_check_degraded', ...payload }));
  }

  return new Response(JSON.stringify(payload), {
    status: healthy ? 200 : 503,
    headers
  });
}
