import { useMemo } from 'react';
import { computeElectrodeLayout } from './electrodeLayout';

type Props = {
  channels: string[];
  selected: string[];
  onToggle?: (label: string) => void;
  size?: number;
};

const HEAD_STROKE = '#334155';
const HEAD_FILL = '#f8fafc';

export function HeadTopographyPlot(props: Props) {
  const { channels, selected, onToggle, size = 340 } = props;

  const positions = useMemo(() => computeElectrodeLayout(channels), [channels]);

  const pad = 0.15;
  const scale = size / (2 * (1 + pad));
  const cx = size / 2;
  const cy = size / 2;
  const project = (x: number, y: number) => ({
    px: cx + x * scale,
    py: cy - y * scale,
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Topografia elektrod EEG"
      className="select-none"
    >
      <circle cx={cx} cy={cy} r={scale} fill={HEAD_FILL} stroke={HEAD_STROKE} strokeWidth={1.5} />
      <polygon
        points={`${cx - scale * 0.08},${cy - scale} ${cx + scale * 0.08},${cy - scale} ${cx},${cy - scale * 1.12}`}
        fill={HEAD_FILL}
        stroke={HEAD_STROKE}
        strokeWidth={1.5}
      />
      <ellipse
        cx={cx - scale}
        cy={cy}
        rx={scale * 0.06}
        ry={scale * 0.15}
        fill={HEAD_FILL}
        stroke={HEAD_STROKE}
        strokeWidth={1.5}
      />
      <ellipse
        cx={cx + scale}
        cy={cy}
        rx={scale * 0.06}
        ry={scale * 0.15}
        fill={HEAD_FILL}
        stroke={HEAD_STROKE}
        strokeWidth={1.5}
      />

      {positions.map((p) => {
        const { px, py } = project(p.x, p.y);
        const isSelected = selected.includes(p.label);
        const r = 10;
        const clickable = Boolean(onToggle);
        return (
          <g
            key={p.label}
            transform={`translate(${px}, ${py})`}
            style={clickable ? { cursor: 'pointer' } : undefined}
            onClick={onToggle ? () => onToggle(p.label) : undefined}
          >
            <circle
              r={r}
              fill={isSelected ? '#1e66d0' : '#e2e8f0'}
              stroke={isSelected ? '#0f172a' : '#64748b'}
              strokeWidth={isSelected ? 2 : 1}
            />
            <text
              y={3}
              textAnchor="middle"
              fontSize={9}
              fontFamily="ui-sans-serif, system-ui"
              fill={isSelected ? '#ffffff' : '#0f172a'}
              pointerEvents="none"
            >
              {p.label.replace(/\.+$/, '')}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

