import { useEffect, useState } from 'react';
import {
  pobierzLiczbeRdzeni,
  uruchomBenchmark,
  type BenchPunkt,
  type BenchWynik,
  type WariantBenchmarku,
} from '../api';
import { Lista } from '../components/Lista';

const WYKRES_H = 180;
const SLUPEK_W = 60;
const SLUPEK_GAP = 24;

type Wiersz = { threads: number; repeats: number; ms: number; speedup: number; efficiency: number };

const DOMYSLNE_PRZEBIEGI = 3;

function policzWiersze(runs: BenchPunkt[]): Wiersz[] {
  const bazowy = runs.find((r) => r.threads === 1)?.ms ?? runs[0]?.ms ?? 0;
  return runs.map((r) => {
    const speedup = r.ms > 0 ? bazowy / r.ms : 0;
    return { threads: r.threads, repeats: r.repeats, ms: r.ms, speedup, efficiency: speedup / r.threads };
  });
}

function zbudujCsv(wynik: BenchWynik, wiersze: Wiersz[]): string {
  const naglowek = 'threads,median_ms,speedup,efficiency,repeats,subjects,records,epochs,channels,cores\n';
  const linie = wiersze.map((w) =>
    [w.threads, w.ms.toFixed(1), w.speedup.toFixed(3), w.efficiency.toFixed(3), w.repeats, wynik.subjects,
      wynik.records, wynik.epochs, wynik.channels, wynik.hardwareConcurrency].join(','),
  );
  return naglowek + linie.join('\n') + '\n';
}

function pobierzPlik(nazwa: string, tresc: string) {
  const url = URL.createObjectURL(new Blob([tresc], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nazwa;
  a.click();
  URL.revokeObjectURL(url);
}

export function PanelBenchmarku(props: { projectId: string; liczbaBadanych: number }) {
  const { projectId, liczbaBadanych } = props;
  const [wynik, setWynik] = useState<BenchWynik | null>(null);
  const [liczy, setLiczy] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [maxBadanych, setMaxBadanych] = useState('0');
  const [warianty, setWarianty] = useState<WariantBenchmarku[]>([
    { watki: 1, przebiegi: DOMYSLNE_PRZEBIEGI },
    { watki: 2, przebiegi: DOMYSLNE_PRZEBIEGI },
    { watki: 4, przebiegi: DOMYSLNE_PRZEBIEGI },
  ]);
  const [rdzenie, setRdzenie] = useState<number | null>(null);
  const [sekundy, setSekundy] = useState(0);

  useEffect(() => {
    pobierzLiczbeRdzeni()
      .then((n) => {
        setRdzenie(n);
        setWarianty((w) => (w.some((x) => x.watki === n) ? w : [...w, { watki: n, przebiegi: DOMYSLNE_PRZEBIEGI }]));
      })
      .catch(() => setRdzenie(null));
  }, []);

  useEffect(() => {
    if (!liczy) return;
    const start = performance.now();
    const t = window.setInterval(() => setSekundy((performance.now() - start) / 1000), 500);
    return () => window.clearInterval(t);
  }, [liczy]);

  const opcje: Array<[string, string]> = [
    ...[10, 30, 50].filter((n) => n < liczbaBadanych).map((n): [string, string] => [String(n), `${n} badanych`]),
    ['0', `wszyscy z Selekcji (${liczbaBadanych})`],
  ];

  async function uruchom() {
    setLiczy(true);
    setBlad(null);
    setSekundy(0);
    try {
      setWynik(await uruchomBenchmark(projectId, Number(maxBadanych), warianty));
    } catch (e: unknown) {
      setBlad(e instanceof Error ? e.message : String(e));
    } finally {
      setLiczy(false);
    }
  }

  const wiersze = wynik ? policzWiersze(wynik.runs) : [];
  const najlepszy = wiersze.reduce<Wiersz | null>((best, w) => (!best || w.speedup > best.speedup ? w : best), null);

  return (
    <div className="border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-text">Sekwencyjnie czy współbieżnie</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Lista etykieta="Dane" value={maxBadanych} opcje={opcje} onChange={setMaxBadanych} />
          {wynik && !liczy ? (
            <button
              type="button"
              onClick={() => pobierzPlik(`benchmark_${projectId}.csv`, zbudujCsv(wynik, wiersze))}
              className="border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-bg"
            >
              Pobierz CSV
            </button>
          ) : null}
          <button
            type="button"
            disabled={liczy}
            onClick={uruchom}
            className="border border-accent bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {liczy ? `Mierzenie… ${sekundy.toFixed(0)} s` : 'Uruchom benchmark'}
          </button>
        </div>
      </div>

      <EdytorWariantow warianty={warianty} rdzenie={rdzenie} zablokowany={liczy} onChange={setWarianty} />

      {blad ? <div className="bg-rose-50 px-4 py-2 text-[11px] text-rose-700">Błąd: {blad}</div> : null}

      {wynik && najlepszy ? (
        <div className="space-y-4 px-4 py-3">
          <div className="border border-accent/40 bg-accentSoft px-4 py-3">
            <div className="text-2xl font-semibold text-text">
              {najlepszy.threads} {odmianaWatki(najlepszy.threads)}: {najlepszy.speedup.toFixed(2)}× szybciej niż sekwencyjnie
            </div>
            <div className="mt-1 text-[11px] text-muted">
              {(wiersze[0].ms / 1000).toFixed(2)} s na 1 wątku → {(najlepszy.ms / 1000).toFixed(2)} s na {najlepszy.threads} wątkach
              {' '}· {wynik.subjects} badanych · {wynik.records} rekordów · {wynik.epochs} epok · {wynik.channels} elektrod
              {' '}· rdzenie w serwerze: <strong>{wynik.hardwareConcurrency}</strong>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <div className="mb-1 text-[11px] font-medium text-muted">Czas całej analizy w ms (niższy słupek = szybciej)</div>
              <WykresSlupkowy runs={wynik.runs} />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-medium text-muted">Ile razy szybciej niż na 1 wątku (przerywana linia to idealne skalowanie)</div>
              <WykresSpeedupu wiersze={wiersze} />
            </div>
          </div>

          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-2 py-1.5 font-medium">Wątki</th>
                <th className="px-2 py-1.5 font-medium">Przebiegi</th>
                <th className="px-2 py-1.5 font-medium">Czas [ms], mediana</th>
                <th className="px-2 py-1.5 font-medium">Przyspieszenie</th>
                <th className="px-2 py-1.5 font-medium">Efektywność</th>
              </tr>
            </thead>
            <tbody>
              {wiersze.map((w) => (
                <tr key={w.threads} className="border-b border-border/60 font-mono text-text">
                  <td className="px-2 py-1.5">{w.threads === 1 ? '1 (sekwencyjnie)' : w.threads}</td>
                  <td className="px-2 py-1.5">{w.repeats}</td>
                  <td className="px-2 py-1.5">{w.ms.toFixed(1)}</td>
                  <td className="px-2 py-1.5">{w.speedup.toFixed(2)}×</td>
                  <td className="px-2 py-1.5">{w.efficiency.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

        </div>
      ) : !liczy && !blad ? (
        <div className="px-4 py-6 text-xs text-muted">
          Brak wyniku benchmarku.
        </div>
      ) : null}
    </div>
  );
}

const MAX_WATKOW = 1024;
const MAX_PRZEBIEGOW = 20;

function EdytorWariantow(props: {
  warianty: WariantBenchmarku[];
  rdzenie: number | null;
  zablokowany: boolean;
  onChange: (w: WariantBenchmarku[]) => void;
}) {
  const { warianty, rdzenie, zablokowany, onChange } = props;
  const pole =
    'w-16 border border-border bg-surface px-2 py-1 text-xs text-text outline-none focus:border-accent disabled:opacity-45';

  function zmien(i: number, zmiana: Partial<WariantBenchmarku>) {
    onChange(warianty.map((w, j) => (j === i ? { ...w, ...zmiana } : w)));
  }

  function dodaj() {
    const ostatni = warianty[warianty.length - 1];
    const watki = Math.min(MAX_WATKOW, (ostatni?.watki ?? 1) * 2);
    onChange([...warianty, { watki, przebiegi: ostatni?.przebiegi ?? DOMYSLNE_PRZEBIEGI }]);
  }

  return (
    <div className="border-b border-border px-4 py-3">
      <div className="mb-2 text-[11px] font-medium text-muted">
        Warianty{rdzenie ? ` · rdzenie w serwerze: ${rdzenie}` : ''}
      </div>
      <div className="flex flex-col gap-1.5">
        {warianty.map((w, i) => (
          <div key={i} className="flex items-center gap-3 text-xs text-muted">
            <label className="flex items-center gap-1.5">
              Wątki
              <input
                type="number"
                min={1}
                max={MAX_WATKOW}
                value={w.watki}
                disabled={zablokowany || i === 0}
                onChange={(e) => zmien(i, { watki: Number(e.target.value) })}
                className={pole}
              />
            </label>
            <label className="flex items-center gap-1.5">
              Przebiegi
              <input
                type="number"
                min={1}
                max={MAX_PRZEBIEGOW}
                value={w.przebiegi}
                disabled={zablokowany}
                onChange={(e) => zmien(i, { przebiegi: Number(e.target.value) })}
                className={pole}
              />
            </label>
            {i === 0 ? (
              <span>sekwencyjnie</span>
            ) : (
              <button
                type="button"
                disabled={zablokowany}
                onClick={() => onChange(warianty.filter((_, j) => j !== i))}
                className="px-1 text-muted hover:text-text disabled:opacity-45"
                aria-label="Usuń wariant"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={zablokowany}
        onClick={dodaj}
        className="mt-2 border border-border bg-surface px-3 py-1 text-xs font-medium text-text hover:bg-bg disabled:opacity-45"
      >
        + Dodaj wariant
      </button>
    </div>
  );
}

function odmianaWatki(n: number): string {
  if (n === 1) return 'wątek';
  if (n >= 2 && n <= 4) return 'wątki';
  return 'wątków';
}

function WykresSlupkowy(props: { runs: BenchPunkt[] }) {
  const { runs } = props;
  const maxMs = Math.max(...runs.map((r) => r.ms), 1);
  const szerokosc = runs.length * SLUPEK_W + (runs.length - 1) * SLUPEK_GAP + 40;

  return (
    <svg viewBox={`0 0 ${szerokosc} ${WYKRES_H + 40}`} className="w-full max-w-lg" aria-label="Czas analizy dla różnej liczby wątków">
      {runs.map((r, i) => {
        const wysokosc = (r.ms / maxMs) * WYKRES_H;
        const x = 20 + i * (SLUPEK_W + SLUPEK_GAP);
        const y = WYKRES_H - wysokosc + 10;
        return (
          <g key={r.threads}>
            <rect x={x} y={y} width={SLUPEK_W} height={wysokosc} className="fill-accent" opacity={0.85} />
            <text x={x + SLUPEK_W / 2} y={y - 4} textAnchor="middle" className="fill-text" fontSize="10" fontFamily="monospace">
              {r.ms.toFixed(0)} ms
            </text>
            <text x={x + SLUPEK_W / 2} y={WYKRES_H + 28} textAnchor="middle" className="fill-muted" fontSize="11">
              {r.threads} {odmianaWatki(r.threads)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function WykresSpeedupu(props: { wiersze: Wiersz[] }) {
  const { wiersze } = props;
  const szer = 320;
  const wys = WYKRES_H + 40;
  const lewy = 32;
  const dolny = wys - 26;
  const maxN = Math.max(...wiersze.map((w) => w.threads), 2);
  const maxY = maxN;

  const px = (n: number) => lewy + ((n - 1) / (maxN - 1)) * (szer - lewy - 16);
  const py = (s: number) => dolny - (s / maxY) * (dolny - 14);

  const sciezka = wiersze.map((w, i) => `${i === 0 ? 'M' : 'L'} ${px(w.threads)} ${py(w.speedup)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${szer} ${wys}`} className="w-full max-w-lg" aria-label="Przyspieszenie względem 1 wątku">
      <line x1={lewy} y1={dolny} x2={szer - 12} y2={dolny} stroke="#516579" strokeWidth="1" />
      <line x1={lewy} y1={dolny} x2={lewy} y2={10} stroke="#516579" strokeWidth="1" />
      <line x1={px(1)} y1={py(1)} x2={px(maxN)} y2={py(maxN)} stroke="#516579" strokeDasharray="4 3" strokeWidth="1" />
      <text x={px(maxN) - 4} y={py(maxN) + 12} textAnchor="end" className="fill-muted" fontSize="10">
        idealne
      </text>
      <path d={sciezka} fill="none" className="stroke-accent" strokeWidth="2" />
      {wiersze.map((w) => (
        <g key={w.threads}>
          <circle cx={px(w.threads)} cy={py(w.speedup)} r="4" className="fill-accent" />
          <text x={px(w.threads)} y={py(w.speedup) - 8} textAnchor="middle" className="fill-text" fontSize="10" fontFamily="monospace">
            {w.speedup.toFixed(2)}×
          </text>
          <text x={px(w.threads)} y={dolny + 14} textAnchor="middle" className="fill-muted" fontSize="10">
            {w.threads}
          </text>
        </g>
      ))}
      <text x={lewy - 4} y={py(maxY) + 4} textAnchor="end" className="fill-muted" fontSize="10">
        {maxY}×
      </text>
      <text x={lewy - 4} y={py(1) + 4} textAnchor="end" className="fill-muted" fontSize="10">
        1×
      </text>
      <text x={szer - 12} y={wys - 4} textAnchor="end" className="fill-muted" fontSize="10">
        wątki
      </text>
    </svg>
  );
}
