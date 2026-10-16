import type { EventItem } from '../types';

export function EventsTable({ events }: { events: EventItem[] }) {
  return (
    <div className="mt-4 border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Zdarzenia</h3>
        <span className="text-xs text-muted">{events.length} łącznie</span>
      </div>
      <div className="mt-2 max-h-56 overflow-auto border border-border bg-surface">
        {events.length ? (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface text-muted">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-medium">Początek [s]</th>
                <th className="px-3 py-2 font-medium">Czas trwania [s]</th>
                <th className="px-3 py-2 font-medium">Opis</th>
              </tr>
            </thead>
            <tbody>
              {events.slice(0, 500).map((e, idx) => (
                <tr key={idx} className="border-b border-border/70 last:border-0">
                  <td className="px-3 py-2 text-text">{e.onsetSec.toFixed(3)}</td>
                  <td className="px-3 py-2 text-text">{e.durationSec.toFixed(3)}</td>
                  <td className="px-3 py-2 text-text">{e.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-3 py-4 text-sm text-muted">Brak adnotacji w pliku albo nie zostały odczytane.</div>
        )}
      </div>
    </div>
  );
}

