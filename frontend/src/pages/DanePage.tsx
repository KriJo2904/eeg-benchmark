import { FileManager, type FileItem } from '@cubone/react-file-manager';
import '@cubone/react-file-manager/dist/style.css';
import { useCallback, useEffect, useState } from 'react';
import {
  anulujPobieranie,
  listaPlikow,
  listaPobieran,
  pobierzZLinku,
  sprawdzZbior,
  usunPlik,
  utworzFolder,
  zmienNazwe,
  type PlikDanych,
  type Pobieranie,
} from '../api';
import { ErrorBanner } from '../components/ErrorBanner';
import { patchProject, type Project } from '../projectsApi';

const STAN_POBIERANIA: Record<Pobieranie['state'], string> = {
  downloading: 'pobieranie',
  extracting: 'rozpakowywanie',
  done: 'gotowe',
  error: 'błąd',
  cancelled: 'anulowane',
};

function aktywne(p: Pobieranie): boolean {
  return p.state === 'downloading' || p.state === 'extracting';
}

function bajty(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} kB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function nazwaZLinku(url: string): string {
  const sciezka = url.split(/[?#]/)[0].replace(/\/+$/, '');
  const ostatni = sciezka.slice(sciezka.lastIndexOf('/') + 1);
  return ostatni.replace(/\.(zip|tar|tgz|tar\.gz|tar\.bz2|tar\.xz)$/i, '');
}

function bladTekst(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function WierszPobierania(props: { p: Pobieranie; onAnuluj: () => void }) {
  const { p } = props;
  const procent = p.total > 0 ? Math.min(100, (p.bytes / p.total) * 100) : null;
  return (
    <div className="border-t border-border py-2 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-mono text-text">{p.name}</span>
        <span className={p.state === 'error' ? 'text-danger' : 'text-muted'}>
          {STAN_POBIERANIA[p.state]}
          {p.state === 'downloading' ? ` · ${bajty(p.bytes)}${p.total ? ` z ${bajty(p.total)}` : ''}` : ''}
        </span>
      </div>
      {aktywne(p) ? (
        <div className="mt-1.5 h-1 bg-border">
          <div
            className={`h-1 bg-accent ${procent === null || p.state === 'extracting' ? 'animate-pulse' : ''}`}
            style={{ width: `${p.state === 'extracting' ? 100 : (procent ?? 100)}%` }}
          />
        </div>
      ) : null}
      {p.error ? <div className="mt-1 text-[11px] text-danger break-all">{p.error}</div> : null}
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-mono text-[10px] text-muted">{p.url}</span>
        <button type="button" onClick={props.onAnuluj} className="shrink-0 text-[11px] text-accent hover:underline">
          {aktywne(p) ? 'Anuluj' : 'Ukryj'}
        </button>
      </div>
    </div>
  );
}

export function DanePage(props: { project: Project | null; onZmianaZbioru: (zbior: string) => void }) {
  const { project, onZmianaZbioru } = props;
  const zbior = project?.dataset ?? '';

  const [pliki, setPliki] = useState<PlikDanych[]>([]);
  const [ladowanie, setLadowanie] = useState(true);
  const [blad, setBlad] = useState<string | null>(null);
  const [folder, setFolder] = useState('');
  const [zaznaczone, setZaznaczone] = useState<FileItem[]>([]);
  const [infoZbioru, setInfoZbioru] = useState<{ subjects: number; records: number } | null>(null);

  const [pobierania, setPobierania] = useState<Pobieranie[]>([]);
  const [url, setUrl] = useState('');
  const [nazwa, setNazwa] = useState('');

  const wczytajPliki = useCallback(async () => {
    try {
      setPliki((await listaPlikow()).files);
    } catch (e) {
      setBlad(bladTekst(e));
    }
    setLadowanie(false);
  }, []);

  const wczytajPobierania = useCallback(async () => {
    const lista = (await listaPobieran()).downloads;
    setPobierania(lista);
    return lista;
  }, []);

  useEffect(() => {
    listaPlikow()
      .then((r) => setPliki(r.files))
      .catch((e: unknown) => setBlad(bladTekst(e)))
      .finally(() => setLadowanie(false));
    listaPobieran()
      .then((r) => setPobierania(r.downloads))
      .catch((e: unknown) => setBlad(bladTekst(e)));
  }, []);

  useEffect(() => {
    if (!zbior) return;
    let aktualne = true;
    sprawdzZbior(zbior)
      .then((info) => aktualne && setInfoZbioru(info))
      .catch((e: unknown) => aktualne && setBlad(bladTekst(e)));
    return () => {
      aktualne = false;
    };
  }, [zbior]);

  const trwa = pobierania.some(aktywne);
  useEffect(() => {
    if (!trwa) return;
    const timer = window.setInterval(async () => {
      try {
        const lista = await wczytajPobierania();
        if (!lista.some(aktywne)) void wczytajPliki();
      } catch (e) {
        setBlad(bladTekst(e));
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [trwa, wczytajPobierania, wczytajPliki]);

  async function wykonaj(akcja: () => Promise<unknown>) {
    setBlad(null);
    setLadowanie(true);
    try {
      await akcja();
    } catch (e) {
      setBlad(bladTekst(e));
    }
    await wczytajPliki();
  }

  async function onPobierz() {
    const nazwaFolderu = nazwa.trim() || nazwaZLinku(url.trim());
    setBlad(null);
    try {
      await pobierzZLinku(url.trim(), nazwaFolderu);
      setUrl('');
      setNazwa('');
      await wczytajPobierania();
    } catch (e) {
      setBlad(bladTekst(e));
    }
  }

  async function onAnuluj(id: number) {
    try {
      await anulujPobieranie(id);
      await wczytajPobierania();
    } catch (e) {
      setBlad(bladTekst(e));
    }
  }

  const wybrany = zaznaczone.length === 1 && zaznaczone[0].isDirectory ? zaznaczone[0].path : folder;

  async function onUzyj() {
    setBlad(null);
    try {
      const info = await sprawdzZbior(wybrany);
      if (info.subjects === 0) {
        setBlad(`W folderze ${wybrany} nie ma folderów badanych z plikami EDF.`);
        return;
      }
      const nowy = wybrany.replace(/^\/+/, '');
      await patchProject(project!._id, { dataset: nowy });
      setInfoZbioru(info);
      onZmianaZbioru(nowy);
    } catch (e) {
      setBlad(bladTekst(e));
    }
  }

  return (
    <div className="space-y-4">
      <div className="border border-border bg-surface px-4 py-3 text-sm">
        <span className="text-muted">Zbiór projektu: </span>
        {zbior ? (
          <>
            <span className="font-mono text-text">{zbior}</span>
            {infoZbioru ? (
              <span className="text-muted">
                {' '}
                · {infoZbioru.subjects} badanych, {infoZbioru.records} plików EDF
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-text">nie wybrano</span>
        )}
      </div>

      <ErrorBanner error={blad} />

      <div className="border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-text">Pobierz z linku</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_220px_auto]">
          <input
            aria-label="Link do danych"
            className="min-w-0 border border-border bg-bg px-2.5 py-1.5 font-mono text-xs text-text outline-none focus:border-accent"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            spellCheck={false}
          />
          <input
            aria-label="Nazwa folderu"
            className="min-w-0 border border-border bg-bg px-2.5 py-1.5 font-mono text-xs text-text outline-none focus:border-accent"
            value={nazwa || (url ? nazwaZLinku(url) : '')}
            onChange={(e) => setNazwa(e.target.value)}
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => void onPobierz()}
            disabled={!url.trim()}
            className="border border-accent bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Pobierz
          </button>
        </div>
        {pobierania.length ? (
          <div className="mt-3">
            {pobierania.map((p) => (
              <WierszPobierania key={p.id} p={p} onAnuluj={() => void onAnuluj(p.id)} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text">Dane na backendzie</h2>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted">{wybrany || '/'}</span>
            <button
              type="button"
              onClick={() => void onUzyj()}
              disabled={!wybrany || wybrany === '/'}
              className="border border-accent bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Użyj w projekcie
            </button>
          </div>
        </div>
        <div className="menedzer-plikow">
          <FileManager
            files={pliki}
            isLoading={ladowanie}
            language="pl-PL"
            layout="list"
            height={480}
            primaryColor="#1e66d0"
            fontFamily="inherit"
            enableFilePreview={false}
            permissions={{
              create: true,
              upload: false,
              move: false,
              copy: false,
              rename: true,
              download: false,
              delete: true,
            }}
            formatDate={(d) => new Date(d).toLocaleString('pl-PL')}
            onFolderChange={setFolder}
            onSelectionChange={setZaznaczone}
            onRefresh={() => void wykonaj(async () => {})}
            onCreateFolder={(name, parent) => wykonaj(() => utworzFolder(`${parent?.path ?? ''}/${name}`))}
            onRename={(file, name) => void wykonaj(() => zmienNazwe(file.path, name))}
            onDelete={(files) => void wykonaj(async () => {
              for (const f of files) await usunPlik(f.path);
            })}
          />
        </div>
      </div>
    </div>
  );
}
