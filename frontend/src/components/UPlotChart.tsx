import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useEffect, useMemo, useRef } from 'react';

type Props = {
  title: string;
  seriesLabel: string;
  x: number[];
  y: number[];
  height?: number;
  eventMarkers?: number[];
};

export function UPlotChart({
  title,
  seriesLabel,
  x,
  y,
  height = 360,
  eventMarkers = [],
}: Props) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);

  const data = useMemo(() => [x, y] as uPlot.AlignedData, [x, y]);

  useEffect(() => {
    if (!elRef.current) return;
    if (plotRef.current) {
      plotRef.current.destroy();
      plotRef.current = null;
    }

    const opts: uPlot.Options = {
      title,
      width: elRef.current.clientWidth || 900,
      height,
      scales: { x: { time: false } },
      axes: [
        {
          stroke: '#516579',
          grid: { stroke: 'rgba(215,224,234,0.7)' },
        },
        {
          stroke: '#516579',
          grid: { stroke: 'rgba(215,224,234,0.7)' },
        },
      ],
      series: [
        {},
        {
          label: seriesLabel,
          stroke: '#1e66d0',
          width: 1,
        },
      ],
      hooks: {
        draw: [
          (u) => {
            if (!eventMarkers.length) return;
            const ctx = u.ctx;
            ctx.save();
            ctx.strokeStyle = 'rgba(11, 27, 42, 0.18)';
            ctx.lineWidth = 1;
            for (const t of eventMarkers) {
              const xPos = u.valToPos(t, 'x', true);
              ctx.beginPath();
              ctx.moveTo(xPos, u.bbox.top);
              ctx.lineTo(xPos, u.bbox.top + u.bbox.height);
              ctx.stroke();
            }
            ctx.restore();
          },
        ],
      },
    };

    plotRef.current = new uPlot(opts, data, elRef.current);

    const onResize = () => {
      if (!plotRef.current || !elRef.current) return;
      plotRef.current.setSize({ width: elRef.current.clientWidth, height });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, [data, title, seriesLabel, height, eventMarkers]);

  return <div ref={elRef} className="w-full" />;
}

