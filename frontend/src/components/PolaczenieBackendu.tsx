import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Polaczenie, Poziom, StanPolaczenia } from '../hooks/usePolaczenie';
import { opisAdresu, ostatnieBackendy } from '../polaczenie';

const KOLOR_KROPKI: Record<Poziom, string> = {
  brak: 'bg-border',
  sprawdzanie: 'bg-border',
  ok: 'bg-ok',
  uwaga: 'bg-warn',
  blad: 'bg-danger',
};

function Kropka({ kolor }: { kolor: string }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${kolor}`} />;
}

function czas(ms: number): string {
  return ms < 1 ? '<1 ms' : `${Math.round(ms)} ms`;
}

function Wiersz(props: { etykieta: string; ok: boolean; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-2 py-1.5 border-t border-border first:border-t-0">
      <div className="text-muted">{props.etykieta}</div>
      <div className="flex items-start gap-2 min-w-0">
        <span className="mt-1">
          <Kropka kolor={props.ok ? 'bg-ok' : 'bg-danger'} />
        </span>
        <div className="min-w-0 text-text">{props.children}</div>
      </div>
    </div>
  );
}

function WynikSprawdzenia({ stan }: { stan: StanPolaczenia }) {
  const { backend, status } = stan;
  const api = status?.projectsApi;

  return (
    <div className="text-xs">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px] text-muted">
        <span className="font-mono">{opisAdresu(stan.adres)}</span>
        <span>{stan.sprawdzono.toLocaleTimeString('pl-PL')}</span>
      </div>
      <Wiersz etykieta="Backend" ok={backend.ok}>
        {backend.ok ? `${czas(backend.ms)}${status ? ` · ${status.host} · ${status.threads} wątków` : ''}` : backend.blad}
      </Wiersz>
      {api ? (
        <Wiersz etykieta="projects-api z backendu" ok={api.ok}>
          {api.ok ? czas(api.ms) : api.error}
          <div className="font-mono text-[10px] text-muted break-all">{api.url}</div>
        </Wiersz>
      ) : null}
    </div>
  );
}

export function PanelPolaczenia({ polaczenie }: { polaczenie: Polaczenie }) {
  const { adres, stan, polacz, rozlacz } = polaczenie;
  const [wpisany, setWpisany] = useState(opisAdresu(adres));
  const [laczenie, setLaczenie] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [nieudany, setNieudany] = useState<StanPolaczenia | null>(null);
  const ostatnie = ostatnieBackendy().filter((a) => a !== adres);

  async function onPolacz(tekst: string) {
    setWpisany(tekst);
    setBlad(null);
    setNieudany(null);
    setLaczenie(true);
    try {
      const wynik = await polacz(tekst);
      if (!wynik.backend.ok) setNieudany(wynik);
    } catch (e) {
      setBlad(e instanceof Error ? e.message : String(e));
    }
    setLaczenie(false);
  }

  const pokazywany = nieudany ?? stan;

  return (
    <div>
      <div className="flex gap-2">
        <input
          aria-label="Adres backendu"
          className="min-w-0 flex-1 border border-border bg-bg px-2.5 py-1.5 font-mono text-xs text-text outline-none focus:border-accent"
          value={wpisany}
          onChange={(e) => {
            setWpisany(e.target.value);
            setBlad(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && void onPolacz(wpisany)}
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => void onPolacz(wpisany)}
          disabled={laczenie}
          className="border border-accent bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {laczenie ? 'Łączenie…' : 'Połącz'}
        </button>
        {adres ? (
          <button
            type="button"
            onClick={rozlacz}
            className="border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text hover:bg-bg transition-colors"
          >
            Rozłącz
          </button>
        ) : null}
      </div>
      {blad ? <p className="mt-1.5 text-[11px] text-danger">{blad}</p> : null}

      {ostatnie.length ? (
        <div className="mt-3">
          <div className="text-[11px] text-muted">Ostatnie</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {ostatnie.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => void onPolacz(opisAdresu(a))}
                disabled={laczenie}
                className="border border-border bg-bg px-2 py-1 font-mono text-[11px] text-text hover:border-accent disabled:opacity-50 transition-colors"
              >
                {opisAdresu(a)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {pokazywany ? (
        <div className="mt-3 border-t border-border pt-3">
          <WynikSprawdzenia stan={pokazywany} />
        </div>
      ) : null}
    </div>
  );
}

export function PolaczenieBackendu({ polaczenie }: { polaczenie: Polaczenie }) {
  const { adres, stan, poziom } = polaczenie;
  const [otwarty, setOtwarty] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!otwarty) return;
    const klik = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOtwarty(false);
    };
    const klawisz = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOtwarty(false);
    };
    document.addEventListener('mousedown', klik);
    document.addEventListener('keydown', klawisz);
    return () => {
      document.removeEventListener('mousedown', klik);
      document.removeEventListener('keydown', klawisz);
    };
  }, [otwarty]);

  const etykieta =
    poziom === 'brak'
      ? 'nie połączono'
      : poziom === 'sprawdzanie'
        ? 'łączenie'
        : poziom === 'blad'
          ? 'brak połączenia'
          : `${opisAdresu(adres)} · ${czas(stan!.backend.ms)}`;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOtwarty((v) => !v)}
        className="flex items-center gap-2 border border-border bg-surface px-3 py-2 text-xs text-text hover:bg-bg transition-colors"
      >
        <Kropka kolor={KOLOR_KROPKI[poziom]} />
        <span className="font-semibold">Backend</span>
        <span className="text-muted">{etykieta}</span>
      </button>

      {otwarty ? (
        <div className="absolute right-0 top-full z-50 mt-1 w-[400px] max-w-[calc(100vw-2rem)] border border-border bg-surface p-4 shadow-[0_8px_24px_rgba(11,27,42,0.12)]">
          <div className="mb-3 text-sm font-semibold text-text">Połączenie z backendem</div>
          <PanelPolaczenia polaczenie={polaczenie} />
        </div>
      ) : null}
    </div>
  );
}

export function BrakPolaczenia({ polaczenie }: { polaczenie: Polaczenie }) {
  if (polaczenie.poziom === 'sprawdzanie') {
    return <div className="py-20 text-center text-sm text-muted">Łączenie z backendem…</div>;
  }
  return (
    <div className="mx-auto mt-10 max-w-md border border-border bg-surface p-5">
      <div className="mb-3 text-sm font-semibold text-text">Brak połączenia z backendem</div>
      <PanelPolaczenia polaczenie={polaczenie} />
    </div>
  );
}
