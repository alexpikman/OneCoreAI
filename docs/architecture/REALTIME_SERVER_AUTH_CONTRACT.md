# Realtime Server Authentication Contract

## Purpose
Define the authentication contract between OneCoreAI and the separately operated realtime server. Do not generate client keys until the realtime server implements and enforces this contract.

## Key model
- Generate at least 32 cryptographically random bytes; encode as `oc_live_` plus base64url.
- Display plaintext only once. Never store or log plaintext.
- Persist only SHA-256 or preferably HMAC-SHA-256 hashes using a server-held pepper; compare hashes in constant time.
- Every key has an immutable ID, label, creation time, optional expiry, last-used time, revocation time, and explicit scopes.
- Support immediate revocation and rotation. Rotation creates a new key and revokes the old key.
- Enforce per-key rate limits and request-size limits. Audit outcomes without key material.

## Required scopes
- `realtime:connect`
- `realtime:events:read`
- `realtime:events:write`
- `realtime:agents:dispatch`
- `realtime:agents:status`
- `realtime:files:read` (disabled by default)
- `realtime:files:write` (disabled by default; separate operation approval required)

## HTTP contract
- Client sends `Authorization: Bearer <key>` over TLS.
- Server hashes the presented key, looks up an active record, checks expiry/revocation and required scope, then applies rate limits.
- Never accept keys in query strings, URLs, browser storage, logs, or WebSocket subprotocol names.
- WebSocket handshake authenticates before upgrade and binds key ID/scopes to the connection.
- Re-check revocation for long-lived connections and close connections when a key is revoked.
- Return generic `401` for invalid/revoked/expired keys and `403` for insufficient scope.

## Management API
The realtime server must provide authenticated management operations to create, list metadata, rotate, revoke, and inspect key usage. Creation returns plaintext exactly once; list/detail endpoints never return it.

## OneCoreAI integration requirements
- Keep realtime base URL and management credential separate from model provider credentials.
- Store the management credential in OS keychain/Vault; never expose it in `/api/settings`.
- UI displays key metadata and scopes, not hashes or plaintext.
- Key lifecycle operations call the realtime server management API. A local-only key registry is not a substitute for server-side authentication.
- Audit creation, rotation, revocation, failed authentication, and scope denials without recording secrets.

## Current repository status
The current OneCoreAI repository does not contain the realtime server implementation or its management/authentication API. The Security page therefore documents this dependency and does not issue fake client keys. Once the server API is available, implement an adapter against its concrete routes and schemas, then add contract tests.
