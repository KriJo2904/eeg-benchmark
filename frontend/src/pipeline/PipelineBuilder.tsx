import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import type { Connection, Edge, Node, ReactFlowInstance } from 'reactflow';
import { getBlockDefinition, jestWstepnym, jestWynikiem } from './blockRegistry';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import {
  jestStarymZapisem,
  nowyZapisZeStarego,
  STFT_ID,
  type ZapisanaKrawedz,
  type ZapisanyWezel,
} from './migratePipelineData';
import { PipelineInspector } from './PipelineInspector';
import { PipelineNode } from './PipelineNode';
import { PipelinePalette } from './PipelinePalette';
import { getProject, patchProject } from '../projectsApi';
import type { BlockKind, PipelineNodeData } from './types';

type PipelineRfNode = Node<PipelineNodeData>;

const EDGE_HIT_SLOP = 22;

type PipelineCanvasMenu =
  | { kind: 'node'; x: number; y: number; nodeId: string }
  | { kind: 'edge'; x: number; y: number; edgeId: string };

function genId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2, 10)}`;
}

const FIXED_START_ID = 'start';
function isFixedNodeId(id: string) {
  return id === FIXED_START_ID || id === STFT_ID;
}

const ZNANE_RODZAJE = ['start', 'stft', 'lowpass', 'normalize', 'krzywa_erd', 'mapa_erd'];

const nodeTypes = { pipelineNode: PipelineNode };
function storageKey(projectId: string) {
  return `project.${projectId}.pipeline.v1.autosave`;
}

type PipelineFile = {
  version: 1 | 2;
  nodes: ZapisanyWezel[];
  edges: ZapisanaKrawedz[];
  analysis?: { band?: unknown; map?: unknown };
};

function serializePipeline(nodes: PipelineRfNode[], edges: Edge[]): PipelineFile {
  return {
    version: 2,
    nodes: nodes.map((n) => ({
      id: n.id,
      position: { x: n.position.x, y: n.position.y },
      data: n.data,
    })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}

function isPipelineFile(x: unknown): x is PipelineFile {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (o.version !== 1 && o.version !== 2) return false;
  return Array.isArray(o.nodes) && Array.isArray(o.edges);
}

function makePipelineEdge(e: { id?: string; source: string; target: string }): Edge {
  return {
    id: e.id ?? genId('e'),
    source: e.source,
    target: e.target,
    animated: true,
    interactionWidth: EDGE_HIT_SLOP,
    style: { stroke: 'rgba(30,102,208,0.85)', strokeWidth: 2 },
  };
}

function rodzajWezla(nodes: PipelineRfNode[], id: string) {
  return nodes.find((n) => n.id === id)?.data.kind;
}

function moznaPolaczyc(nodes: PipelineRfNode[], edges: Edge[], source: string, target: string): boolean {
  if (!source || !target || source === target) return false;
  const zrodlo = rodzajWezla(nodes, source);
  const cel = rodzajWezla(nodes, target);
  if (!zrodlo || !cel) return false;
  if (edges.some((e) => e.target === target)) return false;

  if (jestWynikiem(cel)) return zrodlo === 'stft';

  if (cel !== 'stft' && !jestWstepnym(cel)) return false;
  if (zrodlo !== 'start' && !jestWstepnym(zrodlo)) return false;
  if (edges.some((e) => e.source === source)) return false;

  let biezacy: string | undefined = target;
  while (biezacy) {
    if (biezacy === source) return false;
    biezacy = edges.find((e) => e.source === biezacy)?.target;
  }
  return true;
}

const initialNodes: PipelineRfNode[] = [
  { id: FIXED_START_ID, type: 'pipelineNode', position: { x: 80, y: 240 }, data: { kind: 'start', label: 'Start' } },
  {
    id: STFT_ID,
    type: 'pipelineNode',
    position: { x: 420, y: 240 },
    data: { kind: 'stft', label: 'Spektrogram', params: { windowSize: 128, overlap: 0.9 } },
  },
  { id: 'erd', type: 'pipelineNode', position: { x: 760, y: 150 }, data: getBlockDefinition('krzywa_erd').makeNodeData() },
  { id: 'mapa', type: 'pipelineNode', position: { x: 760, y: 330 }, data: getBlockDefinition('mapa_erd').makeNodeData() },
];

const initialEdges: Edge[] = [
  makePipelineEdge({ id: 'e1', source: FIXED_START_ID, target: STFT_ID }),
  makePipelineEdge({ id: 'e2', source: STFT_ID, target: 'erd' }),
  makePipelineEdge({ id: 'e3', source: STFT_ID, target: 'mapa' }),
];

function ensureFixedNodes(nextNodes: PipelineRfNode[], nextEdges: Edge[]) {
  const outNodes = [...nextNodes];
  if (!outNodes.some((n) => n.id === FIXED_START_ID)) outNodes.unshift(initialNodes[0]);
  if (!outNodes.some((n) => n.id === STFT_ID)) outNodes.push(initialNodes[1]);

  const outEdges: Edge[] = [];
  for (const e of nextEdges) {
    if (moznaPolaczyc(outNodes, outEdges, e.source, e.target)) outEdges.push(e);
  }
  return { nodes: outNodes, edges: outEdges };
}

function sciezkaOdStartu(nodes: PipelineRfNode[], edges: Edge[]): string[] {
  const sciezka = [FIXED_START_ID];
  const odwiedzone = new Set(sciezka);
  let biezacy = FIXED_START_ID;
  while (biezacy !== STFT_ID) {
    const dalej = edges.find((e) => e.source === biezacy && !jestWynikiem(rodzajWezla(nodes, e.target) ?? 'start'));
    if (!dalej || odwiedzone.has(dalej.target)) break;
    sciezka.push(dalej.target);
    odwiedzone.add(dalej.target);
    biezacy = dalej.target;
  }
  return sciezka;
}

function grafZZapisu(file: PipelineFile): { nodes: PipelineRfNode[]; edges: Edge[] } {
  const zapis = jestStarymZapisem(file.nodes)
    ? nowyZapisZeStarego(file.nodes, file.edges, file.analysis)
    : { nodes: file.nodes.filter((n) => ZNANE_RODZAJE.includes(n.data.kind)), edges: file.edges };
  const nodes: PipelineRfNode[] = zapis.nodes.map((n) => ({
    id: n.id,
    type: 'pipelineNode',
    position: n.position,
    data: n.data as PipelineNodeData,
  }));
  return ensureFixedNodes(nodes, zapis.edges.map(makePipelineEdge));
}

export function PipelineBuilder(props: { projectId: string }) {
  const { projectId } = props;
  const [nodes, setNodes, onNodesChange] = useNodesState<PipelineNodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rfRef = useRef<ReactFlowInstance | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<'idle' | 'loading' | 'synced' | 'error'>('loading');
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const wczytanyProjektRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [canvasMenu, setCanvasMenu] = useState<PipelineCanvasMenu | null>(null);

  const sciezka = useMemo(() => {
    const ids = sciezkaOdStartu(nodes, edges);
    const etykieta = (id: string) => nodes.find((n) => n.id === id)?.data.label ?? id;
    const doStft = ids[ids.length - 1] === STFT_ID;
    const wyniki = edges.filter((e) => e.source === STFT_ID).map((e) => e.target);
    const maKrzywa = wyniki.some((id) => rodzajWezla(nodes, id) === 'krzywa_erd');
    const poza = nodes.filter((n) => !isFixedNodeId(n.id) && !ids.includes(n.id) && !wyniki.includes(n.id)).length;
    return { wstepne: ids.map(etykieta), wyniki: wyniki.map(etykieta), doStft, maKrzywa, poza };
  }, [edges, nodes]);

  const zajeteWyniki = useMemo(
    () => nodes.map((n) => n.data.kind).filter((k): k is BlockKind => jestWynikiem(k)),
    [nodes],
  );

  const selected = useMemo(() => {
    if (!selectedId) return null;
    const n = nodes.find((x) => x.id === selectedId);
    if (!n) return null;
    return { id: n.id, data: n.data };
  }, [nodes, selectedId]);

  const isValidConnection = useCallback(
    (connection: Connection) => moznaPolaczyc(nodes, edges, connection.source ?? '', connection.target ?? ''),
    [edges, nodes],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection)) return;
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            animated: true,
            interactionWidth: EDGE_HIT_SLOP,
            style: { stroke: 'rgba(30,102,208,0.85)', strokeWidth: 2 },
          },
          eds,
        ),
      );
    },
    [isValidConnection, setEdges],
  );

  const onAddBlock = useCallback(
    (kind: BlockKind) => {
      const def = getBlockDefinition(kind);
      const id = genId('node');
      const inst = rfRef.current;
      const center = inst ? inst.getViewport() : null;
      const x = center ? (-center.x + 360) / center.zoom : 120;
      const y = center ? (-center.y + 220) / center.zoom : 120;

      const node: PipelineRfNode = {
        id,
        type: 'pipelineNode',
        position: { x, y },
        data: def.makeNodeData(),
      };
      setNodes((ns) => [...ns, node]);
      setSelectedId(id);
    },
    [setNodes],
  );

  const onSelectionChange = useCallback((params: { nodes?: Node[] }) => {
    const first = params.nodes?.[0];
    setSelectedId(first ? first.id : null);
  }, []);

  const onChangeNodeData = useCallback(
    (id: string, next: PipelineNodeData) => {
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: next } : n)));
    },
    [setNodes],
  );

  const onDeleteNode = useCallback(
    (id: string) => {
      if (isFixedNodeId(id)) return;
      setNodes((ns) => ns.filter((n) => n.id !== id));
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [setEdges, setNodes],
  );

  const onDisconnectNode = useCallback(
    (id: string) => {
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    },
    [setEdges],
  );

  const onRemoveEdge = useCallback(
    (edgeId: string) => {
      setEdges((es) => es.filter((e) => e.id !== edgeId));
      setCanvasMenu(null);
    },
    [setEdges],
  );

  const onDuplicateNode = useCallback(
    (id: string) => {
      if (isFixedNodeId(id)) return;
      const n = nodes.find((x) => x.id === id);
      if (!n || jestWynikiem(n.data.kind)) return;
      const nextId = genId('node');
      setNodes((ns) => [
        ...ns,
        {
          ...n,
          id: nextId,
          position: { x: n.position.x + 40, y: n.position.y + 40 },
        },
      ]);
      setSelectedId(nextId);
    },
    [nodes, setNodes],
  );

  const onSaveToFile = useCallback(() => {
    const payload = serializePipeline(nodes, edges);
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline.${projectId}.v2.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [edges, nodes, projectId]);

  const onPickFile = useCallback(() => {
    if (!window.confirm('Czy na pewno wczytać pipeline z pliku? Bieżący stan zostanie zastąpiony.')) return;
    fileInputRef.current?.click();
  }, []);

  const onLoadFromFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (!isPipelineFile(parsed)) {
        throw new Error('Niepoprawny plik pipeline (oczekiwano version: 1 albo 2).');
      }

      const graf = grafZZapisu(parsed);
      setNodes(graf.nodes);
      setEdges(graf.edges);
      setSelectedId(null);
      setFileError(null);
    },
    [setEdges, setNodes],
  );

  useEffect(() => {
    let alive = true;

    const fitAfterLoad = () =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (alive) rfRef.current?.fitView({ padding: 0.18 });
        }),
      );

    getProject(projectId)
      .then((r) => {
        if (!alive) return;
        const pip = r.project.pipeline;
        if (pip && isPipelineFile(pip)) {
          const graf = grafZZapisu(pip);
          setNodes(graf.nodes);
          setEdges(graf.edges);
          setRemoteStatus('synced');
          wczytanyProjektRef.current = projectId;
          fitAfterLoad();
          return;
        }

        try {
          const raw = localStorage.getItem(storageKey(projectId));
          if (!raw) {
            setRemoteStatus('idle');
            wczytanyProjektRef.current = projectId;
            return;
          }
          const parsed = JSON.parse(raw) as unknown;
          if (!isPipelineFile(parsed)) {
            setRemoteStatus('idle');
            wczytanyProjektRef.current = projectId;
            return;
          }
          const graf = grafZZapisu(parsed);
          setNodes(graf.nodes);
          setEdges(graf.edges);
          setRemoteStatus('idle');
          wczytanyProjektRef.current = projectId;
          fitAfterLoad();
        } catch {
          setRemoteStatus('idle');
          wczytanyProjektRef.current = projectId;
        }
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setRemoteStatus('error');
        setRemoteError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      alive = false;
    };
  }, [projectId, setEdges, setNodes]);

  useEffect(() => {
    if (wczytanyProjektRef.current !== projectId) return;
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      const payload = serializePipeline(nodes, edges);
      try {
        localStorage.setItem(storageKey(projectId), JSON.stringify(payload));
      } catch (e) {
        console.warn(e);
      }

      patchProject(projectId, { pipeline: payload })
        .then(() => {
          setRemoteStatus('synced');
          setRemoteError(null);
        })
        .catch((e: unknown) => {
          setRemoteStatus('error');
          setRemoteError(e instanceof Error ? e.message : String(e));
        });
    }, 250);

    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [edges, nodes, projectId]);

  const confirmClearConnections = useCallback(() => {
    if (!edges.length) return;
    if (!window.confirm('Czy na pewno usunąć wszystkie połączenia między blokami?')) return;
    setEdges([]);
  }, [edges.length, setEdges]);

  const confirmClearAll = useCallback(() => {
    if (!nodes.length && !edges.length) return;
    if (!window.confirm('Czy na pewno usunąć wszystkie bloki i połączenia? Tej operacji nie cofniesz.')) return;
    setNodes((ns) => ns.filter((n) => isFixedNodeId(n.id)));
    setEdges([]);
    setSelectedId(null);
  }, [edges.length, nodes.length, setEdges, setNodes]);

  return (
    <div
      className={[
        'grid grid-cols-1 gap-0 lg:gap-0',
        inspectorOpen ? 'lg:grid-cols-[340px_1fr_360px]' : 'lg:grid-cols-[340px_1fr_44px]',
      ].join(' ')}
    >
      <PipelinePalette onAddBlock={onAddBlock} zajete={zajeteWyniki} />

      <div
        className={['min-w-0 border border-border bg-surface', inspectorOpen ? 'lg:border-r-0' : ''].join(' ')}
      >
        <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text">Plansza</h2>
            <p className="mt-0.5 truncate text-[11px] text-muted">
              <span className="text-text">Wstępne:</span> {sciezka.wstepne.join(' › ')}
              {sciezka.doStft ? '' : ' (nie dochodzi do Spektrogramu)'}
              {' · '}
              <span className="text-text">Wyniki:</span> {sciezka.wyniki.length ? sciezka.wyniki.join(', ') : 'brak'}
              {sciezka.maKrzywa ? '' : ' (brak Krzywej ERD)'}
              {sciezka.poza > 0 ? ` · ${sciezka.poza} ${sciezka.poza === 1 ? 'blok niepodłączony' : 'bloki niepodłączone'}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSaveToFile}
              className="border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-bg"
            >
              Eksport
            </button>
            <button
              type="button"
              onClick={onPickFile}
              className="border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-bg"
            >
              Import
            </button>
            <button
              type="button"
              onClick={confirmClearConnections}
              className="border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-bg"
            >
              Wyczyść połączenia
            </button>
            <button
              type="button"
              onClick={confirmClearAll}
              className="border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-bg"
            >
              Wyczyść wszystko
            </button>
          </div>
        </div>

        <div className="relative h-[680px] border-t border-border">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              onInit={(inst) => (rfRef.current = inst)}
              onSelectionChange={onSelectionChange}
              onPaneClick={() => setCanvasMenu(null)}
              onNodeContextMenu={(event, node) => {
                event.preventDefault();
                setSelectedId(node.id);
                setCanvasMenu({ kind: 'node', x: event.clientX, y: event.clientY, nodeId: node.id });
              }}
              onEdgeContextMenu={(event, edge) => {
                event.preventDefault();
                setCanvasMenu({
                  kind: 'edge',
                  x: event.clientX,
                  y: event.clientY,
                  edgeId: edge.id,
                });
              }}
              deleteKeyCode={['Backspace', 'Delete']}
              fitView
              fitViewOptions={{ padding: 0.18 }}
              defaultEdgeOptions={{
                animated: true,
                interactionWidth: EDGE_HIT_SLOP,
                style: { stroke: 'rgba(30,102,208,0.85)', strokeWidth: 2 },
              }}
            >
              <Background gap={18} color="rgba(215,224,234,0.9)" />
              <Controls />
              <MiniMap
                pannable
                zoomable
                nodeColor={(n) => {
                  const d = n.data as PipelineNodeData | undefined;
                  if (!d) return '#9fb2c6';
                  if (d.kind === 'stft') return '#1e66d0';
                  if (jestWstepnym(d.kind)) return '#027a48';
                  if (jestWynikiem(d.kind)) return '#c11574';
                  return '#9fb2c6';
                }}
              />
            </ReactFlow>

          {canvasMenu?.kind === 'node' ? (
            <ContextMenu
              x={canvasMenu.x}
              y={canvasMenu.y}
              title="Akcje"
              onClose={() => setCanvasMenu(null)}
            >
              {jestWstepnym(rodzajWezla(nodes, canvasMenu.nodeId) ?? 'start') ? (
                <ContextMenuItem
                  onClick={() => {
                    onDuplicateNode(canvasMenu.nodeId);
                    setCanvasMenu(null);
                  }}
                >
                  Duplikuj blok
                </ContextMenuItem>
              ) : null}
              <ContextMenuItem
                onClick={() => {
                  if (!window.confirm('Czy na pewno usunąć połączenia tego bloku?')) return;
                  onDisconnectNode(canvasMenu.nodeId);
                  setCanvasMenu(null);
                }}
              >
                Usuń połączenia bloku
              </ContextMenuItem>
              {!isFixedNodeId(canvasMenu.nodeId) ? (
                <>
                  <div className="my-1 h-px bg-border" />
                  <ContextMenuItem
                    danger
                    onClick={() => {
                      if (!window.confirm('Czy na pewno usunąć ten blok?')) return;
                      onDeleteNode(canvasMenu.nodeId);
                      setCanvasMenu(null);
                    }}
                  >
                    Usuń blok
                  </ContextMenuItem>
                </>
              ) : null}
            </ContextMenu>
          ) : null}
          {canvasMenu?.kind === 'edge' ? (
            <ContextMenu
              x={canvasMenu.x}
              y={canvasMenu.y}
              title="Połączenie"
              onClose={() => setCanvasMenu(null)}
            >
              <ContextMenuItem
                onClick={() => {
                  onRemoveEdge(canvasMenu.edgeId);
                }}
              >
                Usuń to połączenie
              </ContextMenuItem>
            </ContextMenu>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface px-4 py-2 text-xs text-muted">
          <div>
            Sync:{' '}
            <span className="text-text">
              {remoteStatus === 'loading'
                ? 'ładowanie…'
                : remoteStatus === 'synced'
                  ? 'zapisano w bazie'
                  : remoteStatus === 'error'
                    ? 'błąd zapisu'
                    : 'brak'}
            </span>
            {remoteError ? <span className="ml-2 text-danger">{remoteError}</span> : null}
            {fileError ? <span className="ml-2 text-danger">{fileError}</span> : null}
          </div>
          <div>
            PPM na blok lub na linię &middot; Zaznacz linię i naciśnij Delete / Backspace &middot; Przeciągnij port:
            nowe połączenie
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          onLoadFromFile(f).catch((err) => setFileError(err instanceof Error ? err.message : String(err)));
          e.currentTarget.value = '';
        }}
      />

      {inspectorOpen ? (
        <PipelineInspector
          selected={selected}
          onChange={onChangeNodeData}
          onCollapse={() => setInspectorOpen(false)}
        />
      ) : (
        <div className="flex min-h-[48px] flex-col border border-border bg-surface lg:min-h-0 lg:border-l-0">
          <button
            type="button"
            onClick={() => setInspectorOpen(true)}
            className="flex w-full flex-1 items-center justify-center px-2 py-3 text-xs font-semibold text-muted hover:bg-bg hover:text-text lg:min-h-[calc(680px+52px+41px)] lg:[writing-mode:vertical-rl] lg:py-6"
          >
            Parametry
          </button>
        </div>
      )}
    </div>
  );
}

