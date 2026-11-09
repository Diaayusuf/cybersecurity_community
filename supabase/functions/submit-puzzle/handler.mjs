const MAX_BODY_BYTES = 8192;
const MAX_ANSWER_CHARS = 256;
const RATE_LIMIT_WINDOW_SECONDS = 600;

const encoder = new TextEncoder();

function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

function readEnv(env, name) {
  try { return env?.get?.(name) ?? ''; } catch { return ''; }
}

function originConfig(env) {
  const raw = readEnv(env, 'CYBERX_ALLOWED_ORIGINS');
  if (!raw || raw.length > 2048) return [];
  return raw.split(',').map(value => value.trim()).filter(Boolean).map(value => {
    try {
      const url = new URL(value);
      if (url.origin !== value || url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) return null;
      return url.origin;
    } catch { return null; }
  }).filter(Boolean);
}

function validIpv4(value) {
  const parts = value.split('.');
  return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function validIp(value) {
  if (!value || value.length > 64 || /[%\s]/.test(value)) return false;
  if (validIpv4(value)) return true;
  if (!value.includes(':')) return false;
  try { return new URL(`http://[${value}]/`).hostname.length > 2; } catch { return false; }
}

function trustedClientIp(request) {
  // Supabase documents the first X-Forwarded-For entry as the client address.
  // This header is deliberately not an accepted browser-set CORS header.
  const first = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  return validIp(first) ? first : null;
}

async function hmacHex(secret, value, cryptoImpl) {
  if (typeof secret !== 'string' || encoder.encode(secret).length < 32) throw new Error('configuration');
  const key = await cryptoImpl.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await cryptoImpl.subtle.sign('HMAC', key, encoder.encode(value));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function equalHexConstantTime(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== 64 || right.length !== 64) return false;
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

async function readBoundedBody(request) {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      try { await reader.cancel(); } catch { /* best effort */ }
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return null; }
}

function validatePayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const allowed = new Set(['challenge_id', 'answer', 'player_name', 'domain', 'idempotency_key']);
  if (Object.keys(value).some(key => !allowed.has(key))) return null;
  const challengeId = value.challenge_id;
  const answer = value.answer;
  const playerName = value.player_name;
  const domain = value.domain;
  const idempotencyKey = value.idempotency_key;
  if (typeof challengeId !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(challengeId)) return null;
  if (typeof answer !== 'string' || !answer.trim() || answer.trim().length > MAX_ANSWER_CHARS || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(answer)) return null;
  if (typeof playerName !== 'string' || !playerName.trim() || playerName.trim().length > 40 || /[\u0000-\u001f\u007f]/.test(playerName)) return null;
  if (domain !== null && domain !== undefined && (typeof domain !== 'string' || domain.trim().length > 40 || /[\u0000-\u001f\u007f]/.test(domain))) return null;
  if (typeof idempotencyKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) return null;
  const normalizedName = playerName.trim();
  const normalizedDomain = typeof domain === 'string' && domain.trim() ? domain.trim() : null;
  if (normalizedDomain && !/[^\s]/.test(normalizedDomain)) return null;
  return { challengeId, answer: answer.trim(), playerName: normalizedName, domain: normalizedDomain, idempotencyKey };
}

function parseObjectSecret(env, name) {
  const raw = readEnv(env, name);
  if (!raw || raw.length > 32768) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

function configuredChallenge(env, challengeId) {
  const config = parseObjectSecret(env, 'CYBERX_CHALLENGE_CONFIG_JSON');
  if (!config) return { configurationError: true, answer: null };
  if (!Object.hasOwn(config, challengeId)) return { configurationError: false, answer: null };
  const entry = config[challengeId];
  if (!entry || typeof entry !== 'object' || typeof entry.active !== 'boolean' || (entry.active && (typeof entry.answer !== 'string' || !entry.answer || entry.answer !== entry.answer.trim() || entry.answer.length > MAX_ANSWER_CHARS))) return { configurationError: true, answer: null };
  return { configurationError: false, answer: entry.active ? entry.answer : null };
}

function allowedPublishableKeys(env) {
  const values = [];
  const map = parseObjectSecret(env, 'SUPABASE_PUBLISHABLE_KEYS');
  if (map) for (const value of Object.values(map)) if (typeof value === 'string') values.push(value);
  const legacy = readEnv(env, 'SUPABASE_ANON_KEY');
  if (legacy) values.push(legacy);
  return values;
}

function serviceCredentials(env) {
  const url = readEnv(env, 'SUPABASE_URL').replace(/\/$/, '');
  try {
    const parsed = new URL(url);
    const localCliGateway = parsed.protocol === 'http:' && parsed.hostname === 'kong' && parsed.port === '8000';
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)) && !localCliGateway) return null;
  } catch { return null; }
  const secretMap = parseObjectSecret(env, 'SUPABASE_SECRET_KEYS');
  const secret = secretMap?.default;
  if (typeof secret === 'string' && secret.startsWith('sb_secret_')) return { url, key: secret, legacy: false };
  const legacy = readEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return { url, key: legacy, legacy: true };
  return null;
}

async function rpc(fetchImpl, credentials, name, payload) {
  const headers = { apikey: credentials.key, 'content-type': 'application/json' };
  if (credentials.legacy) headers.authorization = `Bearer ${credentials.key}`;
  const response = await fetchImpl(`${credentials.url}/rest/v1/rpc/${name}`, {
    method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  try { return await response.json(); } catch { return null; }
}

export function createSubmitPuzzleHandler({ env, fetchImpl = fetch, cryptoImpl = globalThis.crypto, now = () => Date.now() }) {
  return async function handleSubmit(request) {
    const requestId = cryptoImpl.randomUUID();
    const origin = request.headers.get('origin');
    const origins = originConfig(env);
    const cors = { vary: 'Origin', 'x-request-id': requestId };
    if (origin && (!origins.length || !origins.includes(origin))) return jsonResponse(403, { error: 'Origin not allowed' }, cors);
    if (origin) cors['access-control-allow-origin'] = origin;
    cors['access-control-allow-methods'] = 'POST, OPTIONS';
    cors['access-control-allow-headers'] = 'authorization, apikey, content-type, x-client-info';
    cors['access-control-max-age'] = '600';

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' }, { ...cors, allow: 'POST, OPTIONS' });
    if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type') ?? '')) return jsonResponse(415, { error: 'JSON required' }, cors);
    const bodyText = await readBoundedBody(request);
    if (bodyText === null) return jsonResponse(413, { error: 'Request too large or invalid encoding' }, cors);
    let raw;
    try { raw = JSON.parse(bodyText); } catch { return jsonResponse(400, { error: 'Invalid request' }, cors); }
    const input = validatePayload(raw);
    if (!input) return jsonResponse(400, { error: 'Invalid request' }, cors);

    const providedKey = request.headers.get('apikey') ?? '';
    const acceptedKeys = allowedPublishableKeys(env);
    if (!acceptedKeys.some(key => equalSecret(providedKey, key))) return jsonResponse(401, { error: 'Unauthorized' }, cors);
    const ip = trustedClientIp(request);
    const credentials = serviceCredentials(env);
    if (!ip || !credentials) return jsonResponse(503, { error: 'Puzzle verification temporarily unavailable' }, cors);

    try {
      const rateKey = readEnv(env, 'CYBERX_RATE_LIMIT_HMAC_KEY');
      const rateFingerprint = await hmacHex(rateKey, `source:${ip}`, cryptoImpl);
      const rate = await rpc(fetchImpl, credentials, 'consume_puzzle_rate_limit', { p_source_fingerprint: rateFingerprint });
      if (!rate || typeof rate.allowed !== 'boolean') return jsonResponse(503, { error: 'Puzzle verification temporarily unavailable' }, cors);
      if (!rate.allowed) {
        const retry = Number.isInteger(rate.retry_after) ? Math.min(600, Math.max(1, rate.retry_after)) : RATE_LIMIT_WINDOW_SECONDS;
        return jsonResponse(429, { error: 'Too many submissions. Please retry later.' }, { ...cors, 'retry-after': String(retry) });
      }

      const challenge = configuredChallenge(env, input.challengeId);
      if (challenge.configurationError) return jsonResponse(503, { error: 'Puzzle verification temporarily unavailable' }, cors);
      if (!challenge.answer) return jsonResponse(404, { error: 'Challenge unavailable' }, cors);
      const expected = challenge.answer;
      const answerKey = readEnv(env, 'CYBERX_ANSWER_HMAC_KEY');
      const [candidateDigest, expectedDigest] = await Promise.all([
        hmacHex(answerKey, `answer:${input.answer}`, cryptoImpl),
        hmacHex(answerKey, `answer:${expected}`, cryptoImpl),
      ]);
      const verified = equalHexConstantTime(candidateDigest, expectedDigest);
      const idempotencySecret = readEnv(env, 'CYBERX_IDEMPOTENCY_HMAC_KEY');
      const [idempotencyHash, requestHash] = await Promise.all([
        hmacHex(idempotencySecret, `key:${input.idempotencyKey}` , cryptoImpl),
        hmacHex(idempotencySecret, `request:${JSON.stringify([input.challengeId, input.answer, input.playerName, input.domain])}`, cryptoImpl),
      ]);
      const result = await rpc(fetchImpl, credentials, 'commit_puzzle_submission', {
        p_challenge_id: input.challengeId,
        p_idempotency_hash: idempotencyHash,
        p_request_hash: requestHash,
        p_player_name: input.playerName,
        p_domain: input.domain,
        p_verified: verified,
      });
      if (!result || typeof result.status !== 'string') return jsonResponse(503, { error: 'Puzzle verification temporarily unavailable' }, cors);
      if (result.status === 'incorrect') return jsonResponse(200, { status: 'incorrect' }, cors);
      if (result.status === 'already_exists') return jsonResponse(409, { status: 'already_exists' }, cors);
      if (result.status === 'conflict') return jsonResponse(409, { status: 'conflict' }, cors);
      if (result.status !== 'verified' || typeof result.solve_id !== 'string' || typeof result.verified_at !== 'string') return jsonResponse(503, { error: 'Puzzle verification temporarily unavailable' }, cors);
      return jsonResponse(201, { status: 'verified', solve_id: result.solve_id, verified_at: result.verified_at }, cors);
    } catch {
      // Do not log submitted answers, hashes, keys, source IPs, or database errors.
      return jsonResponse(503, { error: 'Puzzle verification temporarily unavailable' }, cors);
    }
  };
}

function equalSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
