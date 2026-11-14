# Continue ONE CORE AI Development

Repository: https://github.com/alexpikman/OneCoreAI

Before making changes:
1. Read `README.md`.
2. Read `docs/AI_WORKING_RULES.md`.
3. Read `docs/DEVELOPMENT_PLAN.md`.
4. Read `docs/CURRENT_WORK.md`.
5. Inspect the latest commit on `main` and the current working tree.
6. Continue from the actual repository state; do not rely on old chat summaries as a substitute for source inspection.

Rules:
- Work directly on `main`. Do not create branches or pull requests unless explicitly requested.
- Preserve the React + TypeScript + Vite + Zustand + Express + Tauri 2 stack.
- Do not redesign the interface or change the visual direction without approval.
- Keep all source files UTF-8 without BOM.
- Make focused changes, add regression tests, and update `docs/CURRENT_WORK.md`.
- Run `npm run lint`, `npm test`, and `npm run build`.
- Do not claim tests or builds passed unless their results are available.
- Never expose secrets, bypass approval gates, or weaken workspace path restrictions.
