import { recordEegLabels } from '../lib/eegChannels';
import type { RecordMetadata, RecordRef } from '../types';

export function ControlsPanel(props: {
  subjectId: string;
  setSubjectId: (v: string) => void;
  subjects: string[];
  records: RecordRef[];
  recordId: string;
  setRecordId: (v: string) => void;
  metadata: RecordMetadata | null;
  previewChannel: string;
  setPreviewChannel: (v: string) => void;
  t0: number;
  setT0: (v: number) => void;
  t1: number;
  setT1: (v: number) => void;
  decimate: number;
  setDecimate: (v: number) => void;
  busy: string | null;
  onLoadWindow: () => void;
}) {
  const {
    subjectId,
    setSubjectId,
    subjects,
    records,
    recordId,
    setRecordId,
    metadata,
    previewChannel,
    setPreviewChannel,
    t0,
    setT0,
    t1,
    setT1,
    decimate,
    setDecimate,
    busy,
    onLoadWindow,
  } = props;

  const eegList = metadata ? recordEegLabels(metadata) : [];

  return (
    <aside className="border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">Wybór rekordu</h2>
      </div>

      <div className="mt-4">
        <label className="block text-xs font-medium text-muted">Badany</label>
        <select
          className="mt-2 w-full border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        >
          {subjects.length ? null : <option value="">(brak)</option>}
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label className="mt-4 block text-xs font-medium text-muted">Rekord</label>
        <select
          className="mt-2 w-full border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
          value={recordId}
          onChange={(e) => setRecordId(e.target.value)}
        >
          {records.length ? null : <option value="">(brak rekordów)</option>}
          {records.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id}
            </option>
          ))}
        </select>
        <div className="mt-2 text-xs text-muted">
          {recordId ? (
            <span>
              Identyfikator:{' '}
              <code className="border border-border bg-surface px-2 py-1">{recordId}</code>
            </span>
          ) : (
            <span>Wybierz rekord.</span>
          )}
        </div>
      </div>

      {metadata ? (
        <div className="mt-6">
          <label className="block text-xs font-medium text-muted">Elektroda podglądu</label>
          <select
            className="mt-2 w-full border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
            value={previewChannel}
            onChange={(e) => setPreviewChannel(e.target.value)}
          >
            {eegList.length ? null : <option value="">(brak)</option>}
            {eegList.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[11px] leading-snug text-muted">
            To tylko podgląd jednej elektrody. Elektrody do analizy wybiera się w zakładce <strong>Selekcja</strong>.
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted">t0 [s]</label>
          <input
            className="mt-2 w-full border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
            type="number"
            step="0.25"
            value={t0}
            onChange={(e) => setT0(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted">t1 [s]</label>
          <input
            className="mt-2 w-full border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
            type="number"
            step="0.25"
            value={t1}
            onChange={(e) => setT1(Number(e.target.value))}
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-muted">Decymacja</label>
          <select
            className="mt-2 w-full border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
            value={decimate}
            onChange={(e) => setDecimate(Number(e.target.value))}
          >
            {[1, 2, 4, 8, 16].map((d) => (
              <option key={d} value={d}>
                co {d}-ta próbka
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        className="mt-6 w-full border border-border bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onLoadWindow}
        disabled={!recordId || !previewChannel || busy !== null}
        type="button"
      >
        Pokaż okno
      </button>
    </aside>
  );
}
