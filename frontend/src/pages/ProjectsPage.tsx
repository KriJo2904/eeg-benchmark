import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProject, listProjects, type Project } from '../projectsApi';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ProjectCard(props: { project: Project; onOpen: () => void }) {
  const { project, onOpen } = props;
  const ds = project.dataSelection as { subjects?: unknown; channels?: unknown } | undefined;
  const badani = ds?.subjects === 'all' ? 'wszyscy' : Array.isArray(ds?.subjects) ? String(ds.subjects.length) : '—';
  const elektrody = Array.isArray(ds?.channels) ? String(ds.channels.length) : '—';
  const hasPipeline = Boolean(project.pipeline);

  return (
    <div className="border border-border bg-surface flex flex-col gap-0 hover:border-accent/60 transition-colors">
      <div className="px-4 pt-4 pb-3 flex-1">
        <div className="text-sm font-semibold text-text truncate">{project.name}</div>
        <div className="text-[11px] text-muted mt-0.5">{formatDate(project.createdAt)}</div>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <div className="border border-border bg-bg px-2 py-1.5 text-[10px]">
            <div className="text-muted">Badani</div>
            <div className="text-text font-medium mt-0.5 truncate">{badani}</div>
          </div>
          <div className="border border-border bg-bg px-2 py-1.5 text-[10px]">
            <div className="text-muted">Elektrody</div>
            <div className="text-text font-medium mt-0.5">{elektrody}</div>
          </div>
          <div className="border border-border bg-bg px-2 py-1.5 text-[10px]">
            <div className="text-muted">Pipeline</div>
            <div className="text-text font-medium mt-0.5">{hasPipeline ? 'jest' : 'brak'}</div>
          </div>
        </div>
      </div>

      <div className="border-t border-border px-4 py-2.5">
        <button
          type="button"
          onClick={onOpen}
          className="w-full border border-accent bg-accentSoft px-3 py-1.5 text-xs font-semibold text-text hover:bg-accent/20 transition-colors"
        >
          Otwórz
        </button>
      </div>
    </div>
  );
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listProjects()
      .then((r) => setItems(r.projects))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (showForm) inputRef.current?.focus();
  }, [showForm]);

  async function onCreate() {
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const r = await createProject(name.trim());
      navigate(`/projects/${r.project._id}/data`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setCreating(false);
    }
  }

  function openProject(id: string) {
    navigate(`/projects/${id}/data`);
  }

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <header className="border-b border-border bg-surface px-6 py-4">
        <div className="flex items-center justify-between gap-4 max-w-5xl mx-auto">
          <div>
            <div className="text-base font-bold text-text tracking-tight">Analiza EEG (EEGMMIDB)</div>
            <div className="text-xs text-muted mt-0.5">
              {loading ? 'Ładowanie…' : `${items.length} projekt${items.length === 1 ? '' : items.length < 5 ? 'y' : 'ów'}`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="border border-border bg-surface px-3 py-2 text-xs font-semibold text-text hover:bg-bg transition-colors"
          >
            + Nowy projekt
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-6 max-w-5xl mx-auto w-full">
        {showForm && (
          <div className="border border-border bg-surface p-4 mb-6">
            <div className="text-xs font-semibold text-muted mb-2">Nowy projekt</div>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                className="flex-1 border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onCreate()}
                placeholder="np. wyobrażenie ruchu, pasmo alfa"
                disabled={creating}
              />
              <button
                type="button"
                onClick={onCreate}
                disabled={!name.trim() || creating}
                className="border border-border bg-surface px-4 py-2 text-sm font-semibold text-text hover:bg-bg disabled:opacity-40 transition-colors"
              >
                {creating ? 'Tworzenie…' : 'Utwórz'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="border border-border bg-surface px-3 py-2 text-sm text-muted hover:bg-bg transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-5 border border-danger/30 bg-dangerSoft px-3 py-2 text-sm text-text">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-muted">
            Ładowanie projektów…
          </div>
        ) : items.length === 0 ? (
          <div className="border border-border border-dashed bg-surface p-12 text-center">
            <div className="text-sm text-muted">Nie ma jeszcze żadnego projektu.</div>
            <div className="text-xs text-muted mt-1">
              Projekt to zapisany wybór badanych, zadań, elektrod i pipeline. Załóż pierwszy, żeby zacząć.
            </div>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-4 border border-border bg-surface px-4 py-2 text-xs font-semibold text-text hover:bg-bg transition-colors"
            >
              + Nowy projekt
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <ProjectCard key={p._id} project={p} onOpen={() => openProject(p._id)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
