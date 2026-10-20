import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import type { Project } from '../projectsApi';

function workspaceStrip(pathname: string) {
  if (pathname.includes('/pipeline')) {
    return {
      title: 'Pipeline przetwarzania',
      hint: 'Ułóż bloki między Start a Koniec. Ten sam ciąg bloków zostanie policzony na każdej 5-sekundowej epoce każdego rekordu.',
    };
  }
  if (pathname.includes('/selection')) {
    return {
      title: 'Selekcja danych',
      hint: 'Których badanych, które zadania i które elektrody bierzemy do analizy. Wybór zapisuje się od razu w projekcie.',
    };
  }
  if (pathname.includes('/results')) {
    return {
      title: 'Wyniki',
      hint: 'Uruchomienie analizy i jej wynik: jak zmienia się moc pasma po zdarzeniu T0, T1 i T2 (desynchronizacja ERD).',
    };
  }
  if (pathname.includes('/performance')) {
    return {
      title: 'Wydajność',
      hint: 'Pomiar do tezy pracy: ta sama analiza puszczona na 1, 2, 4 i wszystkich wątkach. Ile daje współbieżność.',
    };
  }
  return {
    title: 'Podgląd sygnału',
    hint: 'Surowy sygnał jednej elektrody z jednego pliku EDF, żeby zobaczyć, z czym pracujemy. Na analizę nie ma wpływu.',
  };
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

          <div className="shrink-0 text-[10px] text-muted border border-border px-1.5 py-0.5 bg-bg">
            EEGMMIDB · 160 Hz
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
          <div className="text-sm font-semibold text-text">{strip.title}</div>
          <p className="max-w-xl text-[11px] leading-snug text-muted">{strip.hint}</p>
        </div>
      </div>

      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
