const te = new TextEncoder();

function b64UrlEncode(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64ToBytes(str) {
  const clean = (str || '').replace(/-/g, '+').replace(/_/g, '/').trim();
  const pad = clean.length % 4 === 0 ? '' : '='.repeat(4 - (clean.length % 4));
  const raw = atob(clean + pad);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function concatBytes(...arrays) {
  const total = arrays.reduce((acc, a) => acc + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

async function hmacSha256(keyBytes, dataBytes) {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, dataBytes);
  return new Uint8Array(sig);
}

async function buildVapidJwt(audience, subject, pubKeyB64, privKeyB64) {
  const pubBytes = b64ToBytes(pubKeyB64);
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: b64UrlEncode(pubBytes.slice(1, 33)),
    y: b64UrlEncode(pubBytes.slice(33, 65)),
    d: privKeyB64.trim(),
    ext: true
  };
  const signingKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const header = b64UrlEncode(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const claims = b64UrlEncode(te.encode(JSON.stringify({ aud: audience, exp, sub: subject })));
  const unsigned = `${header}.${claims}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, te.encode(unsigned))
  );
  return `${unsigned}.${b64UrlEncode(sig)}`;
}

async function encryptWebPushPayload(p256dhB64, authB64, payloadObj) {
  const uaPublic = b64ToBytes(p256dhB64);
  const authSecret = b64ToBytes(authB64);
  const plaintext = te.encode(JSON.stringify(payloadObj));

  const asKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeyPair.publicKey));
  const uaPubKey = await crypto.subtle.importKey(
    'raw',
    uaPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaPubKey }, asKeyPair.privateKey, 256)
  );

  const prkKey = await hmacSha256(authSecret, ecdhSecret);
  const keyInfo = concatBytes(te.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1]));
  const ikm = await hmacSha256(prkKey, keyInfo);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmacSha256(salt, ikm);
  const cek = (await hmacSha256(prk, concatBytes(te.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmacSha256(prk, concatBytes(te.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);

  const cekKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const padded = concatBytes(plaintext, new Uint8Array([2]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cekKey, padded)
  );

  const rsBytes = new Uint8Array([0, 0, 16, 0]);
  const idLen = new Uint8Array([asPublic.length]);
  return concatBytes(salt, rsBytes, idLen, asPublic, ciphertext);
}

async function sendSingleWebPush(sub, payloadObj, env) {
  const endpointUrl = new URL(sub.endpoint);
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
  const jwt = await buildVapidJwt(
    audience,
    env.VAPID_SUBJECT || 'mailto:info@kalaka-szentendre.hu',
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );
  const body = await encryptWebPushPayload(sub.p256dh, sub.auth, payloadObj);

  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY.trim()}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '3600',
      Urgency: 'high'
    },
    body
  });

  return { ok: res.ok, status: res.status, endpoint: sub.endpoint };
}

function getServiceHeaders(env, extra = {}) {
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const headers = {
    apikey: key,
    'Content-Type': 'application/json',
    ...extra
  };
  if (key.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

function jsonResp(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function verifyCaller(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: authHeader
    }
  });
  if (!res.ok) return null;
  return res.json();
}

async function dispatchToSubscriptions(subs, payload, env) {
  let sent = 0;
  let failed = 0;
  const staleEndpoints = [];

  for (let i = 0; i < subs.length; i += 25) {
    const batch = subs.slice(i, i + 25);
    const results = await Promise.allSettled(
      batch.map((sub) => sendSingleWebPush(sub, payload, env))
    );
    results.forEach((r) => {
      if (r.status === 'fulfilled' && r.value.ok) {
        sent += 1;
      } else {
        failed += 1;
        if (r.status === 'fulfilled' && (r.value.status === 404 || r.value.status === 410)) {
          staleEndpoints.push(r.value.endpoint);
        }
      }
    });
  }

  if (staleEndpoints.length > 0) {
    await Promise.allSettled(
      staleEndpoints.map((ep) =>
        fetch(
          `${env.SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(ep)}`,
          { method: 'DELETE', headers: getServiceHeaders(env) }
        )
      )
    );
  }

  return { sent, failed };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResp({ error: 'Hiányzó szerveroldali értesítési beállítások' }, 500);
  }

  const user = await verifyCaller(request, env);
  if (!user?.id) {
    return jsonResp({ error: 'Bejelentkezés szükséges' }, 401);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return jsonResp({ error: 'Érvénytelen kérés' }, 400);
  }

  if (body.mode === 'test') {
    const subRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&select=endpoint,p256dh,auth`,
      { headers: getServiceHeaders(env) }
    );
    const subs = subRes.ok ? await subRes.json() : [];
    if (!subs.length) {
      return jsonResp({ error: 'Nincs mentett értesítési eszköz ennél a fióknál' }, 404);
    }
    const result = await dispatchToSubscriptions(
      subs,
      {
        title: 'Kaláka Szentendre – Radar aktív',
        body: 'Szuper! Ha legalább 3 helyi lakos megerősít egy fennakadást, azonnal szólunk.',
        tag: `kalaka-test-${Date.now()}`,
        url: '/'
      },
      env
    );
    return jsonResp({ ok: result.sent > 0, ...result });
  }

  if (body.mode === 'alert' && body.alert_id) {
    const alertId = String(body.alert_id).trim();
    const alertRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/road_alerts?id=eq.${encodeURIComponent(alertId)}&select=id,category,zone,status_level,message,confirm_count,expires_at,push_sent_at`,
      { headers: getServiceHeaders(env) }
    );
    const rows = alertRes.ok ? await alertRes.json() : [];
    const alert = rows[0];
    if (!alert) return jsonResp({ skipped: true, reason: 'not_found' });
    if (alert.status_level === 'ok' || (alert.confirm_count || 0) < 3 || alert.push_sent_at) {
      return jsonResp({ skipped: true, reason: 'threshold_or_sent' });
    }
    if (new Date(alert.expires_at).getTime() <= Date.now()) {
      return jsonResp({ skipped: true, reason: 'expired' });
    }

    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const coolRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/road_alerts?category=eq.${encodeURIComponent(alert.category)}&zone=eq.${encodeURIComponent(alert.zone)}&push_sent_at=gt.${encodeURIComponent(twoHoursAgo)}&select=id&limit=1`,
      { headers: getServiceHeaders(env) }
    );
    const coolRows = coolRes.ok ? await coolRes.json() : [];
    if (coolRows.length > 0) {
      return jsonResp({ skipped: true, reason: 'cooldown' });
    }

    const claimRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/road_alerts?id=eq.${encodeURIComponent(alertId)}&push_sent_at=is.null`,
      {
        method: 'PATCH',
        headers: getServiceHeaders(env, { Prefer: 'return=representation' }),
        body: JSON.stringify({ push_sent_at: new Date().toISOString() })
      }
    );
    const claimed = claimRes.ok ? await claimRes.json() : [];
    if (!claimed.length) {
      return jsonResp({ skipped: true, reason: 'already_claimed' });
    }

    const catFilter = encodeURIComponent(`{"${alert.category}"}`);
    const subRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/push_subscriptions?categories=cs.${catFilter}&select=endpoint,p256dh,auth`,
      { headers: getServiceHeaders(env) }
    );
    const subs = subRes.ok ? await subRes.json() : [];
    if (!subs.length) {
      return jsonResp({ ok: true, sent: 0, failed: 0 });
    }

    const result = await dispatchToSubscriptions(
      subs,
      {
        title: `${alert.zone} (${alert.confirm_count}+ jelzés)`,
        body: alert.message,
        tag: `kalaka-radar-${alert.category}-${alert.zone}`,
        url: '/'
      },
      env
    );
    return jsonResp({ ok: true, ...result });
  }

  return jsonResp({ error: 'Ismeretlen művelet' }, 400);
}
