import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Boxes,
  Compass,
  FileCode2,
  FolderOpen,
  GitBranch,
  Layers,
  Loader2,
  Maximize2,
  Minimize2,
  Network,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { apiFetch } from '../../utils/apiFetch';
import { cn } from '../../utils/cn';
import type {
  MacroWorkflowSpec,
  SystemWorkflowGraphPayload,
  WorkflowEdge,
  WorkflowEdgeKind,
  WorkflowLayerId,
  WorkflowNode,
  WorkflowNodeStatus,
} from '../../types/systemGraph';
import { SystemDocsWindowModal } from './SystemDocsWindowModal';

type ExplorerMode = 'graph' | 'macros' | 'scanner-raw';
type StatusFilter = 'all' | WorkflowNodeStatus | 'dead-ends-only';

interface SystemEventGraphViewProps {
  externalDocsRequestTick?: number;
}

const NODE_WIDTH = 256;
const NODE_HEIGHT = 114;
const WORLD_WIDTH = 2420;
const WORLD_HEIGHT = 1280;

const STATUS_META: Record<
  WorkflowNodeStatus,
  { label: string; badgeClass: string; borderClass: string }
> = {
  'live-active': {
    label: 'Live активен',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    borderClass: 'border-emerald-500/60 dark:border-emerald-500/50',
  },
  implemented: {
    label: 'Реализован',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
    borderClass: 'border-zinc-300 dark:border-zinc-700',
  },
  partial: {
    label: 'Частично',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
    borderClass: 'border-amber-500/50 dark:border-amber-500/40',
  },
  'planned-draft': {
    label: 'Draft / Пробел',
    badgeClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30',
    borderClass: 'border-dashed border-violet-500/60 dark:border-violet-400/50',
  },
  'dead-end': {
    label: 'Тупик / Отказ',
    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
    borderClass: 'border-rose-500/60 dark:border-rose-500/50',
  },
};

const EDGE_COLORS: Record<WorkflowEdgeKind, string> = {
  normal: '#3b82f6',
  conditional: '#0ea5e9',
  retry: '#6366f1',
  approval: '#d97706',
  telemetry: '#10b981',
  'dead-end': '#e11d48',
  planned: '#8b5cf6',
};

const EDGE_KIND_LABELS: Record<WorkflowEdgeKind, string> = {
  normal: 'Поток',
  conditional: 'Условие',
  retry: 'Повтор (Retry)',
  approval: 'Одобрение',
  telemetry: 'Аудит / SSE',
  'dead-end': 'Тупик / Отказ',
  planned: 'Пробел / План',
};

function computeEdgeGeometry(edge: WorkflowEdge, nodeMap: Map<string, WorkflowNode>): {
  pathD: string;
  labelX: number;
  labelY: number;
} | null {
  const fromNode = nodeMap.get(edge.from);
  const toNode = nodeMap.get(edge.to);
  if (!fromNode || !toNode) return null;

  const isBackward = toNode.x < fromNode.x;
  const isSameCol = Math.abs(toNode.x - fromNode.x) < 20;

  if (isBackward) {
    const startX = fromNode.x + NODE_WIDTH / 2;
    const startY = fromNode.y + NODE_HEIGHT;
    const endX = toNode.x + NODE_WIDTH / 2;
    const endY = toNode.y + NODE_HEIGHT;
    const loopY = Math.max(startY, endY) + 56;
    const pathD = `M ${startX} ${startY} C ${startX} ${loopY}, ${endX} ${loopY}, ${endX} ${endY}`;
    return {
      pathD,
      labelX: (startX + endX) / 2,
      labelY: loopY - 10,
    };
  }

  if (isSameCol) {
    const goingDown = toNode.y >= fromNode.y;
    const startX = fromNode.x + NODE_WIDTH;
    const startY = fromNode.y + NODE_HEIGHT / 2;
    const endX = toNode.x + NODE_WIDTH;
    const endY = toNode.y + NODE_HEIGHT / 2;
    const bulgeX = startX + (goingDown ? 42 : 58);
    const pathD = `M ${startX} ${startY} C ${bulgeX} ${startY}, ${bulgeX} ${endY}, ${endX} ${endY}`;
    return {
      pathD,
      labelX: bulgeX - 4,
      labelY: (startY + endY) / 2,
    };
  }

  const startX = fromNode.x + NODE_WIDTH;
  const startY = fromNode.y + NODE_HEIGHT / 2;
  const endX = toNode.x;
  const endY = toNode.y + NODE_HEIGHT / 2;
  const dx = Math.max(60, (endX - startX) * 0.45);
  const pathD = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;
  return {
    pathD,
    labelX: (startX + endX) / 2,
    labelY: (startY + endY) / 2 - 6,
  };
}

export const SystemEventGraphView: React.FC<SystemEventGraphViewProps> = ({
  externalDocsRequestTick = 0,
}) => {
  const [graph, setGraph] = useState<SystemWorkflowGraphPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [explorerMode, setExplorerMode] = useState<ExplorerMode>('graph');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [layerFilter, setLayerFilter] = useState<'all' | WorkflowLayerId>('all');
  const [macroFocusId, setMacroFocusId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('orch-team-run');

  // Separate windows state
  const [docsWindowOpen, setDocsWindowOpen] = useState(false);
  const [docsInitialPath, setDocsInitialPath] = useState<string | null>(null);
  const [detachedGraphOpen, setDetachedGraphOpen] = useState(false);

  // Macro unpacking state
  const [expandedMacroIds, setExpandedMacroIds] = useState<Record<string, boolean>>({
    'macro-team-swarm': true,
    'macro-project-agent-loop': true,
  });

  // Pan & Zoom state
  const [zoom, setZoom] = useState(0.72);
  const [pan, setPan] = useState({ x: 20, y: 16 });
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const loadGraph = useCallback(async (isRescan = false) => {
    try {
      if (isRescan) setScanning(true);
      else setLoading(true);
      setError(null);
      const response = await apiFetch('/api/system-graph', {
        headers: { Accept: 'application/json' },
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        graph?: SystemWorkflowGraphPayload;
        error?: string;
      };
      if (!response.ok || !payload.ok || !payload.graph) {
        throw new Error(payload.error || `Не удалось просканировать систему (HTTP ${response.status}).`);
      }
      setGraph(payload.graph);
      setSelectedNodeId((current) => {
        if (current && payload.graph!.nodes.some((n) => n.id === current)) return current;
        return payload.graph!.nodes[0]?.id ?? '';
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ошибка сканирования графа системы.');
    } finally {
      setLoading(false);
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    void loadGraph(false);
  }, [loadGraph]);

  useEffect(() => {
    if (externalDocsRequestTick > 0) {
      setDocsInitialPath(null);
      setDocsWindowOpen(true);
    }
  }, [externalDocsRequestTick]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, WorkflowNode>();
    for (const node of graph?.nodes ?? []) map.set(node.id, node);
    return map;
  }, [graph]);

  const matchingNodeIds = useMemo(() => {
    const nodes = graph?.nodes ?? [];
    const q = searchQuery.trim().toLowerCase();
    const matched = new Set<string>();
    for (const node of nodes) {
      if (layerFilter !== 'all' && node.layerId !== layerFilter) continue;
      if (macroFocusId !== 'all' && node.macroId !== macroFocusId) continue;
      if (statusFilter === 'dead-ends-only' && !node.isDeadEnd) continue;
      if (statusFilter !== 'all' && statusFilter !== 'dead-ends-only' && node.status !== statusFilter) continue;
      if (q) {
        const hay = [
          node.id,
          node.title,
          node.subtitle,
          node.eventTrigger,
          node.emittedEvents.join(' '),
          node.microFeatures.join(' '),
          node.sourceFiles.join(' '),
          node.apiRoutes.join(' '),
          node.docRefs.map((d) => `${d.path} ${d.title}`).join(' '),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) continue;
      }
      matched.add(node.id);
    }
    return matched;
  }, [graph, layerFilter, macroFocusId, statusFilter, searchQuery]);

  // Connected causal neighborhood around selected node
  const selectedNeighborhood = useMemo(() => {
    const connectedNodes = new Set<string>();
    const connectedEdges = new Set<string>();
    if (!selectedNodeId || !graph) return { connectedNodes, connectedEdges };

    connectedNodes.add(selectedNodeId);
    for (const edge of graph.edges) {
      if (edge.from === selectedNodeId || edge.to === selectedNodeId) {
        connectedEdges.add(edge.id);
        connectedNodes.add(edge.from);
        connectedNodes.add(edge.to);
      }
    }
    return { connectedNodes, connectedEdges };
  }, [graph, selectedNodeId]);

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodeMap.get(selectedNodeId) ?? null : null),
    [nodeMap, selectedNodeId],
  );

  const selectedIncomingEdges = useMemo(
    () => (graph?.edges ?? []).filter((e) => e.to === selectedNodeId),
    [graph, selectedNodeId],
  );
  const selectedOutgoingEdges = useMemo(
    () => (graph?.edges ?? []).filter((e) => e.from === selectedNodeId),
    [graph, selectedNodeId],
  );

  const openDocumentWindow = (docPath?: string | null) => {
    setDocsInitialPath(docPath ?? null);
    setDocsWindowOpen(true);
  };

  const focusNodeOnCanvas = (nodeId: string) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;
    setSelectedNodeId(nodeId);
    setExplorerMode('graph');
    const container = viewportRef.current;
    const viewW = container?.clientWidth ?? 960;
    const viewH = container?.clientHeight ?? 620;
    const targetZoom = Math.max(zoom, 0.78);
    setZoom(targetZoom);
    setPan({
      x: Math.round(viewW / 2 - (node.x + NODE_WIDTH / 2) * targetZoom),
      y: Math.round(viewH / 2 - (node.y + NODE_HEIGHT / 2) * targetZoom),
    });
  };

  const fitGraphToViewport = () => {
    const container = viewportRef.current;
    const viewW = container?.clientWidth ?? 1000;
    const viewH = container?.clientHeight ?? 640;
    const scale = Math.max(0.35, Math.min(1.0, Math.min((viewW - 32) / WORLD_WIDTH, (viewH - 32) / WORLD_HEIGHT)));
    setZoom(Number(scale.toFixed(2)));
    setPan({ x: 16, y: 16 });
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, a, input, select')) return;
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      origX: pan.x,
      origY: pan.y,
    };
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    setPan({
      x: dragRef.current.origX + (event.clientX - dragRef.current.startX),
      y: dragRef.current.origY + (event.clientY - dragRef.current.startY),
    });
  };

  const stopDragging = () => {
    dragRef.current.active = false;
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const delta = event.deltaY < 0 ? 0.08 : -0.08;
      setZoom((prev) => Number(Math.max(0.35, Math.min(1.4, prev + delta)).toFixed(2)));
    }
  };

  const toggleMacro = (id: string) => {
    setExpandedMacroIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderGraphWorkspace = (isDetached: boolean) => {
    if (!graph) return null;

    return (
      <div className={cn('flex flex-col gap-3', isDetached ? 'min-h-0 flex-1' : '')}>
        {/* Scanner Filter & Zoom Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-[#111114]">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
            <label className="relative min-w-[200px] flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Фильтр: узел, событие, маршрут, документ…"
                className="h-8 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-8 pr-2.5 text-xs outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950"
              />
            </label>

            <select
              aria-label="Фильтр по слою архитектуры"
              value={layerFilter}
              onChange={(e) => setLayerFilter(e.target.value as 'all' | WorkflowLayerId)}
              className="h-8 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="all">Все 7 слоёв</option>
              {graph.layers.map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {layer.id} · {layer.shortTitle}
                </option>
              ))}
            </select>

            <select
              aria-label="Фильтр по крупному мероприятию"
              value={macroFocusId}
              onChange={(e) => setMacroFocusId(e.target.value)}
              className="h-8 max-w-[230px] rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="all">Все мероприятия (вся система)</option>
              {graph.macros.map((macro) => (
                <option key={macro.id} value={macro.id}>
                  {macro.title}
                </option>
              ))}
            </select>

            <select
              aria-label="Фильтр по статусу и тупикам"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-8 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="all">Все пути и состояния</option>
              <option value="dead-ends-only">Только тупики и пробелы</option>
              <option value="live-active">Live активные</option>
              <option value="implemented">Реализованные</option>
              <option value="partial">Частично реализованы</option>
              <option value="planned-draft">Draft / Плановые</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() =>
                setStatusFilter((prev) => (prev === 'dead-ends-only' ? 'all' : 'dead-ends-only'))
              }
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
                statusFilter === 'dead-ends-only'
                  ? 'border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300',
              )}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Тупики ({graph.scanSummary.deadEndCount})</span>
            </button>

            <div className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => setZoom((z) => Number(Math.max(0.35, z - 0.1).toFixed(2)))}
                className="rounded-md p-1 text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-800"
                title="Уменьшить масштаб"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 font-mono text-[11px] tabular-nums text-zinc-600 dark:text-zinc-300">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Number(Math.min(1.4, z + 0.1).toFixed(2)))}
                className="rounded-md p-1 text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-800"
                title="Увеличить масштаб"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={fitGraphToViewport}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap"
              >
                Уместить
              </button>
            </div>

            {!isDetached && (
              <button
                type="button"
                onClick={() => setDetachedGraphOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 whitespace-nowrap"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span>Граф в отдельном окне</span>
              </button>
            )}
          </div>
        </div>

        {/* Canvas + Node Inspector Split */}
        <div
          className={cn(
            'grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch',
            isDetached ? 'min-h-0 flex-1' : '',
          )}
        >
          {/* Interactive Pan/Zoom Event Graph Canvas */}
          <div
            ref={viewportRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={stopDragging}
            onMouseLeave={stopDragging}
            onWheel={handleWheel}
            className={cn(
              'xl:col-span-8 relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 select-none cursor-grab active:cursor-grabbing dark:border-zinc-800 dark:bg-[#08090C]',
              isDetached ? 'min-h-[520px] h-full' : 'h-[660px]',
            )}
          >
            {/* Subtle Coordinate Grid */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-25"
              style={{
                backgroundImage:
                  'radial-gradient(circle, rgba(113,113,122,0.35) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />

            {/* Floating Legend inside Canvas */}
            <div className="pointer-events-none absolute left-3 bottom-3 z-20 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-zinc-200/90 bg-white/90 px-3 py-1.5 text-[10.5px] text-zinc-600 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/90 dark:text-zinc-300">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">Перетаскивание мышью · Ctrl+колесо масштаб</span>
              <span>·</span>
              <span className="text-emerald-600 dark:text-emerald-400">Live активен</span>
              <span>·</span>
              <span className="text-amber-600 dark:text-amber-400">Approval / Частично</span>
              <span>·</span>
              <span className="text-rose-600 dark:text-rose-400">Тупик / Отказ</span>
              <span>·</span>
              <span className="text-violet-600 dark:text-violet-400">Draft / Пробел</span>
            </div>

            {/* Transformed World */}
            <div
              style={{
                width: `${WORLD_WIDTH}px`,
                height: `${WORLD_HEIGHT}px`,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
              }}
              className="relative"
            >
              {/* Layer Columns */}
              {graph.layers.map((layer) => (
                <div
                  key={layer.id}
                  style={{ left: `${layer.x - 16}px`, top: '12px', width: '288px', height: `${WORLD_HEIGHT - 24}px` }}
                  className="absolute rounded-xl border border-zinc-200/80 bg-white/50 dark:border-zinc-800/70 dark:bg-zinc-900/20"
                >
                  <div className="border-b border-zinc-200/80 px-3 py-2 dark:border-zinc-800/70">
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{layer.title}</div>
                    <div className="mt-0.5 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      {layer.description}
                    </div>
                  </div>
                </div>
              ))}

              {/* SVG Directed Event Edges */}
              <svg
                width={WORLD_WIDTH}
                height={WORLD_HEIGHT}
                className="pointer-events-none absolute inset-0 overflow-visible"
              >
                <defs>
                  {(Object.keys(EDGE_COLORS) as WorkflowEdgeKind[]).map((kind) => (
                    <marker
                      key={kind}
                      id={`arrow-${kind}`}
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill={EDGE_COLORS[kind]} />
                    </marker>
                  ))}
                </defs>

                {graph.edges.map((edge) => {
                  const geom = computeEdgeGeometry(edge, nodeMap);
                  if (!geom) return null;
                  const fromMatched = matchingNodeIds.has(edge.from);
                  const toMatched = matchingNodeIds.has(edge.to);
                  const isFilterDimmed = !fromMatched && !toMatched;
                  const isSelectedIncident = selectedNeighborhood.connectedEdges.has(edge.id);
                  const hasSelection = Boolean(selectedNodeId);

                  const opacity = isFilterDimmed
                    ? 0.08
                    : hasSelection
                      ? isSelectedIncident
                        ? 0.96
                        : 0.22
                      : 0.68;

                  const strokeDasharray =
                    edge.kind === 'dead-end' || edge.kind === 'planned'
                      ? '6 4'
                      : edge.kind === 'retry' || edge.kind === 'telemetry'
                        ? '4 3'
                        : undefined;

                  return (
                    <g key={edge.id} style={{ opacity }}>
                      <path
                        d={geom.pathD}
                        fill="none"
                        stroke={EDGE_COLORS[edge.kind]}
                        strokeWidth={isSelectedIncident ? 2.4 : edge.isLiveActive ? 2 : 1.4}
                        strokeDasharray={strokeDasharray}
                        markerEnd={`url(#arrow-${edge.kind})`}
                      />
                      {(isSelectedIncident || edge.kind === 'dead-end' || edge.kind === 'retry') && (
                        <g transform={`translate(${geom.labelX}, ${geom.labelY})`}>
                          <rect
                            x={-68}
                            y={-9}
                            width={136}
                            height={18}
                            rx={4}
                            className="fill-white/95 stroke-zinc-200 dark:fill-zinc-950/95 dark:stroke-zinc-800"
                            strokeWidth={0.8}
                          />
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="fill-zinc-700 font-mono text-[9px] dark:fill-zinc-300"
                          >
                            {edge.eventName.length > 22 ? `${edge.eventName.slice(0, 21)}…` : edge.eventName}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Event Graph Nodes */}
              {graph.nodes.map((node) => {
                const isMatched = matchingNodeIds.has(node.id);
                const isSelected = selectedNodeId === node.id;
                const isNeighbor = selectedNeighborhood.connectedNodes.has(node.id);
                const dimmed = !isMatched || (Boolean(selectedNodeId) && !isNeighbor);
                const meta = STATUS_META[node.status];

                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedNodeId(node.id)}
                    style={{
                      left: `${node.x}px`,
                      top: `${node.y}px`,
                      width: `${NODE_WIDTH}px`,
                      height: `${NODE_HEIGHT}px`,
                    }}
                    className={cn(
                      'absolute flex flex-col justify-between rounded-xl border bg-white p-2.5 text-left transition-opacity dark:bg-[#121318]',
                      meta.borderClass,
                      isSelected && 'ring-2 ring-blue-500 shadow-md z-10',
                      dimmed ? 'opacity-25 hover:opacity-80' : 'opacity-100',
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                        <span className="font-mono uppercase">{node.kind}</span>
                        <span className={cn('rounded border px-1.5 py-0.2 font-medium whitespace-nowrap', meta.badgeClass)}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-1 line-clamp-2 text-[11.5px] font-semibold leading-tight text-zinc-900 dark:text-zinc-100">
                        {node.title}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-1.5 font-mono text-[9.5px] tabular-nums text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                      <span className="truncate">{node.eventTrigger}</span>
                      <span className="shrink-0">
                        {node.liveMetrics.journalHits > 0
                          ? `live:${node.liveMetrics.journalHits}`
                          : `docs:${node.docRefs.length}`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Node & Event Inspector */}
          <aside
            className={cn(
              'xl:col-span-4 flex flex-col rounded-xl border border-zinc-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-[#111114]',
              isDetached ? 'min-h-0 h-full' : 'h-[660px]',
            )}
          >
            {selectedNode ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-zinc-500">
                      {selectedNode.layerId} · {selectedNode.kind} · {selectedNode.id}
                    </span>
                    <span
                      className={cn(
                        'rounded border px-2 py-0.5 text-[10.5px] font-medium whitespace-nowrap',
                        STATUS_META[selectedNode.status].badgeClass,
                      )}
                    >
                      {STATUS_META[selectedNode.status].label}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {selectedNode.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {selectedNode.subtitle}
                  </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                  {/* Dead-End / Trap Banner */}
                  {selectedNode.isDeadEnd && selectedNode.deadEndReason && (
                    <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-rose-800 dark:text-rose-200">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>Причина тупика / архитектурного ограничения</span>
                      </div>
                      <p className="mt-1 text-[11.5px] leading-relaxed">{selectedNode.deadEndReason}</p>
                    </div>
                  )}

                  {/* Live Runtime State Counters */}
                  <div className="grid grid-cols-3 gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 font-mono tabular-nums dark:border-zinc-800 dark:bg-zinc-900/50">
                    <div>
                      <div className="text-[10px] text-zinc-500">События журнала</div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {selectedNode.liveMetrics.journalHits}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500">Актив / Заверш.</div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {selectedNode.liveMetrics.activeOps} / {selectedNode.liveMetrics.completedOps}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500">Сбои / Отмена</div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {selectedNode.liveMetrics.failedOps} / {selectedNode.liveMetrics.cancelledOps}
                      </div>
                    </div>
                  </div>

                  {/* Event Trigger & Emitted Events */}
                  <div className="space-y-1.5">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">Событийный контракт</div>
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 space-y-1.5 dark:border-zinc-800 dark:bg-zinc-900/40">
                      <div className="text-[11px]">
                        <span className="text-zinc-500">Входное событие: </span>
                        <code className="font-mono text-blue-700 dark:text-blue-300">{selectedNode.eventTrigger}</code>
                      </div>
                      <div className="text-[11px]">
                        <span className="text-zinc-500">Исходящие события: </span>
                        <span className="font-mono text-zinc-700 dark:text-zinc-300">
                          {selectedNode.emittedEvents.join(' · ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Micro-features */}
                  <div className="space-y-1.5">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                      Детали и мелочи функционала ({selectedNode.microFeatures.length})
                    </div>
                    <ul className="space-y-1 text-[11.5px] text-zinc-600 dark:text-zinc-300">
                      {selectedNode.microFeatures.map((feat) => (
                        <li
                          key={feat}
                          className="rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-2.5 py-1.5 dark:border-zinc-800 dark:bg-zinc-900/40"
                        >
                          {feat}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Incoming & Outgoing Transitions */}
                  <div className="space-y-2">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                      Входы ({selectedIncomingEdges.length}) и Выходы ({selectedOutgoingEdges.length})
                    </div>
                    {selectedIncomingEdges.length > 0 && (
                      <div className="space-y-1">
                        {selectedIncomingEdges.map((edge) => {
                          const src = nodeMap.get(edge.from);
                          return (
                            <button
                              key={edge.id}
                              type="button"
                              onClick={() => focusNodeOnCanvas(edge.from)}
                              className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50 px-2.5 py-1.5 text-left text-[11px] hover:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900/40"
                            >
                              <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                                ← {src?.title ?? edge.from}
                              </span>
                              <span className="shrink-0 font-mono text-[10px] text-zinc-500">
                                {edge.eventName}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {selectedOutgoingEdges.length > 0 && (
                      <div className="space-y-1">
                        {selectedOutgoingEdges.map((edge) => {
                          const dst = nodeMap.get(edge.to);
                          return (
                            <button
                              key={edge.id}
                              type="button"
                              onClick={() => focusNodeOnCanvas(edge.to)}
                              className={cn(
                                'flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11px] hover:border-blue-400',
                                edge.kind === 'dead-end'
                                  ? 'border-rose-500/30 bg-rose-500/5 text-rose-800 dark:text-rose-200'
                                  : 'border-zinc-200/80 bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200',
                              )}
                            >
                              <span className="truncate font-medium">→ {dst?.title ?? edge.to}</span>
                              <span className="shrink-0 font-mono text-[10px] opacity-80">
                                {EDGE_KIND_LABELS[edge.kind]} · {edge.eventName}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Document Bindings (Click to open Separate Document Window) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        Документы и расположение ({selectedNode.docRefs.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => openDocumentWindow(selectedNode.docRefs[0]?.path)}
                        className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400 whitespace-nowrap"
                      >
                        Открыть окно документов
                      </button>
                    </div>
                    <div className="space-y-1">
                      {selectedNode.docRefs.map((doc) => (
                        <button
                          key={`${doc.path}:${doc.section}`}
                          type="button"
                          onClick={() => openDocumentWindow(doc.path)}
                          className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-left hover:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900/40"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-100">
                              <BookOpen className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                              <span className="truncate">{doc.title}</span>
                            </div>
                            <div className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">
                              {doc.path} · {doc.section}
                            </div>
                          </div>
                          <span className="shrink-0 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                            {doc.verifiedOnDisk ? doc.status : 'не найден'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Source Files & API Routes */}
                  <div className="space-y-1.5">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                      Модули кода и API ({selectedNode.sourceFiles.length})
                    </div>
                    <div className="space-y-1">
                      {selectedNode.sourceFiles.map((filePath) => (
                        <button
                          key={filePath}
                          type="button"
                          onClick={() => openDocumentWindow(filePath)}
                          className="flex w-full items-center gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50 px-2.5 py-1.5 text-left font-mono text-[11px] text-zinc-700 hover:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300"
                        >
                          <FileCode2 className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                          <span className="truncate">{filePath}</span>
                        </button>
                      ))}
                    </div>
                    {selectedNode.apiRoutes.length > 0 && (
                      <div className="mt-1.5 rounded-lg border border-zinc-200/80 bg-zinc-50 p-2 font-mono text-[10.5px] text-zinc-600 space-y-0.5 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
                        {selectedNode.apiRoutes.map((route) => (
                          <div key={route} className="truncate">
                            {route}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-xs text-zinc-500">
                Нажмите на любой узел Event Graph для распаковки деталей.
              </div>
            )}
          </aside>
        </div>
      </div>
    );
  };

  const renderMacroUnpacking = () => {
    if (!graph) return null;
    const allExpanded = graph.macros.every((m) => expandedMacroIds[m.id]);

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-[#111114]">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Послойная распаковка крупногабаритных мероприятий ({graph.macros.length} схем)
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Каждая схема раскладывает крупный процесс от входного триггера до конечных и тупиковых состояний.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const next: Record<string, boolean> = {};
              for (const macro of graph.macros) next[macro.id] = !allExpanded;
              setExpandedMacroIds(next);
            }}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 whitespace-nowrap"
          >
            {allExpanded ? 'Свернуть все схемы' : 'Распаковать все схемы'}
          </button>
        </div>

        <div className="space-y-3">
          {graph.macros.map((macro: MacroWorkflowSpec) => {
            const expanded = Boolean(expandedMacroIds[macro.id]);
            const statusMeta = STATUS_META[macro.status];

            return (
              <section
                key={macro.id}
                className="rounded-xl border border-zinc-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-[#111114]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{macro.title}</h4>
                      <span
                        className={cn(
                          'rounded border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap',
                          statusMeta.badgeClass,
                        )}
                      >
                        {statusMeta.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{macro.subtitle}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] text-zinc-500 dark:text-zinc-400">
                      <span>Вход: {macro.entryEvent}</span>
                      <span>·</span>
                      <span>Слоёв: {macro.layers.length}</span>
                      <span>·</span>
                      <span>Исходы: {macro.terminalStates.join(' | ')}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setMacroFocusId(macro.id);
                        setExplorerMode('graph');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-500/20 dark:text-blue-300 whitespace-nowrap"
                    >
                      <Network className="h-3.5 w-3.5" />
                      <span>На Event Graph</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openDocumentWindow(macro.docRefs[0]?.path)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 whitespace-nowrap"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>Документы</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleMacro(macro.id)}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 whitespace-nowrap"
                    >
                      {expanded ? 'Свернуть' : 'Распаковать'}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-zinc-200 bg-zinc-50/70 p-4 space-y-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                    <div className="space-y-2.5">
                      {macro.layers.map((step, idx) => (
                        <div
                          key={step.layer}
                          className="rounded-xl border border-zinc-200 bg-white p-3.5 space-y-2 dark:border-zinc-800 dark:bg-[#111216]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                                0{idx + 1}.
                              </span>
                              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                {step.layer}
                              </span>
                            </div>
                            <span className="font-mono text-[10.5px] text-zinc-500 dark:text-zinc-400">
                              {step.stateName} · {step.actor}
                            </span>
                          </div>

                          <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{step.summary}</p>

                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {step.nodeIds.map((nid) => {
                              const node = nodeMap.get(nid);
                              if (!node) return null;
                              return (
                                <button
                                  key={nid}
                                  type="button"
                                  onClick={() => focusNodeOnCanvas(nid)}
                                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 whitespace-nowrap"
                                >
                                  <span>{node.title}</span>
                                  <ArrowRight className="h-3 w-3 text-zinc-400" />
                                </button>
                              );
                            })}
                            {step.deadEnds.map((did) => {
                              const dead = nodeMap.get(did);
                              if (!dead) return null;
                              return (
                                <button
                                  key={did}
                                  type="button"
                                  onClick={() => focusNodeOnCanvas(did)}
                                  className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-500/20 dark:text-rose-300 whitespace-nowrap"
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  <span>{dead.title}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>Документы:</span>
                        {macro.docRefs.map((doc) => (
                          <button
                            key={doc.path}
                            type="button"
                            onClick={() => openDocumentWindow(doc.path)}
                            className="font-mono text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {doc.path}
                          </button>
                        ))}
                      </div>
                      <div className="font-mono text-[10.5px]">
                        Модули: {macro.sourceFiles.join(' · ')}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    );
  };

  const renderScannerInventory = () => {
    if (!graph) return null;
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-8 rounded-xl border border-zinc-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-[#111114]">
          <div className="border-b border-zinc-200 p-4 flex flex-wrap items-center justify-between gap-2 dark:border-zinc-800">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Живой скан Express API маршрутов (server/app.ts)
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Автоматически извлечённые эндпоинты с проверкой подключённых защитных механизмов.
              </p>
            </div>
            <span className="font-mono text-xs tabular-nums text-zinc-500">
              {graph.apiRoutes.length} маршрутов
            </span>
          </div>
          <div className="max-h-[540px] overflow-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <th className="px-3 py-2">Метод и путь</th>
                  <th className="px-3 py-2 text-right">Строка</th>
                  <th className="px-3 py-2">Approval Gate</th>
                  <th className="px-3 py-2">Tool Guard</th>
                  <th className="px-3 py-2">Op / Journal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800/80">
                {graph.apiRoutes.map((route) => (
                  <tr
                    key={`${route.method}:${route.path}:${route.line}`}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30"
                  >
                    <td className="px-3 py-2 font-mono text-[11px]">
                      <span className="font-semibold text-blue-600 dark:text-blue-400">{route.method}</span>{' '}
                      <span className="text-zinc-800 dark:text-zinc-200">{route.path}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-zinc-500">L{route.line}</td>
                    <td className="px-3 py-2 text-[11px]">
                      {route.hasExplicitApproval ? (
                        <span className="text-amber-600 dark:text-amber-400">Да (Class C / Explicit)</span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[11px]">
                      {route.hasProjectToolGuard ? (
                        <span className="text-emerald-600 dark:text-emerald-400">Allowlist</span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-zinc-500">
                      {[route.recordsOperation && 'Op', route.recordsJournal && 'Journal'].filter(Boolean).join(' + ') || 'Middleware'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lg:col-span-4 rounded-xl border border-zinc-200 bg-white p-4 space-y-4 dark:border-zinc-800 dark:bg-[#111114]">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Команды Tauri 2 IPC (src-tauri)
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Просканированные Rust-команды `#[tauri::command]`.
            </p>
          </div>
          <div className="space-y-1.5">
            {graph.tauriCommands.map((cmd) => (
              <button
                key={`${cmd.file}:${cmd.name}:${cmd.line}`}
                type="button"
                onClick={() => openDocumentWindow(cmd.file)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left hover:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <span className="font-mono text-xs font-medium text-zinc-900 dark:text-zinc-100">{cmd.name}</span>
                <span className="font-mono text-[10.5px] tabular-nums text-zinc-500">
                  {cmd.file}:{cmd.line}
                </span>
              </button>
            ))}
          </div>

          <div className="border-t border-zinc-200 pt-3 space-y-1.5 text-xs dark:border-zinc-800">
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">Сводка сканирования файлов</div>
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px] tabular-nums text-zinc-600 dark:text-zinc-300">
              <span>Серверных модулей: {graph.scanSummary.totalServerModules}</span>
              <span>UI-страниц: {graph.scanSummary.totalUiPages}</span>
              <span>UI-компонентов: {graph.scanSummary.totalUiComponents}</span>
              <span>Designer модулей: {graph.scanSummary.totalDesignerModules}</span>
              <span>Knowledge approved: {graph.scanSummary.approvedKnowledgeDocs}/{graph.scanSummary.totalKnowledgeDocs}</span>
              <span>Инструментов (SYS): {graph.scanSummary.totalTools} ({graph.scanSummary.sysToolsCount})</span>
            </div>
          </div>
        </section>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Scanner Header & Live Summary Strip */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#111114]">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Network className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Системный State & Event Graph (Сканер архитектуры и runtime)
            </h2>
          </div>
          {graph ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
              <span>Документов: {graph.scanSummary.totalDocs}</span>
              <span>·</span>
              <span>API: {graph.scanSummary.totalApiRoutes}</span>
              <span>·</span>
              <span>Узлов графа: {graph.scanSummary.totalNodes}</span>
              <span>·</span>
              <span>Переходов: {graph.scanSummary.totalEdges}</span>
              <span>·</span>
              <span className="text-rose-600 dark:text-rose-400">
                Тупиков/пробелов: {graph.scanSummary.deadEndCount}
              </span>
              <span>·</span>
              <span className="text-emerald-600 dark:text-emerald-400">
                Live узлов: {graph.scanSummary.liveActiveNodes}
              </span>
              <span>·</span>
              <span>Событий в журнале: {graph.scanSummary.observedJournalEvents}</span>
            </div>
          ) : (
            <p className="mt-1 text-xs text-zinc-500">
              Выполняется живое сканирование документации, роутов, оркестраторов, инструментов и состояния runtime…
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openDocumentWindow(null)}
            disabled={!graph}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-500/20 disabled:opacity-50 dark:text-blue-300 whitespace-nowrap"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span>Окно документов ({graph?.scanSummary.totalDocs ?? 0})</span>
          </button>

          <button
            type="button"
            onClick={() => void loadGraph(true)}
            disabled={loading || scanning}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 whitespace-nowrap"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', (loading || scanning) && 'animate-spin')} />
            <span>{scanning ? 'Сканирование…' : 'Пересканировать'}</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setExplorerMode('graph')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
              explorerMode === 'graph'
                ? 'bg-white text-blue-700 shadow-sm dark:bg-zinc-800 dark:text-blue-300'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
            )}
          >
            <GitBranch className="h-3.5 w-3.5" />
            <span>Event Graph (7 слоёв)</span>
          </button>
          <button
            type="button"
            onClick={() => setExplorerMode('macros')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
              explorerMode === 'macros'
                ? 'bg-white text-blue-700 shadow-sm dark:bg-zinc-800 dark:text-blue-300'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Распаковка мероприятий ({graph?.macros.length ?? 8})</span>
          </button>
          <button
            type="button"
            onClick={() => setExplorerMode('scanner-raw')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
              explorerMode === 'scanner-raw'
                ? 'bg-white text-blue-700 shadow-sm dark:bg-zinc-800 dark:text-blue-300'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
            )}
          >
            <Server className="h-3.5 w-3.5" />
            <span>Сканер API и IPC ({graph?.scanSummary.totalApiRoutes ?? 0})</span>
          </button>
        </div>

        {graph && (
          <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums text-zinc-500">
            <Compass className="h-3.5 w-3.5 text-zinc-400" />
            <span>Снимок: {new Date(graph.generatedAt).toLocaleTimeString('ru-RU')}</span>
            <span>·</span>
            <span>Проектов: {graph.scanSummary.connectedProjectsCount}</span>
            <span>·</span>
            <span>Провайдеров: {graph.scanSummary.configuredProvidersCount}</span>
          </div>
        )}
      </div>

      {loading && !graph && (
        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-10 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-[#111114]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Сканирование документации, модулей и состояния runtime…</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!error && graph && (
        <>
          {explorerMode === 'graph' && renderGraphWorkspace(false)}
          {explorerMode === 'macros' && renderMacroUnpacking()}
          {explorerMode === 'scanner-raw' && renderScannerInventory()}
        </>
      )}

      {/* Separate Fullscreen Graph Window */}
      {detachedGraphOpen &&
        graph &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Отдельное окно системного Event Graph"
            className="fixed inset-0 z-40 flex flex-col bg-zinc-50 p-4 dark:bg-[#090A0E]"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 dark:border-zinc-800 dark:bg-[#111114]">
              <div className="flex items-center gap-2">
                <Boxes className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Отдельное окно: Системный Event Graph ONE CORE AI
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openDocumentWindow(selectedNode?.docRefs[0]?.path ?? null)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 whitespace-nowrap"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  <span>Окно документов</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetachedGraphOpen(false)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 whitespace-nowrap"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span>Вернуть в страницу</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetachedGraphOpen(false)}
                  aria-label="Закрыть окно графа"
                  className="rounded-lg border border-zinc-200 bg-zinc-50 p-1.5 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {renderGraphWorkspace(true)}
          </div>,
          document.body,
        )}

      {/* Separate Document & Location Window */}
      <SystemDocsWindowModal
        open={docsWindowOpen}
        onClose={() => setDocsWindowOpen(false)}
        documents={graph?.documentsCatalog ?? []}
        nodes={graph?.nodes ?? []}
        initialPath={docsInitialPath}
        onFocusNode={(nodeId) => focusNodeOnCanvas(nodeId)}
      />
    </div>
  );
};
