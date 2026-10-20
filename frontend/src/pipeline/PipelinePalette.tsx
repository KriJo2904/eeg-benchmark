import { BLOCK_CATEGORY_LABEL, BLOCKS, type BlockCategoryId } from './blockRegistry';

export function PipelinePalette(props: {
  onAddBlock: (kind: (typeof BLOCKS)[number]['kind']) => void;
  disabled?: boolean;
}) {
  const { onAddBlock, disabled } = props;

  const byCategory = BLOCKS.reduce(
    (acc, b) => {
      acc[b.category].push(b);
      return acc;
    },
    { processing: [] as typeof BLOCKS, analysis: [] as typeof BLOCKS },
  );

  const order: BlockCategoryId[] = ['analysis', 'processing'];

  return (
    <div className="border border-border bg-surface">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-text">Bloki</h3>
          <p className="mt-0.5 text-xs text-muted">
            Kliknięcie wstawia blok na planszę. Potem łączy się go kreską z poprzednim.
          </p>
        </div>
      </div>

      <div className="border-t border-border px-2 py-2">
        <div className="flex flex-col gap-4">
          {order.map((cat) => (
            <div key={cat}>
              <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                {BLOCK_CATEGORY_LABEL[cat]}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {byCategory[cat].map((b) => (
                  <button
                    key={b.kind}
                    type="button"
                    disabled={disabled}
                    onClick={() => onAddBlock(b.kind)}
                    className={[
                      'group w-full border px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-accent/20',
                      disabled
                        ? 'cursor-not-allowed border-border bg-bg opacity-60'
                        : 'border-border bg-surface hover:border-border/70 hover:bg-bg',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-text">{b.title}</div>
                        <div className="mt-0.5 line-clamp-2 text-xs text-muted">{b.subtitle}</div>
                      </div>
                      <span className="shrink-0 border border-border bg-accentSoft px-2 py-1 text-[11px] font-semibold text-accent group-hover:opacity-95">
                        {b.badge}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

