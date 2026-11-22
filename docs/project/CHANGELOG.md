# Changelog

This file records completed project milestones, not every commit. Git history remains the source for exact diffs and timestamps. Imported entries are undated where the source did not establish a reliable date.

## Stabilization and security foundations
- Restored corrupted Russian UI text and introduced UTF-8/encoding checks; removed BOMs from affected source and installer files.
- Added loopback Host validation, same-origin checks, canonical project-root validation, traversal and symlink protections.
- Added centralized project tool permissions and explicit approvals for file writes, terminal commands, mutating Git operations, and undo.
- Integrated OS credential storage for Windows Credential Manager, macOS Keychain, and Linux Secret Service; separated subagent credential references from the settings manifest.
- Added Linux and Windows CI for encoding checks, TypeScript validation, integration tests, and production builds; restricted installer publishing to tags or manual dispatch.

## Incremental local API and path hardening
- Added short-lived bearer sessions to protected API routes and authenticated the journal stream through the shared API client.
- Added a regression test for missing/valid bearer sessions.
- Added cross-platform rejection of Windows-reserved path components, alternate data streams, invalid characters, trailing dots/spaces, drive-relative paths, and UNC paths.
- Packaged Tauri now supplies a Rust-generated 256-bit bearer token through a native command; the backend rejects HTTP session bootstrapping when this token is configured.
- Browser development/Tauri debug bootstrap, server-side provider secret resolution, and parent-directory race elimination remain outstanding.

## Project workspace and model controls
- Added persistent project-agent context, task creation/status operations, ranked project-file context, and explicit PLAN-mode read-only behavior.
- Added provider token usage and model capability reporting, distinguishing model claims from actual application tools and permissions.
- Reworked the global header, ACT/PLAN controls, provider/model settings, local runtime telemetry, and subagent provider configuration.
- Added static/dynamic navigation taxonomy, route scaffolding, and architecture documentation for the application shell.
- Added independent visibility controls for left navigation and right inspector categories.

## Chat, operations, and activity
- Added streamed standard chat responses and request-scoped operation/session/message identifiers.
- Added operation context propagation through API events and project file/action-log operations.
- Added per-message activity timelines backed by the existing journal SSE stream.
- Added a bounded in-memory operation registry and standard-chat cancellation with journal/registry terminal states.
- Project tasks, pipeline stages, subagents, subprocess trees, and restart recovery still require broader lifecycle/cancellation support.

## Permission manager and fallback vault
- Extended explicit approval checks to model management/downloads, directory creation, project deletion, SSH, browser/network requests, GitHub and Telegram verification, project file writes, terminal execution, mutating Git, and undo.
- Recorded permission decisions in the agent journal with actor, scope, resource, decision, and timestamp. The current client boolean remains weaker than a one-time server-issued Approval Ticket.
- Versioned fallback vault storage with per-vault random salt and scrypt N=32768; legacy entries migrate only after full successful decryption, and corrupt/unreadable vault files are preserved instead of silently replaced.
- User-controlled cross-machine vault recovery/export remains outstanding.
- CI run `43732132097` passed on Ubuntu and Windows after the permission and vault changes.

## Operation lifecycle and verification gate
- Added parent/child cancellation to the bounded operation registry and authenticated operation list/detail/cancel endpoints.
- Propagated cancellation signals to general-agent/provider requests and project command execution; aligned journal terminal states with registry outcomes.
- Added verification reports for persisted file content, file undo/deletion, and command exit/timeout/cancellation.
- Approval Tickets, optimistic file conflicts, Windows process-tree termination, full pipeline/subagent cancellation, task acceptance evidence, Git/pipeline verification, and restart recovery remain outstanding.

## Agent knowledge foundation
- Added version-controlled role, procedure, protocol, schema, proposal, and lesson areas under `docs/knowledge/`.
- Added the multi-agent runtime target architecture, bounded team-execution, and deterministic-first discovery procedures.
- Added `server/knowledgeManager.ts` with approved-document cataloging, metadata validation, path/symlink containment, and size limits.
- Connected project-scoped subagents to the existing agent executor and approved knowledge catalog/read tools.
- Corrected knowledge frontmatter placement so the runtime parser can ingest role, procedure, protocol, and architecture entries.
- Full Manager/Dispatcher orchestration, runtime handoff validation, worker-result validation, model-tier routing, proposal approval UI, and knowledge publication workflow remain unimplemented.

## Documentation governance
- Established separate governance, project, architecture, and runtime knowledge areas.
- Introduced a single documentation index and separated the replaceable current-state snapshot from durable milestone history.
