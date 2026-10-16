type Part = { k: string; v: string };

function chip(label: string, value: string) {
  return (
    <div className="flex items-baseline gap-2 border-r border-border pr-3 last:border-r-0 last:pr-0">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="text-sm text-text">{value}</div>
    </div>
  );
}

export function StatusBar({ parts, busy }: { parts: Part[]; busy: string | null }) {
  return (
    <div className="mb-4 border border-border bg-surface px-4 py-2">
      <div className="flex flex-wrap gap-x-3 gap-y-2">
        {parts.map((p) => (
          <div key={p.k}>{chip(p.k, p.v)}</div>
        ))}
        {busy ? (
          <div className="ml-auto text-xs text-muted">
            Stan: <span className="text-text">{busy}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

