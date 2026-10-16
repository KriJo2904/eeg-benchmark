import type { ReactNode } from 'react';

export function ContextMenu(props: {
  x: number;
  y: number;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { x, y, title, onClose, children } = props;

  return (
    <div
      className="fixed inset-0 z-[60]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className="absolute w-[240px] border border-border bg-surface shadow-lg"
        style={{ left: x, top: y }}
      >
        {title ? (
          <div className="border-b border-border px-3 py-2 text-xs font-semibold text-muted">{title}</div>
        ) : null}
        <div className="p-1">{children}</div>
      </div>
    </div>
  );
}

export function ContextMenuItem(props: { onClick: () => void; children: ReactNode; danger?: boolean }) {
  const { onClick, children, danger } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full px-2 py-2 text-left text-sm',
        danger ? 'text-danger hover:bg-dangerSoft' : 'text-text hover:bg-bg',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

