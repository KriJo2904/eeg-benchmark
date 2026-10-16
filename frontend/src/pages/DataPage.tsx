import { ChartPanel } from '../components/ChartPanel';
import { ControlsPanel } from '../components/ControlsPanel';
import { ErrorBanner } from '../components/ErrorBanner';
import { EventsTable } from '../components/EventsTable';
import { StatusBar } from '../components/StatusBar';
import type { EegState } from '../hooks/useEegData';

function fmtSec(x: number) {
  if (!Number.isFinite(x)) return '';
  return `${x.toFixed(3)} s`;
}

export function DataPage(props: { eeg: EegState }) {
  const { eeg } = props;

  const parts: Array<{ k: string; v: string }> = [];
  if (eeg.recordId) parts.push({ k: 'Rekord', v: eeg.recordId });
  if (eeg.metadata) {
    parts.push({ k: 'Czas trwania', v: fmtSec(eeg.metadata.durationSec) });
    parts.push({ k: 'Kanały', v: String(eeg.metadata.channels.length) });
    parts.push({ k: 'Adnotacje', v: eeg.metadata.hasAnnotations ? 'tak' : 'nie' });
  }
  if (eeg.recordId && eeg.previewChannel) {
    parts.push({ k: 'Podgląd', v: eeg.previewChannel });
    parts.push({ k: 'Okno', v: `[${eeg.t0.toFixed(2)}, ${eeg.t1.toFixed(2)}] s` });
  }

  return (
    <div className="space-y-4">
      <StatusBar parts={parts} busy={eeg.busy} />
      <ErrorBanner error={eeg.error} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <ControlsPanel
          subjectId={eeg.subjectId}
          setSubjectId={eeg.setSubjectId}
          subjects={eeg.subjects}
          records={eeg.records}
          recordId={eeg.recordId}
          setRecordId={eeg.setRecordId}
          metadata={eeg.metadata}
          previewChannel={eeg.previewChannel}
          setPreviewChannel={eeg.setPreviewChannel}
          t0={eeg.t0}
          setT0={eeg.setT0}
          t1={eeg.t1}
          setT1={eeg.setT1}
          decimate={eeg.decimate}
          setDecimate={eeg.setDecimate}
          busy={eeg.busy}
          onLoadWindow={eeg.loadWindow}
        />

        <div className="space-y-4">
          <ChartPanel
            recordId={eeg.recordId}
            channel={eeg.previewChannel}
            t0={eeg.t0}
            t1={eeg.t1}
            samples={eeg.samples}
            sampleRateHz={eeg.sampleRateHz}
            markerTimes={eeg.markerTimes}
          />
          <EventsTable events={eeg.events} />
        </div>
      </div>
    </div>
  );
}
