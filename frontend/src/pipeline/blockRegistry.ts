import type { BlockKind, PipelineNodeData } from './types';

export type BlockDefinition = {
  kind: BlockKind;
  title: string;
  subtitle: string;
  badge: string;
  makeNodeData: () => PipelineNodeData;
};

export const BLOCKS: Array<BlockDefinition> = [
  {
    kind: 'lowpass',
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
    title: 'Normalizacja',
    subtitle: 'Sprowadza każdy kanał do wspólnej skali (z-score albo 0–1)',
    badge: 'Prep',
    makeNodeData: () => ({
      kind: 'normalize',
      label: 'Normalize',
      params: { method: 'zscore' },
    }),
  },
];

export function getBlockDefinition(kind: BlockKind) {
  const def = BLOCKS.find((b) => b.kind === kind);
  if (!def) throw new Error(`Unknown block kind: ${kind}`);
  return def;
}
