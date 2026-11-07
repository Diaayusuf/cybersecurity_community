# M11 Backend Integration Contracts

## Auth
Required backend contract:
- sign up
- sign in
- password reset
- email verification
- session refresh
- account locking / validation errors

Demo status:
- UI screens and validation states are implemented.
- Real auth remains unconnected until backend integration is available.

## Profile
Required backend contract:
- read public profile
- update profile details
- upload avatar
- store social links and interests
- privacy settings

Demo status:
- UI skeleton and form patterns exist.
- No real persistence or avatar upload is in place.

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

Demo status:
- Course/track structure is prepared.
- Real completion and persistence remain pending backend support.

## Puzzle arena
Required backend contract:
- existing `submit-puzzle` server-side endpoint
- leaderboard and verified solve data
- server-controlled status and rate-limit responses

Status:
- Existing architecture retained.
- UI respects the server-side trust boundary and does not perform client-side answer verification.

## Community and suggestions
Required backend contract:
- post creation
- voting and moderation
- suggestion lifecycle management
- comments and likes

Demo status:
- UI patterns and interactive behavior are present.
- No persistence or moderation workflow is connected.

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
