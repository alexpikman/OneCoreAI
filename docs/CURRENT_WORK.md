# Current Work

## Repository
- Project: ONE CORE AI
- Branch: `main`
- Version: `0.2.1`
- Stack: React 19, TypeScript, Vite 8, Zustand 5, Express, Tauri 2.

## Completed in the current stabilization batch
- Restored corrupted Russian text in six frontend source files and verified that the known mojibake signatures no longer appear in those files.
- Added loopback Host validation and stricter same-origin checks using Origin and Fetch Metadata.
- Added canonical project path validation and rejection of symbolic-link components.
- Added a second path validation immediately before project file writes and undo restoration.
- Required an explicit approval flag for terminal execution and mutating Git operations.
- Updated the frontend command/Git calls and integration tests to send the approval flag.
- Added regression tests for untrusted origins, path traversal, symlink escapes, and unapproved terminal execution.
- Added CI workflow for type-checking, integration tests, and production build.
- Restricted Windows installer release workflow to version tags or manual dispatch.
- Added project governance and continuation documents.

## Verification status
- Changes are committed directly to `main`.
- GitHub Actions results have not yet been confirmed from this audit session.
- Local `npm run lint`, `npm test`, and `npm run build` have not been executed in this environment.

## Remaining work
- Implement an authenticated local API session/token model. Origin validation protects browser boundaries but is not authentication against other local processes.
- Complete a centralized Permission Manager for file writes, SSH, browser actions, model management, and every other side-effect endpoint.
- Replace machine-derived vault key material with native OS credential storage where supported; preserve migration compatibility.
- Verify Windows Tauri startup, sidecar bundling, installer generation, and runtime behavior.
- Audit the remaining SSRF, file browser, model download, and provider proxy routes.
- Complete UI route, navigation, responsive, typography, and accessibility audit.

Do not mark the project production-ready until the remaining security work and Windows packaging checks are complete.
