# Client working instructions

This repository is independently implementable from its bundled specification.
For client work, start with README.md and docs/IMPLEMENTATION.md rather than the
parent workspace's server workflow. Inspect branch, status and existing client
code before changes. Preserve unrelated work.

- Read PRODUCT.md, ARCHITECTURE.md, API.md, DESIGN.md and VISUAL_GUIDELINES.md.
  Read referenced payloads and VALIDATION.md before implementing each slice.
- In Plan mode, establish the first bounded slice and its acceptance criteria.
  Implement only after the user exits Plan mode or authorizes implementation.
- Finish each vertical slice, focused checks, rendered review and documentation
  before advancing. Use short, coherent local commits.
- Use real APIs through Gateway. Guild sockets use negotiation and connect
  directly. Never invent endpoints, broaden permissions, embed service secrets,
  write databases or conceal dependency failures behind production mocks.
- Build one web application with the selected stack and feature folders. Follow
  KISS and DRY. No plugin framework, global state library or extra server without
  a demonstrated need and an explicit decision.
- The visual direction is approved by delegated choice: modern handheld
  companion, defined in DESIGN.md. Prove one rendered core screen before adding
  the rest. Do not replace it with a generic dashboard or copy a known game.
- Keep authentication in memory. Redact diagnostics, screenshots and reports.
  Fixtures require a named test target and supplied admin access. They are never
  created automatically on startup. Preserve existing data and settings.
- Package/API schemas stay snake_case. Do not assume id fields have one name.
  Use versioned package presentation data; unknown packages remain readable.
- Browser mocks are permitted only in identified tests or isolated design
  previews. They are not runtime fallbacks or evidence of real integration.
- Keep contributor documentation short. No coursework references, invented
  issue numbers, AI co-author trailers, credentials or generated reports in Git.
- Local setup and small commits are authorized. Remote creation, pushes, merges,
  publication, server changes and runtime/data changes need the user's scope.
  The current repository has no remote and no assumed live branch policies.
- Maintain IMPLEMENTATION.md with completed slices, exact checks, limitations
  and the next step. Ask only for blockers not settled in these documents.
