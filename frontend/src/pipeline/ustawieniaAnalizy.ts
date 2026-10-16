export type Zakres = { fMin: number; fMax: number };

export type UstawieniaAnalizy = { band: Zakres; map: Zakres };

export const DOMYSLNE_USTAWIENIA: UstawieniaAnalizy = {
  band: { fMin: 8, fMax: 13 },
  map: { fMin: 4, fMax: 40 },
};
