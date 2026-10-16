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
import { getBlockDefinition } from './blockRegistry';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { USUNIETE_BLOKI, usunBloki, ustawieniaZeStarychBlokow } from './migratePipelineData';
import { PipelineInspector } from './PipelineInspector';
import { PipelineNode } from './PipelineNode';
import { PipelinePalette } from './PipelinePalette';
import { PanelUstawienAnalizy } from './PanelUstawienAnalizy';
import { DOMYSLNE_USTAWIENIA, type UstawieniaAnalizy } from './ustawieniaAnalizy';
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
const FIXED_END_ID = 'end';
function isFixedNodeId(id: string) {
  return id === FIXED_START_ID || id === FIXED_END_ID;
}

const nodeTypes = { pipelineNode: PipelineNode };
function storageKey(projectId: string) {
  return `project.${projectId}.pipeline.v1.autosave`;
}

type PipelineFileV1 = {
  version: 1;
  nodes: Array<{
    id: string;
    position: { x: number; y: number };
    data: PipelineNodeData;
  }>;
  edges: Array<{
    id?: string;
    source: string;
    target: string;
  }>;
  analysis?: UstawieniaAnalizy;
};

function serializePipeline(nodes: PipelineRfNode[], edges: Edge[], ustawienia: UstawieniaAnalizy): PipelineFileV1 {
  return {
    version: 1,
    analysis: ustawienia,
    nodes: nodes.map((n) => ({
      id: n.id,
      position: { x: n.position.x, y: n.position.y },
      data: n.data,
    })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}

function isPipelineFileV1(x: unknown): x is PipelineFileV1 {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (o.version !== 1) return false;
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

const DOMYSLNE_BLOKI: Array<{ id: string; kind: BlockKind }> = [
  { id: 'n1', kind: 'fft' },
];

const initialNodes: PipelineRfNode[] = [
  { id: FIXED_START_ID, type: 'pipelineNode', position: { x: 80, y: 240 }, data: { kind: 'start', label: 'Start' } },
  ...DOMYSLNE_BLOKI.map((b, i) => ({
    id: b.id,
    type: 'pipelineNode',
    position: { x: 320 + i * 240, y: 240 },
    data: getBlockDefinition(b.kind).makeNodeData(),
  })),
  { id: FIXED_END_ID, type: 'pipelineNode', position: { x: 320 + DOMYSLNE_BLOKI.length * 240, y: 240 }, data: { kind: 'end', label: 'Koniec' } },
];

const kolejnosc = [FIXED_START_ID, ...DOMYSLNE_BLOKI.map((b) => b.id), FIXED_END_ID];
const initialEdges: Edge[] = kolejnosc.slice(1).map((id, i) =>
  makePipelineEdge({ id: `e${i + 1}`, source: kolejnosc[i], target: id }),
);

function ensureFixedNodes(nextNodes: PipelineRfNode[], nextEdges: Edge[]) {
  const hasStart = nextNodes.some((n) => n.id === FIXED_START_ID);
  const hasEnd = nextNodes.some((n) => n.id === FIXED_END_ID);

  const outNodes = [...nextNodes];
  if (!hasStart) {
    outNodes.unshift({
      id: FIXED_START_ID,
      type: 'pipelineNode',
      position: { x: 80, y: 240 },
      data: { kind: 'start', label: 'Start' },
    });
  }
  if (!hasEnd) {
    outNodes.push({
      id: FIXED_END_ID,
      type: 'pipelineNode',
      position: { x: 820, y: 240 },
      data: { kind: 'end', label: 'Koniec' },
    });
  }

  const uzyteZrodla = new Set<string>();
  const uzyteCele = new Set<string>();
  const outEdges: Edge[] = [];
  for (const e of nextEdges) {
    if (e.target === FIXED_START_ID || e.source === FIXED_END_ID) continue;
    if (uzyteZrodla.has(e.source) || uzyteCele.has(e.target)) continue;
    uzyteZrodla.add(e.source);
    uzyteCele.add(e.target);
    outEdges.push(e);
  }

  return { nodes: outNodes, edges: outEdges };
}

function sciezkaOdStartu(edges: Edge[]): string[] {
  const sciezka = [FIXED_START_ID];
  const odwiedzone = new Set(sciezka);
  let biezacy = FIXED_START_ID;
  while (true) {
    const dalej = edges.find((e) => e.source === biezacy);
    if (!dalej || odwiedzone.has(dalej.target)) break;
    sciezka.push(dalej.target);
    odwiedzone.add(dalej.target);
    biezacy = dalej.target;
  }
  return sciezka;
}

function grafZZapisu(file: PipelineFileV1): {
  nodes: PipelineRfNode[];
  edges: Edge[];
  ustawienia: UstawieniaAnalizy;
} {
  const ustawienia = file.analysis ?? ustawieniaZeStarychBlokow(file.nodes);
  const stripped = usunBloki(
    file.nodes.map((n) => ({ id: n.id, position: n.position, data: n.data })),
    file.edges,
    USUNIETE_BLOKI,
  );
  const nodes: PipelineRfNode[] = stripped.nodes.map((n) => ({
    id: n.id,
    type: 'pipelineNode',
    position: n.position,
    data: n.data,
  }));
  return { ...ensureFixedNodes(nodes, stripped.edges.map(makePipelineEdge)), ustawienia };
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
  const [ustawienia, setUstawienia] = useState<UstawieniaAnalizy>(DOMYSLNE_USTAWIENIA);
  const [canvasMenu, setCanvasMenu] = useState<PipelineCanvasMenu | null>(null);

  const sciezka = useMemo(() => {
    const ids = sciezkaOdStartu(edges);
    const etykiety = ids.map((id) => nodes.find((n) => n.id === id)?.data.label ?? id);
    const doKonca = ids[ids.length - 1] === FIXED_END_ID;
    const poza = nodes.filter((n) => !isFixedNodeId(n.id) && !ids.includes(n.id)).length;
    return { etykiety, doKonca, poza };
  }, [edges, nodes]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    const n = nodes.find((x) => x.id === selectedId);
    if (!n) return null;
    return { id: n.id, data: n.data };
  }, [nodes, selectedId]);

  const isValidConnection = useCallback(
    (connection: Connection) => {
      const { source, target } = connection;
      if (!source || !target || source === target) return false;
      if (edges.some((e) => e.source === source)) return false;
      if (edges.some((e) => e.target === target)) return false;

      let biezacy: string | undefined = target;
      while (biezacy) {
        if (biezacy === source) return false;
        biezacy = edges.find((e) => e.source === biezacy)?.target;
      }
      return true;
    },
    [edges],
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
      if (!n) return;
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
    const payload = serializePipeline(nodes, edges, ustawienia);
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline.${projectId}.v1.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [edges, nodes, projectId, ustawienia]);

  const onPickFile = useCallback(() => {
    if (!window.confirm('Czy na pewno wczytać pipeline z pliku? Bieżący stan zostanie zastąpiony.')) return;
    fileInputRef.current?.click();
  }, []);

  const onLoadFromFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (!isPipelineFileV1(parsed)) {
        throw new Error('Niepoprawny plik pipeline (oczekiwano version: 1).');
      }

      const graf = grafZZapisu(parsed);
      setNodes(graf.nodes);
      setUstawienia(graf.ustawienia);
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
        if (pip && isPipelineFileV1(pip)) {
          const graf = grafZZapisu(pip);
          setNodes(graf.nodes);
          setUstawienia(graf.ustawienia);
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
          if (!isPipelineFileV1(parsed)) {
            setRemoteStatus('idle');
            wczytanyProjektRef.current = projectId;
            return;
          }
          const graf = grafZZapisu(parsed);
          setNodes(graf.nodes);
          setUstawienia(graf.ustawienia);
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
      const payload = serializePipeline(nodes, edges, ustawienia);
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
  }, [edges, nodes, projectId, ustawienia]);

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
      <div className="space-y-4">
        <PipelinePalette onAddBlock={onAddBlock} />
        <PanelUstawienAnalizy ustawienia={ustawienia} onChange={setUstawienia} />
      </div>

      <div
        className={['min-w-0 border border-border bg-surface', inspectorOpen ? 'lg:border-r-0' : ''].join(' ')}
      >
        <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text">Plansza</h2>
            <p className="mt-0.5 truncate text-[11px] text-muted">
              {sciezka.etykiety.join(' › ')}
              {sciezka.doKonca ? '' : ' (nie dochodzi do Koniec)'}
              {sciezka.poza > 0 ? ` · ${sciezka.poza} ${sciezka.poza === 1 ? 'blok poza ścieżką' : 'bloki poza ścieżką'}` : ''}
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
                  if (d.kind === 'fft') return '#1e66d0';
                  if (d.kind === 'lowpass') return '#027a48';
                  if (d.kind === 'normalize') return '#c11574';
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
              <ContextMenuItem
                onClick={() => {
                  onDuplicateNode(canvasMenu.nodeId);
                  setCanvasMenu(null);
                }}
              >
                Duplikuj blok
              </ContextMenuItem>
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
                    : '—'}
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

