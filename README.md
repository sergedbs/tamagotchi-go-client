# Tamagotchi Go Client

Web client for **Tamagotchi Go**, a location-based creature companion game.
Players raise creatures, meet nearby players on a map, form guilds, battle each
other and take on raid bosses together. Administrators manage game packages,
bosses and raid events. The interface is responsive from phones to desktops.

## Features

- **Creatures**: collection, care actions, primary creature and shared holders
- **Explore**: map of nearby players (MapLibre and OpenFreeMap) with a list fallback
- **Social**: friends, guilds with roles and live guild chat
- **Combat**: turn-based player battles and guild raids with leaderboards
- **Account**: notifications inbox, wallets, preferences and package membership
- **Administration**: packages and configurations, bosses and raid occurrences
- **Diagnostics**: optional, privacy-preserving request log for troubleshooting

## Tech stack

React 19, TypeScript, Vite, React Router, TanStack Query, Zod, CSS Modules,
MapLibre GL, Vitest and Playwright. Production builds are served by Caddy.

## Requirements

- Node.js 24 LTS and npm
- A running Tamagotchi Go backend (its Gateway URL)
- Google Chrome, for the browser tests
- Docker, optional, for the production image

## Getting started

```sh
npm ci
cp .env.example .env.local   # set GATEWAY_UPSTREAM to your Gateway
npm run dev                  # http://localhost:5173
```

The development server proxies `/api` to `GATEWAY_UPSTREAM`. Sessions are kept in
memory only, so reloading the page asks you to sign in again.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with ESLint |
| `npm run typecheck` | Type-check the project |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run browser tests against mocked API responses |
| `npm run test:e2e:real` | Run browser tests against a real backend (see below) |
| `npm run fixtures` | Prepare test data through the API (see below) |

## Configuration

**Server side.** `GATEWAY_UPSTREAM` is the Gateway address used by the proxy. Set it
in `.env.local` for development or in the container environment in production.

**Runtime.** `public/client-config.json` is loaded when the app starts and can be
changed without rebuilding. It must contain public values only.

| Key | Purpose |
| --- | --- |
| `api_base` | API path prefix, `/api` by default |
| `map_style_url`, `map_default_center` | Map style and initial view |
| `allowed_socket_origins` | Origins allowed for guild chat sockets |
| `package_presentations` | Maps package IDs and config versions to bundled presentations |
| `diagnostics_enabled` | Enables the diagnostics page |
| `manual_location_enabled` | Allows typed coordinates, for testing only |

## Testing

```sh
npm run lint && npm run typecheck && npm run test && npm run build
npm run test:e2e
```

Real-backend tests create synthetic `*.example.test` players and need the target
named twice as a safeguard:

```sh
E2E_REAL_TARGET=local-acceptance E2E_CONFIRM_TEST_TARGET=local-acceptance npm run test:e2e:real
```

Care and raid tests use packages created by the fixture tool and are skipped
without them. Targets are defined in `fixtures/targets.json`. The tool reads admin
credentials from `.local/admin-credentials.json`, which is ignored by Git.

```sh
npm run fixtures -- preflight --target local-acceptance
npm run fixtures -- provision --target local-acceptance --run-id <id> --confirm-test-target local-acceptance
```

`provision` prints the `package_presentations` entries to add to the runtime
configuration.

## Deployment

`deploy/` contains a multi-stage Dockerfile (Node build, Caddy runtime on port 8080)
and a Compose file. Caddy serves the app with deep-link support and proxies `/api`
to the Gateway set in `GATEWAY_UPSTREAM`, which must be reachable from inside the
container:

```sh
GATEWAY_UPSTREAM=http://host.docker.internal:3000 docker compose -f deploy/compose.yaml up -d --build
```

The runtime configuration is mounted read-only (override the file with
`CLIENT_CONFIG=<path>`), and `/healthz` reports the health of the web server.

## Project structure

```text
src/
  app/          app shell, routing and runtime configuration
  api/          HTTP transport, errors and command handling
  components/   shared UI components
  features/     one folder per area (creatures, explore, social, combat, ...)
  packages/     package presentations and artwork catalog
  styles/       design tokens and global styles
public/         static assets and client-config.json
deploy/         Dockerfile, Caddyfile and Compose file
scripts/        fixture tool
tests/          browser tests (mocked and real backend)
docs/           product, architecture and API documentation
```

## Documentation

- [Product](docs/PRODUCT.md) and [architecture](docs/ARCHITECTURE.md)
- [API behaviour](docs/API.md) and [payloads](docs/PAYLOADS.md)
- [Design](docs/DESIGN.md) and [assets](docs/ASSETS.md)
- [Backend environment](docs/ENVIRONMENT.md) and [validation](docs/VALIDATION.md)
- [Implementation notes](docs/IMPLEMENTATION.md) and [backend handoff](docs/BACKEND_HANDOFF.md)

Run `python3 tools/check_spec.py` to validate links and API coverage in the docs.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch and commit conventions.

## License

Code is released under the [MIT License](LICENSE). Creature artwork is by
[Jackalune](https://jackalune.itch.io/) under
[CC BY 4.0](public/assets/creatures/lythbound/LICENSE.txt); see the in-app Credits
page and [CREDITS.md](public/assets/creatures/lythbound/CREDITS.md). Fonts are
licensed under the SIL Open Font License.
