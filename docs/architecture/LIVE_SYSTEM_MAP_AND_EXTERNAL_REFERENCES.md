# Live System Map and External Reference Library

## Purpose

This document defines two separate product surfaces:

1. **Live System Map** — an evidence-backed view of what ONE CORE AI is doing now and how an actual request moved through implemented runtime components.
2. **«КАК У ДРУГИХ»** — a research library for external projects, architectures, workflows, diagrams, and implementation notes.

They must never share execution authority or storage semantics.

## 1. Live System Map

### User-facing location

The map is part of **Контекст → Процессы**. The existing event list remains available as the journal view; the map is an additional view over the same operation/event evidence.

### Evidence sources

- Operation Registry: in-memory API operation identity, parent relation, HTTP method/path, lifecycle status, timestamps, cancellation.
- Agent Journal: persisted event history and existing SSE stream.
- Structured trace metadata: optional, typed execution-stage data attached to journal events.
- Approved knowledge catalog: may be referenced by stable document ID and version only when the runtime actually reads that document.

The map must not infer execution from target architecture documents, UI activity labels, model claims, or planned features.

### Trace event contract

A trace-bearing journal event may include:

- `stageId`, `stageLabel`: stable stage identity and display label.
- `actorType`, `actorId`: actual component, agent, model, or tool responsible for the event.
- `providerId`, `modelId`: actual provider/model identifiers where known.
- `instructionId`, `instructionVersion`: approved instruction actually loaded for this stage; absent otherwise.
- `inputSummary`, `outputSummary`: bounded, redacted summaries; never raw prompts, credentials, private file contents, or full tool arguments.
- `handoffTarget`, `handoffReason`: actual recipient and transition reason when a handoff occurs.
- `toolName`: actual invoked tool where applicable.

Trace metadata is optional and backward-compatible. Existing journal events without it remain valid and render as events with incomplete trace evidence.

### Initial implemented route

The first map version may show only stages backed by current implementation:

1. Incoming API request / registered operation.
2. Project-agent orchestration, when `executeGeneralAgentTask` is invoked.
3. Initial project context and approved-knowledge catalog preparation, when observed.
4. Provider request round, when observed.
5. Actual tool call and result, when observed.
6. Final response or terminal operation status.

The map must label the first version as partial coverage. Standard provider chat, subagent execution, task pipelines, and other routes are not to be shown as fully traced until instrumentation is added to those paths.

### Status semantics

- **Implemented / observed** — backed by a current runtime event or operation record.
- **Running** — current operation/event status says running.
- **Completed / failed / cancelled** — actual terminal state.
- **Not instrumented** — the runtime path may exist, but there is no structured event evidence for the requested detail.
- **Target / planned** — documented architecture only; never merged into the live execution route.

### Privacy and retention

- Do not store raw prompt bodies, authorization headers, API keys, private keys, raw tool arguments, or full file contents in trace metadata.
- Store only bounded summaries and stable identifiers.
- Existing journal retention remains bounded. Any future trace retention change requires a separate decision and migration plan.
- The map is read-only. Cancellation remains an explicit operation action through the existing operation API and must not be triggered by selecting a graph node.

### UI behavior

- Render a chronological, connected operation timeline/tree; a graph canvas is optional.
- Group child operations/events under their real parent operation IDs.
- Selecting a stage shows its observed actor, provider/model, instruction reference/version, input/output summaries, tool, transition reason, timestamps, status, and evidence source.
- Missing fields must be displayed as **not recorded**, never filled from assumptions.
- Provide a text/tree fallback for narrow layouts and accessibility.
- Live updates use the existing journal SSE stream; initial state is loaded from the API snapshot.
- Preserve the existing Processes filters and journal view.

## 2. «КАК У ДРУГИХ» External Reference Library

### User-facing location

Inside **AI-ресурсы → Справочники**, as a separate tab/collection named **«КАК У ДРУГИХ»**.

### Record contract

Each external reference contains:

- Stable record ID.
- Project/product/system name.
- Source URL and source title.
- Source type (repository, documentation, article, video, diagram, other).
- Date collected and optional source publication/update date.
- Short summary and user notes.
- Architecture/workflow description and extracted route/diagram text.
- Tags and status (unreviewed, reviewed, archived).
- Optional local attachment references in a future iteration.

The initial implementation stores metadata and text notes locally. It does not crawl arbitrary websites, download third-party assets, or claim a source was verified unless it was actually opened and reviewed.

### Authority boundary

External references are research material only:

- They are not runtime knowledge documents.
- They are not returned by `listKnowledgeDocuments`.
- They cannot be loaded by `readApprovedKnowledgeDocument`.
- They cannot become agent instructions automatically.
- Promoting an idea into ONE CORE AI requires a separate proposal, review, tests, and explicit approval in the existing knowledge lifecycle.

### Security and data handling

- Accept only absolute HTTP/HTTPS source URLs.
- Treat all imported text as untrusted reference content, not executable instructions.
- Do not fetch a URL automatically on record creation.
- Store records under the ONE CORE user-data home, outside `docs/knowledge`.
- Validate input sizes and IDs on the server; UI validation is not a security boundary.
- Deletion removes only the library record, never a remote source or arbitrary local file.

## 3. Implementation boundaries

### First implementation slice

1. Add the trace metadata contract to journal event types without breaking old persisted events.
2. Instrument the existing project-agent route and its actual tool calls; do not invent Manager/Dispatcher stages.
3. Expose a read-only system-map snapshot by joining operation records and journal events.
4. Add a live map/timeline view under Processes, reusing the current SSE stream.
5. Add a separate local external-reference store and read/create/update/delete API.
6. Add the «КАК У ДРУГИХ» view inside Directories, separate from approved runtime knowledge.
7. Add integration tests for backward compatibility, trace redaction/validation, API behavior, and strict knowledge-library isolation.
8. Update navigation and architecture documentation only if the existing route ownership changes.

### Explicitly out of scope for this slice

- Full Manager/Dispatcher orchestration.
- Automatic web crawling or bulk scraping.
- Automatic diagram extraction from arbitrary sites.
- Importing external references into approved runtime knowledge.
- Claiming universal trace coverage for every provider, task, subagent, or pipeline route.
- Restart recovery or durable operation-registry semantics.

## 4. Acceptance criteria

- Existing journal files without trace metadata still load.
- A real project-agent request appears in the map with its actual operation ID and observed events.
- Tool-call stages show the real tool name and terminal outcome.
- Unobserved instruction versions and handoffs display as not recorded.
- SSE updates modify the visible map without manual refresh.
- External references can be created, listed, edited, and deleted locally.
- External references never appear in the approved knowledge catalog or agent knowledge tools.
- URL and content validation is enforced server-side.
- Light and dark themes render correctly; existing three-column shell and page layout are preserved.
- TypeScript, integration tests, encoding check, and production build pass before the slice is marked verified.
