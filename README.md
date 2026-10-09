# Tamagotchi Go Client

Responsive player and administration client for Tamagotchi Go.

This checkout contains the approved implementation specification. Application
implementation starts in the next session. No runtime application, demo accounts
or populated database is included yet. No remote repository has been created.

## Start here

Read [AGENTS.md](AGENTS.md), then these documents in order:

1. [Product and flows](docs/PRODUCT.md)
2. [Architecture and setup](docs/ARCHITECTURE.md)
3. [API behaviour and endpoint reference](docs/API.md)
4. [Payload definitions](docs/PAYLOADS.md), as referenced by each feature
5. [Visual system](docs/DESIGN.md) and [supplied guidelines](docs/VISUAL_GUIDELINES.md)
6. [Backend environment](docs/ENVIRONMENT.md) and [fixtures and validation](docs/VALIDATION.md)
7. [Implementation order and kickoff prompt](docs/IMPLEMENTATION.md)

The documents are self-contained. Backend source access is not required to build
the client. [Contract provenance](docs/CONTRACT_SNAPSHOT.json) records the dated
source and image baseline. Target contracts and known runtime differences are
distinguished in API.md; do not assume a future server supports new features.

Selected stack: React, TypeScript, Vite, React Router, TanStack Query, native
fetch, CSS Modules, MapLibre/OpenFreeMap, Vitest and Playwright. Use Node 24 LTS
and npm. Pin compatible dependency versions and create the lockfile during the
first implementation slice.

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
