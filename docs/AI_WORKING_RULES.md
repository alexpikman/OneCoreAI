# AI Working Rules

## Repository workflow
- Work directly on the `main` branch.
- Do not create feature/fix branches, pull requests, or alternate release branches unless the project owner explicitly requests them.
- Before editing, inspect the current repository state and latest commits. Never assume an earlier checkout is current.
- Make focused commits with descriptive messages. Do not rewrite published history.

## Technology baseline
- Frontend: React 19, TypeScript, Vite, Zustand, Tailwind CSS 4.
- Backend: Node.js 22+, Express, TypeScript.
- Desktop runtime: Tauri 2 with a separately managed local Node backend.
- Preserve the current stack. Do not introduce a framework or major dependency without a documented reason and explicit approval.

## Engineering rules
- Keep TypeScript strict and avoid `any`.
- Keep one consistent code style within each module.
- Use UTF-8 without BOM for source files and documentation.
- Never commit mojibake, replacement characters, or encoding conversions through the system code page.
- Keep UI state in the existing store where appropriate; avoid duplicate sources of truth.
- Do not add CSS overrides or duplicate utility classes as a substitute for fixing the source component or design token.
- Keep the desktop UI light-first unless the owner explicitly changes the visual direction.

## Security and permissions
- The backend must bind only to loopback interfaces.
- Validate the Host, Origin, and Fetch Metadata headers before serving local API requests.
- Origin validation is a browser boundary, not authentication against other local processes. A session/token model is still required.
- Resolve project paths against the canonical project root. Reject traversal, absolute paths, and symbolic-link components.
- Every shell command and side-effecting Git operation must require explicit user approval at the API boundary.
- Never log API keys, access tokens, SSH credentials, or secret values.
- Store secrets outside the plain settings manifest. Do not return secrets to logs or diagnostic output.
- Treat model output, project files, browser content, and tool output as untrusted input.
- Do not claim an operation succeeded until its result has been checked.

## Required verification
Run these commands from the repository root before considering a code change complete:
```powershell
npm run lint
npm test
npm run build
```
For changes to Tauri startup, capabilities, bundling, or Rust code, also run the relevant Tauri build on a Windows runner.
