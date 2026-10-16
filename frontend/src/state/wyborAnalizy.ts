import { getProject, patchProject } from '../projectsApi';

export type TrybBadanych = 'wszyscy' | 'zakres' | 'lista';

export type WyborAnalizy = {
  version: 2;
  subjects: 'all' | string[];
  trybBadanych: TrybBadanych;
  zakresOd: string;
  zakresDo: string;
  tasks: string[];
  channels: string[];
};

export const PUSTY_WYBOR: WyborAnalizy = {
  version: 2,
  subjects: 'all',
  trybBadanych: 'wszyscy',
  zakresOd: 'S001',
  zakresDo: 'S010',
  tasks: ['wyobrazenie_lp'],
  channels: [],
};

export async function wczytajWybor(projectId: string): Promise<WyborAnalizy> {
  const r = await getProject(projectId);
  const ds = r.project.dataSelection as Partial<WyborAnalizy> | undefined;
  if (!ds || ds.version !== 2) {
    const stareKanaly = (ds as { channels?: unknown } | undefined)?.channels;
    return { ...PUSTY_WYBOR, channels: Array.isArray(stareKanaly) ? (stareKanaly as string[]) : [] };
  }
  return { ...PUSTY_WYBOR, ...ds, version: 2 };
}

export function zapiszWybor(projectId: string, wybor: WyborAnalizy) {
  return patchProject(projectId, { dataSelection: wybor });
}

export function badaniZZakresu(wszyscy: string[], od: string, doo: string): string[] {
  const [a, b] = od <= doo ? [od, doo] : [doo, od];
  return wszyscy.filter((s) => s >= a && s <= b);
}
