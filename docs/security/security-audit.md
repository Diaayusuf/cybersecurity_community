# CyberX security audit

Audit date: 2026-11-07. Static source review only; no penetration test, browser execution, Supabase dashboard access, or production database inspection was performed. Findings below are based on repository contents and require owner verification where provider configuration is involved.

## Findings by priority

### Critical — Database password-like secret committed in public page source

`puzzle.html` contains a comment labeled `DATABASE PASSWORD` followed by a password-like value. It is delivered to every visitor and may also exist in Git history. Validity and scope are unknown. Treat it as compromised until the owner confirms otherwise. If it is a real credential, rotate/revoke it through the owning system and inspect relevant access logs; do not repeat it in tickets or logs. Remove it from code/history under a separately approved remediation. A history rewrite alone does not rotate a secret.

### High — Admin dashboard access is not authentication

`admin.html` discloses a default password in page markup and JavaScript. The gate, password changes, and records are all client-side. Password changes go to localStorage. Any visitor can inspect source, modify localStorage, or alter JavaScript; the UI gate does not protect administrative data or privileged actions. Do not expose production credentials or real sensitive data through this dashboard. Keep the dashboard UI; move any privileged operation behind server-enforced authentication/authorization if such operations are introduced.

### High — Puzzle flag and solution are exposed to clients

The correct flag is in `puzzle.html`, with detailed puzzle-master solution notes in an HTML comment. Browser-side comparison provides gameplay feedback but cannot prove a successful solve. Do not use the client check as a security decision, access-control decision, or trusted anti-cheat signal. Keep solution material out of public deployment artifacts.

### High — Supabase policy posture is unknown; browser write is abuseable

The Supabase URL and publishable key are browser-visible by design. Safety relies on database grants/RLS and any server-side validation, which were not inspected. Anonymous clients can invoke the same API operations as the page; client-side validation and duplicate scans are bypassable and race-prone. Verify RLS is enabled, reads expose only approved fields, inserts constrain fields and sizes, updates/deletes are denied to anonymous users, normalized uniqueness is enforced in the database, and Realtime exposes only intended INSERT data. Test only in staging for this audit.

### High — Experience submission is DOM injection susceptible

`index.html`'s `submitExp()` places user-provided experience text into an `innerHTML` template without escaping. This allows markup/script-capable content to be interpreted in the page. Render submitted text with `textContent` or use safe DOM construction. Validate server-side if persistence is later added.

### Medium — Admin dynamic HTML and URL contexts need review

Admin-generated rows/cards combine template strings, inline event handlers, URLs, and user/localStorage data. Escaping is context-specific; the existing `esc()` helper does not escape apostrophe and does not make arbitrary URLs safe. Prefer DOM APIs, safe URL allowlisting/protocol checks, and event listeners. Treat localStorage as attacker-controlled input. Do not rebuild the dashboard to address this.

### Medium — Public data minimization and abuse controls are unclear

The Hall of Fame collects names and optional domains, selects all columns, and checks for duplicate names by reading the dataset from the browser. Confirm that domain disclosure is expected, minimize selected columns, add server/database constraints and rate limiting or equivalent abuse controls, and establish retention/deletion policy. Avoid exposing unnecessary personal or operational information.

### Medium — Third-party runtime dependencies and security headers

Google Fonts and jsDelivr Supabase JS are loaded remotely. There is no visible dependency lock/pinning or CSP/security-header configuration. Assess supply-chain and availability needs, pin or self-host where appropriate, and introduce security headers/CSP only after inline handlers/styles/scripts and required external origins are accounted for. Deploy only over HTTPS.

### Low — Static repository exposure and content quality

`notes.txt` is a large repository file and may contain material not intended for public distribution; deployment must use an explicit public-file allowlist and exclude notes, `.git`, and authoring content. Multiple asset directories have overlapping names. Mojibake is present in source text. These are release-quality and information-exposure concerns, not evidence that every asset is confidential.

## Positive controls observed

- Browser-side user-entered strings in the Hall of Fame are normalized and escaped before list rendering.
- Hall of Fame form code has client-side length checks and handles duplicate insert errors, though these checks do not replace server/database validation.
- No service-role key was observed in the source reviewed; the browser key is labeled publishable. Production policy still requires verification.
- Delete actions in the local dashboard have confirmation UI. This is usability protection, not authorization.

## Required verification before implementation/release

1. Identify and rotate any real credential exposed in source/history; verify no related secrets in all branches, commits, notes, or deployment artifacts.
2. Inspect staging Supabase table schema, RLS/grants, Realtime publication, and policies; exercise anon/authenticated roles and hostile inputs.
3. Confirm no service-role/secret key is bundled into client code or static artifacts.
4. Review the public output allowlist and ensure puzzle solutions, `notes.txt`, Git metadata, and credentials are absent.
5. Test safe rendering for HTML/script payloads in experience, Hall of Fame, and admin data.
6. Define privacy, moderation, retention, and abuse-response policy for submitted names/domains/experience.

No remediation was performed during this read-only audit.
