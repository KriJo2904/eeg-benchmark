const VIRIDIS: [number, number, number][] = [
  [68, 1, 84],    [72, 20, 103],  [72, 38, 119],  [69, 55, 129],
  [63, 71, 136],  [56, 85, 140],  [49, 99, 141],  [43, 112, 142],
  [37, 124, 140], [33, 137, 137], [30, 149, 132], [33, 161, 125],
  [43, 173, 112], [65, 183, 96],  [94, 192, 76],  [128, 200, 55],
  [163, 205, 39], [199, 208, 31], [232, 210, 33], [253, 220, 50],
  [253, 231, 37], [247, 241, 49], [237, 248, 69], [224, 252, 96],
  [210, 254, 125],[196, 254, 153],[183, 252, 178],[173, 249, 199],
  [165, 244, 216],[163, 239, 228],[167, 234, 236],[253, 231, 37],
];

function interpolujKolor(t: number): [number, number, number] {
  const n = VIRIDIS.length - 1;
  const pozycja = Math.max(0, Math.min(1, t)) * n;
  const dolny = Math.floor(pozycja);
  const gorny = Math.min(dolny + 1, n);
  const waga = pozycja - dolny;
  return [
    Math.round(VIRIDIS[dolny][0] + waga * (VIRIDIS[gorny][0] - VIRIDIS[dolny][0])),
    Math.round(VIRIDIS[dolny][1] + waga * (VIRIDIS[gorny][1] - VIRIDIS[dolny][1])),
    Math.round(VIRIDIS[dolny][2] + waga * (VIRIDIS[gorny][2] - VIRIDIS[dolny][2])),
  ];
}

export function zbudujTabliceKolorow(iloscKrokow: number): Uint8ClampedArray {
  const tablica = new Uint8ClampedArray(iloscKrokow * 3);
  for (let i = 0; i < iloscKrokow; i++) {
    const [r, g, b] = interpolujKolor(i / (iloscKrokow - 1));
    tablica[i * 3] = r;
    tablica[i * 3 + 1] = g;
    tablica[i * 3 + 2] = b;
  }
  return tablica;
}

export function zbudujTabliceRozbiezna(iloscKrokow: number): Uint8ClampedArray {
  const niebieski = [33, 102, 172];
  const bialy = [247, 247, 247];
  const czerwony = [178, 24, 43];
  const tablica = new Uint8ClampedArray(iloscKrokow * 3);
  for (let i = 0; i < iloscKrokow; i++) {
    const t = i / (iloscKrokow - 1);
    const [od, doo, w] = t < 0.5 ? [niebieski, bialy, t * 2] : [bialy, czerwony, (t - 0.5) * 2];
    for (let k = 0; k < 3; k++) tablica[i * 3 + k] = Math.round(od[k] + w * (doo[k] - od[k]));
  }
  return tablica;
}
