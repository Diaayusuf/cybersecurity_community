# CyberX M5/M6 Release Checklist

## 1. Local implementation

- [x] Confirm repository identity and current branch
- [x] Preserve existing user work in `admin.html`, `index.html`, and `puzzle.html`
- [x] Review the existing M5 migration, M6 migration, Edge Function, and tests
- [x] Confirm the code structure matches the documented security boundaries
- [x] Verify the server-side validation logic through local tests
- [x] Verify the browser contract through Playwright
- [x] Execute M5/M6 and additive M7/M8 migrations in the isolated local PostgreSQL environment
- [x] Execute the real M6 Edge Function against local Supabase/Postgres with synthetic challenge data
- [x] Validate the verified-solve Realtime event against a live local database

## 2. Local integration verification

- [x] `node --test tests/puzzle/submit-puzzle.test.mjs` runs successfully
- [x] `npx playwright test tests/m6-puzzle-frontend.spec.mjs` runs successfully
- [x] `npx playwright test` runs successfully
- [x] Real PostgreSQL local migration validation and catalog/RLS checks
- [x] Real Supabase function invocation against a local database
- [x] Real local Auth, profile, Community persistence, ownership, XSS, and concurrency workflow
- [x] Verify complete local password reset email-link consumption through Mailpit and authenticate with the updated password
- [ ] Real browser flow against deployed staging function and live database

## 3. Staging deployment

- [ ] Identify a dedicated disposable staging Supabase project
- [ ] Confirm staging identity and verify it is not production
- [ ] Provision required environment variables without exposing secrets
- [ ] Apply M5 migration to staging in order
- [ ] Validate read-only catalog checks and effective grants
- [ ] Apply M6 migration to staging in order
- [ ] Re-run SQL verification for both migrations
- [ ] Deploy `submit-puzzle` to staging
- [ ] Check exact function permissions and allowed origins
- [ ] Validate real leaderboard behavior and verification labels

## 4. Staging verification

- [ ] Wrong-answer request path
- [ ] Correct-answer request path
- [ ] Case-sensitivity checks
- [ ] Whitespace normalization checks
- [ ] Duplicate request and idempotency verification
- [ ] Rate limiting verification
- [ ] Error sanitization and retry behavior
- [ ] Legacy row preservation and unverified labeling
- [ ] Verified row creation and public read model
- [ ] Realtime update validation
- [ ] Regression check with the full browser suite against staging

## 5. Production approval

- [ ] Review live staging results with project owner
- [ ] Confirm database permissions, API exposure, and secret configuration
- [ ] Confirm function logs do not expose values
- [ ] Confirm no answer material or secret values are exposed to public clients
- [ ] Obtain explicit owner approval for production release

## 6. Production deployment

- [ ] Prepare final deployment runbook
- [ ] Verify migration order against staging results
- [ ] Apply migrations only after explicit approval
- [ ] Deploy function only after infrastructure verification
- [ ] Confirm production environment matches the staging configuration
- [ ] Avoid any production write without approval

## 7. Post-deployment verification

- [ ] Verify `puzzle_leaderboard` read path
- [ ] Verify correct and incorrect puzzle response behavior
- [ ] Verify no trusted client-side writes remain possible
- [ ] Verify service-role-only server boundary remains enforced
- [ ] Verify audit logs and error handling stay sanitized
- [ ] Run final regression tests after deployment
- [ ] Confirm no production secrets or answers were exposed

## 8. Release gate summary

This checklist remains partially complete. The isolated local PostgreSQL/Supabase environment, migrations, function, Realtime, Auth recovery, and regression suites are verified. Live staging deployment and post-deployment verification remain required before any production release decision.
