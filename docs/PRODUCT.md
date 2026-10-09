# Product specification

## Goal and decisions

Build a real Tamagotchi Go web client that makes creature care, exploration,
relationships and combat understandable. It also supports reproducible demos,
administration of exposed resources and diagnosis of distributed failures.

The user delegated unspecified choices on 2026-10-09. Selected defaults:
responsive web on desktop and mobile, all current player capabilities, separate
supported admin workspace, modern handheld companion art direction, English
first, light theme first and API-based fixtures in a dedicated test environment.
The repository is local only. Application implementation is a later session.

Support widths from 360 px upward. Review 390x844, 768x1024 and 1440x900. Chrome
is the primary demo browser; check Safari for layout, location and socket basics.
No native app, offline mutations, PWA install flow, unrelated game mechanics,
OAuth login, chat attachments, global player search or inventory/shop is promised.

## Navigation and routes

The creature screen is the player's home. Explore, Creatures, Social and Combat
are the four main destinations. Notifications and account are utility actions.
On mobile use a compact bottom navigation; on desktop use a compact top rail.
Social contains people/guilds/chat. Combat contains battles/raids. Do not turn the
four destinations into a permanent large dashboard sidebar.

| Route | Purpose | Access |
|---|---|---|
| /login, /register | Package-aware authentication | anonymous |
| /creatures | Primary stage and collection | user |
| /creatures/:id | Care, stats, holder access | authorized holder |
| /explore | Own location and nearby players | user |
| /social | Relationships and friend requests | user |
| /players/:id | Public profile and contextual actions | user |
| /guilds, /guilds/:id | Guild discovery, roster and management | user, action-specific role |
| /guilds/:id/chat | Live chat plus history | guild member |
| /combat/battles, /combat/battles/:id | Challenges and battle state | participating user |
| /combat/raids, /combat/raids/:id | Guild raid discovery and participation | user, action-specific membership |
| /notifications | Personal inbox and read operations | user |
| /account | Identity, packages, wallets, preferences, logout | user |
| /admin/packages, /admin/packages/:id | Package metadata and full configuration authoring | admin/moderator as permitted |
| /admin/bosses, /admin/bosses/:id | Boss definitions and new versions | admin |
| /admin/occurrences | Availability windows and transitions | admin |
| /diagnostics | Opt-in redacted request activity | enabled environment and signed-in user |

Keep routes stable and lazy-load feature code. Future features add a route and
ordinary feature folder after their API is specified. Do not reserve fake menus.

## Authentication and onboarding

Load public active packages before registration/login. Registration requires
username, email, password and package_id. A configured package with no starter
cannot be advertised as ready. Login also requires membership of the chosen
package; joining another package happens after login through the account screen.
Registry config_version=null is not enough to support onboarding or care.

After registration, log in explicitly and load /users/me. Show starter creation
as pending, then poll collection with a bounded onboarding window. Never mint
the creature from the browser. Offer Retry/check later on a delayed event.
Identity comes from /users/me; decoded token roles are only a UI hint.
Switching account clears all user caches, cursors, sockets and location state.
No persistent login in the first release: reload requires login again. No token
entry form in ordinary gameplay. Test identities use separate browser contexts.

## Creatures

Give the primary creature the main visual stage. Show name, combat type, level,
XP number, role and only the stats this package defines. Package presentation
metadata supplies labels, units, icons and care actions. Do not invent hunger,
health decay, mood, XP-to-next-level thresholds or an XP progress percentage.
Secondary creatures use a compact collection view with meaningful artwork.

Care sends the declared action with one command key. The returned creature state
is authoritative. Currency status PENDING is displayed separately from care
success; refresh the local wallet rather than adding currency optimistically.
Show cooldown and unknown-action errors honestly. Confirm primary changes and
destructive release; obtain the correct resource ETag before If-Match writes.
Do not let an origin owner drop their final ownership or offer client mint/XP
grant buttons. Display shared holder count, not a fabricated ownership transfer.

Unknown package presentation: render supported API facts and graceful artwork
fallback; disable unsupported care choices with a clear explanation. Do not
guess action names or call service-only config endpoints.

## Exploration

Map is the canvas, with a compact location control, player marker, selected-player
detail and refresh action. User opts in to one-shot browser geolocation. Preview
coordinates and accuracy before submitting; permission failure does not prevent
using an existing fresh server observation. No background tracking by default.
Location refresh always writes a new timestamp and command key. Browser permission
is requested only from a user gesture. HTTPS/localhost and a reachable Gateway
are prerequisites. Manual coordinates are available in diagnostics/test mode.

Load own location first, then all nearby pages with an unchanged viewer observation.
MapLibre coordinates are [lng, lat]. Key markers by user_id; replace the completed
result set and discard markers absent from it. Show relationship by label/icon as
well as color. Friend/enemy visibility is not limited to the stranger threshold.

Empty, expired location, degraded relationships and map-provider failure are
distinct. Partial results explicitly warn that only close strangers are available.
Provider failure retains a usable list of returned players. No map-centred raid
markers: occurrences have no geographical position. Discovery of raids belongs
in Combat. Location expires quickly; never present stale pins as current.

## People and guilds

Discover profiles from nearby markers, relationships, friend requests and rosters.
Allow UUID entry in a secondary lookup control; there is no username search API.
Show friend request accept/reject, unfriend and enemy changes with confirmation
where destructive. Reconcile the lists after mutations; unknown reverse states
are not available to browser callers and must not be inferred.

Browse guilds with pagination. Selected guild details and roster establish
membership and role. Store a last-selected guild ID as a convenience, then verify
it; no current-user-guild API exists. Do not fetch every roster on every render.
Create guild, invite, accept/decline/revoke, leave/kick, role change, transfer
leadership and delete as permitted. Membership is at most one guild. Leader
cannot leave without transfer; permission refusals remain server-authoritative.

Chat uses fresh Gateway negotiation, direct Guild socket authentication and
REST history. Distinguish connecting, ready, offline, reconnecting, failed and
not-member states. Display pending message acknowledgements without duplicating
messages. Keep drafts through transient disconnects; do not auto-send them.

## Battles and raids

Battle selects two distinct held creatures, opponent and optional available boost.
Use server turn_user_id, expires_at, turn_expires_at and status. Countdown is
display-only; do not declare a victory locally. Challenge, accept/reject, attack
and forfeit use explicit commands. Poll the selected active battle; there is no
Battle socket. Show settlement_status and access_grant_status separately, including
partial delivery and needs attention. Successful combat is not proof of reward
delivery. Show only numeric damage/HP returned by the server.

Raid discovery combines available occurrences, versioned boss display data and raid
lists. Existing Raid detail uses its returned RaidBoss snapshot. If additional
art/reward configuration is needed, resolve its occurrence and boss_version;
never substitute a current boss definition for the pinned combat snapshot. Guild leader creates/cancels; members attack as their own identity. There
is no separate join endpoint: the first accepted attack admits the participant.
An engaged primary can be refused. Use returned next_attack_at for attack
readiness; first-render predictions never authorize an attack. Show leaderboard,
terminal outcome and durable reward status. Completion, timeout defeat and
cancellation have different reward semantics. Preserve boss/participant snapshots;
do not recalculate server damage or allocation in the browser.

## Notifications and account

Notifications are a personal inbox with pagination, individual read, read-all at
a fixed created_before timestamp and category preferences. Render six event types
from parameters using centralized templates; validate deep-link IDs. An unknown
future type has a neutral fallback. No raw JSON in ordinary cards.

Display delivery diagnostics only where useful. NO_DEVICE is not a gameplay error;
ACCEPTED_BY_PROVIDER is not proof of actual device delivery. Browser Firebase push
is an optional configured extension; do not register fake tokens or request
notification permission automatically. Device list/removal can be implemented now.
Registration is enabled only with a working provider adapter and explicit opt-in.

Account exposes /me, package membership/joining, global/local wallets, preferences
and logout. No unsupported profile editor, password reset, currency transfer or
user-directory administration.

## Administration

Administration is a quieter part of the same visual system, not a second product.
Use tables for lists and clear forms for editing. Route visibility is not security;
all actions rely on server authorization. Moderators can access only their permitted
package operations; being an admin does not invent access to service-only routes.

Create/edit package metadata, author a complete configuration, create/version
bosses and create/activate/deactivate/cancel occurrences. Show validation bounds,
version conflicts and the effect on existing snapshots. A config editor starts
from a client-owned saved draft/import because no browser GET of the full config
is available. Do not overwrite with a guessed partial definition. Download/export
drafts as JSON with no credentials. Verify asset references and preview artwork.

No role grants, database viewer, live log viewer, internal service-token console,
arbitrary creature grants or reward-repair buttons. These APIs are absent or
service-only. The fixture CLI is separate from the web admin area.

## Diagnostics and completion

Optional diagnostics show method, safe route template, status, duration, stable
error code and correlation ID. A bounded ring of 100 records in memory is enough.
No request/response body capture by default; redact tokens, cookies, email,
password, exact locations, chat text, headers and tickets. Copy correlation ID
is the link to external service logs. Health is not full integration readiness.

The client is complete when all supported flows work with the real documented
server, required/refusal states are intelligible, responsive screens pass visual
review, fixtures can be resumed safely, configuration requires no source edits,
and tests distinguish local fixtures from real integration. Missing backend
capabilities stay listed and do not silently become simulated successes.
