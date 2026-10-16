import { useMemo } from 'react';
import { UPlotChart } from './UPlotChart';

export function ChartPanel(props: {
  recordId: string;
  channel: string;
  t0: number;
  t1: number;
  samples: number[];
  sampleRateHz: number;
  markerTimes: number[];
}) {
  const { recordId, channel, t0, t1, samples, sampleRateHz, markerTimes } = props;

  const x = useMemo(() => {
    if (!samples.length || !sampleRateHz) return [];
    const xs = new Array<number>(samples.length);
    for (let i = 0; i < samples.length; i++) xs[i] = t0 + i / sampleRateHz;
    return xs;
  }, [samples, sampleRateHz, t0]);

  return (
    <div className="border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-text">Wykres</h2>
          <p className="mt-1 text-xs text-muted">
            {recordId && channel ? (
              <>
                {channel} • [{t0.toFixed(2)}, {t1.toFixed(2)}] s • {samples.length} próbek
              </>
            ) : (
              <>Wybierz rekord i kanał.</>
            )}
          </p>
        </div>
        <div className="text-xs text-muted">
          Markery w oknie: <span className="text-text">{markerTimes.length}</span>
        </div>
      </div>

      <div className="mt-4 border border-border bg-surface p-3">
        {samples.length ? (
          <UPlotChart
            title="Okno EEG"
            seriesLabel={channel}
            x={x}
            y={samples}
            eventMarkers={markerTimes}
            height={380}
          />
        ) : (
          <div className="flex h-[380px] items-center justify-center text-sm text-muted">
            Brak danych do wyświetlenia.
          </div>
        )}
      </div>
    </div>
  );
}

