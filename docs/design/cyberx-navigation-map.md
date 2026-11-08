# CyberX Navigation Map

## Public navigation source of truth

`assets/js/cyberx-navigation.js` defines the public navigation categories, order, labels, destinations, aliases, and availability. The homepage desktop dropdowns, homepage mobile menu, and homepage terminal read the same registry. Admin is intentionally excluded from this public registry.

| Category | Pages (in display order) |
|---|---|
| Main | Home |
| Teams | Red Team, Blue Team |
| Intelligence | Secret, Awareness, Articles, Resources |
| Platform | Learning, Puzzle Arena, Experience, Dashboard, Leaderboard |
| Community | Community, AI Assistant, Donate |
| Account | Sign In, Profile, Pricing |

Pricing remains included under Account because it is an existing public route already linked from the homepage. “Secret” and “Puzzle Arena” both resolve to the existing `puzzle.html` page; they are distinct names for that existing destination. Red/Blue Team, Articles, Experience, and Donate resolve to existing homepage sections. No new routes are created.

## Public destinations

- Home and section links: `index.html` anchors.
- Awareness: `awareness.html`.
- Puzzle Arena / Secret: `puzzle.html`.
- Learning: `learning.html`.
- Dashboard: `dashboard.html`.
- Pricing: `pricing.html`.
- Sign In: `auth.html`.
- Profile: `profile.html`.
- Leaderboard: `leaderboard.html`.
- Community: `community.html`.
- Resources: `resources.html`.
- AI Assistant: `assistant.html`.

The terminal supports `help`, `pages`, `menu`, `navigate <page>`, and keeps the existing `--nav <page>` syntax. Page aliases are stored beside the destination in the shared registry. Existing terminal filesystem commands, module launching, puzzle command, and terminal controls remain in the homepage implementation. The pre-existing `--admin` command is not added to the public navigation registry; the existing Admin page and its authorization model are otherwise unchanged by navigation work.

## Internal discovery pattern

- Learning links to dashboard, puzzle, resources, and profile
- Dashboard links to learning, puzzle, leaderboard, and community
- Leaderboard links to puzzle, dashboard, and community
- Community links to resources, learning, and profile
- Resources links to learning, community, and assistant
- AI Assistant links to learning, resources, and dashboard
- Awareness links back to home and the platform experience

## Footer links

The footer should point to key public destinations without inventing unsupported external services or fake accounts.

## Admin boundary

`admin.html` is intentionally absent from the public navigation configuration and the `pages` / `menu` terminal listings. The existing terminal `--admin` command is preserved for compatibility and only opens the existing Admin route. The page currently has a client-side gate; that is not server-enforced authorization. Navigation changes do not claim to secure the Admin route or authorize privileged actions.
