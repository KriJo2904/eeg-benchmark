import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import type { PipelineNodeData } from './types';

const ZNACZEK: Record<PipelineNodeData['kind'], { tekst: string; kolor: string }> = {
  start: { tekst: 'Start', kolor: 'bg-[#f1f5f9] text-[#0f172a]' },
  lowpass: { tekst: 'Wstępne', kolor: 'bg-[#ecfdf3] text-[#027a48]' },
  normalize: { tekst: 'Wstępne', kolor: 'bg-[#ecfdf3] text-[#027a48]' },
  stft: { tekst: 'STFT', kolor: 'bg-accentSoft text-accent' },
  krzywa_erd: { tekst: 'Wynik', kolor: 'bg-[#fdf2fa] text-[#c11574]' },
  mapa_erd: { tekst: 'Wynik', kolor: 'bg-[#fdf2fa] text-[#c11574]' },
};

function podtytul(data: PipelineNodeData): string {
  if (data.kind === 'start') return 'Epoka EEG, −1 do +4 s';
  if (data.kind === 'lowpass') return `cutoff ${data.params.cutoffHz} Hz • rząd ${data.params.order}`;
  if (data.kind === 'normalize') return `metoda ${data.params.method}`;
  if (data.kind === 'stft') return `okno ${data.params.windowSize} • nakładanie ${(data.params.overlap * 100).toFixed(0)}%`;
  return `${data.params.fMin}–${data.params.fMax} Hz`;
}

export function PipelineNode(props: NodeProps<PipelineNodeData>) {
  const { data, selected } = props;
  const znaczek = ZNACZEK[data.kind];
  const maWejscie = data.kind !== 'start';
  const maWyjscie = data.kind !== 'krzywa_erd' && data.kind !== 'mapa_erd';

  const shellClass = selected ? 'border-accent ring-2 ring-accent/20' : 'border-border hover:border-border/70';

  return (
    <div className={['w-[240px] border bg-surface shadow-sm', shellClass].join(' ')}>
      <div className="flex items-start justify-between gap-2 px-3 pt-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-text">{data.label}</div>
          <div className="mt-0.5 truncate text-xs text-muted">{podtytul(data)}</div>
        </div>
        <span className={['shrink-0 border border-border px-2 py-1 text-[11px] font-semibold', znaczek.kolor].join(' ')}>
          {znaczek.tekst}
        </span>
      </div>

      <div className="relative px-3 pb-3">
        <div className="mt-3 h-px w-full bg-border/60" />

        <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
          <span>{maWejscie ? 'IN' : ''}</span>
          <span>{maWyjscie ? 'OUT' : ''}</span>
        </div>

        {maWejscie ? (
          <Handle
            type="target"
            position={Position.Left}
            className="!h-3 !w-3 !border-2 !border-surface !bg-muted/70"
          />
        ) : null}
        {maWyjscie ? (
          <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-surface !bg-accent" />
        ) : null}
      </div>
    </div>
  );
}
