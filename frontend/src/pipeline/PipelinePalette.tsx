import { BLOCKS, type BlockDefinition } from './blockRegistry';
import type { BlockKind, Etap } from './types';

const ETAPY: Array<{ etap: Etap; tytul: string }> = [
  { etap: 'wstepne', tytul: 'Przetwarzanie wstępne' },
  { etap: 'wyniki', tytul: 'Wyniki ze spektrogramu' },
];

function PrzyciskBloku(props: { blok: BlockDefinition; zajety: boolean; onAdd: () => void }) {
  const { blok, zajety, onAdd } = props;
  return (
    <button
      type="button"
      disabled={zajety}
      onClick={onAdd}
      className={[
        'w-full border px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-accent/20',
        zajety ? 'cursor-not-allowed border-border bg-bg opacity-60' : 'border-border bg-surface hover:bg-bg',
      ].join(' ')}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="truncate text-sm font-medium text-text">{blok.title}</div>
        {zajety ? <span className="shrink-0 text-[11px] text-muted">na planszy</span> : null}
      </div>
      <div className="mt-0.5 line-clamp-2 text-xs text-muted">{blok.subtitle}</div>
    </button>
  );
}

export function PipelinePalette(props: { onAddBlock: (kind: BlockKind) => void; zajete: BlockKind[] }) {
  const { onAddBlock, zajete } = props;

  return (
    <div className="border border-border bg-surface">
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold text-text">Bloki</h3>
      </div>

      {ETAPY.map(({ etap, tytul }) => (
        <div key={etap} className="border-t border-border px-2 pb-2">
          <div className="px-2 pb-1.5 pt-2.5 text-[11px] font-medium uppercase tracking-wide text-muted">{tytul}</div>
          <div className="grid grid-cols-1 gap-2">
            {BLOCKS.filter((b) => b.etap === etap).map((b) => (
              <PrzyciskBloku
                key={b.kind}
                blok={b}
                zajety={b.etap === 'wyniki' && zajete.includes(b.kind)}
                onAdd={() => onAddBlock(b.kind)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
