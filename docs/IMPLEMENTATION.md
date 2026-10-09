# Implementation handoff

## Current state

Implementation started 2026-10-09 on local branch `feat/client-app` (not merged,
no remote). Product, stack and art direction are settled. Progress, exact checks
and the next step are recorded below.

Reuse the existing isolated backend described in [ENVIRONMENT.md](ENVIRONMENT.md).
Do not bootstrap duplicate containers. Existing fixtures are a starting point;
realistic client dataset preparation remains an explicit, resumable API task.

## Ordered slices and acceptance

Complete each slice, checks, rendered review and documentation before advancing.
Keep logical substeps as separate small commits. Do not implement every route in
one change or commit unfinished placeholders as if all flows work.

| Order | Deliverable | Acceptance and commit boundaries |
|---|---|---|
| 1 | Bootstrap React/TS/Vite, exact npm lockfile, routing, configuration/proxy, lint/types/unit/build | Fresh npm ci; no backend source dependency; configured fixed upstream; /api errors remain API errors; setup commit separate from CI |
| 2 | Visual proof: creature home, design tokens, bundled licensed artwork and responsive navigation | Actual mobile/desktop renders; five-point critique/refinement; preview data explicitly isolated; design tokens/artwork/screen can be separate commits |
| 3 | HTTP/session foundation and package-aware register/login/logout | Memory-only credentials, coordinated refresh, /me identity, safe Problem/204 handling, exact keys, abort and account reset tests; transport and auth separate |
| 4 | Supported package presentation, collection, care, primary/holder operations | Real starters, unknown-package fallback, exact ETags, care/currency distinction; collection/care/selection small commits |
| 5 | Minimal fixture provisioner with two packages and a few personas, then dataset expansion as scenarios need it | API-only, explicit test target/admin, resumable private ledger, no mutation re-keying; no initial 12-account prerequisite to prove one screen |
| 6 | Explore and contextual profiles | One-shot consent, paged fresh markers, manual refresh, expiry/partial/provider failure and attribution; location and marker UI separate |
| 7 | Relationships, Guild list/roster/management and chat | Actor/role checks, no directory invention, exact message protocol and bounded reconnect; social/Guild/chat separate |
| 8 | Battle and Raid screens | Real authoritative turns/admission/cooldowns/terminal delivery; separate battle create/detail, raid discovery/combat and outcomes |
| 9 | Notification inbox/preferences and account wallets/packages | Six templates, real events, read/read-all/ETag, no fake push; push adapter deferred unless genuine config exists |
| 10 | Admin package/boss/occurrence authoring | Permitted roles, validated full draft import/export, conflicts, immutable snapshots and real transitions; feature-specific commits |
| 11 | Diagnostics and complete scenario fixtures | Redacted bounded activity, correlated demo, realistic data, reproducible resume; no browser service-token console |
| 12 | Packaging, CI and full acceptance | Fixed-upstream Caddy, runtime config/deep links, fresh install/build, real and fixture reports, responsive review; no publication without authorization |

Frontend slices 8-10 can encounter independent backend failures. Record them,
complete correct UI/unit checks and continue other independent work; never replace
the runtime with fake success or change server contracts to make tests pass.

## Progress record

For each completed slice record source commit, commands, unit/browser results,
real target/image evidence, rendered review and the next bounded step. Keep private
reports and credentials under .local/. Record only redacted links/counts here.

Environment notes: the machine runs Node 26.10 (spec target Node 24 LTS; `.nvmrc`
and CI use 24, `engines` is `>=24`). TypeScript is 6.0 because typescript-eslint
does not yet support 7. Playwright uses the installed Chrome channel.

### Slice 1 - bootstrap (complete)

Commits 9d50605, 95aecb4, 2d235b9 (setup) and 2727a43 (CI). Exact pinned
dependencies with package-lock.json; runtime config validated before render
(strict schema, unknown keys refused); Vite proxy removes `/api` once, never
follows redirects and answers `502 application/problem+json` when Gateway is down.

Checks: fresh `npm ci`; `npm run lint`; `npm run typecheck`; `npm run test`
(26 unit tests); `npm run build`; `npm run test:e2e` (3 fixture tests);
`npm run test:e2e:real` against local-acceptance (3 read-only tests: health/ready,
401/404 stay Problem JSON, public package/type reads); `python3 tools/check_spec.py`.
Manual curl through the dev proxy: `/api/health` 200 JSON, `/api/users/v1/users/me`
401 problem+json, unknown service 404 problem+json, closed upstream 502 problem+json,
`/creatures` deep link serves index.html.

### Slice 2 - creature home visual proof (complete)

Commits d727e1b (tokens, fonts, WCAG contrast unit test), 79ff2d1 (authored
package presentations, sprite catalog, resolver), a4e986d (navigation shell,
credits view), c046177 (creature home and dev-only design preview).

- Tokens follow DESIGN.md; every text/control colour pair is unit-tested for AA.
- Fonts from the official sources with licenses (`public/assets/fonts/README.md`);
  Bricolage subset to Latin WOFF2, Source Sans 3 unmodified (reserved font name).
- Lythbound pack only: Mossling `lythbound/wolfren/green`, Ripple
  `lythbound/laguna/blue`; hero 184-240 px, cards 80 px; labelled outlined fallback.
- Two authored packages in `src/packages/authored/` (one source for fixtures and
  UI); unknown package/config versions render API facts and disable care.
- `/__preview/creatures?state=...` exists only in dev builds (grep of `dist/` finds
  no preview code). States: default, loading, long name, empty, unknown package,
  care pending/done/cooldown/error, API unavailable.
- `/credits` shows the exact artwork attribution, font and icon licenses.

Checks: `npm run lint`, `npm run typecheck`, `npm run test` (71 unit tests,
coverage gate 80% lines on api/config/packages), `npm run build`,
`npm run test:e2e` (15 fixture tests: no overflow at 360/390/768/1440, keyboard
reach, care feedback, unknown package, axe WCAG 2.1 AA on four states, credits),
`python3 tools/check_spec.py`. Rendered review: three rounds at 360x780, 390x844,
768x1024 and 1440x900; five-point critique kept privately under `.local/reviews/`.

Limitations: creature routes still show "not part of this build" until auth and
real collection reads land; the preview simulates care locally and is not evidence
of integration.

### Slice 3 - transport, session and authentication (complete)

Commits d666081 (transport, Problem errors, command snapshots), 98009f3 (memory-only
session, single-flight refresh), cd28fe3 (sign-in, registration, sign-out UI).

- `src/api/http.ts`: same-origin `api_base`, fresh UUIDv7 `X-Correlation-Id` per
  attempt, 10 s timeout combined with caller abort (timer cleared), redirects refused,
  Problem/204/HTML-fallback handling, ETag/Retry-After/correlation captured. GET is
  retried once after a successful refresh; mutations are never replayed after 401.
- `src/api/command.ts` + `useCommand`: frozen body snapshot and UUIDv7
  Idempotency-Key; "Retry same request" re-sends the exact command; changed input
  discards it.
- Session: tokens only in memory, refresh 60 s before expiry through one shared
  promise, public refresh/logout without bearer, refused refresh ends the session,
  identity from `/users/me`, every identity change clears cached queries.
- Login requires a package; 401 invalid_credentials, 403 package_membership_required
  and 429 Retry-After are distinct. Registration offers only configured packages.

Checks: `npm run lint`, `npm run typecheck`, `npm run test` (99 unit tests),
`npm run build`, `npm run test:e2e` (21 fixture tests incl. exact replay of an
uncertain registration, throttling, sign-out without bearer, reload needs sign-in,
no browser storage), `npm run test:e2e:real` against local-acceptance (5 tests:
synthetic registration, sign-out 204, sign-in again, wrong password refused).
Rendered review of login/register at 390x844 and 1440x900 (welcome scene framing
and mobile crop fixed).

Real-run note: each real run registers one synthetic `e2e-<run>-auth` user in the
bootstrap package; credentials stay in `.local/real-runs/`.

### Slice 4 - collection, care, primary and holders (complete)

Commits b0a9306 (collection, starter onboarding, care), d25503d (primary
selection, release, holders), 11f7ce6 (tests).

- Collection pages use limit 25 and a visible Load more; primary from page one,
  secondaries de-duplicated by id. Empty collections poll every 2 s for at most
  30 s while visible, then offer Check again; the browser never mints.
- Art resolves only through the public Registry asset manifest for the exact
  package/config_version; http is accepted only on the page origin, https otherwise.
- Care sends `{"action": ...}` with a UUIDv7 key; the returned creature replaces
  every cached copy, the wallet is invalidated (never adjusted), currency stays
  "pending". Cooldown, engaged and uncertain outcomes are distinct; uncertain care
  is replayed only by "Retry same request" with the same key and body.
- Primary change reads the PrimarySelection ETag and sends it as If-Match; 412
  reloads and asks for review. Release uses the creature ETag; a changed creature
  version drops the cached ETag instead of guessing. Sole origin owners cannot
  release. Holder removal uses the Holders ETag and is offered to origin owners.

Checks: `npm run lint`, `npm run typecheck`, `npm run test` (105 unit tests),
`npm run build`, `npm run test:e2e` (29 fixture tests), `npm run test:e2e:real`
(6 tests; a new synthetic player receives a real server-created starter, sees its
details, holders and disabled release). Rendered review of real `/creatures` and
`/creatures/:id` at 390x844 and 1440x900 (added the nameplate details link).

Limitation: existing acceptance packages have no client presentation, so real care
stays disabled for them by design; labelled real care needs the authored packages
from slice 5 to be provisioned (requires explicit authorization).

### Slice 5 - fixture CLI (built; mutating runs await authorization)

Commit 65a4218. `npm run fixtures -- preflight --target local-acceptance` performs
the ENVIRONMENT.md readiness checks read-only (health, ready, public packages and
types, admin sign-in and `/users/me`, collection, nearby, admin registry read) and
writes a redacted report to `.local/reports/`. Result on 2026-10-09: all 8 checks
passed; nearby answered `viewer_location_unavailable` as expected without a write.

`provision --target <name> --run-id <id> --confirm-test-target <name>
[--write-client-config]` creates the two authored packages (name suffixed with the
run id), writes their full configuration with `expected_package_revision`, verifies
artwork is served at `public_client_origin`, registers the personas in
`fixtures/personas.json`, waits up to 30 s for starters and emits a redacted
manifest plus the `package_presentations` mapping. Every mutation is saved with its
body and UUIDv7 key before sending; an uncertain reply stays pending and a resume
re-sends the identical command; completed package steps are re-read before reuse.
Targets live in `fixtures/targets.json`; unknown or non-test targets are refused.
`scenario` and `refresh-locations` refuse to run until implemented.

Checks: 26 CLI unit tests (argument refusals, ledger resume without re-keying, lost
reply, no credentials in output or manifest). Provision has not been run against
the real target: it needs explicit authorization.

### Slice 6 - Explore (complete)

Commits b1e15f7 (location and nearby queries), 7fd33e1 (map, consent, sheet),
c9d62f4 (tests).

- MapLibre 6.13 with OpenFreeMap Liberty; attribution always visible; the worker
  is set explicitly from an emitted asset (`setWorkerUrl`), so dev and build agree.
- One-shot `getCurrentPosition` only from the Share/Update button, then a preview
  (coordinates, accuracy) before `POST /map/v1/location` with a new UUIDv7 key and
  the device timestamp. `accepted=false` receipts (DUPLICATE/STALE/OUT_OF_ORDER) are
  explained, not treated as success. Stop sharing deletes the observation.
- Nearby: limit 100, cursor walked unchanged, at most 20 pages per refresh with a
  visible Load more, one automatic restart on `cursor_stale`, markers keyed and
  de-duplicated by user_id and replaced as a complete set. No background polling.
- Distinct states: not shared, expired (pins hidden; checked on render and timed),
  `viewer_location_unavailable`, partial (close strangers only), empty, provider or
  WebGL failure (list fallback with the same players). Names come from on-demand
  profile reads; relationship is shown by icon, label and colour.

Checks: `npm run test` (127 unit tests), `npm run test:e2e` (36 fixture tests incl.
101 markers over two pages, provider failure list, expiry, partial, denied
permission, DUPLICATE receipt), `npm run test:e2e:real` explore test: two synthetic
players ~2 m apart share one-shot locations and see each other as strangers.
Rendered review of the real populated map at 390x844 and 1440x900 (stop-sharing
moved into the HUD action row). Observed real TTL of an observation: about 1 minute.

## Definition of done

- A clean checkout runs with npm ci and supplied public configuration; no source
  edits or server-code lookup is required.
- Current supported player/admin flows have real integrations and intelligible
  unavailable/empty/error states; absent API capabilities remain explicit.
- Chosen art direction passes rendered reviews on mobile and desktop with real
  content and accessible controls, not only the first successful render.
- Tests cover critical session/replay/cursor/version/chat behaviour; real tests
  and fixture previews are labelled separately.
- Fixture commands populate real data through APIs, preserve unrelated data and
  resume uncertain commands safely; credentials remain private.
- No speculative architecture, exposed service secrets, fabricated push success,
  source version assumptions or silent mutation retry.
- Packaging/configuration, compact docs and small commits are complete. Remote
  delivery/publication require separate authorization.

## Kickoff prompt

Copy this into a new session opened in this repository, initially in Plan mode:

```text
Plan and then implement Tamagotchi Go Client in this repository.

First read AGENTS.md and README.md, then docs/PRODUCT.md, ARCHITECTURE.md,
API.md, DESIGN.md, VISUAL_GUIDELINES.md, ASSETS.md, ENVIRONMENT.md, VALIDATION.md and IMPLEMENTATION.md.
Use PAYLOADS.md and CONTRACT_SNAPSHOT.json for exact API fields and provenance.
Inspect current Git status and existing client files before changing anything.

These documents are the standalone source of truth. Do not inspect or modify
backend repositories. Product scope, responsive web platform, React/TypeScript/
Vite stack and modern handheld companion art direction have been selected.
Plan the first bounded implementation slice and its acceptance criteria, then
wait for me to exit Plan mode before implementation.

After implementation is authorized, persist through the ordered slices. Finish
each slice's code, meaningful checks, rendered visual critique and docs before
advancing. Make small conventional local commits. No generic dashboard, fake
production backend, invented endpoints, service secrets in the browser or
speculative frameworks. Preserve KISS/DRY and existing data.

Prove one polished creature-home screen at mobile and desktop sizes before
expanding. Include all documented current player flows and supported admin
operations, then API-based realistic demo fixtures and real integration checks.
The normal client must use real APIs through Gateway; Guild sockets follow the
documented negotiation. Unknown packages and backend failures remain explicit.

Use runtime configuration for server addresses. Establish the fixed same-origin
proxy and in-memory auth before real writes. Ask for the named test target and
supplied admin access only when those are needed; do not populate databases or
alter containers automatically. No remote creation, pushes, merges, image
publication or backend changes unless I explicitly authorize them.

Start with repository/dependency/bootstrap planning and the first visual proof.
Do not ask me to choose a new stack or art direction unless a concrete blocker
demonstrates that a documented decision cannot work.
```
