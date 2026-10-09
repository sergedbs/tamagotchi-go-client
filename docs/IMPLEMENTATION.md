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

Next: slice 2 visual proof of the creature home.

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
