export type ElectrodePosition = {
  label: string;
  x: number;
  y: number;
};

const ROW_Y: Record<string, number> = {
  FP: 0.94,
  AF: 0.75,
  F: 0.55,
  FT: 0.32,
  FC: 0.3,
  T: 0.0,
  C: 0.0,
  TP: -0.32,
  CP: -0.3,
  P: -0.55,
  PO: -0.75,
  O: -0.94,
  I: -1.0,
};

const COL_MAG: Record<number, number> = {
  0: 0.0,
  1: 0.15,
  2: 0.35,
  3: 0.55,
  4: 0.75,
  5: 0.95,
};

function parseLabel(label: string): { row: string; colNum: number; side: 'L' | 'R' | 'C' } | null {
  const norm = label.replace(/[.\s]/g, '').toUpperCase();
  const m = norm.match(/^([A-Z]{1,2})(Z|\d{1,2})$/);
  if (!m) return null;
  const rowRaw = m[1];
  const tail = m[2];

  const row = rowRaw in ROW_Y ? rowRaw : null;
  if (!row) return null;

  if (tail === 'Z') return { row, colNum: 0, side: 'C' };
  const n = Number(tail);
  if (!Number.isFinite(n)) return null;
  const magIdx = Math.min(5, Math.ceil(n / 2));
  return { row, colNum: magIdx, side: n % 2 === 1 ? 'L' : 'R' };
}

export function getElectrodePosition(label: string): ElectrodePosition | null {
  const norm = label.replace(/[.\s]/g, '').toUpperCase();

  const overrides: Record<string, [number, number]> = {
    T9: [-1.05, 0.0],
    T10: [1.05, 0.0],
    IZ: [0, -1.05],
    NZ: [0, 1.05],
  };
  if (overrides[norm]) {
    const [x, y] = overrides[norm];
    return { label, x, y };
  }

  const p = parseLabel(label);
  if (!p) return null;
  const y = ROW_Y[p.row];
  const mag = COL_MAG[p.colNum] ?? 0;
  const x = p.side === 'C' ? 0 : p.side === 'L' ? -mag : mag;
  return { label, x, y };
}

export function computeElectrodeLayout(labels: string[]): ElectrodePosition[] {
  const out: ElectrodePosition[] = [];
  for (const l of labels) {
    const p = getElectrodePosition(l);
    if (p) out.push(p);
  }
  return out;
}
