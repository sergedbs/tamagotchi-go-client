# Client backend environment

## Preferred local target

Reuse the existing isolated `tamagotchi-go-acceptance` Docker Compose project.
Do not create another backend stack just for the client. The client remains a
separate application; it does not own backend databases or infrastructure.

Inventory checked on 2026-10-09: all nine services, PostgreSQL/PostGIS and RabbitMQ
are running and healthy. The provisioning container completed successfully.
This is process-health evidence, not a new end-to-end acceptance run.

| Component | Current image |
|---|---|
| Gateway | tamagotchi-go-local/gateway:acceptance-8b40c8b |
| User Management / Battle | patriciamoraru/user-management:2.0.1 / patriciamoraru/battle:2.0.1 |
| Guild / Registry | mihaelacatan/guild-service:2.0.3 / mihaelacatan/package-registry-service:2.0.3 |
| Tamagotchi / Notification | victoriamutruc/tamagotchi:2.0.4 / victoriamutruc/notification:2.0.3 |
| Map / Monster Raid | sergedbs/map:2.0.0 / sergedbs/monster-raid:2.0.0 |
| Database / broker | postgis/postgis:17-3.6-alpine / rabbitmq:4.1-management-alpine |

Use `GATEWAY_UPSTREAM=http://127.0.0.1:13000` in the client's ignored
`.env.local`. The browser uses `/api` through the fixed Vite proxy, not direct
service ports. The existing negotiated Guild socket origin is
`ws://localhost:13004`; include it in `allowed_socket_origins`. Use localhost
consistently for browser rehearsal. A containerized client proxy must use a
reachable backend address instead of its own loopback.

## Existing state and operator handoff

In this workspace, the private environment lives at
`../validation/.private/acceptance/`, relative to the client checkout:

- `compose.json`: resolved Compose configuration containing private settings.
- `settings.env` and mounted key files: existing runtime credentials and keys.
- `fixtures.json`: recorded package and Alice/Bob/Carol account state.

Those files exist. Their presence does not prove credentials are still valid or
that every fixture remains suitable. Never copy them into Git, public runtime
configuration, browser assets or documentation. Do not print their contents.
An operator supplies selected account credentials/admin access privately to the
client fixture CLI. Login obtains fresh tokens; saved access tokens may expire.
Do not make the frontend depend on this workspace directory structure.

For an independent session, the required handoff is only the Gateway address,
allowed socket origin, selected private user/admin credentials, bootstrap package
ID and a redacted fixture manifest. Backend source access is unnecessary.
Container management remains an operator responsibility.

## Preflight and restart

Read-only checks from this checkout:

```sh
docker compose -f ../validation/.private/acceptance/compose.json ps
curl --fail --silent --show-error http://127.0.0.1:13000/health
curl --fail --silent --show-error http://127.0.0.1:13000/ready
```

Confirm the configured health paths against [API.md](API.md). Then verify public
package reads, real login, `/users/me`, starter collection and one authenticated
Nearby call through Gateway. Report failures without substituting mocks.

If stopped, the operator may restart the exact retained environment after runtime
authorization:

```sh
docker compose -f ../validation/.private/acceptance/compose.json up -d --wait
```

Review image availability and configuration before running this command. It may
recreate containers. The local Gateway image must already exist; the retained
configuration is not a portable fresh-install bundle. Never run `down -v`, prune
volumes, rerun environment preparation over retained keys, or start the older
`tamagotchi-go` project on top of this target.

## Prepare realistic client data

Use existing accounts for the first real collection/care screen. Implement the
resumable API fixture CLI specified in [VALIDATION.md](VALIDATION.md), then expand
data only as screens need it. Existing acceptance scripts are server test tools,
not the client seed command; they can mutate state and are not automatic setup.

1. Authenticate and revalidate selected users/package and required admin access.
2. Record a private run ledger and a redacted manifest. Preserve existing IDs.
3. Author package presentation/artwork and serve assets at a browser-reachable
   client origin before creating packages that reference them.
4. Add a few personas, starters, relationships, Guild membership and locations.
5. Add boss/occurrence and Battle/Raid scenarios through actual APIs. Expand to
   the full demo dataset after minimal flows work.
6. Refresh locations and occurrence windows before each rehearsal. Historical
   records persist, but nearby observations and active scenarios expire.

Readiness requires login, usable starters/care, expected social/map visibility,
chat negotiation, admin operations and scenario prerequisites. Record unsupported
flows separately. The current known UM stranger relationship `version=0` differs
from the shared `>=1` contract and blocks Guild invitations; recheck the corrected
owner candidate before calling the complete dataset ready. Do not weaken checks.

No containers, keys or database contents were changed while writing this handoff.
