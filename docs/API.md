# Client API contract

## Baseline and precedence

Snapshot date: 2026-10-09. Shared source: 046899e, including the pending preparation
PR #228. Gateway runtime source: 8b40c8b; publication-only branch: 846c5b6.
Map/Raid published 2.0.0, UM/Battle 2.0.1, Guild/Registry 2.0.3,
Tamagotchi 2.0.4 and Notification 2.0.3 were the isolated acceptance candidates.
Exact source/image provenance and field-reference hashes are in
[CONTRACT_SNAPSHOT.json](CONTRACT_SNAPSHOT.json).

This is a dated compatibility contract, not automatic discovery of future APIs.
The endpoint appendix below and [PAYLOADS.md](PAYLOADS.md) define requests and
responses without backend source access. This document adds client handling and
known runtime differences. If a future response conflicts, retain the raw status
and safe diagnostic, record the mismatch and ask for a contract decision. Do not
rewrite the server, broaden permissions or silently invent a success response.

## Transport and routing

REST JSON is UTF-8, snake_case. Use /api relative to the client origin. The fixed
web proxy removes /api, then Gateway removes exactly one service prefix. Prefixes:
/users, /tamagotchi, /battle, /guild, /registry, /map, /raid, /notification.
Gateway control routes are /api/gateway/v1/ws-negotiate, /api/health and /api/ready.
There is no /api/raid/v1/health convention to infer from domain tables.
Provider assets and negotiated direct Guild sockets are exceptions to REST routing.
Do not introduce direct domain REST URLs in browser configuration.

Send Accept: application/json and Content-Type: application/json when there is a
JSON body. Parse application/problem+json on errors and empty 204 without JSON.
Capture status and returned ETag, Retry-After and X-Correlation-Id independently
of the DTO. A HTML/invalid JSON response from an API route is a transport/proxy
error. Refuse redirects for API requests rather than sending credentials elsewhere.
Validate media/assets separately; they are not domain JSON responses.

## Identity

User requests send Authorization: Bearer <access_token> only to the configured
same-origin API. Do not send X-User-Id, X-User-Roles, X-Service-Name,
X-Gateway-Assertion, X-Gateway-Context, deadline-context headers or service secrets.
Gateway owns those downstream concerns. User claims grant no service scopes.
Routes marked service are unavailable to the web client, including currency
credits, XP grants, minting, engagements, membership internals and config reads.
Even an admin role is not a general service credential.

Public registration/login/refresh/logout and package/type reads omit Authorization.
An invalid bearer on a public route is rejected, not downgraded to anonymous.
Tokens contain access_token, refresh_token, token_type=Bearer, expires_in=900.
Access lifetime is 15 minutes; refresh is opaque, rotates and lasts 30 days.
Only keep both in memory. Refresh once through a coordinated in-flight promise;
its 10-second repeated-use grace is not permission for an unbounded retry loop.
Logout uses the current Refresh body and no bearer. /users/me provides the user_id,
username, email and package_ids. Token role decoding is a navigation hint only.

Login requires the selected package_id. 403 package_membership_required differs
from 401 invalid_credentials. No password reset, role-management or username
search API exists. Admin role must be provisioned outside the client through the
server owner's supported mechanism; the client only logs into that account.

## IDs, timestamps and diagnostics

Treat UUIDv7 as strings, do not replace with numeric IDs. crypto.randomUUID() is
v4 and is unsuitable for correlation/chat client IDs. Generate UUIDv7 using one
tested implementation. Path parameters are encoded; validate IDs before building
deep links. Never interpolate arbitrary URLs into API routing.

Send fresh UUIDv7 X-Correlation-Id per transport attempt, including explicit replay.
Display/copy the returned correlation for failures. Keep the original mutation key
for retries; correlation and command identity are distinct. Requests/response logs
do not include bearer, refresh, assertion, secret, ticket or body values.

Serialize new timestamps with Date.toISOString(): UTC with milliseconds. Parse
valid server ISO timestamps and offsets without string-comparison ordering; some
older owner output may contain more fractional digits. Preserve original values
when round-tripping a command. Never truncate a saved command timestamp during
retry or derive write fingerprints from formatted display values. Display dates
in the user's locale with a UTC detail available. Null dates remain null.

Money/XP are JSON safe integers up to 9007199254740991. Validate bounds before
formatting; don't turn large values into floating-point gameplay calculations.
Server state, damage and rewards are authoritative.

## Command identity and uncertain outcomes

The endpoint table marks required Idempotency-Key headers. Use UUIDv7 strings
for new logical commands, each within the 1-128 printable ASCII contract. Snapshot
method, path, body and key before sending. Disable duplicate submits while in-flight.
Retain an uncertain operation in memory so an explicit Retry uses the exact body
and same key. Keep mutation retry=false; reads alone may have limited retries.

Completed receipts last 24 hours. Identical retries return the recorded response;
changed input yields 409 idempotency_conflict. Pending work can return
409 command_in_progress. Never solve a timeout by giving the same action a fresh
key: it may have committed already. A new intentional care/attack gets a new key.
Do not silently modify a retry timestamp, boost array, actor or selected creature.
After re-login, allow explicit replay only under the same user/operation.
On reload, the memory-only pending command is lost: show state reconciliation,
not guaranteed replay recovery. Persistent command journaling is a later decision.

Authentication refresh must not automatically retry a mutation. GET can retry
once after successful refresh; a command remains in a visible retry/reconcile state.
Read-refetch after a timeout can establish resource state, but does not prove an
unobservable effect failed. Durable external effects are server responsibilities.

## Optimistic concurrency

Capture the exact ETag from the relevant resource read, including quotes. Use it
unchanged in If-Match for primary selection, creature release, preferences and
Registry metadata/boss edits. Do not use wildcard * as a default or guess ETags.
412/precondition_failed prompts reload and review of edits, not automatic overwrite.

Guild role changes use expected_guild_version in the body, not If-Match.
Package config writes use expected_package_revision, not config_version. Package
revision is a metadata concurrency counter; config_version identifies an immutable
definition. GET full package configuration for browser callers does not exist.
Retain/import/export authored definitions explicitly before writing a full replacement.

## Cursor lists

Use limit=25 for ordinary lists, 100 for Map marker pages and a visible Load more
for large history. Never treat a cursor as offset or inspect its signature. Keep
caller, endpoint, filters and limit unchanged until next_cursor=null. Bound aggregate
Map loading to 20 pages per refresh; show a truncation notice and an explicit
Load more for larger results rather than hidden endless fetching.

Map response uses nearby, Collection uses primary/secondary; other page DTOs
typically use items. Do not impose a universal items accessor on every DTO.
Nearby sort is distance_m, user_id ascending, bound to full viewer observation.
Raid list sorts started_at and raid_id descending; leaderboard sorts damage
descending, joined time/user ascending and binds raid_version. Other lists use
opaque server ordering. All are live, not frozen snapshots.

400 invalid_cursor resets pagination with a visible notice. 409 cursor_stale resets
Map/leaderboard from page one; allow one automatic restart per refresh, then offer
manual Retry if data keeps changing. Do not mix old and new cursor contexts.
409 viewer_location_unavailable means submit/check a fresh own location, not
an empty successful map. Deduplicate aggregated markers by user_id and messages
by message_id. Keep list keys tied to server IDs, not array indexes.

## Expected failures and UI action

| Status/code | UI handling |
|---|---|
| 400 validation_error/invalid_idempotency_key | Inline field/action validation; no automatic retry |
| 401 unauthenticated/invalid_credentials | Distinguish API session expiry from failed login; bounded refresh or login |
| 403 not_self/insufficient_scope/admin_required/not_a_holder | Permission explanation; never retry with forged headers |
| 404 missing resource | Resource unavailable state; location 404 allows submitting an initial observation |
| 409 idempotency_conflict | Preserve command diagnostics; changed input requires a genuinely new action |
| 409 command_in_progress | Pending state with explicit check/retry using same command |
| 409 creature_engaged | Explain another battle/raid; refresh collection/state |
| 409 cursor_stale/viewer_location_unavailable | Reset pagination or obtain fresh location |
| 409 version_conflict/action_on_cooldown | Reload resource or wait; no invented duration if not supplied |
| 410 challenge_expired | Expired challenge, refresh detail |
| 412 precondition_failed | Reload and review stale edits |
| 422 domain validation | Explain the domain refusal; preserve returned safe code |
| 429 too_many_attempts | Wait per Retry-After; disable auth spam, no bypass |
| 502 dependency_error/upstream_unavailable | Dependency unavailable/malformed response, keep retry/reconciliation honest |
| 503 too_many_tasks | Busy, Retry-After generally 1s; no automatic mutation retry |
| 503 auth_keys_unavailable/gateway_keys_unavailable | Environment unavailable, do not erase account state as bad credentials |
| 504 task_timeout | Operation may be uncertain; preserve key/body and offer reconciliation |
| Abort/network failure | Keep distinctions between navigation cancellation and user-visible operation failure |

Problem has type, title, status, detail, instance, code, correlation_id. Type can
be about:blank or an absolute URI; code is the application discriminator. Use
text rendering, never HTML. Unknown codes get a useful generic explanation and
correlation ID; don't crash the app because a future code is new.

## Map behaviour

Only own raw location, writes, deletion and nearby queries are allowed. The write
receipt can be HTTP 200 with accepted=false and reason DUPLICATE/STALE/OUT_OF_ORDER;
do not treat all 200s as an updated observation. Friends/enemies are visible while
fresh; strangers are restricted to six metres under the selected default.
Nearby partial=true/RELATIONSHIPS_UNAVAILABLE provides only close strangers.
Both caller observation and nearby markers age; use expires_at where supplied.
No marker names are included: fetch selected profiles on demand and cache briefly.
No geographic boss/occurrence positions exist.

## Guild socket protocol

1. With a user bearer, POST /api/gateway/v1/ws-negotiate with
   {"resource":"guild.chat","resource_id":"<guild UUIDv7>"}.
2. Validate {url,ticket,expires_at}; use a fresh single-use ticket within 30s.
3. Open the direct ws/wss URL. Never put bearer/ticket in a URL or handshake header.
4. Send {"type":"auth","ticket":"<ticket>"} as the first frame within five seconds.
5. Wait for ready {type,guild_id,user_id,expires_at}; then send
   {"type":"send","client_message_id":"<UUIDv7>","content":"Hello"}.
6. ack carries client_message_id,message_id,timestamp. Broadcast message wraps
   ChatMessage. Merge either arrival order without duplicate bubbles. Retrying
   an explicitly pending same message uses the same client_message_id.

Server error frames use type=error,code,detail and optional client_message_id.
Close 4401 is invalid/expired/reused ticket; 4403 means membership refusal.
Do not repeatedly reconnect on these refusals. Other transport disconnects can
retry negotiation up to five times with 1/2/4/8/15-second delays and jitter while
visible. After the bound, offer manual Reconnect. Every new connection negotiates
a new ticket; there is no reusable ticket or Battle WebSocket. Reconcile missed
chat through paged REST history. No undocumented resume cursor or heartbeat frame.

Selected runtime ready.expires_at can describe the socket session, longer than
the initial ticket lifetime. Don't reject a ready frame merely for exceeding
30 seconds; that bound applies to ticket issuance. Socket activity and history
are not broker subscriptions from the browser.

## Notification presentation

Notification DTO primary key is id, not notification_id. The latter appears in
provider payloads. params contain strings/numbers/booleans; they are not arbitrary
trusted HTML. Use these six template families: friend request, nearby player,
battle request, shared creature, guild invitation and raid started.
Use known validated target IDs where present; otherwise link to the owning list.
The browser does not read RabbitMQ or manufacture a notification record.

Provider status must retain PENDING/ACCEPTED_BY_PROVIDER/SUPPRESSED/NO_DEVICE/
EXPIRED/FAILED. Do not report that a device received a push from persisted history.
Preferences update uses If-Match. Read-all fixes created_before at click time and
replays the same timestamp/key after an uncertain response.

### Notification parameter templates

These parameter keys were checked in retained acceptance responses. The Guild
shape is a contract/sample reference; its live producer flow remains blocked
at this snapshot. Validate values before rendering or routing.

| Type | Parameters | Destination |
|---|---|---|
| FRIEND_REQUEST | request_id, from_user_id, from_username, expires_at | /social with selected request |
| PLAYER_NEARBY | with_user_id, distance_m, encounter_id | /players/:with_user_id or Explore |
| BATTLE_REQUEST | battle_id, challenger_id, challenger_username, expires_at | /combat/battles/:battle_id |
| TAMAGOTCHI_SHARED | tamagotchi_id, tamagotchi_name, combat_type, level | /creatures/:tamagotchi_id |
| GUILD_INVITATION | guild_id, guild_name, invitation_id, expires_at | /guilds/:guild_id with selected invitation |
| RAID_STARTED | raid_id, guild_id, boss_name, started_at, expires_at | /combat/raids/:raid_id |

IDs and dates above are strings; level is an integer and distance_m a number.
Do not require envelope recipient/event fields to be repeated inside params.
Names are display text, not authorization. Missing optional contextual values
produce neutral wording/list navigation, never a forged route or app crash.

## Known gaps and compatibility decisions

| Gap/status at snapshot | Client decision |
|---|---|
| UM 2.0.1 stranger Relationship version=0; target >=1 | Guild invitation can fail 502. Keep a real failure state and retest corrected server; do not weaken contract |
| No user search, user-admin CRUD or role grants | Contextual discovery/UUID lookup and externally provisioned admin; no fake directory |
| No browser full package config/stat/currency-rules read | Authored versioned presentation/config drafts; never embed service tokens |
| No me/guild or membership query for current user | Select a guild and verify roster; last-selected guild is only a hint |
| No raid join command | First attack admits participant; button labels explain this |
| No asset upload API, boss-specific asset manifest or XP threshold API | Local licensed assets/catalog; XP number only |
| Browser push needs genuine Firebase/provider configuration | Inbox works; push optional and disabled until configured |
| Gateway metrics and domain probes are infrastructure routes | Do not expose internal metrics/service hosts in ordinary player UI |
| Gateway/Shared preparation PRs require review | Source specification is not proof those changes are published |
| Live Registry (acceptance, 2026-10-09) refuses package PATCH and boss PUT without Idempotency-Key, though the table lists only If-Match | Client sends both; one key per logical edit, reused only by an explicit retry. Recheck when Registry is corrected |
| Live Map (acceptance, 2026-10-09): STALE means the reading's timestamp is more than 60 s old (nothing stored, current_timestamp null); OUT_OF_ORDER means older than the stored reading; more than about 30 s ahead is 400 invalid_timestamp; expires_at is timestamp + 60 s | Client stamps an observation when it is shared, re-locates previews older than 30 s and explains each reason |

## Examples

Public login body:

```json
{"email":"player@example.test","password":"<supplied password>","package_id":"<actual package UUIDv7>"}
```

Location write body, with bearer and Idempotency-Key generated for this command:

```json
{"user_id":"<authenticated user UUIDv7>","lat":47.0105,"lng":28.8638,"timestamp":"2026-10-09T12:00:00.000Z","accuracy_m":5}
```

The example timestamp is illustrative: new observations use the actual current
time. Explicit retries retain the original timestamp, body and command key.
Raid create body: {"guild_id":"<led guild UUIDv7>","occurrence_id":"<active occurrence UUIDv7>"}.
Attack body: {"user_id":"<authenticated user UUIDv7>"}.
Care body: {"action":"FEED"}, only when the package presentation declares FEED.
Primary selection body: {"tamagotchi_id":"<held creature UUIDv7>"} with its own
PrimarySelection ETag, not an arbitrary creature's ETag.

## Endpoint appendix

The generated endpoint tables follow this section. Paths already include the
Gateway prefix, but omit the client /api prefix. Shapes are linked by heading in
PAYLOADS.md. Service-only rows are included for context and fixture constraints;
they are not browser features. Only declared admin/user/public access is usable.

### Gateway endpoints

| Method/path | Request | Response | Access |
|---|---|---|---|
| `ANY /{service}/v1/...` | downstream request | downstream response | per endpoint |
| `POST /gateway/v1/ws-negotiate` | [WsNegotiateInput](PAYLOADS.md#wsnegotiateinput) | 200 [WsTicket](PAYLOADS.md#wsticket) | user |
| `GET /health` | none | 200 [Health](PAYLOADS.md#health) | public |
| `GET /ready` | none | 200 [Readiness](PAYLOADS.md#readiness) or 503 [Problem](PAYLOADS.md#problem) | public |

### User Management endpoints

| Method/path | Request | Response | Access |
|---|---|---|---|
| `POST /users/v1/users/register` | [Register](PAYLOADS.md#register), Idempotency-Key | 201 [Registration](PAYLOADS.md#registration) | public |
| `POST /users/v1/users/login` | [Login](PAYLOADS.md#login) | 200 [Tokens](PAYLOADS.md#tokens) | public |
| `POST /users/v1/auth/refresh` | [Refresh](PAYLOADS.md#refresh) | 200 [Tokens](PAYLOADS.md#tokens) | public |
| `POST /users/v1/auth/logout` | [Refresh](PAYLOADS.md#refresh) | 204 | public |
| `POST /users/v1/service-tokens` | [ServiceTokenRequest](PAYLOADS.md#servicetokenrequest), X-Service-Secret | 200 [ServiceToken](PAYLOADS.md#servicetoken) | service client secret or admin |
| `GET /users/v1/jwks` | none | 200 [Jwks](PAYLOADS.md#jwks) | public |
| `GET /users/v1/users/me` | none | 200 [User](PAYLOADS.md#user) | user |
| `GET /users/v1/users/{userId}` | none | 200 [UserProfile](PAYLOADS.md#userprofile) | user or service |
| `POST /users/v1/users/me/packages` | [JoinPackage](PAYLOADS.md#joinpackage), Idempotency-Key | 200 [User](PAYLOADS.md#user) | user |
| `GET /users/v1/internal/users/{userId}/membership` | none | 200 [MembershipSnapshot](PAYLOADS.md#membershipsnapshot) | service |
| `GET /users/v1/users/{userId}/relationships` | query limit, cursor | 200 [RelationshipPage](PAYLOADS.md#relationshippage) | user or service |
| `GET /users/v1/users/{userId}/relationship/{otherId}` | none | 200 [Relationship](PAYLOADS.md#relationship) | service |
| `POST /users/v1/friend-requests` | [FriendRequestInput](PAYLOADS.md#friendrequestinput), Idempotency-Key | 201 [FriendRequest](PAYLOADS.md#friendrequest) | user |
| `GET /users/v1/friend-requests` | query limit, cursor | 200 [FriendRequestPage](PAYLOADS.md#friendrequestpage) | user |
| `POST /users/v1/friend-requests/{id}/accept` | Idempotency-Key | 200 [FriendRequest](PAYLOADS.md#friendrequest) | user |
| `POST /users/v1/friend-requests/{id}/reject` | Idempotency-Key | 200 [FriendRequest](PAYLOADS.md#friendrequest) | user |
| `DELETE /users/v1/users/{userId}/friends/{otherId}` | none | 204 | user |
| `PUT /users/v1/users/{userId}/enemies/{otherId}` | none | 200 [Relationship](PAYLOADS.md#relationship) | user |
| `DELETE /users/v1/users/{userId}/enemies/{otherId}` | none | 204 | user |
| `GET /users/v1/users/{userId}/currency/global` | none | 200 [Wallet](PAYLOADS.md#wallet) | user or service |
| `GET /users/v1/users/{userId}/currency/local/{packageId}` | none | 200 [Wallet](PAYLOADS.md#wallet) | user |
| `POST /users/v1/users/{userId}/currency/global/add` | [Credit](PAYLOADS.md#credit), Idempotency-Key | 200 [CreditReceipt](PAYLOADS.md#creditreceipt) | service |
| `POST /users/v1/users/{userId}/currency/local/add` | [LocalCredit](PAYLOADS.md#localcredit), Idempotency-Key | 200 [CreditReceipt](PAYLOADS.md#creditreceipt) | service |
| `POST /users/v1/internal/battle-settlements` | [BattleSettlementInput](PAYLOADS.md#battlesettlementinput), Idempotency-Key | 200 [BattleSettlement](PAYLOADS.md#battlesettlement) | service |
| `GET /users/v1/users/me/boosts` | query limit, cursor | 200 [BoostPage](PAYLOADS.md#boostpage) | user |
| `POST /users/v1/internal/boost-consumptions` | [ConsumeBoost](PAYLOADS.md#consumeboost), Idempotency-Key | 200 [BoostReceipt](PAYLOADS.md#boostreceipt) | service |

### Tamagotchi endpoints

| Method/path | Request | Response | Access |
|---|---|---|---|
| `POST /tamagotchi/v1/tamagotchis` | [Mint](PAYLOADS.md#mint), Idempotency-Key | 201 [Tamagotchi](PAYLOADS.md#tamagotchi) | service |
| `GET /tamagotchi/v1/tamagotchis/{id}` | none | 200 [Tamagotchi](PAYLOADS.md#tamagotchi) | user or service |
| `GET /tamagotchi/v1/tamagotchis` | query holder_id, package_id, type, limit, cursor | 200 [TamagotchiPage](PAYLOADS.md#tamagotchipage) | user |
| `POST /tamagotchi/v1/tamagotchis/{id}/care` | [CareInput](PAYLOADS.md#careinput), Idempotency-Key | 200 [CareReceipt](PAYLOADS.md#carereceipt) | user |
| `POST /tamagotchi/v1/tamagotchis/{id}/xp` | [XpInput](PAYLOADS.md#xpinput), Idempotency-Key | 200 [XpReceipt](PAYLOADS.md#xpreceipt) | service |
| `POST /tamagotchi/v1/tamagotchis/{id}/holders` | [GrantAccessInput](PAYLOADS.md#grantaccessinput), Idempotency-Key | 200 [AccessGrantReceipt](PAYLOADS.md#accessgrantreceipt) | service |
| `GET /tamagotchi/v1/tamagotchis/{id}/holders` | none | 200 [Holders](PAYLOADS.md#holders) | user or service |
| `DELETE /tamagotchi/v1/tamagotchis/{id}/holders/{userId}` | If-Match | 204 | user |
| `GET /tamagotchi/v1/users/{userId}/collection` | query limit, cursor | 200 [Collection](PAYLOADS.md#collection) | user or service |
| `GET /tamagotchi/v1/users/{userId}/collection/primary` | none | 200 [PrimarySelection](PAYLOADS.md#primaryselection) | user |
| `PUT /tamagotchi/v1/users/{userId}/collection/primary` | [PrimaryInput](PAYLOADS.md#primaryinput), If-Match | 200 [PrimarySelection](PAYLOADS.md#primaryselection) | user |
| `DELETE /tamagotchi/v1/users/{userId}/collection/{id}` | If-Match | 204 | user |
| `GET /tamagotchi/v1/types` | none | 200 [TypeList](PAYLOADS.md#typelist) | public |
| `GET /tamagotchi/v1/types/matrix` | none | 200 [TypeMatrix](PAYLOADS.md#typematrix) | public |
| `POST /tamagotchi/v1/internal/engagements` | [EngagementInput](PAYLOADS.md#engagementinput), Idempotency-Key | 201 [Engagement](PAYLOADS.md#engagement) | service |
| `GET /tamagotchi/v1/internal/engagements/{referenceId}` | none | 200 [Engagement](PAYLOADS.md#engagement) | service |
| `POST /tamagotchi/v1/internal/engagements/{referenceId}/release` | Idempotency-Key | 200 [Engagement](PAYLOADS.md#engagement) | service |

### Battle endpoints

| Method/path | Request | Response | Access |
|---|---|---|---|
| `POST /battle/v1/battles` | [BattleInput](PAYLOADS.md#battleinput), Idempotency-Key | 201 [Battle](PAYLOADS.md#battle) | user |
| `GET /battle/v1/battles` | query limit, cursor | 200 [BattlePage](PAYLOADS.md#battlepage) | user |
| `GET /battle/v1/battles/{battleId}` | none | 200 [Battle](PAYLOADS.md#battle) | user |
| `POST /battle/v1/battles/{battleId}/accept` | [BattleAccept](PAYLOADS.md#battleaccept), Idempotency-Key | 202 [Battle](PAYLOADS.md#battle) | user |
| `POST /battle/v1/battles/{battleId}/reject` | Idempotency-Key | 200 [Battle](PAYLOADS.md#battle) | user |
| `POST /battle/v1/battles/{battleId}/attack` | [ActorInput](PAYLOADS.md#actorinput), Idempotency-Key | 200 [BattleAttack](PAYLOADS.md#battleattack) | user |
| `POST /battle/v1/battles/{battleId}/forfeit` | Idempotency-Key | 200 [Battle](PAYLOADS.md#battle) | user |

### Guild endpoints

| Method/path | Request | Response | Access |
|---|---|---|---|
| `POST /guild/v1/guilds` | [GuildInput](PAYLOADS.md#guildinput), Idempotency-Key | 201 [Guild](PAYLOADS.md#guild) | user |
| `GET /guild/v1/guilds` | query limit, cursor | 200 [GuildPage](PAYLOADS.md#guildpage) | user |
| `GET /guild/v1/guilds/{guildId}` | none | 200 [Guild](PAYLOADS.md#guild) | user or service |
| `GET /guild/v1/guilds/{guildId}/members` | none | 200 [Members](PAYLOADS.md#members) | user or service |
| `POST /guild/v1/guilds/{guildId}/invitations` | [InvitationInput](PAYLOADS.md#invitationinput), Idempotency-Key | 201 [Invitation](PAYLOADS.md#invitation) | user |
| `GET /guild/v1/invitations` | query limit, cursor | 200 [InvitationPage](PAYLOADS.md#invitationpage) | user |
| `POST /guild/v1/guilds/{guildId}/invitations/{id}/accept` | Idempotency-Key | 200 [Invitation](PAYLOADS.md#invitation) | user |
| `POST /guild/v1/guilds/{guildId}/invitations/{id}/decline` | Idempotency-Key | 200 [Invitation](PAYLOADS.md#invitation) | user |
| `POST /guild/v1/guilds/{guildId}/invitations/{id}/revoke` | Idempotency-Key | 200 [Invitation](PAYLOADS.md#invitation) | user |
| `DELETE /guild/v1/guilds/{guildId}/members/{userId}` | none | 204 | user |
| `PATCH /guild/v1/guilds/{guildId}/members/{userId}/role` | [RoleInput](PAYLOADS.md#roleinput), Idempotency-Key | 200 [Members](PAYLOADS.md#members) | user |
| `POST /guild/v1/guilds/{guildId}/leadership` | [LeaderInput](PAYLOADS.md#leaderinput), Idempotency-Key | 200 [Guild](PAYLOADS.md#guild) | user |
| `DELETE /guild/v1/guilds/{guildId}` | none | 204 | user |
| `GET /guild/v1/guilds/{guildId}/messages` | query limit, cursor | 200 [ChatPage](PAYLOADS.md#chatpage) | user |
| `POST /guild/v1/guilds/{guildId}/chat-tickets` | none | 201 [ChatTicket](PAYLOADS.md#chatticket) | user |
| `GET /guild/v1/guilds/{guildId}/chat` | WebSocket upgrade | 101 | ticket in the first frame |

### Package Registry endpoints

| Method/path | Request | Response | Access |
|---|---|---|---|
| `POST /registry/v1/packages` | [PackageInput](PAYLOADS.md#packageinput), Idempotency-Key | 201 [Package](PAYLOADS.md#package) | admin |
| `GET /registry/v1/packages` | query limit, cursor | 200 [PackagePage](PAYLOADS.md#packagepage) | public |
| `GET /registry/v1/packages/{packageId}` | none | 200 [Package](PAYLOADS.md#package) | public |
| `PATCH /registry/v1/packages/{packageId}` | [PackageEdit](PAYLOADS.md#packageedit), If-Match | 200 [Package](PAYLOADS.md#package) | moderator |
| `PUT /registry/v1/packages/{packageId}/stats` | [PackageConfigWrite](PAYLOADS.md#packageconfigwrite), Idempotency-Key | 200 [PackageConfig](PAYLOADS.md#packageconfig) | moderator |
| `GET /registry/v1/packages/{packageId}/stat-definitions` | query config_version | 200 [StatDefinitions](PAYLOADS.md#statdefinitions) | service |
| `GET /registry/v1/packages/{packageId}/stat-bonuses` | query config_version | 200 [Bonuses](PAYLOADS.md#bonuses) | service |
| `GET /registry/v1/packages/{packageId}/currency-rules` | query config_version | 200 [CurrencyRules](PAYLOADS.md#currencyrules) | service |
| `GET /registry/v1/packages/{packageId}/starter-pet` | query config_version | 200 [StarterConfig](PAYLOADS.md#starterconfig) | service |
| `GET /registry/v1/packages/{packageId}/assets` | query config_version | 200 [Assets](PAYLOADS.md#assets) | public |
| `GET /registry/v1/packages/{packageId}/users` | query limit, cursor | 200 [PackageMemberPage](PAYLOADS.md#packagememberpage) | service |
| `POST /registry/v1/packages/eligibility-check` | [EligibilityInput](PAYLOADS.md#eligibilityinput) | 200 [Eligibility](PAYLOADS.md#eligibility) | service |
| `POST /registry/v1/bosses` | [BossInput](PAYLOADS.md#bossinput), Idempotency-Key | 201 [Boss](PAYLOADS.md#boss) | admin |
| `GET /registry/v1/bosses` | query limit, cursor | 200 [BossPage](PAYLOADS.md#bosspage) | admin |
| `GET /registry/v1/bosses/{bossId}` | query config_version | 200 [Boss](PAYLOADS.md#boss) | user or service |
| `PUT /registry/v1/bosses/{bossId}` | [BossInput](PAYLOADS.md#bossinput), If-Match | 200 [Boss](PAYLOADS.md#boss) | admin |
| `POST /registry/v1/raid-occurrences` | [OccurrenceInput](PAYLOADS.md#occurrenceinput), Idempotency-Key | 201 [Occurrence](PAYLOADS.md#occurrence) | admin |
| `GET /registry/v1/raid-occurrences` | query limit, cursor | 200 [OccurrencePage](PAYLOADS.md#occurrencepage) | user |
| `GET /registry/v1/raid-occurrences/{id}` | none | 200 [Occurrence](PAYLOADS.md#occurrence) | user or service |
| `POST /registry/v1/raid-occurrences/{id}/activate` | Idempotency-Key | 200 [OccurrenceReceipt](PAYLOADS.md#occurrencereceipt) | admin |
| `POST /registry/v1/raid-occurrences/{id}/deactivate` | Idempotency-Key | 200 [OccurrenceReceipt](PAYLOADS.md#occurrencereceipt) | admin |
| `POST /registry/v1/raid-occurrences/{id}/cancel` | Idempotency-Key | 200 [OccurrenceReceipt](PAYLOADS.md#occurrencereceipt) | admin |

### Map endpoints

| Method/path | Request | Response | Access |
|---|---|---|---|
| `POST /map/v1/location` | [LocationInput](PAYLOADS.md#locationinput), Idempotency-Key | 200 [LocationReceipt](PAYLOADS.md#locationreceipt) | user |
| `GET /map/v1/location/{userId}` | none | 200 [Location](PAYLOADS.md#location) | user |
| `GET /map/v1/location/nearby/{userId}` | query limit, cursor | 200 [Nearby](PAYLOADS.md#nearby) | user |
| `DELETE /map/v1/location/{userId}` | none | 204 | user |

### Monster Raid endpoints

| Method/path | Request | Response | Access |
|---|---|---|---|
| `POST /raid/v1/raids` | [RaidInput](PAYLOADS.md#raidinput), Idempotency-Key | 201 [Raid](PAYLOADS.md#raid) | user |
| `GET /raid/v1/raids` | query guild_id, limit, cursor | 200 [RaidPage](PAYLOADS.md#raidpage) | user |
| `GET /raid/v1/raids/{raidId}` | none | 200 [Raid](PAYLOADS.md#raid) | user or service |
| `POST /raid/v1/raids/{raidId}/attack` | [ActorInput](PAYLOADS.md#actorinput), Idempotency-Key | 200 [RaidAttack](PAYLOADS.md#raidattack) | user |
| `GET /raid/v1/raids/{raidId}/leaderboard` | query limit, cursor | 200 [Leaderboard](PAYLOADS.md#leaderboard) | user or service |
| `DELETE /raid/v1/raids/{raidId}` | none | 204 | user |

### Notification endpoints

| Method/path | Request | Response | Access |
|---|---|---|---|
| `POST /notification/v1/devices` | [DeviceInput](PAYLOADS.md#deviceinput), Idempotency-Key | 200 [Device](PAYLOADS.md#device) | user |
| `GET /notification/v1/devices` | query limit, cursor | 200 [DevicePage](PAYLOADS.md#devicepage) | user |
| `DELETE /notification/v1/devices/{id}` | none | 204 | user |
| `GET /notification/v1/users/{userId}/notifications` | query limit, cursor | 200 [NotificationPage](PAYLOADS.md#notificationpage) | user |
| `PATCH /notification/v1/notifications/{id}` | [ReadInput](PAYLOADS.md#readinput) | 200 [Notification](PAYLOADS.md#notification) | user |
| `POST /notification/v1/users/{userId}/notifications/read-all` | [ReadAllInput](PAYLOADS.md#readallinput), Idempotency-Key | 200 [ReadAllReceipt](PAYLOADS.md#readallreceipt) | user |
| `GET /notification/v1/users/{userId}/preferences` | none | 200 [Preferences](PAYLOADS.md#preferences) | user |
| `PUT /notification/v1/users/{userId}/preferences` | [PreferencesInput](PAYLOADS.md#preferencesinput), If-Match | 200 [Preferences](PAYLOADS.md#preferences) | user |
