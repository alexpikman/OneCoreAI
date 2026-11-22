# LLMS Runtime Integration Plan

**Status:** approved implementation direction; staged migration plan.
**Target:** replace the current managed llama.cpp runtime implementation in ONE CORE AI with the proven runtime and GGUF capabilities from LLMS, while keeping ONE CORE AI as the application and orchestration layer.

## 1. Architecture decision

ONE CORE AI remains the product shell and provider-agnostic orchestration layer. LLMS is a source of runtime implementation and GGUF-management capabilities, not a second application or a separately hosted service.

The integrated application must have exactly one owner for managed `llama-server` lifecycle, one GGUF model inventory, and one model storage location. The integrated runtime runs inside the ONE CORE AI server process and uses the existing ONE CORE AI settings, paths, API authentication, approvals, event journal, and UI.

## 2. Reuse and replacement map

| Area | Decision | Integration boundary |
|---|---|---|
| `server/ggufRunner.ts` (LLMS) | Adapt and reuse | Extract process lifecycle, readiness checks, streaming, slot inspection, process output and crash handling. Adapt to ONE CORE AI's single managed-runtime contract rather than importing LLMS deployment ownership unchanged. |
| `server/downloader.ts` (LLMS) | Adapt capabilities | Reuse Hub discovery, GGUF file listing, safe direct URL probing, resumable downloads, integrity verification, and runtime archive handling where useful. Persist model records and files through ONE CORE AI's existing model manager and configured models directory. |
| `server/hardware.ts` (LLMS) | Merge selectively | Reuse hardware and llama-server capability detection after reconciling it with `server/hardware.ts` and shared ONE CORE AI hardware types. Do not maintain two hardware profiles. |
| `server/engine.ts` (LLMS) | Do not transplant wholesale | It owns LLMS deployments, routing, Gemini integration, and deployment-specific state. Those responsibilities conflict with ONE CORE AI's provider registry and Model Router. Extract only independently useful GGUF runtime behavior. |
| `server.ts` (LLMS) | Do not transplant | Its Express application, auth/config, API routes, port management, and frontend shell would duplicate ONE CORE AI. Integrate required endpoints into `server/app.ts`. |
| LLMS React application shell | Do not transplant | Rebuild the useful GGUF controls inside existing ONE CORE AI workspaces and design tokens. |
| ONE CORE AI `server/llamaCppRuntime.ts` | Retire after migration | Replace its process-management implementation and remove it only after all callers, routes, tests, and UI use the integrated runtime. |
| ONE CORE AI `server/modelsManager.ts` | Keep as the canonical catalog/storage owner | Extend through adapters or service boundaries; do not create a second manifest or model directory. |
| ONE CORE AI provider registry, Model Router, vault, API session and approval middleware | Keep | The runtime must not bypass provider identity, server-side secrets, authorization, or side-effect approval. |

## 3. Runtime contract

- ONE CORE AI owns one managed `llama-server` process and one loaded GGUF model under the current product contract.
- Parallel slots are request concurrency inside that process, not separate models or independent runtimes.
- Runtime settings must expose CPU threads, GPU layers/backend, parallel slots, and context **per request/slot** as distinct values.
- The backend must translate per-slot context into the correct llama.cpp total context argument for the installed binary. The current LLMS launch behavior passes `--ctx-size` and `--parallel`; the resulting per-slot context must be verified against the actual installed llama.cpp version before declaring the setting semantics complete.
- The runtime must validate executable and model paths, GGUF magic, port availability, process exit, readiness, and successful inference. A healthy HTTP process alone is not proof that inference works.
- Preserve streaming and downstream cancellation. Stop/restart operations must not leave orphaned child processes.
- Slot telemetry must come from the runtime's actual `/slots` endpoint when supported. Do not synthesize active-request counts.
- llama.cpp KV cache/slot telemetry may be displayed when the runtime exposes real values. Do not label a conceptual visualization as vLLM PagedAttention or claim that llama.cpp implements vLLM's PagedAttention allocator.

## 4. Existing ONE CORE AI design integration

| Existing surface | Integrated responsibility |
|---|---|
| Global AI Settings → Providers → LlamaServer (`ProvidersView`, `LlamaServerWorkspace`) | Connection state, loaded model, start/stop, agent assignment, runtime summary, and concurrency status. |
| LlamaServer → Установка llama-server | Binary discovery, supported platform release selection, download/install/update, executable path, version, checksum and operation history. |
| LlamaServer → Поиск моделей / existing `ModelHubView` | Hugging Face/ModelScope discovery as supported, GGUF variants, compatibility assessment, resumable download, local import, verification, and existing storage directory. |
| Existing inference settings | Context per request, parallel slots, CPU threads, GPU backend/layers, and memory limits with validation and explanatory constraints. |
| Existing diagnostics and Processes/event journal | Runtime output tail, startup phases, health/inference verification, crash events, slot telemetry, and benchmark records. |
| Existing API gateway in `server/app.ts` | Preserve protected ONE CORE AI routes and OpenAI-compatible gateway behavior; do not expose a second LLMS API server. |

Use the existing page layouts, navigation, shared controls, Tailwind conventions, and light/dark theme. Do not embed the LLMS application shell or introduce a parallel design system.

## 5. LlamaServer workspace navigation and settings ownership

The LlamaServer entry in the AI-resources navigation becomes a parent workspace with five nested destinations. These destinations are scoped to LlamaServer and must not become new global navigation groups or standalone application tabs.

| LlamaServer destination | Responsibility | Reused LLMS UI capability |
|---|---|---|
| **Модели и запуск** | Select the single active GGUF model; show runtime/binary state; start, stop, restart, and show loaded-model status. | `ModelsManagerView` runtime controls, adapted to ONE CORE AI's canonical model catalog and runtime service. |
| **Центр GGUF** | Search repositories/files, inspect quantizations and compatibility, download/resume/verify/import/delete GGUF models. | `GgufHubView` and model-download flows, adapted to `modelsManager.ts`; no second manifest or storage root. |
| **PagedAttention** | Show measured KV-cache and slot state, context allocation, and active request telemetry where the installed llama.cpp build exposes it. | `PagedAttentionGrid` and GPU/context controls, with llama.cpp terminology and actual `/slots` data. Do not claim vLLM PagedAttention implementation. |
| **OpenAI API** | Show the ONE CORE AI OpenAI-compatible endpoint, model IDs and access state; provide a request console against the existing protected gateway. | `OpenAiConsoleView` adapted to ONE CORE AI auth, keys, scopes, approvals, and gateway routes. Do not start LLMS's second API server. |
| **Бенчмарк** | Run controlled inference benchmarks against the active managed model; display measured throughput/latency and saved runs. | `RealBenchmarkView` adapted to the ONE CORE AI runtime and event journal. Never display fabricated metrics. |

### Navigation behavior

- Keep **LlamaServer** as the parent item under **AI-ресурсы**. Its five destinations appear as a nested submenu when the parent is selected.
- The selected destination must survive navigation between sections and app reloads using the existing navigation/settings state conventions.
- Do not add five peer-level global navigation items, a second sidebar, or a separate LLMS shell.
- Preserve the existing LlamaServer provider identity and provider assignment flow. The workspace is an operational surface, not a replacement for the provider registry.

### Settings ownership

Move configuration controls out of the five operational destinations and into the existing **Настройки → AI / Inference → LlamaServer** settings area. The operational pages may show effective values and runtime status, but must link to settings rather than maintain duplicate editable controls.

Centralized settings include:
- Runtime executable path, install/update channel, bind host and port.
- Context size per request/slot, parallel slots, CPU threads, GPU backend and GPU layers.
- KV-cache type/precision, memory limits, offload and batching options only when supported by the installed binary.
- OpenAI-compatible API access configuration, key management and model allowlists; secrets remain in the existing server-side vault.
- Benchmark defaults and test limits, while individual benchmark runs remain in the **Бенчмарк** workspace.

Settings must be validated by the backend against the installed runtime capabilities. Unsupported options must be disabled or reported as unavailable, not silently accepted. Existing saved values and the current model directory must be preserved during migration.

## 6. Data and compatibility rules

- Keep the existing ONE CORE AI model directory, model manifest, settings manifest, provider IDs, vault references, and user assignments.
- Do not move, rename, overwrite, or delete model files during migration.
- Existing llama.cpp provider identity and Base URL must be preserved unless an explicit migration is required and tested.
- Preserve Ollama, LM Studio, cloud, and generic OpenAI-compatible provider adapters.
- Keep current API route contracts during the transition where practical; update frontend callers in the same stage as any route change.
- Runtime install/uninstall must be separate from model deletion. Uninstalling a binary must never delete GGUF files.

## 7. Delivery stages

1. **Inventory and contract:** map every current runtime route, store action, settings field, component, installer dependency, and test. Record the final adapter boundaries before changing runtime code.
2. **Runtime core:** integrate the LLMS-derived process manager behind a ONE CORE AI runtime service. Add validated launch options, per-slot context semantics, slots endpoint, process cleanup, cancellation, and inference verification.
3. **Model pipeline:** adapt discovery/download/import/verification to the existing ONE CORE AI catalog and storage. Keep Ollama operations separate.
4. **Settings and UI:** add the new runtime settings to the existing LlamaServer and inference settings surfaces; integrate installer diagnostics and slot telemetry into existing components.
5. **Gateway and observability:** route provider requests through the new runtime, preserve streaming/cancellation/auth/approvals, and expose measured runtime metrics.
6. **Retirement and verification:** remove old runtime implementation and dead routes only after all callers are migrated; update architecture/status docs and run typecheck, tests, build, and runtime smoke tests.

Each stage is a separate logical commit directly on `main`. No branch or pull request is created. A stage is not marked complete until its code and available checks have been inspected.
