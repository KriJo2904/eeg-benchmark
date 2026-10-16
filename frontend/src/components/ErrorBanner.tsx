export function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="mb-4 border border-border bg-dangerSoft px-4 py-3 text-sm">
      <div className="font-medium text-danger">Błąd</div>
      <div className="mt-1 whitespace-pre-wrap text-text/90">{error}</div>
    </div>
  );
}

