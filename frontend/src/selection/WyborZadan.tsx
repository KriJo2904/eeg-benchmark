import type { WyborState } from '../hooks/useWyborAnalizy';

export function WyborZadan(props: { stan: WyborState }) {
  const { wybor, zmien, zadania } = props.stan;

  function przelacz(id: string) {
    const nowe = wybor.tasks.includes(id) ? wybor.tasks.filter((t) => t !== id) : [...wybor.tasks, id];
    zmien({ tasks: zadania.map((z) => z.id).filter((z) => nowe.includes(z)) });
  }

  return (
    <div className="border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-text">Zadania</h2>
      <div className="mt-3 space-y-1.5">
        {zadania.map((z) => (
          <label key={z.id} className="flex cursor-pointer items-center gap-2 text-xs text-text">
            <input
              type="checkbox"
              className="accent-accent"
              checked={wybor.tasks.includes(z.id)}
              onChange={() => przelacz(z.id)}
            />
            <span className="flex-1">{z.name}</span>
            <span className="font-mono text-[10px] text-muted">
              {z.runs.map((r) => `R${String(r).padStart(2, '0')}`).join(', ')}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
