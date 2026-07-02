// Sincronizzazione cross-device via Cloudflare Worker + KV.
// Sostituisce il vecchio backend Supabase (dismesso: bannato/in pausa 2 volte).
// localStorage resta la memoria AUTORITATIVA locale; questo modulo allinea i
// dispositivi tra loro: ad ogni device il suo snapshot, il Worker fa il merge.
import { useQuizStore } from '@/store/quiz-store';
import type { QuizLeitnerState, StatisticheMateria } from '@/types/quiz';

const SYNC_URL = process.env.NEXT_PUBLIC_SYNC_URL || 'https://ripam-sync.erold90.workers.dev';
// Utente logico unico condiviso tra i dispositivi (Sara)
const USER = 'f3eaf2d1-1b0f-43aa-9a37-b44a3fa27e65';

interface ProgressEntry {
  c: 0 | 1; // ultimo esito: 1 = corretta, 0 = sbagliata
  m: string | null; // materia
  t: number; // timestamp ultimo tentativo
}

interface CloudSnapshot {
  progress: Record<string, ProgressEntry>;
  leitner: Record<string, QuizLeitnerState>;
  stats: Record<string, StatisticheMateria>;
  simCount: number;
  updatedAt: number;
}

// Costruisce lo snapshot del dispositivo dallo stato corrente dello store.
function buildSnapshot(): CloudSnapshot {
  const s = useQuizStore.getState();
  const progress: Record<string, ProgressEntry> = {};
  for (const id of s.quizCompletati) {
    const l = s.leitnerStates[id];
    progress[id] = {
      c: s.quizSbagliati.has(id) ? 0 : 1,
      m: l?.materia ?? null,
      t: l?.lastAttemptAt ?? Date.now(),
    };
  }
  return {
    progress,
    leitner: s.leitnerStates,
    stats: s.statsPerMateria,
    simCount: s.simulazioniCount,
    updatedAt: Date.now(),
  };
}

// Applica lo stato unificato ricevuto dal cloud facendo UNION col locale.
function applyMerged(merged: CloudSnapshot) {
  const s = useQuizStore.getState();
  const quizCompletati = new Set(s.quizCompletati);
  const quizSbagliati = new Set(s.quizSbagliati);
  for (const [id, p] of Object.entries(merged.progress || {})) {
    quizCompletati.add(id);
    if (p.c === 0) quizSbagliati.add(id);
    else quizSbagliati.delete(id);
  }

  const leitnerStates: Record<string, QuizLeitnerState> = { ...s.leitnerStates };
  for (const [id, l] of Object.entries(merged.leitner || {})) {
    const cur = leitnerStates[id];
    if (!cur || (l.lastAttemptAt || 0) >= (cur.lastAttemptAt || 0)) leitnerStates[id] = l;
  }

  const statsPerMateria: Record<string, StatisticheMateria> = { ...s.statsPerMateria };
  for (const [m, v] of Object.entries(merged.stats || {})) {
    if (!statsPerMateria[m] || (v.totale || 0) >= (statsPerMateria[m].totale || 0)) {
      statsPerMateria[m] = v;
    }
  }

  useQuizStore.setState({
    quizCompletati,
    quizSbagliati,
    leitnerStates,
    statsPerMateria,
    simulazioniCount: Math.max(s.simulazioniCount, merged.simCount || 0),
    dataLoaded: true,
  });
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

async function pushNow() {
  try {
    const res = await fetch(`${SYNC_URL}/state?u=${USER}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildSnapshot()),
    });
    if (res.ok) applyMerged((await res.json()) as CloudSnapshot);
  } catch (err) {
    console.error('[Sync] push fallito:', err);
  }
}

// Debounce: raggruppa risposte ravvicinate in un'unica scrittura sul cloud.
function schedulePush() {
  if (typeof window === 'undefined') return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, 2500);
}

// Carica lo stato dal cloud, UNION col locale, poi ripubblica i progressi locali.
// (Nome invariato per compatibilità coi chiamanti esistenti.)
export async function loadAllFromSupabase() {
  try {
    const res = await fetch(`${SYNC_URL}/state?u=${USER}`, { cache: 'no-store' });
    if (res.ok) applyMerged((await res.json()) as CloudSnapshot);
    else useQuizStore.setState({ dataLoaded: true });
  } catch (err) {
    console.error('[Sync] load fallito:', err);
    useQuizStore.setState({ dataLoaded: true });
  }
  schedulePush(); // spingi eventuali progressi presenti solo in locale
}

// Cancella lo stato sincronizzato sul cloud (usato dal Reset delle statistiche).
export async function resetCloud() {
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; } // evita un push che rimetterebbe i dati
  try {
    await fetch(`${SYNC_URL}/state?u=${USER}`, { method: 'DELETE' });
  } catch (err) {
    console.error('[Sync] reset cloud fallito:', err);
  }
}

/* eslint-disable @typescript-eslint/no-unused-vars */
// Firme invariate per compatibilità: ora attivano un push (debounced) verso il cloud.
export async function syncQuizAnswer(
  _quizId: string, _materia: string, _rispostaData: string | null, _corretto: boolean, _tempoMs: number,
) {
  schedulePush();
}

export async function syncSimulazioneAnswer(
  _quizId: string, _materia: string, _rispostaData: string | null, _corretto: boolean | null, _tempoMs: number,
) {
  schedulePush();
}

export async function syncProgressOnly(
  _quizId: string, _materia: string, _rispostaData: string | null, _corretto: boolean | null, _tempoMs: number,
) {
  schedulePush();
}

export async function syncSimulazione(
  _punteggio: number, _tempoMs: number, _risposte: unknown[],
) {
  schedulePush();
}
/* eslint-enable @typescript-eslint/no-unused-vars */
