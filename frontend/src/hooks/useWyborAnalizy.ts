import { useEffect, useMemo, useRef, useState } from 'react';
import { getMetadata, listSubjectRecords, listSubjects, listTasks, type TypZadania } from '../api';
import { recordEegLabels } from '../lib/eegChannels';
import {
  badaniZZakresu,
  PUSTY_WYBOR,
  wczytajWybor,
  zapiszWybor,
  type WyborAnalizy,
} from '../state/wyborAnalizy';

export type StatusZapisu = 'idle' | 'saving' | 'saved' | 'error';

export type WyborState = {
  wybor: WyborAnalizy;
  zmien: (zmiana: Partial<WyborAnalizy>) => void;
  wszyscyBadani: string[];
  wybraniBadani: string[];
  zadania: TypZadania[];
  elektrody: string[];
  liczbaRekordow: number;
  zaladowany: boolean;
  statusZapisu: StatusZapisu;
  blad: string | null;
};

export function useWyborAnalizy(projectId: string): WyborState {
  const [wybor, setWybor] = useState<WyborAnalizy>(PUSTY_WYBOR);
  const [wszyscyBadani, setWszyscyBadani] = useState<string[]>([]);
  const [zadania, setZadania] = useState<TypZadania[]>([]);
  const [elektrody, setElektrody] = useState<string[]>([]);
  const [zaladowany, setZaladowany] = useState(false);
  const [statusZapisu, setStatusZapisu] = useState<StatusZapisu>('idle');
  const [blad, setBlad] = useState<string | null>(null);
  const zmienionyPrzezUzytkownika = useRef(false);

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    zmienionyPrzezUzytkownika.current = false;

    (async () => {
      const [w, s, t] = await Promise.all([wczytajWybor(projectId), listSubjects(), listTasks()]);
      const rekordy = s.subjects.length ? await listSubjectRecords(s.subjects[0]) : { records: [] };
      const meta = rekordy.records.length ? await getMetadata(rekordy.records[0].id) : null;
      if (!alive) return;
      setWybor(w);
      setWszyscyBadani(s.subjects);
      setZadania(t.tasks);
      setElektrody(meta ? recordEegLabels(meta) : []);
      setZaladowany(true);
    })().catch((e: unknown) => {
      if (alive) setBlad(e instanceof Error ? e.message : String(e));
    });

    return () => {
      alive = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (!zaladowany || !zmienionyPrzezUzytkownika.current) return;
    const t = window.setTimeout(() => {
      setStatusZapisu('saving');
      zapiszWybor(projectId, wybor)
        .then(() => setStatusZapisu('saved'))
        .catch((e: unknown) => {
          setBlad(e instanceof Error ? e.message : String(e));
          setStatusZapisu('error');
        });
    }, 500);
    return () => window.clearTimeout(t);
  }, [projectId, wybor, zaladowany]);

  function zmien(zmiana: Partial<WyborAnalizy>) {
    zmienionyPrzezUzytkownika.current = true;
    setWybor((prev) => {
      const nowy = { ...prev, ...zmiana };
      if (nowy.trybBadanych === 'wszyscy') nowy.subjects = 'all';
      if (nowy.trybBadanych === 'zakres') {
        nowy.subjects = badaniZZakresu(wszyscyBadani, nowy.zakresOd, nowy.zakresDo);
      }
      if (nowy.trybBadanych === 'lista' && nowy.subjects === 'all') nowy.subjects = [];
      return nowy;
    });
  }

  const wybraniBadani = useMemo(
    () => (wybor.subjects === 'all' ? wszyscyBadani : wybor.subjects),
    [wybor.subjects, wszyscyBadani],
  );

  const liczbaRekordow = useMemo(() => {
    const naBadanego = zadania
      .filter((z) => wybor.tasks.includes(z.id))
      .reduce((suma, z) => suma + z.runs.length, 0);
    return naBadanego * wybraniBadani.length;
  }, [wybor.tasks, wybraniBadani, zadania]);

  return {
    wybor,
    zmien,
    wszyscyBadani,
    wybraniBadani,
    zadania,
    elektrody,
    liczbaRekordow,
    zaladowany,
    statusZapisu,
    blad,
  };
}
