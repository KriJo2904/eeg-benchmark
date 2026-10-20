import { useEffect, useMemo, useState } from 'react';
import { WykresSpektrogramu } from '../analysis/SpectrogramChart';
import { Lista } from '../components/Lista';
import type { DaneSpektrogramu } from '../analysis/spectrogramTypes';
import { getAnalysisMap } from '../projectsApi';
import type { MapaErd, OpisZadania, PodsumowanieAnalizy } from './analizaTypes';
import { bezKropek, domyslneElektrody } from './elektrody';

export function MapaErdPanel(props: {
  projectId: string;
  wynik: PodsumowanieAnalizy;
  zadanie: OpisZadania;
  wersja: string | null;
}) {
  const { projectId, wynik, zadanie, wersja } = props;
  const [elektroda, setElektroda] = useState(domyslneElektrody(wynik.channels)[0] ?? '');
  const [zdarzenie, setZdarzenie] = useState(zadanie.events[zadanie.events.length - 1]?.code ?? 'T0');
  const [mapa, setMapa] = useState<{ klucz: string; dane: MapaErd | null; blad?: string } | null>(null);

  const zd = zadanie.events.some((e) => e.code === zdarzenie) ? zdarzenie : (zadanie.events[0]?.code ?? 'T0');
  const el = wynik.channels.includes(elektroda) ? elektroda : (wynik.channels[0] ?? '');
  const klucz = `${zadanie.id}|${zd}|${wersja}`;

  useEffect(() => {
    let alive = true;
    getAnalysisMap(projectId, zadanie.id, zd)
      .then((m) => alive && setMapa({ klucz, dane: m }))
      .catch((e: unknown) => alive && setMapa({ klucz, dane: null, blad: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, [projectId, zadanie.id, zd, klucz]);

  const dane = useMemo<DaneSpektrogramu | null>(() => {
    const macierz = mapa?.klucz === klucz ? mapa.dane?.data[el] : undefined;
    if (!macierz) return null;
    let m = 1;
    for (const wiersz of macierz) for (const v of wiersz) m = Math.max(m, Math.abs(v));
    return { macierz, osCzasu: wynik.time, osCzestotliwosci: wynik.freq, nazwaKanalu: el, minMoc: -m, maxMoc: m };
  }, [mapa, klucz, el, wynik.time, wynik.freq]);

  return (
    <div className="border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-text">Mapa czas × częstotliwość (ERD %)</h2>
          <p className="text-[11px] text-muted">
            To samo co wyżej, ale dla wszystkich częstotliwości naraz, uśrednione po wszystkich badanych.
            Niebieski to spadek mocy, czerwony wzrost. Ramka zaznacza pasmo z bloku „Moc pasma”.
          </p>
        </div>
        <div className="flex gap-2">
          <Lista etykieta="Elektroda" value={el} opcje={wynik.channels.map((c) => [c, bezKropek(c)])} onChange={setElektroda} />
          <Lista etykieta="Zdarzenie" value={zd} opcje={zadanie.events.map((e) => [e.code, `${e.code} · ${e.name}`])} onChange={setZdarzenie} />
        </div>
      </div>
      <div className="p-3">
        {dane ? (
          <WykresSpektrogramu dane={dane} rodzaj="erd" pasmoMin={wynik.band.fMin} pasmoMax={wynik.band.fMax} wysokosc={300} />
        ) : (
          <div className="py-6 text-center text-xs text-muted">{mapa?.blad ?? 'Ładowanie mapy…'}</div>
        )}
      </div>
    </div>
  );
}
