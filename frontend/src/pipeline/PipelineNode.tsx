import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import type { PipelineNodeData } from './types';

function badgeColor(badge: string) {
  if (badge === 'IO') return 'bg-[#f1f5f9] text-[#0f172a]';
  if (badge === 'FFT') return 'bg-accentSoft text-accent';
  if (badge === 'Filter') return 'bg-[#ecfdf3] text-[#027a48]';
  if (badge === 'Prep') return 'bg-[#fdf2fa] text-[#c11574]';
  if (badge === 'STFT') return 'bg-[#fef3c7] text-[#92400e]';
  if (badge === 'BP') return 'bg-[#fef3c7] text-[#92400e]';
  return 'bg-accentSoft text-accent';
}

export function PipelineNode(props: NodeProps<PipelineNodeData>) {
  const { data, selected } = props;

  const BADGE: Record<PipelineNodeData['kind'], string> = {
    start: 'IO', end: 'IO', lowpass: 'Filter', fft: 'FFT', normalize: 'Prep', spektrogram: 'STFT', band_power: 'BP',
  };
  const badge = BADGE[data.kind];

  let subtitle: string | null = null;
  if (data.kind === 'start') subtitle = 'Źródło sygnału EEG';
  else if (data.kind === 'end') subtitle = 'Wynik / wyjście pipeline';
  else if (data.kind === 'lowpass')
    subtitle = `cutoff ${data.params.cutoffHz} Hz • rząd ${data.params.order}`;
  else if (data.kind === 'fft')
    subtitle = `okno ${data.params.windowSize} • overlap ${(data.params.overlap * 100).toFixed(0)}%`;
  else if (data.kind === 'normalize') subtitle = `metoda ${data.params.method}`;
  else if (data.kind === 'spektrogram') subtitle = `mapa ERD ${data.params.fMin}–${data.params.fMax} Hz`;
  else if (data.kind === 'band_power') {
    subtitle = `${data.params.fMin}–${data.params.fMax} Hz · ${data.params.agg}`;
  }

  const shellClass = selected ? 'border-accent ring-2 ring-accent/20' : 'border-border hover:border-border/70';

  return (
    <div className={['w-[240px] border bg-surface shadow-sm', shellClass].join(' ')}>
      <div className="flex items-start gap-2 px-3 pt-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-text">{data.label}</div>
              <div className="mt-0.5 truncate text-xs text-muted">{subtitle}</div>
            </div>
            <span
              className={['shrink-0 border border-border px-2 py-1 text-[11px] font-semibold', badgeColor(badge)].join(
                ' ',
              )}
            >
              {badge}
            </span>
          </div>
        </div>
      </div>

      <div className="relative px-3 pb-3">
        <div className="mt-3 h-px w-full bg-border/60" />

        <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
          <span>{data.kind === 'start' ? '' : 'IN'}</span>
          <span>{data.kind === 'end' ? '' : 'OUT'}</span>
        </div>

        {data.kind !== 'start' ? (
          <Handle
            type="target"
            position={Position.Left}
            className="!h-3 !w-3 !border-2 !border-surface !bg-muted/70"
          />
        ) : null}
        {data.kind !== 'end' ? (
          <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-surface !bg-accent" />
        ) : null}
      </div>
    </div>
  );
}
