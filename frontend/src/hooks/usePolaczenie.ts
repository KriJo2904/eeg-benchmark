import { useCallback, useEffect, useRef, useState } from 'react';
import {
  adresBackendu,
  dodajOstatniBackend,
  normalizujAdres,
  pingBackendu,
  statusBackendu,
  zapiszAdresBackendu,
  type Odpowiedz,
  type StatusBackendu,
} from '../polaczenie';

const CO_ILE_MS = 5000;
const PRZERWA_MS = 12000;

export type StanPolaczenia = {
  adres: string;
  backend: Odpowiedz;
  status: StatusBackendu | null;
  sprawdzono: Date;
};

export type Poziom = 'brak' | 'sprawdzanie' | 'ok' | 'uwaga' | 'blad';

export type Polaczenie = {
  adres: string;
  stan: StanPolaczenia | null;
  poziom: Poziom;
  polaczony: boolean;
  polacz: (wpisany: string) => Promise<StanPolaczenia>;
  rozlacz: () => void;
};

async function sprawdzPolaczenie(adres: string): Promise<StanPolaczenia> {
  const [backend, status] = await Promise.all([pingBackendu(adres), statusBackendu(adres)]);
  return { adres, backend, status, sprawdzono: new Date() };
}

function poziomPolaczenia(adres: string, stan: StanPolaczenia | null, polaczony: boolean): Poziom {
  if (!adres) return 'brak';
  if (!stan) return 'sprawdzanie';
  if (!polaczony || !stan.backend.ok) return 'blad';
  if (stan.status && !stan.status.projectsApi.ok) return 'uwaga';
  return 'ok';
}

export function usePolaczenie(): Polaczenie {
  const [adres, setAdres] = useState(adresBackendu);
  const [stan, setStan] = useState<StanPolaczenia | null>(null);
  const [polaczony, setPolaczony] = useState(false);
  const ostatniOk = useRef<number | null>(null);
  const aktualnyAdres = useRef(adres);

  const sprawdz = useCallback(async () => {
    if (!adres) return;
    const nowy = await sprawdzPolaczenie(adres);
    if (aktualnyAdres.current !== adres) return;
    if (nowy.backend.ok) ostatniOk.current = Date.now();
    setStan(nowy);
    setPolaczony(ostatniOk.current !== null && Date.now() - ostatniOk.current < PRZERWA_MS);
  }, [adres]);

  useEffect(() => {
    if (!adres) return;
    const tik = () => {
      if (document.visibilityState === 'visible') void sprawdz();
    };
    tik();
    const timer = window.setInterval(tik, CO_ILE_MS);
    document.addEventListener('visibilitychange', tik);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tik);
    };
  }, [adres, sprawdz]);

  const polacz = useCallback(async (wpisany: string) => {
    const nowyAdres = normalizujAdres(wpisany);
    const wynik = await sprawdzPolaczenie(nowyAdres);
    if (wynik.backend.ok) {
      zapiszAdresBackendu(nowyAdres);
      dodajOstatniBackend(nowyAdres);
      aktualnyAdres.current = nowyAdres;
      ostatniOk.current = Date.now();
      setAdres(nowyAdres);
      setStan(wynik);
      setPolaczony(true);
    }
    return wynik;
  }, []);

  const rozlacz = useCallback(() => {
    zapiszAdresBackendu('');
    aktualnyAdres.current = '';
    ostatniOk.current = null;
    setAdres('');
    setStan(null);
    setPolaczony(false);
  }, []);

  return { adres, stan, poziom: poziomPolaczenia(adres, stan, polaczony), polaczony, polacz, rozlacz };
}
