import type { MapaErd, PodsumowanieAnalizy, WynikBadanego } from './results/analizaTypes';

export type Project = {
  _id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  pipeline?: unknown;
  dataSelection?: unknown;
};

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function listProjects(): Promise<{ projects: Project[] }> {
  return http(`/projects-api/projects`);
}

export async function createProject(name: string): Promise<{ project: Project }> {
  return http(`/projects-api/projects`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export async function getProject(id: string): Promise<{ project: Project }> {
  return http(`/projects-api/projects/${encodeURIComponent(id)}`);
}

export async function patchProject(
  id: string,
  patch: { pipeline?: unknown; dataSelection?: unknown },
): Promise<{ project: Project }> {
  return http(`/projects-api/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function getAnalysis(
  projectId: string,
): Promise<{ summary: PodsumowanieAnalizy; createdAt: string } | null> {
  const res = await fetch(`/projects-api/projects/${encodeURIComponent(projectId)}/analysis`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return res.json();
}

export async function getAnalysisSubject(projectId: string, subjectId: string): Promise<{ data: WynikBadanego }> {
  return http(`/projects-api/projects/${encodeURIComponent(projectId)}/analysis/subjects/${encodeURIComponent(subjectId)}`);
}

export async function getAnalysisMap(projectId: string, task: string, event: string): Promise<MapaErd> {
  return http(
    `/projects-api/projects/${encodeURIComponent(projectId)}/analysis/maps/${encodeURIComponent(task)}/${encodeURIComponent(event)}`,
  );
}

export function analysisCsvUrl(projectId: string): string {
  return `/projects-api/projects/${encodeURIComponent(projectId)}/analysis.csv`;
}
