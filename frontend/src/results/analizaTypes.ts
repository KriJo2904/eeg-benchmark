export type KrzyweErd = Record<string, number[]>;

export type WynikZdarzenia = {
  erd: KrzyweErd;
  epochs: number;
  subjects?: number;
};

export type WynikZadania = Record<string, WynikZdarzenia>;

export type OpisZadania = {
  id: string;
  name: string;
  events: Array<{ code: string; name: string }>;
};

export type CzasBloku = { kind: string; label: string; ms: number };

export type StatystykiAnalizy = {
  recordsTotal: number;
  recordsUsed: number;
  skipped: string[];
  epochs: number;
  threads: number;
  totalMs: number;
  blocks: CzasBloku[];
};

export type PodsumowanieAnalizy = {
  channels: string[];
  time: number[];
  freq: number[];
  band: { fMin: number; fMax: number };
  hasMap: boolean;
  tasks: OpisZadania[];
  subjects: string[];
  average: Record<string, WynikZadania>;
  stats: StatystykiAnalizy;
};

export type WynikBadanego = Record<string, WynikZadania>;

export type MapaErd = { epochs: number; data: Record<string, number[][]> };
