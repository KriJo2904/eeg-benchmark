import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import type { Project } from '../projectsApi';

function workspaceStrip(pathname: string): string {
  if (pathname.includes('/pipeline')) {
    return 'Pipeline przetwarzania';
  }
  if (pathname.includes('/selection')) {
    return 'Selekcja danych';
  }
  if (pathname.includes('/results')) {
    return 'Wyniki';
  }
  if (pathname.includes('/performance')) {
    return 'Wydajność';
  }
  return 'Podgląd sygnału';
}

function WorkspaceTab(props: { to: string; label: string }) {
  return (
    <NavLink
      to={props.to}
      end
      className={({ isActive }) =>
        [
          'px-4 py-2.5 text-xs font-semibold tracking-wide border-b-2 transition-colors',
          isActive
            ? 'border-accent text-text'
            : 'border-transparent text-muted hover:text-text hover:border-border',
        ].join(' ')
      }
    >
      {props.label}
    </NavLink>
  );
}

export function AppShell(props: { project: Project | null; projectId: string; children: ReactNode }) {
  const { project, projectId, children } = props;
  const location = useLocation();
  const strip = workspaceStrip(location.pathname);

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <header className="border-b border-border bg-surface">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link
            to="/projects"
            className="flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors shrink-0"
          >
            ← Projekty
          </Link>

          <div className="h-4 w-px bg-border shrink-0" />

          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-text truncate leading-tight">
              {project?.name ?? <span className="text-muted">Ładowanie…</span>}
            </div>
            <div className="text-[10px] text-muted leading-tight font-mono">{projectId}</div>
          </div>
        </div>

        <nav className="flex items-center gap-0 px-4 -mb-px">
          <WorkspaceTab to={`/projects/${projectId}/data`} label="1 · Podgląd" />
          <WorkspaceTab to={`/projects/${projectId}/selection`} label="2 · Selekcja" />
          <WorkspaceTab to={`/projects/${projectId}/pipeline`} label="3 · Pipeline" />
          <WorkspaceTab to={`/projects/${projectId}/results`} label="4 · Wyniki" />
          <WorkspaceTab to={`/projects/${projectId}/performance`} label="5 · Wydajność" />
        </nav>
      </header>

      <div className="border-b border-border bg-surface px-4 py-2.5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="text-sm font-semibold text-text">{strip}</div>
        </div>
      </div>

      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
