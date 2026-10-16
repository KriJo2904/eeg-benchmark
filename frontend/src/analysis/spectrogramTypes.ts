export type DaneSpektrogramu = {
  macierz: number[][];
  osCzasu: number[];
  osCzestotliwosci: number[];
  nazwaKanalu: string;
  minMoc: number;
  maxMoc: number;
};

export type RodzajMapy = 'moc' | 'erd';
