import type {
  EventsResponse,
  RecordMetadata,
  SignalWindow,
  SubjectRecordsResponse,
  SubjectsResponse,
} from './types';

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function listSubjects(): Promise<SubjectsResponse> {
  return http<SubjectsResponse>(`/api/subjects`);
}

export async function listSubjectRecords(subjectId: string): Promise<SubjectRecordsResponse> {
  return http<SubjectRecordsResponse>(`/api/subjects/${encodeURIComponent(subjectId)}/records`);
}

export async function getMetadata(id: string): Promise<RecordMetadata> {
  return http<RecordMetadata>(`/api/records/${encodeURI(id)}/metadata`);
}

export async function getWindow(params: {
  id: string;
  channel: string;
  t0: number;
  t1: number;
  decimate?: number;
}): Promise<SignalWindow> {
  const qs = new URLSearchParams({
    channel: params.channel,
    t0: String(params.t0),
    t1: String(params.t1),
    decimate: String(params.decimate ?? 1),
  });
  return http<SignalWindow>(`/api/records/${encodeURI(params.id)}/window?${qs.toString()}`);
}

export async function getEvents(id: string): Promise<EventsResponse> {
  return http<EventsResponse>(`/api/records/${encodeURI(id)}/events`);
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
