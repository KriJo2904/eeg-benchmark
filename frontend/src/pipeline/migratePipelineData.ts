import { DOMYSLNE_PASMO_ERD, DOMYSLNY_ZAKRES_MAPY } from './blockRegistry';
import type { PipelineNodeData, Zakres } from './types';

export type ZapisanyWezel = {
  id: string;
  position: { x: number; y: number };
  data: { kind: string; label?: string; params?: unknown };
};

export type ZapisanaKrawedz = { id?: string; source: string; target: string };

type StarePasmo = { kind?: string; presetId?: string; fMin?: number; fMax?: number };

const STARE_PRESETY: Record<string, [number, number]> = {
  delta: [0.5, 4],
  theta: [4, 8],
  alpha: [8, 13],
  mu: [8, 13],
  beta: [13, 30],
  gamma: [30, 45],
};

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

export const STFT_ID = 'stft';

export function jestStarymZapisem(nodes: ZapisanyWezel[]): boolean {
  return !nodes.some((n) => ['stft', 'krzywa_erd', 'mapa_erd'].includes(n.data.kind));
}

function lancuchOdStartu(edges: ZapisanaKrawedz[]): string[] {
  const lancuch = ['start'];
  const odwiedzone = new Set(lancuch);
  let biezacy = 'start';
  while (true) {
    const dalej = edges.find((e) => e.source === biezacy);
    if (!dalej || odwiedzone.has(dalej.target)) break;
    lancuch.push(dalej.target);
    odwiedzone.add(dalej.target);
    biezacy = dalej.target;
  }
  return lancuch;
}

export function nowyZapisZeStarego(
  nodes: ZapisanyWezel[],
  edges: ZapisanaKrawedz[],
  analysis?: { band?: unknown; map?: unknown },
): { nodes: ZapisanyWezel[]; edges: ZapisanaKrawedz[] } {
  let pasmo = DOMYSLNE_PASMO_ERD;
  let mapa = DOMYSLNY_ZAKRES_MAPY;
  for (const n of nodes) {
    if (n.data.kind === 'band_power') pasmo = zakresZParametrow(n.data.params, pasmo);
    if (n.data.kind === 'spektrogram') mapa = zakresZParametrow(n.data.params, mapa);
  }
  if (analysis?.band) pasmo = zakresZParametrow(analysis.band, pasmo);
  if (analysis?.map) mapa = zakresZParametrow(analysis.map, mapa);

  const poId = new Map(nodes.map((n) => [n.id, n]));
  const start = poId.get('start') ?? { id: 'start', position: { x: 80, y: 240 }, data: { kind: 'start', label: 'Start' } };
  const wynik: ZapisanyWezel[] = [start];
  const krawedzie: ZapisanaKrawedz[] = [];
  let poprzedni = start;
  let stft: ZapisanyWezel | null = null;

  for (const id of lancuchOdStartu(edges).slice(1)) {
    const n = poId.get(id);
    if (!n) continue;
    if (n.data.kind === 'lowpass' || n.data.kind === 'normalize') {
      wynik.push(n);
      krawedzie.push({ source: poprzedni.id, target: n.id });
      poprzedni = n;
    } else if (n.data.kind === 'fft') {
      stft = { id: STFT_ID, position: n.position, data: { kind: 'stft', label: 'Spektrogram', params: n.data.params } };
      break;
    }
  }

  for (const n of nodes) {
    const wstepny = n.data.kind === 'lowpass' || n.data.kind === 'normalize';
    if (wstepny && !wynik.includes(n)) wynik.push(n);
  }

  if (!stft) {
    stft = {
      id: STFT_ID,
      position: { x: poprzedni.position.x + 300, y: poprzedni.position.y },
      data: { kind: 'stft', label: 'Spektrogram', params: { windowSize: 128, overlap: 0.9 } },
    };
  }
  krawedzie.push({ source: poprzedni.id, target: STFT_ID });

  const { x, y } = stft.position;
  const erd: PipelineNodeData = { kind: 'krzywa_erd', label: 'Krzywa ERD', params: pasmo };
  const mapaErd: PipelineNodeData = { kind: 'mapa_erd', label: 'Mapa ERD', params: mapa };
  wynik.push(
    stft,
    { id: 'erd', position: { x: x + 320, y: y - 90 }, data: erd },
    { id: 'mapa', position: { x: x + 320, y: y + 90 }, data: mapaErd },
  );
  krawedzie.push({ source: STFT_ID, target: 'erd' }, { source: STFT_ID, target: 'mapa' });

  return { nodes: wynik, edges: krawedzie };
}
