# CyberX current-state architecture audit

Audit date: 2026-11-07  
Repository: `Diaayusuf/cybersecurity_community`  
Observed branch: `main` (the requested `feat/cyberx-complete-implementation` branch is not checked out)  
Working tree: pre-existing modification to `admin.html`; preserved byte-for-byte by this audit.

## Scope and method

Read-only inspection covered all tracked-looking project files and assets in the repository: `index.html`, `awareness.html`, `puzzle.html`, `admin.html`, empty `script.js` and `style.css`, `notes.txt`, image folders `image/` and `img/`, repository metadata/status, references to third-party scripts/styles, Supabase browser integration, and deployment/configuration files. No tests or browser execution were performed. No production Supabase state was queried or changed.

## System shape

CyberX is currently a static, framework-free website. Four standalone HTML documents contain their own substantial markup, inline CSS, and inline JavaScript. `index.html` is the public landing page and implements much of its behavior inline; the two nominal shared files, `script.js` and `style.css`, are zero bytes and are not the actual source of the site behavior. `awareness.html` is a standalone cybersecurity awareness guide. `puzzle.html` is a standalone puzzle plus Supabase-backed Hall of Fame. `admin.html` is a standalone local-only content dashboard.

The root has two image directories with many similarly named or duplicate-looking assets. Some names point to different file sizes/formats. Keep both until references and image contents have been verified; do not deduplicate by filename alone. External runtime dependencies include Google Fonts and the Supabase JS v2 CDN loaded by `puzzle.html`. There is no package manifest, build system, test setup, deployment manifest, CI workflow, or visible environment-variable configuration in the root inventory.

## Pages and user-facing capabilities

- **Home (`index.html`)**: CyberX branded landing page, red-team and blue-team content, nine cybersecurity learning modules, dynamically generated module cards, module detail overlays, boot/transition effects, scroll reveals, animated visual elements, puzzle navigation, awareness navigation, interactive terminal/hidden commands, experience form, news links, donation call-to-action, responsive layouts.
- **Awareness (`awareness.html`)**: Threat and compromise education, prevention guidance, attack scenarios, social engineering content, password guidance, interactive checklist/progress and emergency response content. Some hotline/contact values are visibly placeholders.
- **Puzzle (`puzzle.html`)**: Hidden multi-step puzzle narrative and flag, Hall of Fame, name/domain form, public list, duplicate-name check, insert, initial read, and realtime INSERT subscription via Supabase.
- **Admin (`admin.html`)**: Existing dashboard with overview, media listing/create/filter/delete, puzzle listing/create/delete, hints, settings/password change, JSON export, delete confirmations, localStorage-backed records. Preserve its features and design; do not rebuild it.

The home experience form currently validates basic email shape and non-empty text, constructs a post in the current DOM, and clears fields; persistence, moderation, and verification are absent. Its post body is inserted using `innerHTML` without escaping the submitted text, creating a DOM injection risk. Some content is static/placeholder (including the news cards and donation action).

## Data and trust boundaries

- `admin.html` stores media, puzzles, and the dashboard password in browser `localStorage`. The UI gate and password-change flow are client-side; the password is a documented default in source and can be bypassed by editing browser state or page code. Data is per browser/profile and has no server backup, shared access, authorization, or durable cross-device behavior.
- `puzzle.html` uses the project URL `https://unxpmpgrvujijtfmyrfw.supabase.co`, a publishable browser key, and table `public.puzzle_players`. A publishable key is expected to be visible in a browser; effective access depends on verified Supabase grants/RLS. This audit did not inspect production project settings. The client reads all selected rows, checks duplicate names in the browser, inserts name/domain, and receives public INSERT events via Realtime. Client-only flag comparison is not an authorization control because the correct flag is in the page source.
- `index.html` experience submissions are transient DOM content, not database submissions.

## Design system and implementation condition

The shared visual language is embedded across pages: dark navy surfaces, cyan `#09D8C7`, red `#BD0927`, gold `#FFD700`, and technology/display fonts such as Share Tech Mono, Orbitron, Rajdhani, Oswald, and Press Start 2P. Preserve the current CyberX visual identity, component behavior, and page content during architecture work. CSS variables are not fully consistent across pages (home/awareness/puzzle use `#0D1A2F` for `--bg`, admin uses a darker palette and different variable names); centralizing tokens must retain each intentional treatment.

There are observed mojibake sequences in rendered/source text (for example `Â©`, `âœ“`, and `ðŸ…`) in the files inspected; encoding should be confirmed and corrected carefully as a separately reviewed content-preserving change. The source includes HTML inline styles and JavaScript event-handler attributes alongside inline scripts, which complicates a strict Content Security Policy. Admin HTML generation has several dynamic insertion points and should be reviewed for safe context-specific escaping; its helper currently escapes `& < > "` but omits apostrophe escaping.

## Repository state and deployment

The checked-out branch is `main`, despite the requested branch name. Git status reports only `M admin.html`. The full diff is a trailing comment `//new admin password id diaa` appended after the document, without a final newline; it is preserved and not interpreted as an application password change. `origin` points to `https://github.com/Diaayusuf/cybersecurity_community.git`. There are no visible project deployment files or Wasmer configuration in the inspected root inventory. This audit neither switched branch nor committed/pushed/deployed.

## Main architectural constraints

1. No authenticated server-side admin boundary exists.
2. Admin records are local to one browser, with no safe shared persistence.
3. Public client-side puzzle data and checks must be treated as attacker-controlled.
4. Supabase database policy, uniqueness, grants, Realtime configuration, and abuse controls remain unverified.
5. Standalone pages duplicate styles and behavior; blank shared assets give a misleading impression of centralization.
6. Current feature contracts and visual identity need explicit regression coverage before structural migration.
