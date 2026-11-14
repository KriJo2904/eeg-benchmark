import type {
  EventsResponse,
  RecordMetadata,
  SignalWindow,
  SubjectRecordsResponse,
  SubjectsResponse,
} from './types';
import { adresBackendu, backendUrl, opisAdresu } from './polaczenie';

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(backendUrl(path), init);
  } catch {
    throw new Error(`Brak połączenia z backendem (${opisAdresu(adresBackendu())}).`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(trescBledu(text) || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

function trescBledu(text: string): string {
  try {
    const dane = JSON.parse(text) as { error?: unknown };
    return typeof dane.error === 'string' ? dane.error : text;
  } catch {
    return text;
  }
}

function zbiorQs(zbior: string): string {
  return `dataset=${encodeURIComponent(zbior)}`;
}

export async function listSubjects(zbior: string): Promise<SubjectsResponse> {
  return http<SubjectsResponse>(`/api/subjects?${zbiorQs(zbior)}`);
}

export async function listSubjectRecords(zbior: string, subjectId: string): Promise<SubjectRecordsResponse> {
  return http<SubjectRecordsResponse>(`/api/subjects/${encodeURIComponent(subjectId)}/records?${zbiorQs(zbior)}`);
}

export async function getMetadata(zbior: string, id: string): Promise<RecordMetadata> {
  return http<RecordMetadata>(`/api/records/${encodeURI(id)}/metadata?${zbiorQs(zbior)}`);
}

export async function getWindow(params: {
  zbior: string;
  id: string;
  channel: string;
  t0: number;
  t1: number;
  decimate?: number;
}): Promise<SignalWindow> {
  const qs = new URLSearchParams({
    dataset: params.zbior,
    channel: params.channel,
    t0: String(params.t0),
    t1: String(params.t1),
    decimate: String(params.decimate ?? 1),
  });
  return http<SignalWindow>(`/api/records/${encodeURI(params.id)}/window?${qs.toString()}`);
}

export async function getEvents(zbior: string, id: string): Promise<EventsResponse> {
  return http<EventsResponse>(`/api/records/${encodeURI(id)}/events?${zbiorQs(zbior)}`);
}

export type TypZadania = { id: string; name: string; runs: number[] };

export async function listTasks(): Promise<{ tasks: TypZadania[] }> {
  return http<{ tasks: TypZadania[] }>(`/api/tasks`);
}

export type BenchPunkt = { threads: number; repeats: number; ms: number };

export type BenchWynik = {
  hardwareConcurrency: number;
  subjects: number;
  records: number;
  epochs: number;
  channels: number;
  runs: BenchPunkt[];
};

export type WariantBenchmarku = { watki: number; przebiegi: number };

export async function pobierzLiczbeRdzeni(): Promise<number> {
  const r = await http<{ hardwareConcurrency: number }>(`/api/bench/info`);
  return r.hardwareConcurrency;
}

export async function uruchomBenchmark(
  projectId: string,
  maxBadanych: number,
  warianty: WariantBenchmarku[],
): Promise<BenchWynik> {
  const runs = warianty.map((w) => `${w.watki}:${w.przebiegi}`).join(',');
  const params = new URLSearchParams({ maxSubjects: String(maxBadanych), runs });
  return http<BenchWynik>(`/api/projects/${encodeURIComponent(projectId)}/bench?${params}`, {
    method: 'POST',
  });
}

export type PlikDanych = {
  name: string;
  path: string;
  isDirectory: boolean;
  updatedAt: string;
  size?: number;
};

export type Pobieranie = {
  id: number;
  url: string;
  name: string;
  state: 'downloading' | 'extracting' | 'done' | 'error' | 'cancelled';
  error: string;
  bytes: number;
  total: number;
};

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

export async function listaPlikow(): Promise<{ files: PlikDanych[]; truncated: boolean }> {
  return http(`/api/files`);
}

export async function utworzFolder(sciezka: string): Promise<void> {
  await http(`/api/files/folder`, jsonInit('POST', { path: sciezka }));
}

export async function zmienNazwe(sciezka: string, nazwa: string): Promise<void> {
  await http(`/api/files/rename`, jsonInit('POST', { path: sciezka, name: nazwa }));
}

export async function usunPlik(sciezka: string): Promise<void> {
  await http(`/api/files?path=${encodeURIComponent(sciezka)}`, { method: 'DELETE' });
}

export async function sprawdzZbior(sciezka: string): Promise<{ subjects: number; records: number }> {
  return http(`/api/datasets/check?path=${encodeURIComponent(sciezka)}`);
}

export async function listaPobieran(): Promise<{ downloads: Pobieranie[] }> {
  return http(`/api/downloads`);
}

export async function pobierzZLinku(url: string, nazwa: string): Promise<void> {
  await http(`/api/downloads`, jsonInit('POST', { url, name: nazwa }));
}

export async function anulujPobieranie(id: number): Promise<void> {
  await http(`/api/downloads/${id}`, { method: 'DELETE' });
}
