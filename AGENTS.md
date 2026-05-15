# AGENTS.md

This project builds a static The Bazaar build finder and theoretical build generator.

Rules:
- No game plugins.
- No memory reading.
- No packet sniffing.
- No official server/client integration.
- No scraping.
- Use local JSON data only.
- V1 has no database.
- Generated builds are theoretical and must not be described as real win-rate predictions.

Engineering preferences:
- TypeScript only.
- Keep scoring explainable.
- Keep scoring weights configurable.
- Add tests for parser, scorer, generator, and search.
- Do not use official game art unless the repository already has licensed assets.
- Before starting a dev server, first inspect existing listening ports and verify whether the
  process belongs to this repo by checking its command and cwd. Reuse an existing same-project
  server instead of opening another port. Only start a new port when no suitable same-project
  server is already running.
