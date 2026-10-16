export type UstawieniaPodgladu = {
  subjectId: string;
  recordId: string;
  channel: string;
  t0: number;
  t1: number;
  decimate: number;
};

function klucz(projectId: string) {
  return `project.${projectId}.podglad.v1`;
}

export function wczytajPodglad(projectId: string): UstawieniaPodgladu | null {
  try {
    const raw = localStorage.getItem(klucz(projectId));
    if (!raw) return null;
    const x = JSON.parse(raw) as Partial<UstawieniaPodgladu>;
    if (typeof x.subjectId !== 'string' || typeof x.recordId !== 'string') return null;
    return {
      subjectId: x.subjectId,
      recordId: x.recordId,
      channel: typeof x.channel === 'string' ? x.channel : '',
      t0: typeof x.t0 === 'number' ? x.t0 : 0,
      t1: typeof x.t1 === 'number' ? x.t1 : 10,
      decimate: typeof x.decimate === 'number' ? x.decimate : 1,
    };
  } catch {
    return null;
  }
}

export function zapiszPodglad(projectId: string, u: UstawieniaPodgladu) {
  try {
    localStorage.setItem(klucz(projectId), JSON.stringify(u));
  } catch (e) {
    console.warn(e);
  }
}
