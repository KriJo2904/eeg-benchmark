export function Lista(props: {
  etykieta: string;
  value: string;
  opcje: Array<[string, string]>;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted">
      {props.etykieta}
      <select
        className="border border-border bg-surface px-2 py-1 text-xs text-text outline-none focus:border-accent"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {props.opcje.map(([v, napis]) => (
          <option key={v} value={v}>
            {napis}
          </option>
        ))}
      </select>
    </label>
  );
}
