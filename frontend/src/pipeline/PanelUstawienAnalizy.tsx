import type { UstawieniaAnalizy, Zakres } from './ustawieniaAnalizy';

const PRESETY_PASMA: Array<{ nazwa: string; zakres: Zakres }> = [
  { nazwa: 'μ (8–13)', zakres: { fMin: 8, fMax: 13 } },
  { nazwa: 'β (13–30)', zakres: { fMin: 13, fMax: 30 } },
  { nazwa: 'θ (4–8)', zakres: { fMin: 4, fMax: 8 } },
  { nazwa: 'γ (30–80)', zakres: { fMin: 30, fMax: 80 } },
];

const POLE = 'mt-1 w-full border border-border bg-surface px-2 py-1.5 text-sm text-text outline-none focus:border-accent';

function PolaZakresu(props: { tytul: string; zakres: Zakres; onChange: (z: Zakres) => void }) {
  const { tytul, zakres, onChange } = props;
  return (
    <div>
      <div className="text-xs font-medium text-text">{tytul}</div>
      <div className="mt-1 grid grid-cols-2 gap-3">
        {(['fMin', 'fMax'] as const).map((pole) => (
          <label key={pole} className="block text-xs text-muted">
            {pole === 'fMin' ? 'od [Hz]' : 'do [Hz]'}
            <input
              className={POLE}
              type="number"
              step="0.5"
              min={0}
              max={80}
              value={zakres[pole]}
              onChange={(e) => onChange({ ...zakres, [pole]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export function PanelUstawienAnalizy(props: {
  ustawienia: UstawieniaAnalizy;
  onChange: (u: UstawieniaAnalizy) => void;
}) {
  const { ustawienia, onChange } = props;

  return (
    <div className="border border-border bg-surface">
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold text-text">Ustawienia analizy</h3>
      </div>
      <div className="space-y-4 border-t border-border px-4 py-3">
        <div>
          <PolaZakresu
            tytul="Pasmo ERD (krzywe w Wynikach)"
            zakres={ustawienia.band}
            onChange={(band) => onChange({ ...ustawienia, band })}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETY_PASMA.map((p) => (
              <button
                key={p.nazwa}
                type="button"
                onClick={() => onChange({ ...ustawienia, band: p.zakres })}
                className="border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text hover:bg-bg"
              >
                {p.nazwa}
              </button>
            ))}
          </div>
        </div>
        <PolaZakresu
          tytul="Zakres mapy ERD (czas × częstotliwość)"
          zakres={ustawienia.map}
          onChange={(map) => onChange({ ...ustawienia, map })}
        />
      </div>
    </div>
  );
}
