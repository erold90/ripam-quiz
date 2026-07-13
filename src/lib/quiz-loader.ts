import { QuizIndex, MateriaData, Quiz, QuizLeitnerState } from '@/types/quiz';
import { statoQuiz, QuizCategory, categoriaRipasso } from '@/lib/leitner';

// Quota di domande NUOVE in ogni sessione (studio + simulazione).
// Il resto va al ripasso, per priorità: nonSai → ripetile → apprendimento.
// Le padroneggiate sono sempre escluse (0%).
export const PCT_NUOVE = 0.70;

let quizIndex: QuizIndex | null = null;
const quizCache: Record<string, MateriaData> = {};

export async function getQuizIndex(): Promise<QuizIndex> {
  if (quizIndex) return quizIndex;
  const response = await fetch('/data/index.json');
  quizIndex = await response.json();
  return quizIndex!;
}

export async function getQuizByMateria(materiaId: string): Promise<MateriaData> {
  if (quizCache[materiaId]) return quizCache[materiaId];
  const response = await fetch(`/data/${materiaId}.json`);
  const data = await response.json();
  if (!data.materia && data.id) data.materia = data.id;
  quizCache[materiaId] = data;
  return data;
}

export async function getAllQuiz(): Promise<Record<string, Quiz[]>> {
  const index = await getQuizIndex();
  const allQuiz: Record<string, Quiz[]> = {};
  for (const materia of index.materie) {
    const data = await getQuizByMateria(materia.id);
    allQuiz[materia.id] = data.quiz;
  }
  return allQuiz;
}

// Mescola un array in place (Fisher-Yates)
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Raggruppa un insieme di domande per stato (pool già mescolati).
function raggruppaPerStato<T extends { id: string }>(
  items: T[],
  leitnerStates: Record<string, QuizLeitnerState>,
  quizCompletati: Set<string>,
): Record<QuizCategory, T[]> {
  const pools: Record<QuizCategory, T[]> = {
    nuova: [], nonSai: [], ripetile: [], apprendimento: [], padroneggiata: [],
  };
  for (const q of items) {
    const st = statoQuiz(leitnerStates[q.id] || null, quizCompletati.has(q.id));
    pools[st].push(q);
  }
  for (const k of Object.keys(pools) as QuizCategory[]) shuffleArray(pools[k]);
  return pools;
}

// Compone una sessione: PCT_NUOVE% nuove + resto ripasso per priorità.
// Le padroneggiate sono escluse. Se un pool è scarso, si attinge dall'altro.
function componiSessione<T extends { id: string }>(
  pools: Record<QuizCategory, T[]>,
  limit: number,
): T[] {
  const nuove = pools.nuova;
  const ripasso = [...pools.nonSai, ...pools.ripetile, ...pools.apprendimento]; // priorità

  const targetNuove = Math.round(limit * PCT_NUOVE);
  const sessione: T[] = nuove.slice(0, Math.min(targetNuove, nuove.length));
  sessione.push(...ripasso.slice(0, Math.min(limit - sessione.length, ripasso.length)));

  // Riempi con l'eventuale surplus (poco materiale in una delle due parti)
  if (sessione.length < limit) {
    const used = new Set(sessione.map(q => q.id));
    const rest = [...nuove, ...ripasso].filter(q => !used.has(q.id));
    sessione.push(...rest.slice(0, limit - sessione.length));
  }
  return sessione;
}

/**
 * Simulazione: per ogni materia il numero di domande è quello del bando.
 * Usa SOLO domande MAI viste (test onesto su materiale fresco). Quando le nuove
 * di una materia si esauriscono, completa con le già viste MENO RECENTI.
 * Mescolamento finale tra materie (interleaving).
 */
export async function generaQuizSimulazione(
  leitnerStates: Record<string, QuizLeitnerState>,
  quizCompletati: Set<string>,
  _quizSbagliati: Set<string>,
): Promise<Array<Quiz & { materia: string }>> {
  const index = await getQuizIndex();
  const quizSimulazione: Array<Quiz & { materia: string }> = [];

  for (const materia of index.materie) {
    const data = await getQuizByMateria(materia.id);
    const items = data.quiz.map(q => ({ ...q, materia: materia.id }));
    const need = materia.domande_esame;
    const pools = raggruppaPerStato(items, leitnerStates, quizCompletati);

    // Priorità: domande MAI viste
    const selected = pools.nuova.slice(0, need);

    // Fallback (solo se le nuove sono finite): già viste, meno recenti prima
    if (selected.length < need) {
      const viste = [...pools.apprendimento, ...pools.ripetile, ...pools.nonSai, ...pools.padroneggiata]
        .sort((a, b) => (leitnerStates[a.id]?.lastAttemptAt || 0) - (leitnerStates[b.id]?.lastAttemptAt || 0));
      selected.push(...viste.slice(0, need - selected.length));
    }
    quizSimulazione.push(...selected);
  }

  shuffleArray(quizSimulazione);
  return quizSimulazione;
}

/**
 * Conta i quiz per macro-categoria per la schermata pre-studio.
 * (unseen = nuove, wrong = nonSai+ripetile, review = apprendimento, mastered = padroneggiate)
 */
export async function countQuizByCategory(
  materiaId: string,
  quizCompletati: Set<string>,
  _quizSbagliati: Set<string>,
  leitnerStates: Record<string, QuizLeitnerState>,
): Promise<{ total: number; unseen: number; wrong: number; review: number; mastered: number }> {
  const data = await getQuizByMateria(materiaId);
  const counts = { total: data.quiz.length, unseen: 0, wrong: 0, review: 0, mastered: 0 };

  for (const q of data.quiz) {
    const st = statoQuiz(leitnerStates[q.id] || null, quizCompletati.has(q.id));
    if (st === 'nuova') counts.unseen++;
    else if (st === 'nonSai' || st === 'ripetile') counts.wrong++;
    else if (st === 'padroneggiata') counts.mastered++;
    else counts.review++; // apprendimento
  }
  return counts;
}

// Conteggio per il Ripasso: domande sempre sbagliate e miste, per materia.
export async function countRipasso(
  materiaId: string,
  leitnerStates: Record<string, QuizLeitnerState>,
): Promise<{ sempre: number; mista: number }> {
  const data = await getQuizByMateria(materiaId);
  let sempre = 0, mista = 0;
  for (const q of data.quiz) {
    const c = categoriaRipasso(leitnerStates[q.id] || null);
    if (c === 'sempre') sempre++;
    else if (c === 'mista') mista++;
  }
  return { sempre, mista };
}

export interface CoverageMateria {
  id: string;
  nome: string;
  total: number;
  seen: number;      // domande viste almeno una volta
  mastered: number;  // domande padroneggiate
  wrong: number;     // domande "non sai" + "ripetile"
}

/**
 * Copertura della banca dati (metrica di prontezza): quante domande viste
 * e quante padroneggiate, globale e per materia.
 */
export async function getCoverageStats(
  leitnerStates: Record<string, QuizLeitnerState>,
  quizCompletati: Set<string>,
  _quizSbagliati: Set<string>,
): Promise<{ totBank: number; totSeen: number; totMastered: number; totWrong: number; perMateria: CoverageMateria[] }> {
  const index = await getQuizIndex();
  const perMateria: CoverageMateria[] = [];
  let totBank = 0, totSeen = 0, totMastered = 0, totWrong = 0;

  for (const m of index.materie) {
    const data = await getQuizByMateria(m.id);
    let seen = 0, mastered = 0, wrong = 0;
    for (const q of data.quiz) {
      const st = statoQuiz(leitnerStates[q.id] || null, quizCompletati.has(q.id));
      if (st !== 'nuova') seen++;
      if (st === 'padroneggiata') mastered++;
      if (st === 'nonSai' || st === 'ripetile') wrong++;
    }
    perMateria.push({ id: m.id, nome: m.nome, total: data.quiz.length, seen, mastered, wrong });
    totBank += data.quiz.length;
    totSeen += seen;
    totMastered += mastered;
    totWrong += wrong;
  }
  return { totBank, totSeen, totMastered, totWrong, perMateria };
}

/**
 * Studio di una materia con filtri e limite.
 *  - all: composizione 70/30 (nuove + ripasso, padroneggiate escluse)
 *  - unseen: solo nuove | wrong: nonSai+ripetile | review: in apprendimento
 */
export async function generaQuizStudio(
  materiaId: string,
  leitnerStates: Record<string, QuizLeitnerState>,
  quizCompletati: Set<string>,
  _quizSbagliati: Set<string>,
  filter: 'all' | 'unseen' | 'wrong' | 'review' | 'ripasso' = 'all',
  limit?: number,
): Promise<Quiz[]> {
  const data = await getQuizByMateria(materiaId);

  if (filter === 'all') {
    const pools = raggruppaPerStato(data.quiz, leitnerStates, quizCompletati);
    return componiSessione(pools, limit ?? data.quiz.length);
  }

  // Ripasso: SOLO domande sbagliate almeno una volta. Priorità: sempre-sbagliate → miste
  if (filter === 'ripasso') {
    const sempre: Quiz[] = [], mista: Quiz[] = [];
    for (const q of data.quiz) {
      const c = categoriaRipasso(leitnerStates[q.id] || null);
      if (c === 'sempre') sempre.push(q);
      else if (c === 'mista') mista.push(q);
    }
    shuffleArray(sempre); shuffleArray(mista);
    let out = [...sempre, ...mista];
    if (limit && limit < out.length) out = out.slice(0, limit);
    return out;
  }

  let filtered: Quiz[];
  switch (filter) {
    case 'unseen':
      filtered = data.quiz.filter(q => statoQuiz(leitnerStates[q.id] || null, quizCompletati.has(q.id)) === 'nuova');
      break;
    case 'wrong':
      filtered = data.quiz.filter(q => {
        const st = statoQuiz(leitnerStates[q.id] || null, quizCompletati.has(q.id));
        return st === 'nonSai' || st === 'ripetile';
      });
      break;
    case 'review':
    default:
      filtered = data.quiz.filter(q => statoQuiz(leitnerStates[q.id] || null, quizCompletati.has(q.id)) === 'apprendimento');
      break;
  }
  shuffleArray(filtered);
  if (limit && limit < filtered.length) filtered = filtered.slice(0, limit);
  return filtered;
}

/**
 * Punteggio simulazione secondo le regole ufficiali RIPAM.
 * Conoscenze+Logica: +0,75 / -0,25 / 0.  Situazionali: +0,75 / +0,375 / 0.
 */
export function calcolaPunteggio(
  risposte: Array<{ corretto: boolean | null; materia: string; efficacia?: 'alta' | 'neutra' | 'bassa' | null }>,
): number {
  let punteggio = 0;
  for (const risposta of risposte) {
    const isSituazionale = risposta.materia === 'situazionali';
    if (risposta.corretto === true) {
      punteggio += 0.75;
    } else if (risposta.corretto === false) {
      if (isSituazionale) {
        if (risposta.efficacia === 'neutra') punteggio += 0.375;
        // 'bassa' = 0, nessuna penalità
      } else {
        punteggio -= 0.25;
      }
    }
  }
  return Math.max(0, punteggio);
}

export function formatTempo(ms: number): string {
  const secondi = Math.floor(ms / 1000);
  const minuti = Math.floor(secondi / 60);
  const ore = Math.floor(minuti / 60);
  if (ore > 0) return `${ore}h ${minuti % 60}m`;
  if (minuti > 0) return `${minuti}m ${secondi % 60}s`;
  return `${secondi}s`;
}

export function formatTempoRimanente(secondi: number): string {
  const min = Math.floor(secondi / 60);
  const sec = secondi % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}
