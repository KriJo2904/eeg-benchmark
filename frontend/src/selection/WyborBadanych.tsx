import type { WyborState } from '../hooks/useWyborAnalizy';
import type { TrybBadanych } from '../state/wyborAnalizy';

const TRYBY: Array<{ id: TrybBadanych; etykieta: string }> = [
  { id: 'wszyscy', etykieta: 'Wszyscy' },
  { id: 'zakres', etykieta: 'Zakres' },
  { id: 'lista', etykieta: 'Lista' },
];

export function WyborBadanych(props: { stan: WyborState }) {
  const { wybor, zmien, wszyscyBadani, wybraniBadani } = props.stan;

  function ustawTryb(tryb: TrybBadanych) {
    if (tryb === 'lista') zmien({ trybBadanych: 'lista', subjects: [...wybraniBadani] });
    else zmien({ trybBadanych: tryb });
  }

  function przelacz(id: string) {
    const lista = Array.isArray(wybor.subjects) ? wybor.subjects : [];
    const nowa = lista.includes(id) ? lista.filter((s) => s !== id) : [...lista, id].sort();
    zmien({ subjects: nowa });
  }

  return (
    <div className="border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-text">Badani</h2>
      <p className="mt-0.5 text-[11px] text-muted">
        W zbiorze jest {wszyscyBadani.length} osób, wybrano <strong className="text-text">{wybraniBadani.length}</strong>.
        Mniej badanych = szybsza analiza, więcej = gładsze krzywe.
      </p>

      <div className="mt-3 flex border border-border">
        {TRYBY.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => ustawTryb(t.id)}
            className={[
              'flex-1 px-3 py-1.5 text-xs font-medium',
              wybor.trybBadanych === t.id ? 'bg-accentSoft text-accent' : 'bg-surface text-muted hover:text-text',
            ].join(' ')}
          >
            {t.etykieta}
          </button>
        ))}
      </div>

      {wybor.trybBadanych === 'zakres' ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <PoleBadanego etykieta="Od" value={wybor.zakresOd} opcje={wszyscyBadani} onChange={(v) => zmien({ zakresOd: v })} />
          <PoleBadanego etykieta="Do" value={wybor.zakresDo} opcje={wszyscyBadani} onChange={(v) => zmien({ zakresDo: v })} />
        </div>
      ) : null}

      {wybor.trybBadanych === 'lista' ? (
        <div className="mt-3">
          <div className="mb-2 flex gap-2">
            <button type="button" onClick={() => zmien({ subjects: [...wszyscyBadani] })} className="border border-border px-2 py-0.5 text-[11px] text-text hover:bg-bg">
              Zaznacz wszystkich
            </button>
            <button type="button" onClick={() => zmien({ subjects: [] })} className="border border-border px-2 py-0.5 text-[11px] text-text hover:bg-bg">
              Wyczyść
            </button>
          </div>
          <div className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto sm:grid-cols-8">
            {wszyscyBadani.map((s) => {
              const zaznaczony = wybraniBadani.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => przelacz(s)}
                  className={[
                    'border px-1 py-1 font-mono text-[10px]',
                    zaznaczony ? 'border-accent bg-accentSoft text-accent' : 'border-border text-muted hover:text-text',
                  ].join(' ')}
                >
                  {s.replace(/^S0*/, '')}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PoleBadanego(props: { etykieta: string; value: string; opcje: string[]; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs font-medium text-muted">
      {props.etykieta}
      <select
        className="mt-1 w-full border border-border bg-surface px-2 py-1.5 text-sm text-text outline-none focus:border-accent"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {props.opcje.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </label>
  );
}
