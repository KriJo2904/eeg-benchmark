import { ErrorBanner } from '../components/ErrorBanner';
import { StatusBar } from '../components/StatusBar';
import type { WyborState } from '../hooks/useWyborAnalizy';
import { WyborBadanych } from '../selection/WyborBadanych';
import { WyborElektrod } from '../selection/WyborElektrod';
import { WyborZadan } from '../selection/WyborZadan';

export function SelectionPage(props: { stan: WyborState }) {
  const { stan } = props;
  const { wybor, wybraniBadani, liczbaRekordow, statusZapisu } = stan;

  const parts: Array<{ k: string; v: string }> = [
    { k: 'Badani', v: String(wybraniBadani.length) },
    { k: 'Zadania', v: String(wybor.tasks.length) },
    { k: 'Rekordy EDF', v: String(liczbaRekordow) },
    { k: 'Elektrody', v: String(wybor.channels.length) },
  ];

  const braki: string[] = [];
  if (wybraniBadani.length === 0) braki.push('badanych');
  if (wybor.tasks.length === 0) braki.push('zadania');
  if (wybor.channels.length === 0) braki.push('elektrod');

  return (
    <div className="space-y-4">
      <StatusBar parts={parts} busy={stan.zaladowany ? null : 'Ładowanie wyboru…'} />
      <ErrorBanner error={stan.blad} />

      <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-surface px-4 py-2 text-xs">
        {braki.length > 0 ? (
          <span className="text-danger">Żeby policzyć analizę, trzeba jeszcze wybrać: {braki.join(', ')}.</span>
        ) : (
          <span className="text-muted">
            Do analizy wejdzie <strong className="text-text">{liczbaRekordow}</strong> plików EDF. W każdym pliku
            znajdujemy zdarzenia T0/T1/T2 i wycinamy wokół nich epoki: 1 s przed i 4 s po.
          </span>
        )}
        <span className="text-[11px] text-muted">
          {statusZapisu === 'saving' ? 'Zapisywanie…' : statusZapisu === 'saved' ? 'Zapisano ✓' : statusZapisu === 'error' ? 'Błąd zapisu' : ''}
        </span>
      </div>

      {stan.zaladowany ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
          <WyborElektrod stan={stan} />
          <div className="space-y-4">
            <WyborZadan stan={stan} />
            <WyborBadanych stan={stan} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
