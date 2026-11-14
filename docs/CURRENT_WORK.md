# Current Work

## Repository
- Project: ONE CORE AI
- Branch: `main`
- Version: `0.2.1`
- Stack: React 19, TypeScript, Vite 8, Zustand 5, Express, Tauri 2.

## Completed in the current stabilization batch
- Restored corrupted Russian text in the affected frontend files; added a CI encoding guard for mojibake, invalid UTF-8 replacement characters, and UTF-8 BOMs.
- Removed UTF-8 BOMs from the header component and Windows installer script.
- Added loopback Host validation and stricter same-origin checks using Origin and Fetch Metadata.
- Added canonical project path validation and rejection of absolute paths, traversal, and symbolic-link components; paths are rechecked before writes and undo restoration.
- Added a central project tool permission manager and enforced `read_file`, `write_file`, `run_command`, `git`, and `search_code` permissions in agent operations.
- Terminal commands, mutating Git operations, file writes, and undo now require explicit API approval.
- Agent-generated file changes and terminal commands remain pending until the user applies or runs them.
- Added regression tests for untrusted origins, path traversal, symlink escapes, unapproved actions, and project tool allowlists.
- Added Windows Credential Manager access through the native Windows Credential API, macOS Keychain support, and Linux Secret Service integration; application settings now use OS credential storage where available.
- Added CI on Linux and Windows for encoding checks, type-checking, integration tests, and production builds.
- Restricted Windows installer release workflow to version tags or manual dispatch.
- Added project governance and continuation documents.

## Verification status
- Changes are committed directly to `main`.
- CI has not yet been confirmed as green from this audit session.
- Local `npm run check:encoding`, `npm run lint`, `npm test`, and `npm run build` have not been executed in this environment.

## Remaining work
- Confirm the first Linux and Windows CI runs and resolve any failures.
- Implement a session/token authentication layer for local API requests. Origin validation protects browser boundaries but is not authentication against other local processes.
- Extend centralized permission enforcement to model management, SSH, browser/network actions, project deletion, and all other side-effect endpoints.
- Strengthen fallback vault key derivation for environments without an available OS credential service; preserve existing encrypted-vault migration compatibility.
- Verify Windows Tauri startup, sidecar bundling, installer generation, Credential Manager persistence, and runtime behavior.
- Audit remaining SSRF, file browser, model download, and provider proxy routes.
- Complete UI route, navigation, responsive, typography, and accessibility audit.

Do not mark the project production-ready until the remaining security work and Windows packaging checks are complete.
