import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createSubmitPuzzleHandler } from '../../supabase/functions/submit-puzzle/handler.mjs';

const SYNTHETIC_ANSWER = 'SYNTHETIC-TEST-ANSWER';
const FIXED_KEY = '11111111-1111-4111-8111-111111111111';
const SOLVE_ID = '22222222-2222-4222-8222-222222222222';
const VERIFIED_AT = '2026-01-01T00:00:00.000Z';
const migrationSql = readFileSync(fileURLToPath(new URL('../../supabase/migrations/20261107133243_cyberx_m6_trusted_puzzle_submissions.sql', import.meta.url)), 'utf8');
const puzzleHtml = readFileSync(fileURLToPath(new URL('../../puzzle.html', import.meta.url)), 'utf8');

function makeEnv(overrides = {}) {
  const values = new Map(Object.entries({
    SUPABASE_URL: 'https://unit-test.supabase.co',
    SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: 'sb_publishable_test_only' }),
    SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_test_only' }),
    CYBERX_ALLOWED_ORIGINS: 'https://cyberx.example,http://127.0.0.1:4173',
    CYBERX_CHALLENGE_CONFIG_JSON: JSON.stringify({ main: { active: true, answer: SYNTHETIC_ANSWER }, paused: { active: false } }),
    CYBERX_ANSWER_HMAC_KEY: 'synthetic-answer-hmac-key-32-bytes-minimum',
    CYBERX_RATE_LIMIT_HMAC_KEY: 'synthetic-rate-hmac-key-32-bytes-minimum',
    CYBERX_IDEMPOTENCY_HMAC_KEY: 'synthetic-idempotency-hmac-key-32-bytes',
    ...overrides,
  }));
  return { get: name => values.get(name) ?? '' };
}

function makeFetch({ rate = { allowed: true, retry_after: 0 }, commit = null, failRpc = false } = {}) {
  const calls = [];
  const records = new Map();
  const byName = new Map();
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    const rpc = url.split('/').at(-1);
    calls.push({ rpc, body, headers: init.headers });
    if (failRpc) return new Response('private database detail', { status: 500 });
    if (rpc === 'consume_puzzle_rate_limit') return new Response(JSON.stringify(rate), { status: 200 });
    if (rpc !== 'commit_puzzle_submission') return new Response('{}', { status: 404 });
    if (commit) return new Response(JSON.stringify(commit), { status: 200 });
    const key = `${body.p_challenge_id}:${body.p_idempotency_hash}`;
    const existing = records.get(key);
    if (existing) {
      return new Response(JSON.stringify(existing.requestHash === body.p_request_hash
        ? existing.result
        : { status: 'conflict' }), { status: 200 });
    }
    if (!body.p_verified) {
      const result = { status: 'incorrect' };
      records.set(key, { requestHash: body.p_request_hash, result });
      return new Response(JSON.stringify(result), { status: 200 });
    }
    const nameKey = `${body.p_challenge_id}:${body.p_player_name.trim().toLowerCase()}`;
    if (byName.has(nameKey)) {
      const result = { status: 'already_exists' };
      records.set(key, { requestHash: body.p_request_hash, result });
      return new Response(JSON.stringify(result), { status: 200 });
    }
    const result = { status: 'verified', solve_id: SOLVE_ID, verified_at: VERIFIED_AT };
    records.set(key, { requestHash: body.p_request_hash, result });
    byName.set(nameKey, SOLVE_ID);
    return new Response(JSON.stringify(result), { status: 200 });
  };
  return { calls, records, fetchImpl };
}

function makeRequest({ answer = SYNTHETIC_ANSWER, key = FIXED_KEY, challenge = 'main', name = 'Synthetic Operator', domain = 'Test Lab', extras = {}, origin = 'https://cyberx.example', apiKey = 'sb_publishable_test_only', ip = '203.0.113.20, 10.0.0.1', method = 'POST', contentType = 'application/json', rawBody } = {}) {
  const body = rawBody ?? JSON.stringify({ challenge_id: challenge, answer, player_name: name, domain, idempotency_key: key, ...extras });
  const headers = new Headers({ 'content-type': contentType });
  if (origin) headers.set('origin', origin);
  if (apiKey) headers.set('apikey', apiKey);
  if (ip) headers.set('x-forwarded-for', ip);
  return new Request('https://function.test/submit-puzzle', { method, headers, body: method === 'GET' || method === 'OPTIONS' ? undefined : body });
}

async function invoke(options = {}, fixture = {}) {
  const backend = makeFetch(fixture);
  const handler = createSubmitPuzzleHandler({ env: makeEnv(fixture.env), fetchImpl: backend.fetchImpl });
  const response = await handler(makeRequest(options));
  const body = response.status === 204 ? null : await response.json();
  return { response, body, calls: backend.calls, records: backend.records };
}

test('preflight, method, and content type follow the HTTP contract', async () => {
  const preflight = createSubmitPuzzleHandler({ env: makeEnv(), fetchImpl: async () => { throw new Error('must not call backend'); } });
  const options = await preflight(new Request('https://function.test/submit-puzzle', { method: 'OPTIONS', headers: { origin: 'https://cyberx.example' } }));
  assert.equal(options.status, 204);
  assert.equal(options.headers.get('access-control-allow-origin'), 'https://cyberx.example');
  assert.doesNotMatch(options.headers.get('access-control-allow-headers'), /x-forwarded-for/i);
  assert.equal((await invoke({ method: 'GET' })).response.status, 405);
  assert.equal((await invoke({ contentType: 'text/plain' })).response.status, 415);
});

test('malformed, oversized, and client-asserted success fields are rejected before RPC', async () => {
  assert.equal((await invoke({ rawBody: '{bad json' })).response.status, 400);
  assert.equal((await invoke({ extras: { is_correct: true } })).response.status, 400);
  assert.equal((await invoke({ extras: { score: 1000 } })).response.status, 400);
  const tooLarge = createSubmitPuzzleHandler({ env: makeEnv(), fetchImpl: async () => { throw new Error('must not call backend'); } });
  const response = await tooLarge(new Request('https://function.test/submit-puzzle', {
    method: 'POST', headers: { 'content-type': 'application/json', 'content-length': '9000' }, body: '{}',
  }));
  assert.equal(response.status, 413);
});

test('CORS origin and publishable app key are checked without treating CORS as user authentication', async () => {
  assert.equal((await invoke({ origin: 'https://attacker.example' })).response.status, 403);
  const badKey = await invoke({ apiKey: 'not-a-project-key' });
  assert.equal(badKey.response.status, 401);
  assert.equal(badKey.calls.length, 0);
});

test('field bounds and identifier formats reject malformed input', async () => {
  assert.equal((await invoke({ extras: { player_id: 'client-asserted' } })).response.status, 400);
  assert.equal((await invoke({ key: 'not-a-uuid' })).response.status, 400);
  assert.equal((await invoke({ challenge: '../main' })).response.status, 400);
  assert.equal((await invoke({ name: 'x'.repeat(41) })).response.status, 400);
  assert.equal((await invoke({ domain: 'x'.repeat(41) })).response.status, 400);
  assert.equal((await invoke({ answer: 'x'.repeat(257) })).response.status, 400);
});

test('missing platform source address fails closed and the raw address is never sent to RPC', async () => {
  const noIp = await invoke({ ip: null });
  assert.equal(noIp.response.status, 503);
  assert.equal(noIp.calls.length, 0);
  const result = await invoke({ ip: '203.0.113.20, 10.0.0.1' });
  assert.equal(result.response.status, 201);
  const rateCall = result.calls.find(call => call.rpc === 'consume_puzzle_rate_limit');
  assert.match(rateCall.body.p_source_fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(rateCall.body).includes('203.0.113.20'), false);
});

test('wrong answers are checked server-side and neither response nor RPC contains raw answers', async () => {
  const result = await invoke({ answer: 'SYNTHETIC-WRONG-ANSWER' });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, { status: 'incorrect' });
  const commit = result.calls.find(call => call.rpc === 'commit_puzzle_submission');
  assert.equal(commit.body.p_verified, false);
  assert.equal(JSON.stringify(commit.body).includes('SYNTHETIC-WRONG-ANSWER'), false);
  assert.equal(JSON.stringify(result.body).includes(SYNTHETIC_ANSWER), false);
});

test('correct answers return only a generated solve identifier and server timestamp', async () => {
  const result = await invoke();
  assert.equal(result.response.status, 201);
  assert.deepEqual(result.body, { status: 'verified', solve_id: SOLVE_ID, verified_at: VERIFIED_AT });
  const commit = result.calls.find(call => call.rpc === 'commit_puzzle_submission');
  assert.equal(commit.body.p_verified, true);
  assert.equal('answer' in commit.body, false);
  assert.equal('score' in commit.body, false);
  assert.equal('rank' in commit.body, false);
  assert.equal('player_id' in commit.body, false);
});

test('unknown and inactive challenges return the same safe result after consuming rate budget', async () => {
  const unknown = await invoke({ challenge: 'not-configured' });
  const inactive = await invoke({ challenge: 'paused' });
  assert.equal(unknown.response.status, 404);
  assert.deepEqual(unknown.body, inactive.body);
  assert.equal(inactive.response.status, 404);
  assert.equal(unknown.calls.filter(call => call.rpc === 'consume_puzzle_rate_limit').length, 1);
  assert.equal(unknown.calls.some(call => call.rpc === 'commit_puzzle_submission'), false);
});

test('rate limiting returns 429 with a bounded retry header and no internal counters', async () => {
  const result = await invoke({}, { rate: { allowed: false, retry_after: 731, count: 9 } });
  assert.equal(result.response.status, 429);
  assert.equal(result.response.headers.get('retry-after'), '600');
  assert.deepEqual(result.body, { error: 'Too many submissions. Please retry later.' });
  assert.equal(result.calls.some(call => call.rpc === 'commit_puzzle_submission'), false);
});

test('backend errors are sanitized and missing challenge secrets fail closed', async () => {
  const failed = await invoke({}, { failRpc: true });
  assert.equal(failed.response.status, 503);
  assert.doesNotMatch(JSON.stringify(failed.body), /private database detail|SYNTHETIC-TEST-ANSWER/i);
  const missingConfig = await invoke({}, { env: { CYBERX_CHALLENGE_CONFIG_JSON: '' } });
  assert.equal(missingConfig.response.status, 503);
});

test('idempotent retries do not create duplicate solves and changed payloads conflict', async () => {
  const backend = makeFetch();
  const handler = createSubmitPuzzleHandler({ env: makeEnv(), fetchImpl: backend.fetchImpl });
  const a = await handler(makeRequest());
  const b = await handler(makeRequest());
  const [aBody, bBody] = await Promise.all([a.json(), b.json()]);
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.equal(aBody.solve_id, bBody.solve_id);
  assert.equal(backend.records.size, 1);
  const changed = await handler(makeRequest({ name: 'Different Name' }));
  assert.equal(changed.status, 409);
  assert.deepEqual(await changed.json(), { status: 'conflict' });
});

test('distinct idempotency keys cannot create duplicate normalized names for one challenge', async () => {
  const backend = makeFetch();
  const handler = createSubmitPuzzleHandler({ env: makeEnv(), fetchImpl: backend.fetchImpl });
  const first = await handler(makeRequest());
  const second = await handler(makeRequest({ key: '33333333-3333-4333-8333-333333333333', name: ' synthetic operator ' }));
  assert.equal(first.status, 201);
  assert.equal(second.status, 409);
  assert.deepEqual(await second.json(), { status: 'already_exists' });
});
test('concurrent identical requests share one idempotent result', async () => {
  const backend = makeFetch();
  const handler = createSubmitPuzzleHandler({ env: makeEnv(), fetchImpl: backend.fetchImpl });
  const [left, right] = await Promise.all([handler(makeRequest()), handler(makeRequest())]);
  const [leftBody, rightBody] = await Promise.all([left.json(), right.json()]);
  assert.deepEqual([left.status, right.status], [201, 201]);
  assert.equal(leftBody.solve_id, rightBody.solve_id);
  assert.equal(backend.records.size, 1);
});

test('migration contract denies public trusted writes and exposes only the labeled read model', () => {
  assert.match(migrationSql, /ALTER TABLE public\.puzzle_verified_solves ENABLE ROW LEVEL SECURITY/);
  assert.match(migrationSql, /REVOKE ALL ON FUNCTION public\.commit_puzzle_submission[\s\S]*?FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(migrationSql, /GRANT EXECUTE ON FUNCTION public\.commit_puzzle_submission[\s\S]*?TO service_role/);
  assert.match(migrationSql, /SET search_path = pg_catalog/);
  assert.match(migrationSql, /security_invoker = true/);
  assert.match(migrationSql, /UNIQUE \(challenge_id, normalized_name\)/);
  assert.match(migrationSql, /PRIMARY KEY \(challenge_id, idempotency_hash\)/);
  assert.match(migrationSql, /request_count > 0/);
  assert.match(migrationSql, /DROP POLICY IF EXISTS "Anyone can insert puzzle players"/);
  assert.match(migrationSql, /legacy_unverified/);
  assert.match(migrationSql, /server_verified/);
  assert.doesNotMatch(migrationSql, /GRANT\s+INSERT[^;]*\bTO\s+(anon|authenticated)\b/i);
});

test('public puzzle source contains no answer authority or privileged credential reference', () => {
  assert.doesNotMatch(puzzleHtml, /CORRECT_FLAG|SUPABASE_SERVICE_ROLE_KEY|sb_secret_/i);
  assert.doesNotMatch(puzzleHtml, /\.from\([^)]*\)\s*\.insert\s*\(/);
  assert.match(puzzleHtml, /\.from\(TABLE_NAME\)[\s\S]*?verification_status/);
});
test('answer comparison trims surrounding whitespace but remains case-sensitive', async () => {
  const trimmed = await invoke({ answer: ` ${SYNTHETIC_ANSWER} ` });
  assert.equal(trimmed.response.status, 201);
  const lower = await invoke({ answer: SYNTHETIC_ANSWER.toLowerCase() });
  assert.equal(lower.response.status, 200);
  assert.deepEqual(lower.body, { status: 'incorrect' });
  assert.equal(lower.calls.find(call => call.rpc === 'commit_puzzle_submission').body.p_verified, false);
});