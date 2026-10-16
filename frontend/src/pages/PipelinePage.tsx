import { StatusBar } from '../components/StatusBar';
import type { WyborState } from '../hooks/useWyborAnalizy';
import { PipelineBuilder } from '../pipeline/PipelineBuilder';

export function PipelinePage(props: { wybor: WyborState; projectId: string }) {
  const { wybor, projectId } = props;

  const parts: Array<{ k: string; v: string }> = [
    { k: 'Badani', v: String(wybor.wybraniBadani.length) },
    { k: 'Rekordy EDF', v: String(wybor.liczbaRekordow) },
    { k: 'Elektrody', v: wybor.wybor.channels.map((c) => c.replace(/\.+$/, '')).join(', ') || '—' },
  ];

  return (
    <div className="space-y-4">
      <StatusBar parts={parts} busy={null} />
      <PipelineBuilder key={projectId} projectId={projectId} />
    </div>
  );
}
