# Fixtures, testing and demo acceptance

## Data ownership and prerequisites

Populate a dedicated, explicitly named test environment through Gateway APIs.
Do not query/write owner databases, purge volumes, replace existing credentials
or create fixtures automatically on client startup. The frontend has no server
database. Fixture definitions are committed; actual IDs, passwords, tokens and
progress are private under .local/, ignored by Git.

Preflight requires a reachable configured Gateway, real owner services, broker,
working key/issuer configuration and an existing configured bootstrap package.
An externally provisioned admin user is required to author Registry resources.
The client cannot bootstrap an admin role through an absent HTTP endpoint.
An empty server with no package/admin is a server setup prerequisite, not something
the fixture tool bypasses. Use an existing admin login or supplied token via
private CLI configuration; never put it in client-config.json or a browser bundle.

Public artwork must already be available at PUBLIC_CLIENT_ORIGIN. Registry asset
URLs need a browser-reachable origin. Refuse production/unknown targets unless
the user explicitly authorizes them. A --confirm-test-target option confirms
the named target, not permission to destroy any data.

## Dataset and execution modes

Start with a small credible dataset: 12 player personas, three authored packages
with different starters/care presentation, two populated guilds and one independent
player group, friend/enemy/stranger relationships, distinct map positions, three
bosses and active/scheduled/inactive occurrences. Add a pending battle, completed
battle, active raid and completed/failed raid only through their real workflows.
Sizes are demo fixtures, not server limits. Keep history small enough to explain.

Suggested personas: Mira the guild leader, Theo the regular player, Nia the new
player, Leon the rival and eight ordinary members. Use synthetic .example.test
addresses, plausible names/descriptions and original creature artwork. Server
IDs are returned UUIDv7 values, never hardcoded user IDs or forged tokens.

Three explicit tool modes:

| Mode | Purpose |
|---|---|
| provision | Create/resume packages and player fixtures using saved progress |
| scenario | Run a named stateful battle/raid/social scenario with chosen personas |
| refresh-locations | Renew chosen fixture observations just before Map demo |

No all-purpose destructive reset. New --run-id makes a new namespace and preserves
old runs. Repeating a stateful attack with a new key is a new action; it is not
an idempotent seed operation. Completed battles/raids stay completed.

## Repeatable API workflow

1. Load target and private run ledger. Check Gateway health/readiness, then real
   public package/types access. Record candidate versions supplied by the operator.
2. Authenticate the supplied admin. Provision three packages with that admin in
   developer_user_ids/moderator_user_ids. Persist response IDs before the next step.
3. PUT package stats with expected_package_revision and the full authored definition.
   Persist config_version and presentation mapping. Do not guess an existing config.
4. Register personas against configured packages, using stable saved command keys.
   Save generated credentials privately before submitting; never print them. Login
   and load /users/me. Joining a second package creates a secondary starter by event.
5. Poll each collection up to 30 seconds for starters; report timeout if missing.
   Do not mint or award XP to compensate. Care creates realistic stat/XP/currency
   changes with legal actions and cooldowns, not privileged direct writes.
6. Create and accept real friend requests before Guild invitations where required.
   Enemy state is an explicit user command. Preserve actor/recipient credentials.
7. Create guilds under intended leaders; invite and accept through each member's
   account. A user joins at most one guild. Persist IDs/versions and verify rosters.
8. Submit locations as each user. Arrange nearby stranger within six metres,
   friend farther away and another player outside visibility. Coordinates are
   synthetic demo observations, not actual tracking. Renew them before rehearsal.
9. Create/version bosses and occurrences as admin. Active occurrence windows use
   actual current time. Activate through the real API; preserve immutable versions.
10. Scenario mode uses two creatures per Battle lineup. Accept, attack or forfeit
    with the appropriate actor and capture settlement/holder results. Raid create
    uses a Guild leader; attack by members reserves their primaries. Produce real
    victory, timeout/cancellation and delivery statuses; never fabricate rows.
11. Poll Notification history for real events, up to 15 seconds every 500 ms.
    Collect intended recipient and delivery evidence; a provider status is not
    proof of a received device push. Guild invitation may remain blocked by UM.
12. Emit a redacted fixture manifest (IDs, labels, versions, scenario availability)
    and a separate private credentials/progress ledger. Stop visibly on failures.

Every new mutation persists method/body/key before sending. On a lost response,
resuming retries the same operation/key or checks the resource. No automatic fresh
key mutation retries. A saved step is revalidated against the target before skipping.
Independent registry names are not guaranteed unique; lookup alone is not a receipt.
Locks/roles/care cooldowns are domain constraints, not errors to bypass.

## Shared authored package definition

Use one authored file for both the fixture Registry definition and client
presentation mapping. Strip presentation-only fields before sending the API body.
Store returned package/config IDs in private fixture state and a safe generated
public mapping only when deliberately selected. An initial example follows;
the asset origin and moderator UUID are supplied at execution, not sent literally.

```json
{
  "key": "grove-companions",
  "package": {"name":"Grove Companions","description":"Small woodland companions for an exploration demo.","version":"0.1.0"},
  "definition": {
    "stats": [
      {"key":"energy","value_type":"NUMBER","minimum":0,"maximum":100,"allowed_strings":null},
      {"key":"bond","value_type":"NUMBER","minimum":0,"maximum":100,"allowed_strings":null}
    ],
    "bonuses": [],
    "care_actions": [
      {"action":"FEED","deltas":[{"stat_key":"energy","delta":10}],"xp":2,"cooldown_seconds":5,"local_currency":1},
      {"action":"PLAY","deltas":[{"stat_key":"bond","delta":5}],"xp":2,"cooldown_seconds":5,"local_currency":1}
    ],
    "daily_currency_cap":50,
    "starter":{"name":"Mossling","combat_type":"NATURE","sprite_ref":"grove/mossling","initial_stats":{"energy":50,"bond":30}},
    "assets":[{"sprite_ref":"grove/mossling","url":"<PUBLIC_CLIENT_ORIGIN>/assets/creatures/mossling.webp"}]
  },
  "presentation": {
    "stats":{"energy":{"label":"Energy","unit":"points"},"bond":{"label":"Bond","unit":"points"}},
    "actions":{"FEED":{"label":"Feed"},"PLAY":{"label":"Play"}}
  }
}
```

This is proposed fixture content, not the definition of existing packages. Validate
all actual server bounds. Do not apply this template to existing packages without
the current revision and explicit intent. Existing creatures retain old config
snapshots; changing a package config does not rewrite their stats automatically.

## Automated checks

Use identified browser network fixtures for UI states, not a fake production backend.
Use real API tests only with explicit target credentials and confirmation of writes.
Test what can fail materially rather than copying component implementation.

| Layer | Meaningful checks |
|---|---|
| Transport/session | Problem/204 parsing, redirects, cancellation, exact replay body/key, refresh coordination, public requests without expired bearer, redaction |
| Lists and versions | Cursor restart bound, special Collection/Nearby shapes, account cache separation, exact ETag use, conflict preserves edits |
| Forms | Schema bounds, required package, action identifiers, full config import/export and stale revision |
| Map | lng/lat order, marker replacement, expiry, partial warning, 101+ markers across pages, provider/WebGL error list fallback |
| Chat | First auth frame, ready/ack/message merge, ticket reuse/expiry refusal, bounded reconnect/new tickets and membership closure |
| Combat | Actor-specific controls, no automatic mutation retries, server timers, final-vs-delivery states and stale leaderboard handling |
| Notifications | Six templates/unknown fallback, recipient separation, preferences ETag, read-all snapshot/key, delivery distinctions |
| Admin | No unauthorized/service-only calls, full-definition replacement, optimistic concurrency and original snapshot display |
| Fixture CLI | Missing inputs, unknown target, pagination, already-completed steps, lost reply/resume, dependency failures and no credential output |

Set a pragmatic 80% line gate for independently testable transport/session and
domain UI utilities. Do not promise artificial 80% coverage of every JSX/artwork
file. Browser tests prove integrated behaviour. Keep unit/browser fixture evidence
and real-server evidence separate. Native backend tests remain outside this repo.

## Real acceptance and rehearsal

Run authentication, starter creation/care, Map, friends, Guild membership/chat,
Battle lifecycle, Raid participation/rewards, notifications and admin versioning
against real dependencies. Check forbidden access with a normal user. Public
package/type reads should work while signed out. Prove no service credentials or
downstream assertion headers are generated in browser requests.

Rehearse: admin creates an occurrence; leader starts raid; member attacks; show
actual reward status and Notification. Separately show care and Map discovery,
then live Guild chat. A visible correlation ID from nearby allows Gateway -> Map
-> Gateway -> UM log tracing outside the client. Diagnosing an error is useful;
a demo should never label failed integration as a fake success.

Inspect desktop/mobile screens, loading/empty/partial/refusal states, provider
failure, reconnect, long names and keyboard flow. Capture screenshots without
credentials. Save reports under .local/reports/ with target, timestamp, source
commit, configured image set and exact outcomes. Do not infer deployment image
versions from health responses that do not include them.

Completion has three independent levels: mocked/component checks, real client
flows against a specified server and packaged deployment rehearsal. All must be
labelled accurately. Backend incompatibilities remain named failures and do not
block implementing unrelated client slices.
