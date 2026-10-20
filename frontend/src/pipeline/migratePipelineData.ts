import type { PipelineNodeData } from './types';

type StarePasmo = { kind?: string; presetId?: string; fMin?: number; fMax?: number };

const STARE_PRESETY: Record<string, [number, number]> = {
  delta: [0.5, 4],
  theta: [4, 8],
  alpha: [8, 13],
  mu: [8, 13],
  beta: [13, 30],
  gamma: [30, 45],
};

function zakresZeStarychPasm(bands: StarePasmo[]): { fMin: number; fMax: number } {
  let lo = Infinity;
  let hi = -Infinity;
  for (const b of bands) {
    const [a, c] = b.kind === 'preset' ? (STARE_PRESETY[b.presetId ?? ''] ?? [NaN, NaN]) : [Number(b.fMin), Number(b.fMax)];
    if (!Number.isFinite(a) || !Number.isFinite(c) || c <= a) continue;
    lo = Math.min(lo, a);
    hi = Math.max(hi, c);
  }
  return Number.isFinite(lo) ? { fMin: lo, fMax: hi } : { fMin: 4, fMax: 40 };
}

export function migratePipelineNodeData(data: PipelineNodeData): PipelineNodeData {
  if (data.kind === 'band_power') {
    const p = data.params as { fMin?: unknown; fMax?: unknown; agg?: unknown } | undefined;
    const fMinN = Number(p?.fMin);
    const fMaxN = Number(p?.fMax);
    const lo = Number.isFinite(fMinN) ? fMinN : 8;
    const hi = Number.isFinite(fMaxN) ? fMaxN : 13;
    const agg = p?.agg === 'sum' ? 'sum' : 'mean';
    return {
      ...data,
      params: { fMin: Math.min(lo, hi), fMax: Math.max(lo, hi), agg },
    };
  }
  if (data.kind !== 'spektrogram') return data;

  const p = data.params as { fMin?: unknown; fMax?: unknown; bands?: unknown } | undefined;
  if (Array.isArray(p?.bands)) return { ...data, params: zakresZeStarychPasm(p.bands as StarePasmo[]) };

  const lo = Number(p?.fMin);
  const hi = Number(p?.fMax);
  if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo) return { ...data, params: { fMin: lo, fMax: hi } };
  return { ...data, params: { fMin: 4, fMax: 40 } };
}

export function migrateLoadedPipelineNodes<T extends { data: PipelineNodeData }>(
  nodes: T[],
): T[] {
  return nodes.map((n) => ({ ...n, data: migratePipelineNodeData(n.data) }));
}

export function stripLegacyChannelSelect<
  N extends { id: string; data: PipelineNodeData | { kind: string } },
  E extends { id?: string; source: string; target: string },
>(nodes: N[], edges: E[]): { nodes: N[]; edges: E[] } {
  const removed = new Set<string>();
  const kept: N[] = [];
  for (const n of nodes) {
    if ((n.data as { kind: string }).kind === 'channel_select') removed.add(n.id);
    else kept.push(n);
  }
  if (removed.size === 0) return { nodes: kept, edges };

  const bypass: E[] = [];
  for (const x of removed) {
    const incoming = edges.filter((e) => e.target === x).map((e) => e.source);
    const outgoing = edges.filter((e) => e.source === x).map((e) => e.target);
    for (const a of incoming) {
      for (const b of outgoing) {
        if (removed.has(a) || removed.has(b)) continue;
        bypass.push({ source: a, target: b } as E);
      }
    }
  }

  const keptEdges = edges.filter((e) => !removed.has(e.source) && !removed.has(e.target));
  const seen = new Set<string>();
  const finalEdges: E[] = [];
  for (const e of [...keptEdges, ...bypass]) {
    const key = `${e.source}→${e.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    finalEdges.push(e);
  }
  return { nodes: kept, edges: finalEdges };
}
