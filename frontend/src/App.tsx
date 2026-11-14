import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { BrakPolaczenia } from './components/PolaczenieBackendu';
import { useEegData } from './hooks/useEegData';
import { usePolaczenie } from './hooks/usePolaczenie';
import { useWyborAnalizy } from './hooks/useWyborAnalizy';
import { AppShell } from './layout/AppShell';
import { DanePage } from './pages/DanePage';
import { DataPage } from './pages/DataPage';
import { PerformancePage } from './pages/PerformancePage';
import { PipelinePage } from './pages/PipelinePage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ResultsPage } from './pages/ResultsPage';
import { SelectionPage } from './pages/SelectionPage';
import { getProject, type Project } from './projectsApi';

function ZawartoscProjektu({ id, zbior }: { id: string; zbior: string }) {
  const eeg = useEegData(id, zbior);
  const wybor = useWyborAnalizy(id, zbior);

  return (
    <Routes>
      <Route index element={<Navigate to="data" replace />} />
      <Route path="data" element={<DataPage eeg={eeg} />} />
      <Route path="pipeline" element={<PipelinePage wybor={wybor} projectId={id} />} />
      <Route path="selection" element={<SelectionPage stan={wybor} />} />
      <Route path="results" element={<ResultsPage projectId={id} />} />
      <Route path="performance" element={<PerformancePage projectId={id} wybor={wybor} />} />
      <Route path="*" element={<Navigate to="data" replace />} />
    </Routes>
  );
}

function ProjectWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const id = projectId ?? '';
  const [project, setProject] = useState<Project | null>(null);
  const [bladProjektu, setBladProjektu] = useState<string | null>(null);
  const polaczenie = usePolaczenie();

  useEffect(() => {
    if (!id) return;
    let aktywny = true;
    let timer = 0;
    const wczytaj = () => {
      getProject(id)
        .then((r) => {
          if (!aktywny) return;
          setProject(r.project);
          setBladProjektu(null);
        })
        .catch((e: unknown) => {
          if (!aktywny) return;
          setBladProjektu(e instanceof Error ? e.message : String(e));
          timer = window.setTimeout(wczytaj, 3000);
        });
    };
    wczytaj();
    return () => {
      aktywny = false;
      window.clearTimeout(timer);
    };
  }, [id]);

  function zmienZbior(zbior: string) {
    setProject((p) => (p ? { ...p, dataset: zbior } : p));
  }

  return (
    <AppShell project={project} projectId={id} polaczenie={polaczenie}>
      {!polaczenie.polaczony ? (
        <BrakPolaczenia polaczenie={polaczenie} />
      ) : !project ? (
        <div className="py-20 text-center text-sm text-muted">
          {bladProjektu ? `Nie udało się wczytać projektu: ${bladProjektu}` : 'Ładowanie projektu…'}
        </div>
      ) : (
        <Routes>
          <Route
            path="dane"
            element={<DanePage key={polaczenie.adres} project={project} onZmianaZbioru={zmienZbior} />}
          />
          <Route
            path="*"
            element={
              project.dataset ? (
                <ZawartoscProjektu key={`${polaczenie.adres}|${project.dataset}`} id={id} zbior={project.dataset} />
              ) : (
                <Navigate to={`/projects/${id}/dane`} replace />
              )
            }
          />
        </Routes>
      )}
    </AppShell>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/:projectId/*" element={<ProjectWorkspace />} />
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}
