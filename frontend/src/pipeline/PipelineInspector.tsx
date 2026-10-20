import type { PipelineNodeData } from './types';

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}

const POLE = 'mt-2 w-full border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent';

export function PipelineInspector(props: {
  selected: { id: string; data: PipelineNodeData } | null;
  onChange: (id: string, next: PipelineNodeData) => void;
  onCollapse?: () => void;
}) {
  const { selected, onChange, onCollapse } = props;

  return (
    <div className="flex min-h-0 min-w-0 flex-col border border-border bg-surface">
      <div className="flex min-h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text">Parametry</h3>
          <p className="mt-0.5 text-xs text-muted">
            Ustawienia zaznaczonego bloku. Zapisują się razem z pipeline.
          </p>
        </div>
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            className="shrink-0 border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-bg"
            title="Zwiń panel parametrów"
          >
            Ukryj
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        {!selected ? (
          <div className="border border-border bg-bg px-3 py-3 text-sm text-muted">
            Nic nie zaznaczono. Kliknij blok na planszy, żeby zobaczyć jego parametry.
          </div>
        ) : (
          <FormularzBloku data={selected.data} zmien={(next) => onChange(selected.id, next)} />
        )}
      </div>
    </div>
  );
}

function FormularzBloku(props: { data: PipelineNodeData; zmien: (next: PipelineNodeData) => void }) {
  const { data, zmien } = props;
  const isFixed = data.kind === 'start' || data.kind === 'end';

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted">Nazwa</label>
        <input
          className={POLE}
          value={data.label}
          disabled={isFixed}
          onChange={(e) => zmien({ ...data, label: e.target.value } as PipelineNodeData)}
        />
        {isFixed ? <div className="mt-2 text-xs text-muted">Start i Koniec są stałe, nie mają parametrów.</div> : null}
      </div>

      {data.kind === 'lowpass' ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted">cutoff [Hz]</label>
            <input
              className={POLE}
              type="number"
              step="0.5"
              value={data.params.cutoffHz}
              onChange={(e) => zmien({ ...data, params: { ...data.params, cutoffHz: Number(e.target.value) } })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted">rząd</label>
            <input
              className={POLE}
              type="number"
              step="1"
              min={1}
              value={data.params.order}
              onChange={(e) =>
                zmien({ ...data, params: { ...data.params, order: Math.max(1, Math.round(Number(e.target.value))) } })
              }
            />
          </div>
        </div>
      ) : null}

      {data.kind === 'fft' ? (
        <>
          <div>
            <label className="block text-xs font-medium text-muted">windowSize</label>
            <input
              className={POLE}
              type="number"
              step="32"
              min={32}
              max={200}
              value={data.params.windowSize}
              onChange={(e) =>
                zmien({ ...data, params: { ...data.params, windowSize: Math.max(32, Math.round(Number(e.target.value))) } })
              }
            />
            <p className="mt-1 text-[11px] text-muted">
              Długość okna w próbkach. Epoka ma 800 próbek (5 s przy 160 Hz), więc okno może mieć najwyżej 200.
              128 próbek to 0,8 s, co daje rozdzielczość 1,25 Hz.
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-muted">overlap</label>
              <span className="text-xs text-muted">{(data.params.overlap * 100).toFixed(0)}%</span>
            </div>
            <input
              className="mt-2 w-full accent-[theme(colors.accent)]"
              type="range"
              min={0}
              max={95}
              step={5}
              value={Math.round(data.params.overlap * 100)}
              onChange={(e) =>
                zmien({ ...data, params: { ...data.params, overlap: clamp(Number(e.target.value) / 100, 0, 0.95) } })
              }
            />
          </div>
        </>
      ) : null}

      {data.kind === 'normalize' ? (
        <div>
          <label className="block text-xs font-medium text-muted">metoda</label>
          <select
            className={POLE}
            value={data.params.method}
            onChange={(e) => zmien({ ...data, params: { ...data.params, method: e.target.value as 'zscore' | 'minmax' } })}
          >
            <option value="zscore">z-score</option>
            <option value="minmax">min-max</option>
          </select>
        </div>
      ) : null}

      {data.kind === 'spektrogram' ? (
        <div>
          <p className="text-[11px] text-muted">
            Jaki wycinek częstotliwości pokazać na mapie czas × częstotliwość w Wynikach. Domyślnie 4–40 Hz,
            bo tam widać pasma theta, alfa i beta.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {(['fMin', 'fMax'] as const).map((pole) => (
              <div key={pole}>
                <label className="block text-xs font-medium text-muted">
                  {pole === 'fMin' ? 'f min [Hz]' : 'f max [Hz]'}
                </label>
                <input
                  className={POLE}
                  type="number"
                  step="1"
                  min={0}
                  max={80}
                  value={data.params[pole]}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    zmien({ ...data, params: { ...data.params, [pole]: Number.isFinite(v) ? v : 0 } });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {data.kind === 'band_power' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {(['fMin', 'fMax'] as const).map((pole) => (
              <div key={pole}>
                <label className="block text-xs font-medium text-muted">
                  {pole === 'fMin' ? 'f min [Hz]' : 'f max [Hz]'}
                </label>
                <input
                  className={POLE}
                  type="number"
                  step="0.5"
                  min={0}
                  value={data.params[pole]}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    zmien({ ...data, params: { ...data.params, [pole]: Number.isFinite(v) ? v : 0 } });
                  }}
                />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted">agregacja po freq</label>
            <select
              className={POLE}
              value={data.params.agg}
              onChange={(e) => zmien({ ...data, params: { ...data.params, agg: e.target.value as 'mean' | 'sum' } })}
            >
              <option value="mean">średnia</option>
              <option value="sum">suma</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <label className="block w-full text-xs font-medium text-muted">Presety EEG</label>
            {[
              { name: 'μ (8–13)', lo: 8, hi: 13 },
              { name: 'β (13–30)', lo: 13, hi: 30 },
              { name: 'θ (4–8)', lo: 4, hi: 8 },
              { name: 'γ (30–80)', lo: 30, hi: 80 },
            ].map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => zmien({ ...data, params: { ...data.params, fMin: p.lo, fMax: p.hi } })}
                className="border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text hover:bg-bg"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
