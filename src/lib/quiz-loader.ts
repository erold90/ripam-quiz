import { QuizIndex, MateriaData, Quiz, QuizLeitnerState } from '@/types/quiz';
import { categorizeQuiz, calculateTierWeight, weightedRandomSample, QuizCategory } from '@/lib/leitner';

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
  // Normalizza: vecchio formato ha "id" invece di "materia"
  if (!data.materia && data.id) {
    data.materia = data.id;
  }
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

/**
 * ALGORITMO PWAS (Priority-Weighted Adaptive Selection)
 *
 * Seleziona le domande per la simulazione con selezione a tier:
 *   1. UNSEEN → domande mai tentate (massima priorità)
 *   2. WRONG → domande sbagliate (da ripassare urgentemente)
 *   3. LEARNING → domande in fase di apprendimento (box 3-4)
 *   4. CORRECT → risposte giuste 1 volta (minima presenza)
 *   5. CONSOLIDATED → box 5-6 (solo se pool esaurito)
 *   6. MASTERED → box ≥6 + 2+ corrette consecutive → ESCLUSE
 *
 * Principi scientifici applicati:
 *   - Regola dell'85% (Wilson 2019): punta a ~85% tasso di successo
 *   - Spaced Repetition: priorità a domande overdue
 *   - Interleaving: mescolamento finale tra materie
 *   - Desirable Difficulties: mix calibrato di difficoltà
 */
export async function generaQuizSimulazione(
  leitnerStates: Record<string, QuizLeitnerState>,
  quizCompletati: Set<string>,
  quizSbagliati: Set<string>
): Promise<Array<Quiz & { materia: string }>> {
  const index = await getQuizIndex();
  const quizSimulazione: Array<Quiz & { materia: string }> = [];
  const now = Date.now();

  for (const materia of index.materie) {
    const data = await getQuizByMateria(materia.id);
    const nDomande = materia.domande_esame;

    // Categorizza ogni domanda della materia
    const tiers: Record<QuizCategory, Array<{ item: Quiz & { materia: string }; weight: number }>> = {
      unseen: [],
      wrong: [],
      learning: [],
      correct: [],
      consolidated: [],
      mastered: [], // Mai usato nella selezione
    };

    for (const q of data.quiz) {
      const lState = leitnerStates[q.id] || null;
      const isCompleted = quizCompletati.has(q.id);
      const isWrong = quizSbagliati.has(q.id);

      const category = categorizeQuiz(lState, isCompleted, isWrong);

      // MASTERED → skip completamente
      if (category === 'mastered') continue;

      tiers[category].push({
        item: { ...q, materia: materia.id },
        weight: calculateTierWeight(lState, now, category),
      });
    }

    // Selezione a tier: riempi in ordine di priorità
    const selected: Array<Quiz & { materia: string }> = [];
    const tierOrder: QuizCategory[] = ['unseen', 'wrong', 'learning', 'correct', 'consolidated'];

    for (const tierName of tierOrder) {
      if (selected.length >= nDomande) break;

      const tier = tiers[tierName];
      if (tier.length === 0) continue;

      const needed = nDomande - selected.length;

      if (tier.length <= needed) {
        // Prendi tutto dal tier
        selected.push(...tier.map(t => t.item));
      } else {
        // Weighted random sample dal tier
        const sampled = weightedRandomSample(tier, needed);
        selected.push(...sampled);
      }
    }

    quizSimulazione.push(...selected);
  }

  // Mescola l'ordine finale (interleaving tra materie)
  shuffleArray(quizSimulazione);

  return quizSimulazione;
}

/**
 * Genera quiz per studio di una materia con ordinamento intelligente.
 * Ordine: mai viste → sbagliate → in apprendimento → corrette → consolidate.
 * Le domande MASTERED vengono messe alla fine (non escluse, è allenamento).
 */
export async function generaQuizStudio(
  materiaId: string,
  leitnerStates: Record<string, QuizLeitnerState>,
  quizCompletati: Set<string>,
  quizSbagliati: Set<string>,
  soloErrori?: boolean
): Promise<Quiz[]> {
  const data = await getQuizByMateria(materiaId);
  const now = Date.now();

  if (soloErrori) {
    // Filtra solo quelli sbagliati
    const quiz = data.quiz.filter(q => quizSbagliati.has(q.id));
    shuffleArray(quiz);
    return quiz;
  }

  // Categorizza e ordina per priorità
  const tiers: Record<string, Quiz[]> = {
    unseen: [],
    wrong: [],
    learning: [],
    correct: [],
    consolidated: [],
    mastered: [],
  };

  for (const q of data.quiz) {
    const lState = leitnerStates[q.id] || null;
    const isCompleted = quizCompletati.has(q.id);
    const isWrong = quizSbagliati.has(q.id);
    const category = categorizeQuiz(lState, isCompleted, isWrong);
    tiers[category].push(q);
  }

  // Mescola dentro ogni tier per varietà
  for (const tier of Object.values(tiers)) {
    shuffleArray(tier);
  }

  // Concatena in ordine di priorità (unseen prima, mastered ultima)
  return [
    ...tiers.unseen,
    ...tiers.wrong,
    ...tiers.learning,
    ...tiers.correct,
    ...tiers.consolidated,
    ...tiers.mastered,
  ];
}

// Utility per mescolare array
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Calcola punteggio simulazione secondo le regole ufficiali del bando RIPAM.
 *
 * Conoscenze + Logica (32 domande):
 *   - Corretta: +0,75 | Errata: -0,25 | Non data: 0
 *
 * Situazionali (8 domande):
 *   - Più efficace: +0,75 | Neutra: +0,375 | Meno efficace: 0
 *   (NESSUNA penalità per risposta errata)
 */
export function calcolaPunteggio(
  risposte: Array<{ corretto: boolean | null; materia: string; efficacia?: 'alta' | 'neutra' | 'bassa' | null }>
): number {
  let punteggio = 0;

  for (const risposta of risposte) {
    const isSituazionale = risposta.materia === 'situazionali';

    if (risposta.corretto === true) {
      // Corretta / più efficace: +0.75
      punteggio += 0.75;
    } else if (risposta.corretto === false) {
      if (isSituazionale) {
        // Situazionali: usa campo efficacia per punteggio graduato
        if (risposta.efficacia === 'neutra') {
          punteggio += 0.375;
        }
        // 'bassa' = 0 punti, nessuna penalità
      } else {
        // Conoscenze + Logica: risposta errata = -0.25
        punteggio -= 0.25;
      }
    }
    // null = non risposto = 0 punti
  }

  return Math.max(0, punteggio);
}

// Formatta tempo
export function formatTempo(ms: number): string {
  const secondi = Math.floor(ms / 1000);
  const minuti = Math.floor(secondi / 60);
  const ore = Math.floor(minuti / 60);

  if (ore > 0) {
    return `${ore}h ${minuti % 60}m`;
  }
  if (minuti > 0) {
    return `${minuti}m ${secondi % 60}s`;
  }
  return `${secondi}s`;
}

// Formatta tempo rimanente (countdown)
export function formatTempoRimanente(secondi: number): string {
  const min = Math.floor(secondi / 60);
  const sec = secondi % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}
