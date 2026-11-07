# Wasmer Edge deployment plan

Status: documentation only. No Wasmer manifest was created and no deployment was run. The repository currently consists of static HTML/CSS/JavaScript and image files, which fits Wasmer's static-site hosting path. Wasmer's current documentation describes a static website template, a `public` content directory, and a `Staticfile` root; the React guide shows a `wasmer.toml` manifest mapping a public directory. Verify current CLI/platform details before a future release.

References: [Wasmer static-site quickstart](https://docs.wasmer.io/edge/guides/static-site/), [Wasmer static-site framework guide](https://docs.wasmer.io/edge/guides/react-static-site/), [Wasmer Git deployments](https://docs.wasmer.io/edge/git/).

## Repository-specific preparation

There is no visible `Staticfile`, `app.yaml`, `wasmer.toml`, package/build manifest, CI workflow, or deployment config in the repository inventory. The site has root-level `index.html`, `awareness.html`, `puzzle.html`, `admin.html`, and two image folders. Before configuring a deployment:

1. Agree on an explicit publication directory/file allowlist. Do not blindly publish the repository root. Include only reviewed HTML pages and required assets. Exclude `.git`, `notes.txt`, audit/source-only material, credentials, and puzzle-master notes.
2. Keep the existing direct page URLs working. Verify `index.html` is served as `/` and the other pages/assets resolve at their expected paths.
3. Preserve both `image/` and `img/` until every reference and apparent duplicate is verified.
4. Resolve secret and source-note exposure before the first public build. A static host cannot keep browser code or browser configuration secret.
5. Review HTTPS, security headers, caching, MIME types, error pages, and direct-link behavior against Wasmer's current configuration docs.

## Suggested future validation sequence (not run)

1. Install/update the Wasmer CLI using the official installation documentation and authenticate only when the deployment owner is ready.
2. In a clean staging directory, assemble the allowlisted static output and inspect every file in it.
3. Use the current Wasmer static-site template or an explicit static-server configuration with its root pointed at that output directory. Do not guess manifest schema; verify against current official docs.
4. Run the documented local static server and manually inspect page routes, CSS/fonts, images, and browser console behavior.
5. Confirm Supabase CORS/origin configuration and database policies for the chosen preview/staging origin, without changing production during this audit.
6. Have the owner review the artifact, domain, headers, access behavior, privacy content, and rollback plan.
7. Deploy only after a separate explicit approval. Record the deployment ID/URL and rollback method.

## Release risks to close

- The public page source currently includes puzzle solution notes and a database-password-like comment.
- Root publication may expose `notes.txt` and other files not intended for visitors.
- Admin data/password are local-only and client-side; a public static site does not make them secure.
- Supabase access policy and allowed origins were not verified.
- Google Fonts and jsDelivr are external dependencies that affect CSP and runtime availability.

The static-site fit does not imply the current application is release-ready. No deployment has occurred.
