# Contributing

Branch from develop using feat/, fix/, docs/ or chore/. Use short conventional
subjects: type(scope): description. Keep coherent commits and preserve their
history with merge commits for work and release PRs. Every remote develop/main
change uses a PR after the initial repository publication. Inspect actual policies
before merging. Do not invent issue numbers.

Update the relevant specification when a verified interface or setup changes.
Link real issues when available. Do not modify backend repositories as part of a
client-only task. Record missing API capabilities in API.md.

Run applicable type, lint, unit, browser and build checks. Review real rendered
screens, including failure states. Distinguish mocked tests from real API checks.
Do not commit secrets, node_modules, build output, fixtures with credentials or
private runtime reports. Use X.Y.Z package/image versions. Only the Shared
repository receives Git tags and GitHub Releases.
