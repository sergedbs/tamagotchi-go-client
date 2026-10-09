# Tamagotchi Go Client

Responsive player and administration client for Tamagotchi Go.

Implementation progress, checks and known backend gaps are in
[implementation progress](docs/IMPLEMENTATION.md); backend owners start with the
[backend handoff](docs/BACKEND_HANDOFF.md). No demo accounts or populated
database are included. No remote repository has been created.

## Run locally

```sh
npm ci
cp .env.example .env.local   # set GATEWAY_UPSTREAM, e.g. http://127.0.0.1:13000
npm run dev                  # http://localhost:5173, /api proxied to Gateway
```

Checks: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`,
`npm run test:e2e` (identified browser fixtures, system Chrome). Real-target tests
need an explicit target name and confirmation:
`E2E_REAL_TARGET=local-acceptance E2E_CONFIRM_TEST_TARGET=local-acceptance npm run test:e2e:real`.
Runtime settings live in `public/client-config.json` (public values only).

Fixture CLI (explicit, never on startup; credentials stay in ignored `.local/`):
`npm run fixtures -- preflight --target local-acceptance` (read-only) and
`npm run fixtures -- provision --target local-acceptance --run-id <id> --confirm-test-target local-acceptance`.
Provision prints the `package_presentations` mapping for `public/client-config.json`;
the labelled-care and raid real tests use the latest provisioned run and are
skipped without one. Package artwork is published for the target's
`public_client_origin`, so serve the client there (default `http://localhost:5173`).

## Packaged runtime

`deploy/` holds a two-stage image (Node 24 build, Caddy on port 8080) and a
standalone Compose file. Caddy serves the build with SPA deep links, removes `/api`
once and proxies it to a fixed Gateway; API paths never fall back to `index.html`,
and an unreachable Gateway yields a `502 upstream_unavailable` Problem. The
upstream is read at start and must be reachable from inside the container:

```sh
GATEWAY_UPSTREAM=http://host.docker.internal:13000 docker compose -f deploy/compose.yaml up -d --build --wait
E2E_BASE_URL=http://localhost:8080 E2E_REAL_TARGET=local-acceptance E2E_CONFIRM_TEST_TARGET=local-acceptance npm run test:e2e:real
GATEWAY_UPSTREAM=unused docker compose -f deploy/compose.yaml down
```

`client-config.json` is mounted read-only (override with `CLIENT_CONFIG=<path>`),
so configuration changes need a restart, not a rebuild. `/healthz` reports only the
web process. No image is published.

## Start here

Read [AGENTS.md](AGENTS.md), then these documents in order:

1. [Product and flows](docs/PRODUCT.md)
2. [Architecture and setup](docs/ARCHITECTURE.md)
3. [API behaviour and endpoint reference](docs/API.md)
4. [Payload definitions](docs/PAYLOADS.md), as referenced by each feature
5. [Visual system](docs/DESIGN.md), [bundled assets](docs/ASSETS.md) and [supplied guidelines](docs/VISUAL_GUIDELINES.md)
6. [Backend environment](docs/ENVIRONMENT.md) and [fixtures and validation](docs/VALIDATION.md)
7. [Implementation order and kickoff prompt](docs/IMPLEMENTATION.md)

The documents are self-contained. Backend source access is not required to build
the client. [Contract provenance](docs/CONTRACT_SNAPSHOT.json) records the dated
source and image baseline. Target contracts and known runtime differences are
distinguished in API.md; do not assume a future server supports new features.

Selected stack: React, TypeScript, Vite, React Router, TanStack Query, native
fetch, CSS Modules, MapLibre/OpenFreeMap, Vitest and Playwright. Use Node 24 LTS
and npm; dependency versions are exact and locked in `package-lock.json`.

The finished client must run with a Gateway address and public configuration.
The existing isolated acceptance stack is the preferred local backend target;
see [environment setup](docs/ENVIRONMENT.md). Data population is a separate,
explicit API-based fixture command against a dedicated test environment.

Specification check (Python 3, no installed dependencies):

```sh
python3 tools/check_spec.py
```

This checks local links, field anchors, endpoint coverage and snapshot integrity.
It does not verify backend runtime compatibility or UI behaviour.
