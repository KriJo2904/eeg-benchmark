import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getEvents, getMetadata, getWindow, listSubjectRecords, listSubjects } from '../api';
import { firstEegLabel } from '../lib/eegChannels';
import { wczytajPodglad, zapiszPodglad } from '../state/podglad';
import type { EventItem, RecordMetadata, RecordRef } from '../types';

export type EegState = {
  subjectId: string;
  setSubjectId: (v: string) => void;
  subjects: string[];

  records: RecordRef[];
  recordId: string;
  setRecordId: (v: string) => void;

  metadata: RecordMetadata | null;
  events: EventItem[];

  previewChannel: string;
  setPreviewChannel: (v: string) => void;

  t0: number;
  setT0: (v: number) => void;
  t1: number;
  setT1: (v: number) => void;

  decimate: number;
  setDecimate: (v: number) => void;

  samples: number[];
  sampleRateHz: number;

  busy: string | null;
  error: string | null;

  markerTimes: number[];
  loadWindow: () => Promise<void>;
};

export function useEegData(projectId: string): EegState {
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjectId, setSubjectId] = useState<string>('');
  const [records, setRecords] = useState<RecordRef[]>([]);
  const [recordId, setRecordId] = useState<string>('');

  const [metadata, setMetadata] = useState<RecordMetadata | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);

  const [previewChannel, setPreviewChannel] = useState<string>('');
  const [t0, setT0] = useState<number>(0);
  const [t1, setT1] = useState<number>(10);
  const [decimate, setDecimate] = useState<number>(1);

  const [samples, setSamples] = useState<number[]>([]);
  const [sampleRateHz, setSampleRateHz] = useState<number>(0);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveTimerRef = useRef<number | null>(null);
  const restoreLockRef = useRef(false);

  useEffect(() => {
    let alive = true;
    setError(null);
    setBusy('Ładowanie pacjentów…');
    listSubjects()
      .then((s) => {
        if (!alive) return;
        setSubjects(s.subjects);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!alive) return;
        setBusy(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  useLayoutEffect(() => {
    if (!projectId) return;
    setSubjectId('');
    setRecords([]);
    setRecordId('');
    setMetadata(null);
    setEvents([]);
    setPreviewChannel('');
    setT0(0);
    setT1(10);
    setDecimate(1);
    setSamples([]);
    setSampleRateHz(0);
    setError(null);
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !subjects.length) return;

    let cancelled = false;
    restoreLockRef.current = true;
    setBusy('Ładowanie ustawień projektu…');
    setSamples([]);
    setSampleRateHz(0);

    void (async () => {
      try {
        const ds = wczytajPodglad(projectId);
        const pickSubject =
          ds?.subjectId && subjects.includes(ds.subjectId) ? ds.subjectId : (subjects[0] ?? '');
        if (!pickSubject) {
          if (!cancelled) setBusy(null);
          return;
        }

        const recRes = await listSubjectRecords(pickSubject);
        if (cancelled) return;
        const recs = recRes.records;

        const pickRecord =
          ds?.recordId && recs.some((x) => x.id === ds.recordId) ? ds.recordId : (recs[0]?.id ?? '');
        if (!pickRecord) {
          setSubjectId(pickSubject);
          setRecords(recs);
          setRecordId('');
          setMetadata(null);
          setEvents([]);
          if (!cancelled) setBusy(null);
          return;
        }

        const m = await getMetadata(pickRecord);
        if (cancelled) return;

        const defaultLabel = firstEegLabel(m);
        const pickFromDs =
          ds?.channel && m.channels.some((c) => c.label === ds.channel) ? ds.channel : defaultLabel;
        const ev = await getEvents(pickRecord);
        if (cancelled) return;

        setSubjectId(pickSubject);
        setRecords(recs);
        setRecordId(pickRecord);
        setMetadata(m);
        setPreviewChannel(pickFromDs || defaultLabel || '');
        setT0(typeof ds?.t0 === 'number' ? ds.t0 : 0);
        setT1(typeof ds?.t1 === 'number' ? ds.t1 : Math.min(10, m.durationSec || 10));
        setDecimate(typeof ds?.decimate === 'number' ? ds.decimate : 1);
        setEvents(ev.events ?? []);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setBusy(null);
        setTimeout(() => {
          restoreLockRef.current = false;
        }, 0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, subjects]);

  useEffect(() => {
    if (!subjectId || restoreLockRef.current) return;
    let alive = true;
    setError(null);
    setBusy('Ładowanie rekordów…');
    setRecords([]);
    setRecordId('');
    setMetadata(null);
    setEvents([]);
    setSamples([]);
    setSampleRateHz(0);

    listSubjectRecords(subjectId)
      .then((r) => {
        if (!alive) return;
        setRecords(r.records);
        if (r.records.length) setRecordId(r.records[0].id);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!alive) return;
        setBusy(null);
      });

    return () => {
      alive = false;
    };
  }, [subjectId]);

  useEffect(() => {
    if (!recordId || restoreLockRef.current) return;
    let alive = true;
    setError(null);
    setBusy('Ładowanie metadanych…');
    setMetadata(null);
    setEvents([]);
    setSamples([]);
    setSampleRateHz(0);

    getMetadata(recordId)
      .then((m) => {
        if (!alive) return;
        setMetadata(m);
        const label = firstEegLabel(m);
        setPreviewChannel(label || '');
        setT0(0);
        setT1(Math.min(10, m.durationSec || 10));
      })
      .then(() => getEvents(recordId))
      .then((ev) => {
        if (!alive) return;
        setEvents(ev.events ?? []);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!alive) return;
        setBusy(null);
      });

    return () => {
      alive = false;
    };
  }, [recordId]);

  useEffect(() => {
    if (!projectId || !recordId) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      zapiszPodglad(projectId, { subjectId, recordId, channel: previewChannel, t0, t1, decimate });
    }, 400);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [projectId, subjectId, recordId, previewChannel, t0, t1, decimate]);

  async function loadWindow() {
    if (!recordId || !previewChannel) return;
    setError(null);
    setBusy('Ładowanie okna…');
    try {
      const w = await getWindow({ id: recordId, channel: previewChannel, t0, t1, decimate });
      setSamples(w.samples);
      setSampleRateHz(w.sampleRateHz / (w.decimate || 1));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const loadWindowCb = useCallback(loadWindow, [recordId, previewChannel, t0, t1, decimate]);

  const markerTimes = useMemo(
    () => events.map((e) => e.onsetSec).filter((sec) => sec >= t0 && sec <= t1),
    [events, t0, t1],
  );

  return {
    subjectId,
    setSubjectId,
    subjects,
    records,
    recordId,
    setRecordId,
    metadata,
    events,
    previewChannel,
    setPreviewChannel,
    t0,
    setT0,
    t1,
    setT1,
    decimate,
    setDecimate,
    samples,
    sampleRateHz,
    busy,
    error,
    markerTimes,
    loadWindow: loadWindowCb,
  };
}
