import { useCallback, useEffect, useRef, useState } from 'react';
import { getAnalysis } from '../projectsApi';
import type { PodsumowanieAnalizy } from '../results/analizaTypes';

export type FazaAnalizy = 'bezczynna' | 'liczenie' | 'zapis';

export type AnalizaState = {
  faza: FazaAnalizy;
  postep: { gotowe: number; wszystkie: number };
  uplynelo: number;
  blad: string | null;
  wynik: PodsumowanieAnalizy | null;
  utworzono: string | null;
  uruchom: () => void;
  anuluj: () => void;
};

export function useAnaliza(projectId: string): AnalizaState {
  const [faza, setFaza] = useState<FazaAnalizy>('bezczynna');
  const [postep, setPostep] = useState({ gotowe: 0, wszystkie: 0 });
  const [uplynelo, setUplynelo] = useState(0);
  const [blad, setBlad] = useState<string | null>(null);
  const [wynik, setWynik] = useState<PodsumowanieAnalizy | null>(null);
  const [utworzono, setUtworzono] = useState<string | null>(null);
  const zrodloRef = useRef<EventSource | null>(null);
  const startRef = useRef(0);

  const wczytajWynik = useCallback(() => {
    getAnalysis(projectId)
      .then((r) => {
        setWynik(r?.summary ?? null);
        setUtworzono(r?.createdAt ?? null);
      })
      .catch((e: unknown) => setBlad(e instanceof Error ? e.message : String(e)));
  }, [projectId]);

  useEffect(() => {
    if (projectId) wczytajWynik();
  }, [projectId, wczytajWynik]);

  useEffect(() => {
    if (faza === 'bezczynna') return;
    const t = window.setInterval(() => setUplynelo((performance.now() - startRef.current) / 1000), 200);
    return () => window.clearInterval(t);
  }, [faza]);

  useEffect(() => () => zrodloRef.current?.close(), []);

  const zakoncz = useCallback(() => {
    zrodloRef.current?.close();
    zrodloRef.current = null;
    setFaza('bezczynna');
  }, []);

  const uruchom = useCallback(() => {
    zrodloRef.current?.close();
    setBlad(null);
    setPostep({ gotowe: 0, wszystkie: 0 });
    setUplynelo(0);
    startRef.current = performance.now();
    setFaza('liczenie');

    const es = new EventSource(`/api/projects/${encodeURIComponent(projectId)}/analysis/stream`);
    zrodloRef.current = es;
    const dane = (ev: Event) => JSON.parse((ev as MessageEvent).data);

    es.addEventListener('start', (ev) => setPostep({ gotowe: 0, wszystkie: dane(ev).records }));
    es.addEventListener('progress', (ev) => {
      const d = dane(ev);
      setPostep({ gotowe: d.done, wszystkie: d.total });
    });
    es.addEventListener('saving', () => setFaza('zapis'));
    es.addEventListener('done', () => {
      zakoncz();
      wczytajWynik();
    });
    es.addEventListener('analysis-error', (ev) => {
      setBlad(dane(ev).message);
      zakoncz();
    });
    es.onerror = () => {
      if (zrodloRef.current !== es) return;
      setBlad('Połączenie z backendem przerwane.');
      zakoncz();
    };
  }, [projectId, wczytajWynik, zakoncz]);

  const anuluj = useCallback(() => {
    zakoncz();
    setBlad('Analiza anulowana.');
  }, [zakoncz]);

  return { faza, postep, uplynelo, blad, wynik, utworzono, uruchom, anuluj };
}
