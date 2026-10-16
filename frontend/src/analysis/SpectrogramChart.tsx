import { useCallback, useEffect, useRef, useState } from 'react';
import { zbudujTabliceKolorow, zbudujTabliceRozbiezna } from './colormap';
import type { DaneSpektrogramu, RodzajMapy } from './spectrogramTypes';

const LICZBA_KOLOROW = 256;
const PALETY = {
  moc: zbudujTabliceKolorow(LICZBA_KOLOROW),
  erd: zbudujTabliceRozbiezna(LICZBA_KOLOROW),
};

const MARGINES = { gora: 12, prawo: 60, dol: 36, lewo: 52 };

type Props = {
  dane: DaneSpektrogramu;
  pasmoMin?: number;
  pasmoMax?: number;
  wysokosc?: number;
  rodzaj?: RodzajMapy;
};

export function WykresSpektrogramu({ dane, pasmoMin, pasmoMax, wysokosc = 320, rodzaj = 'moc' }: Props) {
  const kolory = PALETY[rodzaj];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const kontenerRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; czas: number; czest: number; moc: number;
  } | null>(null);

  const rysuj = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const szer = canvas.clientWidth;
    const wys = wysokosc;
    canvas.width = szer * dpr;
    canvas.height = wys * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, szer, wys);

    const szerWykresu = szer - MARGINES.lewo - MARGINES.prawo;
    const wysWykresu = wys - MARGINES.gora - MARGINES.dol;
    if (szerWykresu <= 0 || wysWykresu <= 0) return;

    const { macierz, osCzasu, osCzestotliwosci, minMoc, maxMoc } = dane;
    const liczbaCzest = osCzestotliwosci.length;
    const liczbaCzas = osCzasu.length;
    const zakres = maxMoc - minMoc || 1;

    const obraz = ctx.createImageData(liczbaCzas, liczbaCzest);
    for (let fi = 0; fi < liczbaCzest; fi++) {
      const wiersz = liczbaCzest - 1 - fi;
      for (let ti = 0; ti < liczbaCzas; ti++) {
        const norm = (macierz[wiersz][ti] - minMoc) / zakres;
        const idx = Math.max(0, Math.min(LICZBA_KOLOROW - 1, Math.round(norm * (LICZBA_KOLOROW - 1))));
        const px = (fi * liczbaCzas + ti) * 4;
        obraz.data[px] = kolory[idx * 3];
        obraz.data[px + 1] = kolory[idx * 3 + 1];
        obraz.data[px + 2] = kolory[idx * 3 + 2];
        obraz.data[px + 3] = 255;
      }
    }

    const tmp = document.createElement('canvas');
    tmp.width = liczbaCzas;
    tmp.height = liczbaCzest;
    tmp.getContext('2d')!.putImageData(obraz, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, MARGINES.lewo, MARGINES.gora, szerWykresu, wysWykresu);

    if (rodzaj === 'erd' && osCzasu[0] < 0) {
      const x0 = MARGINES.lewo + szerWykresu * ((0 - osCzasu[0]) / (osCzasu[liczbaCzas - 1] - osCzasu[0]));
      ctx.strokeStyle = 'rgba(11, 27, 42, 0.7)';
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(x0, MARGINES.gora);
      ctx.lineTo(x0, MARGINES.gora + wysWykresu);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (pasmoMin != null && pasmoMax != null) {
      const fMin = osCzestotliwosci[0];
      const fMax = osCzestotliwosci[osCzestotliwosci.length - 1];
      const zakresF = fMax - fMin;
      const y1 = MARGINES.gora + wysWykresu * (1 - (pasmoMax - fMin) / zakresF);
      const y2 = MARGINES.gora + wysWykresu * (1 - (pasmoMin - fMin) / zakresF);

      ctx.fillStyle = 'rgba(30, 102, 208, 0.15)';
      ctx.fillRect(MARGINES.lewo, y1, szerWykresu, y2 - y1);
      ctx.strokeStyle = 'rgba(30, 102, 208, 0.6)';
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(MARGINES.lewo, y1);
      ctx.lineTo(MARGINES.lewo + szerWykresu, y1);
      ctx.moveTo(MARGINES.lewo, y2);
      ctx.lineTo(MARGINES.lewo + szerWykresu, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = '#516579';
    ctx.font = '10px ui-sans-serif, system-ui, sans-serif';

    ctx.textAlign = 'center';
    const tMin = osCzasu[0];
    const tMax = osCzasu[osCzasu.length - 1];
    for (let i = 0; i <= 6; i++) {
      const t = tMin + (i / 6) * (tMax - tMin);
      const x = MARGINES.lewo + (i / 6) * szerWykresu;
      ctx.fillText(t.toFixed(1), x, wys - MARGINES.dol + 14);
    }
    ctx.fillText('Czas [s]', MARGINES.lewo + szerWykresu / 2, wys - 4);

    ctx.textAlign = 'right';
    const fMin = osCzestotliwosci[0];
    const fMax = osCzestotliwosci[osCzestotliwosci.length - 1];
    for (let i = 0; i <= 6; i++) {
      const f = fMin + (i / 6) * (fMax - fMin);
      const y = MARGINES.gora + wysWykresu * (1 - i / 6);
      ctx.fillText(f.toFixed(0), MARGINES.lewo - 6, y + 3);
    }
    ctx.save();
    ctx.translate(12, MARGINES.gora + wysWykresu / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Częstotliwość [Hz]', 0, 0);
    ctx.restore();

    const pasekX = szer - MARGINES.prawo + 14;
    const pasekSzer = 12;
    for (let py = 0; py < wysWykresu; py++) {
      const norm = 1 - py / wysWykresu;
      const idx = Math.max(0, Math.min(LICZBA_KOLOROW - 1, Math.round(norm * (LICZBA_KOLOROW - 1))));
      ctx.fillStyle = `rgb(${kolory[idx * 3]},${kolory[idx * 3 + 1]},${kolory[idx * 3 + 2]})`;
      ctx.fillRect(pasekX, MARGINES.gora + py, pasekSzer, 1);
    }
    ctx.strokeStyle = '#d7e0ea';
    ctx.lineWidth = 1;
    ctx.strokeRect(pasekX, MARGINES.gora, pasekSzer, wysWykresu);
    ctx.fillStyle = '#516579';
    ctx.textAlign = 'left';
    const jednostka = rodzaj === 'erd' ? ' %' : '';
    ctx.fillText(maxMoc.toFixed(1) + jednostka, pasekX + pasekSzer + 4, MARGINES.gora + 8);
    ctx.fillText(minMoc.toFixed(1) + jednostka, pasekX + pasekSzer + 4, MARGINES.gora + wysWykresu);
  }, [dane, pasmoMin, pasmoMax, wysokosc, rodzaj, kolory]);

  useEffect(() => {
    if (canvasRef.current) rysuj(canvasRef.current);
  }, [rysuj]);

  useEffect(() => {
    const el = kontenerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (canvasRef.current) rysuj(canvasRef.current);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [rysuj]);

  function obsluzRuchMyszy(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const szerWykresu = canvas.clientWidth - MARGINES.lewo - MARGINES.prawo;
    const wysWykresu = wysokosc - MARGINES.gora - MARGINES.dol;
    const rx = (mx - MARGINES.lewo) / szerWykresu;
    const ry = (my - MARGINES.gora) / wysWykresu;

    if (rx < 0 || rx > 1 || ry < 0 || ry > 1) {
      setTooltip(null);
      return;
    }

    const { osCzasu, osCzestotliwosci, macierz } = dane;
    const ti = Math.min(osCzasu.length - 1, Math.max(0, Math.round(rx * (osCzasu.length - 1))));
    const fi = Math.min(osCzestotliwosci.length - 1, Math.max(0, Math.round((1 - ry) * (osCzestotliwosci.length - 1))));

    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      czas: osCzasu[ti],
      czest: osCzestotliwosci[fi],
      moc: macierz[fi][ti],
    });
  }

  return (
    <div ref={kontenerRef} className="relative w-full">
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: wysokosc }}
        onMouseMove={obsluzRuchMyszy}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip ? (
        <div
          className="pointer-events-none absolute z-10 border border-border bg-surface px-2 py-1 text-xs text-text shadow-sm"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          {tooltip.czas.toFixed(2)} s &middot; {tooltip.czest.toFixed(1)} Hz &middot;{' '}
          {rodzaj === 'erd' ? `ERD: ${tooltip.moc.toFixed(1)} %` : `moc: ${tooltip.moc.toFixed(2)}`}
        </div>
      ) : null}
    </div>
  );
}
