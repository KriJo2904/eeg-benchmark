import { DOMYSLNE_USTAWIENIA, type UstawieniaAnalizy, type Zakres } from './ustawieniaAnalizy';

type StarePasmo = { kind?: string; presetId?: string; fMin?: number; fMax?: number };

const STARE_PRESETY: Record<string, [number, number]> = {
  delta: [0.5, 4],
  theta: [4, 8],
  alpha: [8, 13],
  mu: [8, 13],
  beta: [13, 30],
  gamma: [30, 45],
};

export const USUNIETE_BLOKI = ['channel_select', 'spektrogram', 'band_power'];

function zakresZeStarychPasm(bands: StarePasmo[], domyslny: Zakres): Zakres {
  let lo = Infinity;
  let hi = -Infinity;
  for (const b of bands) {
    const [a, c] = b.kind === 'preset' ? (STARE_PRESETY[b.presetId ?? ''] ?? [NaN, NaN]) : [Number(b.fMin), Number(b.fMax)];
    if (!Number.isFinite(a) || !Number.isFinite(c) || c <= a) continue;
    lo = Math.min(lo, a);
    hi = Math.max(hi, c);
  }
  return Number.isFinite(lo) ? { fMin: lo, fMax: hi } : domyslny;
}

function zakresZParametrow(params: unknown, domyslny: Zakres): Zakres {
  const p = params as { fMin?: unknown; fMax?: unknown; bands?: unknown } | undefined;
  if (Array.isArray(p?.bands)) return zakresZeStarychPasm(p.bands as StarePasmo[], domyslny);
  const lo = Number(p?.fMin);
  const hi = Number(p?.fMax);
  if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo) return { fMin: lo, fMax: hi };
  return domyslny;
}

export function ustawieniaZeStarychBlokow(nodes: Array<{ data: { kind: string } }>): UstawieniaAnalizy {
  const wynik = { ...DOMYSLNE_USTAWIENIA };
  for (const n of nodes) {
    const params = (n.data as { params?: unknown }).params;
    if (n.data.kind === 'band_power') wynik.band = zakresZParametrow(params, DOMYSLNE_USTAWIENIA.band);
    if (n.data.kind === 'spektrogram') wynik.map = zakresZParametrow(params, DOMYSLNE_USTAWIENIA.map);
  }
  return wynik;
}

export function usunBloki<
  N extends { id: string; data: { kind: string } },
  E extends { id?: string; source: string; target: string },
>(nodes: N[], edges: E[], rodzaje: string[]): { nodes: N[]; edges: E[] } {
  const removed = new Set<string>();
  const kept: N[] = [];
  for (const n of nodes) {
    if (rodzaje.includes(n.data.kind)) removed.add(n.id);
    else kept.push(n);
  }
  if (removed.size === 0) return { nodes: kept, edges };

  let wynik = edges;
  for (const x of removed) {
    const incoming = wynik.filter((e) => e.target === x).map((e) => e.source);
    const outgoing = wynik.filter((e) => e.source === x).map((e) => e.target);
    const bypass: E[] = [];
    for (const a of incoming) {
      for (const b of outgoing) bypass.push({ source: a, target: b } as E);
    }
    wynik = [...wynik.filter((e) => e.source !== x && e.target !== x), ...bypass];
  }

  const seen = new Set<string>();
  const finalEdges: E[] = [];
  for (const e of wynik) {
    const key = `${e.source}→${e.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    finalEdges.push(e);
  }
  return { nodes: kept, edges: finalEdges };
}
