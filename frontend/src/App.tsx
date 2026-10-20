import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useEegData } from './hooks/useEegData';
import { useWyborAnalizy } from './hooks/useWyborAnalizy';
import { AppShell } from './layout/AppShell';
import { DataPage } from './pages/DataPage';
import { PerformancePage } from './pages/PerformancePage';
import { PipelinePage } from './pages/PipelinePage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ResultsPage } from './pages/ResultsPage';
import { SelectionPage } from './pages/SelectionPage';
import { getProject, type Project } from './projectsApi';

function ProjectWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const id = projectId ?? '';
  const [project, setProject] = useState<Project | null>(null);
  const eeg = useEegData(id);
  const wybor = useWyborAnalizy(id);

  useEffect(() => {
    if (!id) return;
    getProject(id)
      .then((r) => setProject(r.project))
      .catch(() => {});
  }, [id]);

  return (
    <AppShell project={project} projectId={id}>
      <Routes>
        <Route index element={<Navigate to="data" replace />} />
        <Route path="data" element={<DataPage eeg={eeg} />} />
        <Route path="pipeline" element={<PipelinePage wybor={wybor} projectId={id} />} />
        <Route path="selection" element={<SelectionPage stan={wybor} />} />
        <Route path="results" element={<ResultsPage projectId={id} wybor={wybor} />} />
        <Route path="performance" element={<PerformancePage projectId={id} wybor={wybor} />} />
        <Route path="*" element={<Navigate to="data" replace />} />
      </Routes>
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
