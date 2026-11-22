# AI Providers, Model Runtime, and External API Contract

**Status:** normative product architecture; implementation status must be checked against source and `IMPLEMENTATION_STATUS.md`.
**Scope:** provider integrations, model execution, agent routing, and the API exposed by ONE CORE AI to external clients.

This document restores and centralizes product requirements. It is not evidence that every capability is already implemented. A missing implementation must be recorded as a gap, not silently removed from the product contract.

## 1. Product invariant

ONE CORE AI is a provider-agnostic AI workspace and orchestration layer. It must not be reduced to a single model host, a single vendor, or a chat UI around one runtime.

Users retain the ability to connect, configure, validate, diagnose, select, and use every supported provider. Adding one provider must not remove or disable another. Provider-specific limitations are represented as capabilities and diagnostics; they must not be converted into arbitrary application-wide restrictions.

## 2. Provider classes

The architecture must support these provider classes through explicit adapters:

- **Managed local runtime:** a runtime that ONE CORE AI can install/manage and start, monitor, stop, and configure (including a native llama.cpp / `llama-server` runtime).
- **Externally managed local runtime:** Ollama, LM Studio, and compatible local services whose lifecycle is owned by the external application unless the user explicitly configures otherwise.
- **User-managed remote runtime:** endpoints on the user's own machines or servers, including OpenAI-compatible servers.
- **Cloud provider:** hosted model APIs with provider-specific authentication, model catalogs, limits, and capabilities.
- **Generic OpenAI-compatible endpoint:** a configurable base URL and credential, with endpoint validation and capability discovery where possible.

The provider registry must be extensible. Do not hard-code the product around the current list. Provider adapters own connection semantics, authentication, model discovery, health checks, request translation, streaming, error normalization, and capability reporting.

## 2.1 Provider settings surface

The unified **Global AI Settings → Providers** page is a connection-management surface, not the model-routing engine. It uses four provider categories:

| UI category | Provider ownership | Included connections |
|---|---|---|
| **Local** | Externally managed local services | Ollama, LM Studio |
| **Cloud** | Hosted vendor APIs | DeepSeek, Qwen, OpenAI, OpenRouter, Groq, and future cloud adapters |
| **Compatible** | User-managed OpenAI-compatible endpoints | Custom local or remote endpoints such as vLLM, LocalAI, TabbyAPI, or a VPS |
| **LlamaServer** | ONE CORE AI-managed llama.cpp runtime | The managed `llama-server` process and its GGUF inference endpoint |

The previous generic `RUNTIME` category is retired from the user interface. Existing persisted selections under the legacy `runtime` key must be migrated by inspecting the selected provider kind: `custom` maps to **Compatible**, and `llama-cpp` maps to **LlamaServer**. The migration must preserve provider IDs and all provider configuration; it must not rewrite credentials or infer connectivity.

Provider and local model management share the **Провайдеры / Модели** page. Its LlamaServer category owns the configured connection, loaded-model state, local GGUF inventory, and explicit agent assignment. The separate **LlamaServer** navigation destination contains two subsections: **Установка llama-server** for binary acquisition, executable configuration, and installation/update controls; and **Поиск моделей** for GGUF discovery, model downloads, HTTP Range links, local-file import, and the model storage directory. The detected hardware profile is shown in the right context panel, with GPU separated from the remaining system characteristics. Generic compatible endpoints are checked and used as connections; ONE CORE AI must not assume ownership of their process lifecycle.

## 2.2 Model catalog and routing surface

Model discovery and agent assignment are separate from provider connection management. Discovery/import tools live under LlamaServer → Поиск моделей; provider selection and local runtime model assignment remain under Провайдеры / Модели:

- The **model catalog** represents discovered models and their provider/runtime origin.
- The **Model Router** resolves an agent/task request to a provider ID and model ID, applying capability checks, availability, priority, fallback, and resource constraints.
- Agent-to-model assignments and routing policies belong to the Model Router workspace within **Провайдеры / Модели**, not to LlamaServer installation or search.
- LlamaServer owns local llama.cpp process management and GGUF execution only. It does not own agent identities, roles, permissions, or global routing decisions.
- Provider defaults are not hard bindings. A model can be reached through different provider/runtime adapters where the adapters support it; agent assignments must reference stable provider/model identities rather than UI tab names.

The dedicated Model Router management UI is a target capability and must not be represented as implemented until its typed configuration, backend resolution, persistence, and tests exist.

## 2.3 Provider and LlamaServer workspaces

The Compatible category supports multiple independently persisted endpoint profiles. Each profile has its own stable provider ID, display name, Base URL, optional API key, selected model, discovered model list, and connection status. Adding a new endpoint must append a profile; it must never overwrite the existing `custom` provider or another endpoint. Existing profiles can be edited without changing their IDs; leaving the API key blank preserves the stored credential. Provider credentials remain keyed by provider ID in the server-side secret store.

The LlamaServer category is a model/runtime workspace, not the installation page and not the global Model Router. Its top status row reports the discovered local GGUF library and the actual managed `llama-server` process state. The workspace lists ready GGUF files as model cards and exposes load, unload, and delete actions through the existing protected model/runtime API.

The current managed `llama-server` implementation runs one GGUF model per process. The UI must distinguish:
- **Active/selected:** the model selected in the local model catalog or assigned as the primary provider's model.
- **In memory/used:** the model ID reported by the running llama-server process.
- **Agent assigned:** the model selected in the primary provider or a persisted role-scoped subagent provider profile.
- **External clients:** unavailable until runtime request/client telemetry is implemented. The UI must not display an invented count.

The workspace can persist a model assignment for the primary agent or an existing role-scoped subagent profile. This is a provider/model selection only; it does not create independent runtime instances or guarantee concurrent use of multiple GGUF models. A single shared llama-server process means changing its loaded model affects every caller using that process. Full task-aware routing, concurrency, per-agent runtime isolation, and resource-aware model scheduling remain Model Router responsibilities.

## 3. Provider and model lifecycle

The domain model must distinguish:

- provider configuration from provider connectivity;
- provider health from model availability;
- discovered models from selected models;
- selected models from loaded/running models;
- a managed process from an externally managed service;
- a successful health check from a successful inference request.

Statuses must reflect real observations. Never seed a provider as connected or a runtime as running without a successful check. A configured endpoint is not necessarily reachable. A model listed by a provider is not necessarily loaded in memory.

For managed local runtimes, ONE CORE AI must own the complete lifecycle: executable acquisition/verification, path selection, launch arguments, environment, process ownership, stdout/stderr capture, health readiness, inference verification, stop/restart, crash detection, and cleanup. Runtime settings (GPU backend/layers, context size, ports, model path and other supported options) must reach the actual process invocation. Packaging and platform-specific binaries must be verified in CI and in a real inference smoke test.

For externally managed runtimes, ONE CORE AI must connect, inspect, validate, and use the service without silently taking ownership of its process. The UI must make lifecycle ownership explicit.

## 4. Model and agent routing

A user must be able to assign different providers and models to different agents, roles, tasks, and workflows. Routing must resolve a stable provider ID and model ID at execution time, validate that the requested capability is available, and preserve the user's explicit selection.

A primary agent, specialist/subagent, project agent, or task may use a different provider/model where configured. Global defaults are defaults only; they must not overwrite role- or task-specific assignments.

Capability metadata must be explicit and provider/model-specific (for example: streaming, tools/function calling, vision, structured output, context limits, embeddings). Unknown means unknown. Do not infer support from a model name or claim unsupported behavior. If a capability is unavailable, return a clear actionable error and preserve other provider choices.

## 5. ONE CORE AI as an API provider

ONE CORE AI must expose its own models and agent routing through a documented API so third-party applications can use ONE CORE AI as their model endpoint. This is a first-class product capability, not merely an inbound provider integration.

The API gateway must provide, at minimum:

- `GET /v1/models` for available public model IDs and aliases;
- `POST /v1/chat/completions` for chat requests;
- streaming responses using OpenAI-compatible SSE framing when requested;
- stable model IDs/aliases that resolve to a configured provider/model or an explicitly configured ONE CORE agent route;
- consistent error responses and request validation;
- authentication with user-managed API keys;
- per-key enable/revoke, scopes, model/route allowlists, and access controls;
- request IDs and an auditable request log that excludes credentials and sensitive prompt content by default;
- configurable bind address and network exposure, with loopback-only as the safe default.

The gateway routes requests through the same provider registry, adapters, capability checks, permission boundaries, and operation lifecycle used by the ONE CORE UI. It must not implement a separate, inconsistent model-routing stack.

Additional OpenAI-compatible endpoints may be added when their semantics are supported and documented. Do not advertise endpoints or features that are not implemented.

## 6. API security and network exposure

API keys are secrets: store them using the existing server-side secret/vault architecture, show secret values only at creation, and never return them from settings APIs or write them to logs.

Unauthenticated network exposure is forbidden by default. Binding beyond loopback requires explicit user action and a clear warning. Remote exposure must document TLS/reverse-proxy requirements, firewall implications, trusted origins, and key rotation. Apply request-size limits, concurrency/backpressure controls, timeouts, input validation, and abuse/resource safeguards without imposing arbitrary limits that make valid local use impossible.

Provider endpoint configuration must be protected against SSRF and unsafe local-network access. Credentials must only be sent to the configured provider origin. Logs and diagnostics must redact authorization headers, tokens, and secrets.

## 7. Service lifecycle

The API gateway and managed runtimes must have an explicit service lifecycle. Where the platform supports it and the user enables it, the API service must be able to continue operating when the UI window closes. UI lifetime and service lifetime must not be accidentally coupled.

The product must show whether the service is stopped, starting, ready, degraded, or failed, and provide real start/stop/restart controls. Background operation, startup behavior, shutdown behavior, and OS integration must be documented per platform. Never claim background persistence where the host process or OS service is not actually configured to provide it.

## 8. Diagnostics and observability

For every provider, provide actionable diagnostics for configuration, authentication, reachability, model discovery, capability support, and inference. Preserve the underlying provider error while presenting a normalized explanation.

Track request lifecycle and operational metrics (duration, status, token usage when available, provider/model, route, and failure category). Metrics must identify whether values are provider-reported, estimated, or unavailable. Do not log secrets.

## 9. Required verification

A provider is not complete merely because it appears in a selector. Verification must cover, as applicable:

1. create/edit/delete configuration and secret replacement/revocation;
2. connectivity and authentication failures;
3. model discovery and model selection;
4. a real inference request;
5. streaming and cancellation;
6. capability-specific behavior and honest unsupported responses;
7. process lifecycle for managed runtimes;
8. external API model discovery, authenticated chat, streaming, routing, key revocation, and unauthorized access;
9. Linux and Windows packaging/runtime behavior where supported.

Tests must use representative Ollama, LM Studio, llama.cpp/OpenAI-compatible local servers, user-managed remote endpoints, and cloud providers. Never report a runtime test as passed when only type-checking or mocked tests ran.

## 10. Documentation and change control

This contract is normative. Any change that removes a provider class, narrows user routing, removes the external API, or changes the default security boundary requires an explicit product decision and corresponding documentation change. Refactors and documentation updates must preserve these invariants.

When implementation and this contract differ:
- keep the contract intact;
- record the implementation as missing, partial, or unverified in `IMPLEMENTATION_STATUS.md`;
- add concrete work items to `DEVELOPMENT_PLAN.md`;
- update `CURRENT_WORK.md` with the actual verified state;
- do not present planned capabilities as implemented.
