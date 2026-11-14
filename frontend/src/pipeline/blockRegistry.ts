import type { BlockKind, Etap, PipelineNodeData, Zakres } from './types';

export type BlockDefinition = {
  kind: BlockKind;
  etap: Etap;
  title: string;
  subtitle: string;
  makeNodeData: () => PipelineNodeData;
};

export const DOMYSLNE_PASMO_ERD: Zakres = { fMin: 8, fMax: 13 };
export const DOMYSLNY_ZAKRES_MAPY: Zakres = { fMin: 4, fMax: 40 };

export const BLOCKS: Array<BlockDefinition> = [
  {
    kind: 'lowpass',
    etap: 'wstepne',
    title: 'Filtr dolnoprzepustowy',
    subtitle: 'Średnia ruchoma na próbkach. Tłumi szybkie drgania powyżej podanej częstotliwości',
    makeNodeData: () => ({
      kind: 'lowpass',
      label: 'Filtr',
      params: { cutoffHz: 30, order: 4 },
    }),
  },
  {
    kind: 'normalize',
    etap: 'wstepne',
    title: 'Normalizacja',
    subtitle: 'Sprowadza każdy kanał do wspólnej skali (z-score albo 0–1)',
    makeNodeData: () => ({
      kind: 'normalize',
      label: 'Normalizacja',
      params: { method: 'zscore' },
    }),
  },
  {
    kind: 'krzywa_erd',
    etap: 'wyniki',
    title: 'Krzywa ERD',
    subtitle: 'Średnia moc pasma ze spektrogramu w kolejnych oknach, w Wynikach jako ERD % w czasie',
    makeNodeData: () => ({
      kind: 'krzywa_erd',
      label: 'Krzywa ERD',
      params: { ...DOMYSLNE_PASMO_ERD },
    }),
  },
  {
    kind: 'mapa_erd',
    etap: 'wyniki',
    title: 'Mapa ERD',
    subtitle: 'Wycinek spektrogramu w zakresie Hz, w Wynikach jako mapa czas × częstotliwość',
    makeNodeData: () => ({
      kind: 'mapa_erd',
      label: 'Mapa ERD',
      params: { ...DOMYSLNY_ZAKRES_MAPY },
    }),
  },
];

export function getBlockDefinition(kind: BlockKind) {
  const def = BLOCKS.find((b) => b.kind === kind);
  if (!def) throw new Error(`Unknown block kind: ${kind}`);
  return def;
}

export function jestWynikiem(kind: PipelineNodeData['kind']): boolean {
  return kind === 'krzywa_erd' || kind === 'mapa_erd';
}

export function jestWstepnym(kind: PipelineNodeData['kind']): boolean {
  return kind === 'lowpass' || kind === 'normalize';
}
