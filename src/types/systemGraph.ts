export type WorkflowLayerId = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';

export type WorkflowNodeKind =
  | 'trigger'
  | 'gateway'
  | 'router'
  | 'orchestrator'
  | 'subagent'
  | 'tool'
  | 'provider'
  | 'state'
  | 'guard'
  | 'dead-end';

export type WorkflowNodeStatus =
  | 'live-active'
  | 'implemented'
  | 'partial'
  | 'planned-draft'
  | 'dead-end';

export type WorkflowEdgeKind =
  | 'normal'
  | 'conditional'
  | 'retry'
  | 'approval'
  | 'telemetry'
  | 'dead-end'
  | 'planned';

export interface ScannedDocEntry {
  id?: string;
  title: string;
  path: string;
  category: 'architecture' | 'intelligence' | 'knowledge' | 'schema' | 'governance' | 'project' | 'root';
  status: string;
  version?: string;
  ownerRole?: string;
  triggers: string[];
  headings: string[];
  referencedPaths: string[];
  lineCount: number;
  sizeBytes: number;
  linkedNodeIds: string[];
}

export interface ScannedApiRoute {
  method: string;
  path: string;
  line: number;
  hasExplicitApproval: boolean;
  hasProjectToolGuard: boolean;
  recordsOperation: boolean;
  recordsJournal: boolean;
}

export interface WorkflowDocBinding {
  path: string;
  title: string;
  section: string;
  status: string;
  verifiedOnDisk: boolean;
}

export interface WorkflowNode {
  id: string;
  layerId: WorkflowLayerId;
  macroId: string;
  kind: WorkflowNodeKind;
  title: string;
  subtitle: string;
  status: WorkflowNodeStatus;
  isDeadEnd: boolean;
  deadEndReason?: string;
  x: number;
  y: number;
  eventTrigger: string;
  emittedEvents: string[];
  microFeatures: string[];
  sourceFiles: string[];
  apiRoutes: string[];
  docRefs: WorkflowDocBinding[];
  liveMetrics: {
    journalHits: number;
    activeOps: number;
    completedOps: number;
    failedOps: number;
    cancelledOps: number;
    lastSeenAt: string | null;
  };
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  eventName: string;
  kind: WorkflowEdgeKind;
  condition?: string;
  isLiveActive: boolean;
}

export interface MacroWorkflowLayerStep {
  layer: string;
  stateName: string;
  actor: string;
  summary: string;
  nodeIds: string[];
  deadEnds: string[];
}

export interface MacroWorkflowSpec {
  id: string;
  title: string;
  subtitle: string;
  status: 'implemented' | 'partial' | 'planned-draft';
  entryEvent: string;
  terminalStates: string[];
  layers: MacroWorkflowLayerStep[];
  docRefs: WorkflowDocBinding[];
  sourceFiles: string[];
}

export interface WorkflowLayerMeta {
  id: WorkflowLayerId;
  index: number;
  title: string;
  shortTitle: string;
  description: string;
  x: number;
}

export interface SystemWorkflowGraphPayload {
  generatedAt: string;
  scanSummary: {
    totalDocs: number;
    totalApiRoutes: number;
    totalServerModules: number;
    totalUiPages: number;
    totalUiComponents: number;
    totalTauriCommands: number;
    totalDesignerModules: number;
    totalKnowledgeDocs: number;
    approvedKnowledgeDocs: number;
    totalRoles: number;
    totalTools: number;
    sysToolsCount: number;
    totalNodes: number;
    totalEdges: number;
    deadEndCount: number;
    liveActiveNodes: number;
    observedJournalEvents: number;
    inMemoryOperations: number;
    activeOperationsCount: number;
    connectedProjectsCount: number;
    configuredProvidersCount: number;
    activeProviderId: string | null;
  };
  layers: WorkflowLayerMeta[];
  macros: MacroWorkflowSpec[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  documentsCatalog: ScannedDocEntry[];
  apiRoutes: ScannedApiRoute[];
  tauriCommands: Array<{ name: string; file: string; line: number }>;
}

export interface LoadedSystemDocument {
  path: string;
  title: string;
  format: 'markdown' | 'json' | 'code';
  content: string;
  lineCount: number;
  sizeBytes: number;
  truncated: boolean;
}
