import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useEffect, useRef } from 'react';

export type Seria = { etykieta: string; wartosci: number[]; kolor: string };

type Props = {
  tytul: string;
  x: number[];
  serie: Seria[];
  wysokosc?: number;
  zakresY?: [number, number];
  znacznikZera?: boolean;
};

export function WykresWieluSerii({ tytul, x, serie, wysokosc = 260, zakresY, znacznikZera }: Props) {
  const elRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const opts: uPlot.Options = {
      title: tytul,
      width: el.clientWidth || 600,
      height: wysokosc,
      scales: { x: { time: false }, y: zakresY ? { range: () => zakresY } : {} },
      axes: [
        { stroke: '#516579', grid: { stroke: 'rgba(215,224,234,0.7)' }, label: 'Czas od zdarzenia [s]' },
        { stroke: '#516579', grid: { stroke: 'rgba(215,224,234,0.7)' }, label: 'ERD [%]' },
      ],
      series: [{}, ...serie.map((s) => ({ label: s.etykieta, stroke: s.kolor, width: 1.5 }))],
      legend: { show: false },
      hooks: {
        draw: [
          (u) => {
            if (!znacznikZera) return;
            const ctx = u.ctx;
            ctx.save();
            ctx.strokeStyle = 'rgba(11, 27, 42, 0.45)';
            ctx.setLineDash([4, 3]);
            const x0 = u.valToPos(0, 'x', true);
            const y0 = u.valToPos(0, 'y', true);
            ctx.beginPath();
            ctx.moveTo(x0, u.bbox.top);
            ctx.lineTo(x0, u.bbox.top + u.bbox.height);
            ctx.moveTo(u.bbox.left, y0);
            ctx.lineTo(u.bbox.left + u.bbox.width, y0);
            ctx.stroke();
            ctx.restore();
          },
        ],
      },
    };

    const dane = [x, ...serie.map((s) => s.wartosci)] as uPlot.AlignedData;
    const wykres = new uPlot(opts, dane, el);

    const obserwator = new ResizeObserver(() => wykres.setSize({ width: el.clientWidth, height: wysokosc }));
    obserwator.observe(el);
    return () => {
      obserwator.disconnect();
      wykres.destroy();
    };
  }, [tytul, x, serie, wysokosc, zakresY, znacznikZera]);

  return <div ref={elRef} className="w-full" />;
}
