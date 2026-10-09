# Backend handoff from the web client

For the backend owners (Gateway, User Management, Tamagotchi, Registry, Map,
Battle, Monster Raid, Guild, Notification). It summarizes how the finished web
client uses the platform, what was verified against the running acceptance stack
on 2026-10-09, and the server-side behaviour that differs from the contract or
deserves a decision. Client details live in [IMPLEMENTATION.md](IMPLEMENTATION.md)
and [API.md](API.md); this page is the backend view.

## 1. The client in one paragraph

A React/TypeScript single-page app (branch `feat/client-app` of the client
repository). The browser calls only same-origin `/api/...`; the Vite dev proxy or
the packaged Caddy runtime removes `/api` once and forwards to Gateway unchanged
(Authorization included). Tokens live in memory only. Every logical command sends a
UUIDv7 `Idempotency-Key` and every attempt a fresh UUIDv7 `X-Correlation-Id`;
an explicit retry re-sends the identical body and key, and a 401 never replays a
mutation. Versioned writes send the exact ETag in `If-Match` or the documented
`expected_*` field. Guild chat negotiates through `POST /gateway/v1/ws-negotiate`
and connects directly to the returned socket URL with an `auth` first frame. No
service-only route, service secret or internal header is used.

## 2. Environment used

| Item | Value |
|---|---|
| Gateway | `http://127.0.0.1:13000` (isolated `tamagotchi-go-acceptance` stack, not modified) |
| Guild socket origin | `ws://localhost:13004` (from negotiation) |
| Client origins | dev `http://localhost:5173`, packaged container `http://localhost:8080` |
| Admin | the supplied admin account (role claim `admin`), used only for admin acceptance |

## 3. Data the client created on the acceptance stack

All writes went through the public API and are named so they can be found.

- Fixture provision run `c10090613`: packages "Grove Companions c10090613" and
  "Tidewater Companions c10090613" (config_version 1, Lythbound art URLs on
  `http://localhost:5173/assets/...`), personas `mira`, `theo`, `nia`, `leon`
  (`*+c10090613@example.test`). Kept: the client's committed config maps them.
- Synthetic test players `e2e-<run>-<label>` / `e2e+<run>-<label>@example.test`
  from real test runs (registration, care, locations, friends, battles, raids,
  notification preferences). There is no user deletion API, so they remain.
- Bosses named `E2E Gryfon <run>` (versions 1 and 2) and their occurrences; every
  occurrence is cancelled. No boss deletion API exists.
- Synthetic guilds (`Grove <run>`, `Raiders <run>`) were deleted by their leaders.
- Package metadata of the provisioned Grove package was edited (description).
- Existing records not created by the client were only read.

## 4. Verified against the live stack

| Area | Exercised | Result |
|---|---|---|
| Gateway | health, ready, unknown service, 401 without bearer | JSON/Problem as documented; 401 code is `unauthorized` |
| User Management | register, login, logout, `/users/me`, join package, profiles, relationships, friend requests, wallets | Works (token refresh is covered by client unit tests only) |
| Tamagotchi | starter creation, collection, creature detail, holders, care with cooldown | Works; care reward credited to the package wallet within seconds (primary change and release are covered by fixtures only) |
| Registry | packages, assets, types, bosses, occurrences, admin create/edit/publish/transitions | Works with one header gap (5.1) |
| Map | location write/read, nearby between two strangers | Works; receipt semantics in 5.2 (delete is covered by fixtures only) |
| Battle | create, accept, attack, forfeit, settlement and access-grant status | Works; accept answers 202 with status already `ONGOING` |
| Monster Raid | start, attack/admission, leaderboard, victory, cancel | Works; boss defeated, rewards `PENDING`, coins credited afterwards |
| Guild | create, invite (between friends), accept, delete, chat negotiate and socket | Works; invitation returned 201 (role changes are covered by fixtures only) |
| Notification | inbox, read, preferences with If-Match, devices list | `FRIEND_REQUEST` and `RAID_STARTED` arrived with the documented params |

Real client test suite: 12 tests, passing against the dev server and against the
packaged container.

## 5. Server-side issues and decisions needed

Ordered by impact on players. Each item says what was observed, how to reproduce
it, what the client does now and what we suggest.

### 5.1 Registry requires Idempotency-Key on edits the contract marks If-Match only

- Observed: `PATCH /registry/v1/packages/{id}` and `PUT /registry/v1/bosses/{id}`
  with a correct `If-Match` but no `Idempotency-Key` are refused with a validation
  Problem ("Send a unique key of 1 to 255 characters").
- Contract: API.md lists only If-Match for both. `PUT .../preferences` (Notification)
  accepts If-Match alone, so the services differ.
- Client: sends both headers on these two calls.
- Suggest: either document the key requirement in the contract or accept If-Match
  alone, consistently across services.

### 5.2 Map receipt reasons and the 60-second window are undocumented

- Observed with a fresh synthetic user (same clock on client and server):
  - timestamp older than 60 s: `200 {accepted:false, reason:"STALE", current_timestamp:null}`, nothing stored;
  - older than the stored reading but within 60 s: `OUT_OF_ORDER` with the stored `current_timestamp`;
  - up to about 30 s in the future: accepted; 61 s ahead: `400 invalid_timestamp`;
  - accepted readings expire at `timestamp + 60 s` (not at receipt time).
- Effect: the name `STALE` reads like "a newer location exists". A browser that
  sends the device fix time (macOS can report a cached fix minutes old) gets STALE
  while `GET /map/v1/location/{id}` still returns 404 `location_not_found`, which
  players experienced as "Location not updated" with no location shown.
- Client: stamps each observation when the player presses Share, re-locates
  previews older than 30 s, explains STALE, OUT_OF_ORDER and `invalid_timestamp`.
- Suggest: document the acceptance window, future tolerance and expiry rule in the
  contract (LocationReceipt), and consider a clearer reason name such as
  `TOO_OLD`.

### 5.3 A shared location is visible for one minute at most

- Observed: `expires_at` is always the reading timestamp plus 60 s. With one-shot
  sharing and no background tracking (product rules), a player is discoverable for
  under a minute per share.
- Suggest: product decision on the TTL (or a documented refresh expectation).
  The client already supports manual refresh and shows expiry.

### 5.4 Raid list shows raids whose detail the caller cannot open

- Observed: `GET /raid/v1/raids` without `guild_id` returns other guilds' raids to a
  player in no guild; `GET /raid/v1/raids/{id}` for those returns 403.
- Client: explains "This raid belongs to another guild" and notes on the list that
  only members can open details.
- Suggest: filter the unscoped list to raids the caller may read, or make the
  permission rule explicit in the contract.

### 5.5 Battle turn timer is short and undocumented

- Observed: turn deadlines of seconds, not minutes; an unanswered turn ends the
  battle and the waiting player wins (settlement then runs normally).
- Contract: `turn_expires_at` exists but the duration and expiry outcome are not
  described.
- Suggest: document turn duration and the expiry rule; confirm the length is
  intended for a casual mobile game.

### 5.6 New occurrences start as `scheduled` even inside their window

- Observed: `POST /registry/v1/raid-occurrences` with `available_from` in the past
  returns status `scheduled`; players cannot start a raid until an admin calls
  `/activate` (receipt `runtime_propagation: PENDING`).
- Suggest: document that activation is always explicit (the admin UI says so).

### 5.7 Gateway 401 code

- Observed: Gateway 401 uses code `unauthorized`, which is not in the API.md error
  table. The client keys on status first, so it works.
- Suggest: add the code to the contract table.

### 5.8 Seed packages publish unreachable artwork

- Observed: existing packages (for example "Dragon Tamers", "UM scenarios")
  publish asset URLs on `example.com` and have no presentation; players in those
  packages see fallback art and no labelled care.
- Suggest: seed real asset URLs on a reachable origin for demo packages.

### 5.9 Items rechecked and still open per the contract

- UM stranger relationship `version=0` (contract `>=1`) affecting Guild invitations:
  not triggered between friends in these runs; the documented gap stays open.
- Not observed live in the inbox during these runs: `BATTLE_REQUEST`,
  `GUILD_INVITATION`, `TAMAGOTCHI_SHARED`, `PLAYER_NEARBY` (rendering is covered by
  client fixtures). Worth a producer check.
- No browser read of a package's full configuration exists, so admin edits start
  from client drafts (known and accepted).

## 6. Running the client against a backend

```sh
npm ci
echo GATEWAY_UPSTREAM=http://127.0.0.1:13000 > .env.local
npm run dev        # http://localhost:5173
E2E_REAL_TARGET=local-acceptance E2E_CONFIRM_TEST_TARGET=local-acceptance npm run test:e2e:real
GATEWAY_UPSTREAM=http://host.docker.internal:13000 docker compose -f deploy/compose.yaml up -d --build --wait
```

Socket origins and package presentation mappings are public settings in
`public/client-config.json`. Report backend fixes against the items above; the
client's real tests can confirm them.
