const KLUCZ_ADRESU = 'eeg.adresBackendu';
const KLUCZ_OSTATNICH = 'eeg.ostatnieBackendy';
const ILE_OSTATNICH = 5;
const DOMYSLNY_PORT = '8080';
const LIMIT_MS = 4000;

export function adresBackendu(): string {
  try {
    return sessionStorage.getItem(KLUCZ_ADRESU) ?? '';
  } catch (e) {
    console.warn(e);
    return '';
  }
}

export function zapiszAdresBackendu(adres: string) {
  try {
    if (adres) sessionStorage.setItem(KLUCZ_ADRESU, adres);
    else sessionStorage.removeItem(KLUCZ_ADRESU);
  } catch (e) {
    console.warn(e);
  }
}

export function ostatnieBackendy(): string[] {
  try {
    const lista: unknown = JSON.parse(localStorage.getItem(KLUCZ_OSTATNICH) ?? '[]');
    return Array.isArray(lista) ? lista.filter((a): a is string => typeof a === 'string') : [];
  } catch (e) {
    console.warn(e);
    return [];
  }
}

export function dodajOstatniBackend(adres: string) {
  const lista = [adres, ...ostatnieBackendy().filter((a) => a !== adres)].slice(0, ILE_OSTATNICH);
  try {
    localStorage.setItem(KLUCZ_OSTATNICH, JSON.stringify(lista));
  } catch (e) {
    console.warn(e);
  }
}

export function opisAdresu(adres: string): string {
  return adres.replace(/^http:\/\//, '');
}

export function backendUrl(sciezka: string): string {
  return adresBackendu() + sciezka;
}

export function normalizujAdres(wpisany: string): string {
  let tekst = wpisany.trim().replace(/\/+$/, '');
  if (!tekst) throw new Error('Wpisz adres backendu.');
  const bezSchematu = !/^https?:\/\//i.test(tekst);
  if (bezSchematu) tekst = `http://${tekst}`;
  let url: URL;
  try {
    url = new URL(tekst);
  } catch {
    throw new Error('To nie jest poprawny adres.');
  }
  if (bezSchematu && !url.port) url.port = DOMYSLNY_PORT;
  return `${url.protocol}//${url.host}`;
}

export type Odpowiedz = { ok: boolean; ms: number; blad: string | null };

export type StatusBackendu = {
  host: string;
  threads: number;
  projectsApi: { url: string; ok: boolean; ms: number; error?: string };
};

async function zapytaj(url: string): Promise<{ odp: Odpowiedz; dane: unknown }> {
  const kontroler = new AbortController();
  const timer = window.setTimeout(() => kontroler.abort(), LIMIT_MS);
  const start = performance.now();
  try {
    const res = await fetch(url, { signal: kontroler.signal, cache: 'no-store' });
    const ms = performance.now() - start;
    const dane: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const tekst = (dane as { error?: string } | null)?.error;
      return { odp: { ok: false, ms, blad: tekst ?? `HTTP ${res.status}` }, dane: null };
    }
    return { odp: { ok: true, ms, blad: null }, dane };
  } catch {
    const ms = performance.now() - start;
    const blad = kontroler.signal.aborted ? `brak odpowiedzi w ${LIMIT_MS / 1000} s` : 'nie można się połączyć';
    return { odp: { ok: false, ms, blad }, dane: null };
  } finally {
    window.clearTimeout(timer);
  }
}

export async function pingBackendu(adres: string): Promise<Odpowiedz> {
  return (await zapytaj(`${adres}/api/ping`)).odp;
}

export async function statusBackendu(adres: string): Promise<StatusBackendu | null> {
  const { odp, dane } = await zapytaj(`${adres}/api/status`);
  return odp.ok ? (dane as StatusBackendu) : null;
}
