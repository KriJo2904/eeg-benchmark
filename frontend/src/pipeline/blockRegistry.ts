import type { BlockKind, PipelineNodeData } from './types';

export type BlockCategoryId = 'processing' | 'analysis';

export const BLOCK_CATEGORY_LABEL: Record<BlockCategoryId, string> = {
  processing: 'Obróbka',
  analysis: 'Analiza',
};

export type BlockDefinition = {
  kind: BlockKind;
  category: BlockCategoryId;
  title: string;
  subtitle: string;
  badge: string;
  makeNodeData: () => PipelineNodeData;
};

export const BLOCKS: Array<BlockDefinition> = [
  {
    kind: 'lowpass',
    category: 'processing',
    title: 'Filtr dolnoprzepustowy',
    subtitle: 'Średnia ruchoma na próbkach. Tłumi szybkie drgania powyżej podanej częstotliwości',
    badge: 'Filter',
    makeNodeData: () => ({
      kind: 'lowpass',
      label: 'Low-pass',
      params: { cutoffHz: 30, order: 4 },
    }),
  },
  {
    kind: 'fft',
    category: 'processing',
    title: 'Transformacja Fouriera',
    subtitle: 'STFT: sygnał cięty na nakładające się okna, z każdego liczona moc w prążkach częstotliwości',
    badge: 'FFT',
    makeNodeData: () => ({
      kind: 'fft',
      label: 'FFT',
      params: { windowSize: 128, overlap: 0.9 },
    }),
  },
  {
    kind: 'normalize',
    category: 'processing',
    title: 'Normalizacja',
    subtitle: 'Sprowadza każdy kanał do wspólnej skali (z-score albo 0–1)',
    badge: 'Prep',
    makeNodeData: () => ({
      kind: 'normalize',
      label: 'Normalize',
      params: { method: 'zscore' },
    }),
  },
  {
    kind: 'spektrogram',
    category: 'analysis',
    title: 'Spektrogram',
    subtitle: 'Sam nic nie liczy. Włącza mapę czas × częstotliwość w Wynikach i mówi, jaki zakres Hz pokazać',
    badge: 'STFT',
    makeNodeData: () => ({
      kind: 'spektrogram',
      label: 'Spektrogram',
      params: { fMin: 4, fMax: 40 },
    }),
  },
  {
    kind: 'band_power',
    category: 'analysis',
    title: 'Moc pasma w czasie',
    subtitle: 'Z macierzy STFT zostawia jedną linię: średnią moc wybranego pasma w kolejnych oknach',
    badge: 'BP',
    makeNodeData: () => ({
      kind: 'band_power',
      label: 'Moc pasma',
      params: { fMin: 8, fMax: 13, agg: 'mean' },
    }),
  },
];

export function getBlockDefinition(kind: BlockKind) {
  const def = BLOCKS.find((b) => b.kind === kind);
  if (!def) throw new Error(`Unknown block kind: ${kind}`);
  return def;
}
