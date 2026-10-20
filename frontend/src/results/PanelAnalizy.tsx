import { useState } from 'react';
import type { AnalizaState } from '../hooks/useAnaliza';
import { analysisCsvUrl } from '../projectsApi';

export function PanelAnalizy(props: { analiza: AnalizaState; projectId: string; liczbaRekordow: number }) {
  const { analiza, projectId, liczbaRekordow } = props;
  const { faza, postep, uplynelo, wynik } = analiza;
  const trwa = faza !== 'bezczynna';
  const procent = postep.wszystkie > 0 ? (100 * postep.gotowe) / postep.wszystkie : 0;

  return (
    <div className="border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-text">Analiza</h2>
          <p className="text-[11px] text-muted">
            Wczytuje {liczbaRekordow} plików EDF z Selekcji, w każdym wycina epoki wokół zdarzeń, na każdej epoce
            liczy pipeline i uśrednia moc pasma. Pliki liczone są równolegle, po jednym na wątek.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {wynik && !trwa ? (
            <a
              href={analysisCsvUrl(projectId)}
              className="border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-bg"
              title="Jeden wiersz = badany, zadanie, zdarzenie, elektroda, czas, ERD %"
            >
              Eksport CSV
            </a>
          ) : null}
          <button
            type="button"
            onClick={trwa ? analiza.anuluj : analiza.uruchom}
            disabled={faza === 'zapis'}
            className={[
              'border px-4 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45',
              trwa ? 'border-border bg-surface text-text hover:bg-bg' : 'border-accent bg-accent text-white hover:opacity-95',
            ].join(' ')}
          >
            {trwa ? 'Anuluj' : wynik ? 'Uruchom ponownie' : 'Uruchom analizę'}
          </button>
        </div>
      </div>

      {trwa ? (
        <div className="border-t border-border px-4 py-3">
          <div className="mb-1.5 flex justify-between text-[11px] text-muted">
            <span>
              {faza === 'zapis' ? 'Zapis wyniku w bazie…' : `Rekord ${postep.gotowe} / ${postep.wszystkie || '…'}`}
            </span>
            <span className="font-mono">{uplynelo.toFixed(1)} s</span>
          </div>
          <div className="h-1.5 w-full bg-bg">
            <div className="h-full bg-accent transition-[width]" style={{ width: `${faza === 'zapis' ? 100 : procent}%` }} />
          </div>
        </div>
      ) : null}

      {analiza.blad ? (
        <div className="border-t border-border bg-rose-50 px-4 py-2 text-[11px] text-rose-700">{analiza.blad}</div>
      ) : null}

      {wynik && !trwa ? <Statystyki analiza={analiza} /> : null}
    </div>
  );
}

function Statystyki({ analiza }: { analiza: AnalizaState }) {
  const s = analiza.wynik!.stats;
  const [pokazPominiete, setPokazPominiete] = useState(false);
  const sumaBlokow = s.blocks.reduce((suma, b) => suma + b.ms, 0);

  return (
    <div className="grid gap-4 border-t border-border px-4 py-3 text-xs lg:grid-cols-2">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        <dt className="text-muted">Ostatnia analiza</dt>
        <dd className="text-text">{analiza.utworzono ? new Date(analiza.utworzono).toLocaleString('pl-PL') : '—'}</dd>
        <dt className="text-muted">Rekordy</dt>
        <dd className="text-text">
          {s.recordsUsed} z {s.recordsTotal}
          {s.skipped.length ? (
            <button type="button" onClick={() => setPokazPominiete((v) => !v)} className="ml-2 text-accent hover:underline">
              ({s.skipped.length} pominiętych)
            </button>
          ) : null}
        </dd>
        <dt className="text-muted">Epoki</dt>
        <dd className="text-text">{s.epochs}</dd>
        <dt className="text-muted">Czas analizy</dt>
        <dd className="text-text">
          {(s.totalMs / 1000).toFixed(2)} s na {s.threads} wątkach
        </dd>
      </dl>

      <div>
        <div className="mb-1 text-muted">
          Ile czasu zajął każdy blok, zsumowane po wszystkich epokach. Suma może być większa niż czas analizy,
          bo {s.threads} wątków liczyło bloki jednocześnie.
        </div>
        <table className="w-full">
          <tbody>
            {s.blocks.map((b, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0">
                <td className="py-1 text-text">{b.label || b.kind}</td>
                <td className="py-1 text-right font-mono text-text">{b.ms.toFixed(0)} ms</td>
                <td className="w-24 py-1 pl-2">
                  <div className="h-1.5 bg-accent/70" style={{ width: `${sumaBlokow ? (100 * b.ms) / sumaBlokow : 0}%` }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pokazPominiete ? (
        <ul className="col-span-full max-h-32 list-disc overflow-y-auto pl-4 text-[11px] text-muted">
          {s.skipped.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
