import { StatusBar } from '../components/StatusBar';
import type { WyborState } from '../hooks/useWyborAnalizy';
import { PanelBenchmarku } from '../results/PanelBenchmarku';

export function PerformancePage(props: { projectId: string; wybor: WyborState }) {
  const { projectId, wybor } = props;
  const parts: Array<{ k: string; v: string }> = [
    { k: 'Badani w Selekcji', v: String(wybor.wybraniBadani.length) },
    { k: 'Zadania', v: String(wybor.wybor.tasks.length) },
    { k: 'Elektrody', v: String(wybor.wybor.channels.length) },
  ];

  return (
    <div className="space-y-4">
      <StatusBar parts={parts} busy={null} />
      <PanelBenchmarku projectId={projectId} liczbaBadanych={wybor.wybraniBadani.length} />
    </div>
  );
}
