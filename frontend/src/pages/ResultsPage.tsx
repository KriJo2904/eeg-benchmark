import { useEffect, useState } from 'react';
import { Lista } from '../components/Lista';
import { useAnaliza } from '../hooks/useAnaliza';
import { getAnalysisSubject } from '../projectsApi';
import type { WynikBadanego } from '../results/analizaTypes';
import { KrzyweErd } from '../results/KrzyweErd';
import { MapaErdPanel } from '../results/MapaErdPanel';
import { PanelAnalizy } from '../results/PanelAnalizy';

export function ResultsPage(props: { projectId: string }) {
  const { projectId } = props;
  const analiza = useAnaliza(projectId);
  const wynik = analiza.wynik;

  const [zadanieId, setZadanieId] = useState('');
  const [badany, setBadany] = useState('');
  const daneBadanego = useDaneBadanego(projectId, badany, analiza.utworzono);

  const zadanie = wynik?.tasks.find((t) => t.id === zadanieId) ?? wynik?.tasks[0] ?? null;
  const widokBadany = badany && wynik?.subjects.includes(badany) ? badany : '';
  const dane = !wynik || !zadanie ? null : widokBadany ? (daneBadanego?.[zadanie.id] ?? null) : (wynik.average[zadanie.id] ?? {});

  return (
    <div className="space-y-4">
      <PanelAnalizy analiza={analiza} projectId={projectId} />

      {!wynik ? (
        <div className="border border-border bg-surface px-4 py-6 text-xs text-muted">
          Brak wyniku analizy.
        </div>
      ) : zadanie ? (
        <>
          <div className="border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-text">
                  Moc pasma {wynik.band.fMin}–{wynik.band.fMax} Hz w czasie (ERD %)
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Lista
                  etykieta="Zadanie"
                  value={zadanie.id}
                  opcje={wynik.tasks.map((t) => [t.id, t.name])}
                  onChange={setZadanieId}
                />
                <Lista
                  etykieta="Widok"
                  value={widokBadany}
                  opcje={[['', `Średnia (${wynik.subjects.length} badanych)`], ...wynik.subjects.map((s): [string, string] => [s, s])]}
                  onChange={setBadany}
                />
              </div>
            </div>
            <KrzyweErd wynik={wynik} zadanie={zadanie} dane={dane} />
          </div>

          <MapaErdPanel projectId={projectId} wynik={wynik} zadanie={zadanie} wersja={analiza.utworzono} />
        </>
      ) : null}
    </div>
  );
}

function useDaneBadanego(projectId: string, badany: string, wersja: string | null): WynikBadanego | null {
  const [stan, setStan] = useState<{ klucz: string; dane: WynikBadanego } | null>(null);
  const klucz = `${badany}|${wersja}`;

  useEffect(() => {
    if (!badany) return;
    let alive = true;
    getAnalysisSubject(projectId, badany)
      .then((r) => alive && setStan({ klucz, dane: r.data }))
      .catch(() => alive && setStan({ klucz, dane: {} }));
    return () => {
      alive = false;
    };
  }, [projectId, badany, klucz]);

  return stan?.klucz === klucz ? stan.dane : null;
}
