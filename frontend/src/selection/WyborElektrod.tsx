import { HeadTopographyPlot } from '../analysis/HeadTopographyPlot';
import type { WyborState } from '../hooks/useWyborAnalizy';

const KORA_RUCHOWA = /^C[1-6Z]\.*$|^FC[1-6Z]\.*$|^CP[1-6Z]\.*$/i;

export function WyborElektrod(props: { stan: WyborState }) {
  const { wybor, zmien, elektrody } = props.stan;

  function przelacz(label: string) {
    const nowe = wybor.channels.includes(label)
      ? wybor.channels.filter((c) => c !== label)
      : elektrody.filter((l) => wybor.channels.includes(l) || l === label);
    zmien({ channels: nowe });
  }

  return (
    <div className="border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-text">Elektrody</h2>
        </div>
        <div className="flex gap-2">
          <Przycisk onClick={() => zmien({ channels: [...elektrody] })}>Wszystkie</Przycisk>
          <Przycisk onClick={() => zmien({ channels: [] })}>Wyczyść</Przycisk>
          <Przycisk akcent onClick={() => zmien({ channels: elektrody.filter((l) => KORA_RUCHOWA.test(l)) })}>
            Kora ruchowa
          </Przycisk>
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <HeadTopographyPlot channels={elektrody} selected={wybor.channels} onToggle={przelacz} size={400} />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <div className="text-xs font-medium text-muted">Wybrane ({wybor.channels.length})</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {wybor.channels.length === 0 ? (
            <span className="text-xs text-muted">Nic nie zaznaczono. Kliknij elektrody na rysunku głowy albo użyj przycisku „Kora ruchowa”.</span>
          ) : (
            wybor.channels.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 border border-accent bg-accentSoft px-2 py-0.5 text-[11px] font-medium text-accent">
                {c.replace(/\.+$/, '')}
                <button type="button" onClick={() => przelacz(c)} className="text-accent/70 hover:text-accent" aria-label="Usuń">
                  ×
                </button>
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Przycisk(props: { onClick: () => void; akcent?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        'border px-2.5 py-1 text-[11px] font-medium',
        props.akcent ? 'border-border bg-accentSoft text-accent hover:opacity-95' : 'border-border bg-surface text-text hover:bg-bg',
      ].join(' ')}
    >
      {props.children}
    </button>
  );
}
