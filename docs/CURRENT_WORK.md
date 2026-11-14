# Current Work

## Repository
- Project: ONE CORE AI
- Branch: `main`
- Version at audit start: `0.2.1`
- Stack: React 19, TypeScript, Vite 8, Zustand 5, Express, Tauri 2.

## Audit findings
- Russian text was damaged by an encoding conversion in several frontend files.
- Local API origin validation accepted broad localhost origins and did not validate the Host header.
- Project path validation did not reject symbolic-link components.
- Terminal and mutating Git endpoints did not independently require an approval marker.
- Windows installer workflow published a release on every push to main.
- Development governance documents and a dedicated CI workflow were missing.

## Stabilization changes in progress
- Restore damaged Russian text and preserve feature changes.
- Harden loopback Host and browser Origin checks.
- Reject project path traversal and symbolic links.
- Require explicit approval flags for terminal execution and mutating Git operations.
- Add regression tests for origin and path checks.
- Add CI checks for type-checking, integration tests, and production build.
- Restrict installer release workflow to version tags.

## Not yet verified
- CI results after these changes.
- Windows Tauri installer build.
- Full authenticated local API session/token model.
- Native Windows Credential Manager integration.
- Complete centralized Permission Manager coverage for every side-effect endpoint.
- Full UI and accessibility audit.

Do not mark the project production-ready until the remaining security work and Windows packaging checks are complete.
