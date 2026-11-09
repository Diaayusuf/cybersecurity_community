# M11 Backend Integration Contracts

## Auth
Required backend contract:
- sign up
- sign in
- password reset
- email verification
- session refresh
- account locking / validation errors

Status (local only):
- Sign up, sign in, reset email request/recovery password form, session persistence, and refresh use Supabase Auth when the ignored local config is present.
- Local Chromium verified signup, session restoration, sign-out, invalid-token rejection, and the local profile trigger. A local Mailpit reset-email link was consumed and the new password was used for a fresh sign-in. Local Auth auto-confirms accounts; production email confirmation/provider settings remain unverified.
- Without local Supabase config the page reports demo mode and does not claim success.

## Profile
Required backend contract:
- read public profile
- update profile details
- upload avatar
- store social links and interests
- privacy settings

Status (local only):
- Private member profile fields (display name, handle, headline, bio) read/update under owner RLS and persist locally.
- Avatar upload, social links, privacy settings, and a public profile page are not implemented.

## Membership and billing
Required backend contract:
- plan listing
- subscription state
- pricing metadata
- checkout/session creation
- renewal and cancellation status

Demo status:
- Pricing and upgrade flows are implemented as UI-only placeholders.
- Payment flows are not simulated as real transactions.

## Learning platform
Required backend contract:
- track catalog
- lesson list and completion state
- progress persistence
- achievement ownership

Status (local only):
- The three existing Learning catalog path starts persist per signed-in user; the Dashboard shows that user's started paths and count.
- The existing page has no lesson/activity completion behavior, so completions, achievements, streaks, and skill percentages are not recorded or claimed.

## Puzzle arena
Required backend contract:
- existing `submit-puzzle` server-side endpoint
- leaderboard and verified solve data
- server-controlled status and rate-limit responses

Status:
- Existing architecture retained. Local `submit-puzzle` runtime executed against Postgres; wrong/correct, idempotency, duplicate-name, malformed, unauthorized, unknown-challenge, and live rate-limit paths were checked.
- Local browser received the verified solve Realtime event. The client still never makes trusted answer decisions.

## Community and suggestions
Required backend contract:
- post creation
- voting and moderation
- suggestion lifecycle management
- comments and likes

Status (local only):
- Authenticated posts, comments, and likes persist. Community feed/comment views expose text and display-name snapshots only; RLS enforces author ownership and one reaction per member/post.
- Local database limits are 5 posts, 20 comments, and 60 reactions per member in an aligned 10-minute window. Concurrency was verified for post insertion.
- Moderation/reporting, suggestions lifecycle, and production data-retention/privacy policy are not defined or implemented. Unconfigured pages keep the explicit local demo fallback.

## AI assistant
Required backend contract:
- model request handling
- prompt sanitization
- policy and trust boundaries
- conversation storage (if enabled)

Demo status:
- Interface shell exists.
- Demo placeholder state is used unless the backend is configured.

## Discord
Required backend contract:
- invite configuration
- server metadata and status
- community channel mapping

Demo status:
- Interface is present with placeholder configuration guidance.
- Real Discord invite URL remains external configuration.

## Resources and settings
Required backend contract:
- resource search/filter metadata
- preferences storage
- notification preferences
- account security settings

Demo status:
- UI and data structure are present.
- Persistence remains backend-dependent.

## Key implementation principle
All UI work is intentionally separated from backend trust boundaries. Anything that needs server-side authority stays clearly framed as demo-only or requires a real integration contract before production use.

## Remaining backend-only scope

- Dashboard personalization is limited to persisted Learning path starts. Membership/billing, resources/settings, AI provider requests, Discord metadata, and Admin operations remain UI/demo-only.
- Admin's browser gate is not authorization. No administrator role, moderation authority, or protected server action was invented as part of the local integration.
