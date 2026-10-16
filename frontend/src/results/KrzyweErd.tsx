import { useMemo, useState } from 'react';
import { WykresWieluSerii, type Seria } from '../components/WykresWieluSerii';
import type { OpisZadania, PodsumowanieAnalizy, WynikZadania } from './analizaTypes';
import { bezKropek, domyslneElektrody } from './elektrody';

const KOLORY = ['#1e66d0', '#d0461e', '#16a34a', '#9333ea', '#ca8a04', '#0891b2', '#db2777', '#4b5563', '#65a30d', '#ea580c'];

export function KrzyweErd(props: { wynik: PodsumowanieAnalizy; zadanie: OpisZadania; dane: WynikZadania | null }) {
  const { wynik, zadanie, dane } = props;
  const [wybrane, setWybrane] = useState<string[] | null>(null);
  const widoczne = wybrane ?? domyslneElektrody(wynik.channels);
  const kolor = (k: string) => KOLORY[Math.max(0, widoczne.indexOf(k)) % KOLORY.length];

  function przelacz(k: string) {
    setWybrane(widoczne.includes(k) ? widoczne.filter((x) => x !== k) : [...widoczne, k]);
  }

  const zakresY = useMemo<[number, number]>(() => {
    let min = 0;
    let max = 0;
    for (const zd of Object.values(dane ?? {})) {
      for (const k of widoczne) {
        for (const v of zd.erd[k] ?? []) {
          min = Math.min(min, v);
          max = Math.max(max, v);
        }
      }
    }
    const zapas = 0.05 * (max - min || 1);
    return [min - zapas, max + zapas];
  }, [dane, widoczne]);

  if (!dane) return <div className="px-4 py-6 text-xs text-muted">Ładowanie…</div>;

  return (
    <div className="px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center gap-1">
        <span className="mr-1 text-[11px] text-muted">Elektrody:</span>
        {wynik.channels.map((k) => {
          const wl = widoczne.includes(k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => przelacz(k)}
              className={['inline-flex items-center gap-1 border px-1.5 py-0.5 text-[11px]', wl ? 'border-border text-text' : 'border-transparent text-muted/60'].join(' ')}
            >
              <span className="inline-block h-2 w-2" style={{ background: wl ? kolor(k) : '#cbd5e1' }} />
              {bezKropek(k)}
            </button>
          );
        })}
        <button type="button" onClick={() => setWybrane([...wynik.channels])} className="ml-2 text-[11px] text-accent hover:underline">
          wszystkie
        </button>
        <button type="button" onClick={() => setWybrane(null)} className="text-[11px] text-accent hover:underline">
          domyślne
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {zadanie.events.map((ev) => {
          const zd = dane[ev.code];
          return (
            <div key={ev.code} className="min-w-0">
              {zd ? (
                <WykresWieluSerii
                  tytul={`${ev.code} · ${ev.name} (${zd.epochs} epok${zd.subjects ? `, ${zd.subjects} badanych` : ''})`}
                  x={wynik.time}
                  serie={widoczne
                    .filter((k) => zd.erd[k])
                    .map((k): Seria => ({ etykieta: bezKropek(k), wartosci: zd.erd[k], kolor: kolor(k) }))}
                  zakresY={zakresY}
                  znacznikZera
                  wysokosc={280}
                />
              ) : (
                <div className="py-6 text-center text-xs text-muted">
                  {ev.code} · {ev.name}: brak epok
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

