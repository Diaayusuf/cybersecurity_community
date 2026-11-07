# CyberX M6 — Puzzle Security Review

**Review scope:** Current local branch source, M5 audit/migration, local M6 migration/function/tests, plus read-only current project metadata. Production was not modified. This review does not assert that the proposed controls are active on the connected project.

## Threat model and findings

| Finding | Risk | Status and evidence | Control / remaining limitation |
|---|---|---|---|
| Browser previously held the expected answer and decided success | High | Confirmed in the pre-M6 `puzzle.html` flow; the local branch now has no answer constant or answer comparison. | Function verifies a case-sensitive, trimmed answer against server-only configuration using keyed HMAC comparison. It returns no answer or digest. Production remains on its prior deployed version until an owner-approved release. |
| Anonymous clients could fabricate `puzzle_players` rows | High | Confirmed in the M5 catalog/grant review. Current project has no M6 migration applied. | Local M6 migration removes API-role writes to the legacy table, adds a separate verified table, and grants its insert only through service-role-only RPC execution. Must be staged and applied before these controls become active. |
| Anonymous brute force and request flooding | High | No rate limit existed in the inspected app/database. | Local implementation limits a source fingerprint to 8 valid requests per fixed 10-minute window. It HMACs the documented first `X-Forwarded-For` address and stores only the keyed digest. Missing/invalid source data fails closed. Distributed abuse and network-origin spoofing outside the documented Supabase gateway trust model remain possible. No global capacity threshold is configured. |
| Anonymous names do not establish identity | Medium | Confirmed product behavior; no user account or verified identity is collected. | One normalized display name per challenge is enforced atomically. A person can choose another name or network. The UI does not claim authenticated identity. |
| Historical leaderboard rows have unverified provenance | Medium | M5 review found an old anonymous insert flow; existing records cannot be retroactively trusted. Current catalog row summaries and the earlier aggregate count conflicted. | Rows remain untouched in `puzzle_players` and appear with a `LEGACY · UNVERIFIED` label. New records use `puzzle_verified_solves` and show `SERVER VERIFIED`. |
| API key or CORS could be mistaken for authentication | Medium | The browser key is public by design; no user auth exists. | Function checks the configured publishable key and exact configured origins. CORS is only a browser policy; non-browser callers remain subject to server validation, rate limiting, and database grants. The function’s JWT check is disabled only in its per-function config. |
| Request retries and concurrent submissions | Medium | Old client relied on lookup-before-insert, which is race-prone. | Keyed idempotency and a unique constraint are checked in one database transaction. Matching retries return the same minimal solve result; changed payloads with the same key conflict. Database concurrency has not been exercised against a running PostgreSQL instance. |
| Public read exposure | Low / intended | Hall of Fame intentionally exposes display name, optional domain, timestamp, and ID. | `puzzle_leaderboard` is a `security_invoker` view with an explicit five-column projection and a visible provenance label. No answer/config/rate/idempotency data is in the view. Data API exposed-schema settings still require owner verification. |
| Challenge/secret provisioning | Medium | No live Edge Function or M6 secrets are configured. | Exact answers, HMAC keys, service credentials, and allowed origins are named but not populated in tracked files. Missing or invalid config fails closed. Owner must provision values privately before staging. |

## Database permissions

The local migration enables RLS on `public.puzzle_verified_solves` and all private tables. `anon` can select only the public leaderboard fields under a SELECT policy. It cannot insert/update/delete/truncate the verified table or call either RPC. `authenticated` receives no M6 table or RPC access. The legacy table remains read-only to `anon`, with the existing public SELECT policy retained and its INSERT policy removed. Service-role access is restricted to the two named RPCs; table grants are revoked from `service_role` as defense in depth.

Both RPCs are `SECURITY DEFINER` because they must atomically modify restricted tables. They set `search_path = pg_catalog`, qualify table references, validate inputs, revoke execute from `PUBLIC`, `anon`, and `authenticated`, and grant execute only to `service_role`. This is intentionally narrower than exposing privileged functions as anonymous APIs. Function ownership and effective grants still need verification after staging application.

## Function boundary

- Per-function `verify_jwt = false` is required for this anonymous static-page endpoint. The function rejects missing/unrecognized publishable API keys; the key is not treated as user identity.
- CORS accepts only explicitly configured HTTPS origins, plus explicit loopback HTTP origins for local testing. Wildcards are rejected. The forwarded-IP header is not included in allowed browser request headers.
- The Supabase API security guide documents the first `X-Forwarded-For` entry as the client address. The function validates that value and never accepts an IP field in JSON. A keyed HMAC is persisted instead of the address. Gateway behavior should be revalidated in a staging request before relying on the limit operationally.
- Request bodies are streamed with an 8 KiB maximum. Only the allowlisted fields are accepted. Client-supplied correctness, score, rank, identity, timestamp, or IP properties cause rejection.
- No answer, answer HMAC, authorization header, API key, database error, or raw IP is logged. Database RPC receives only a correctness Boolean, display metadata, and keyed hashes; it never receives the submitted answer.
- HMAC keys must be independent, random, and at least 32 bytes. Rotating the rate key resets source buckets; rotating the idempotency key invalidates existing retries. Coordinate rotations.
- Rate rows are pruned when a later request runs after 48 hours. Idempotency rows are pruned after 90 days, so the duplicate-retry guarantee is bounded to that retention window. No scheduled cleanup job or alert is configured.

## Remaining risks and release gates

1. This is local code only. Production still has its old frontend and grants until separate deployment/migration approvals.
2. No staging project was available. Migration SQL, effective PostgREST grants, Realtime publication behavior, function secrets, actual gateway source header, and end-to-end function/database interactions remain unverified.
3. Local Docker/Supabase and Deno runtimes are unavailable. Node tests mock the RPC layer; they do not prove PostgreSQL transactional behavior.
4. Per-source rate limits do not stop distributed abuse or a caller able to manipulate network source attribution. No global budget or CAPTCHA/auth requirement was introduced because there is no traffic/capacity baseline and no identity product requirement.
5. Current public leaderboard reads are unbounded, matching the existing UI behavior. Consider pagination as a separate compatibility change.
6. Supabase Edge/API keys and configuration are runtime-managed. No service key or challenge answer is committed or included in reports.

Supabase’s [Edge Function authorization guidance](https://supabase.com/docs/guides/functions/auth-headers), [secret management guidance](https://supabase.com/docs/guides/functions/secrets), [CORS guide](https://supabase.com/docs/guides/functions/cors), and [API security guide](https://supabase.com/docs/guides/api/securing-your-api) informed this implementation. The API guide documents the `X-Forwarded-For` convention used for source bucketing.