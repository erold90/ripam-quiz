import { QuizLeitnerState } from '@/types/quiz';

// Intervalli di ripasso per ogni box (in giorni)
const BOX_INTERVALS: Record<number, number> = {
  0: 0,    // Mai vista
  1: 0,    // Non la sai → subito
  2: 1,    // 1 giorno
  3: 3,    // 3 giorni
  4: 7,    // 1 settimana
  5: 14,   // 2 settimane
  6: 30,   // 1 mese
  7: 60,   // 2 mesi (padroneggiata)
};

// Peso base per box (inversamente proporzionale alla padronanza)
const BOX_WEIGHT: Record<number, number> = {
  0: 50,   // Mai vista: peso medio-alto per esplorazione
  1: 100,  // Non la sai: massima priorità
  2: 70,   // Sbagliata di recente
  3: 45,   // La stai imparando
  4: 30,   // Quasi acquisita
  5: 20,   // La sai bene
  6: 10,   // Consolidata
  7: 5,    // Padroneggiata: minima priorità
};

export const DAY_MS = 24 * 60 * 60 * 1000;

// ===== CATEGORIZZAZIONE INTELLIGENTE =====

export type QuizCategory = 'unseen' | 'wrong' | 'learning' | 'consolidated' | 'mastered';

/**
 * Una domanda è "padroneggiata" (esclusa dal ripasso) dopo 3 risposte corrette
 * consecutive (box >= 4). Soglia calibrata sul concorso: banca dati enorme,
 * tempo limitato → si consolida in fretta senza sprecare ripetizioni.
 */
export function isMastered(lState: QuizLeitnerState | null): boolean {
  return !!lState && lState.box >= 4 && lState.consecutiveCorrect >= 3;
}

/**
 * Categorizza un quiz in base allo stato Leitner e all'ultimo esito.
 * TASSONOMIA UNICA usata sia per generare le sessioni sia per i contatori UI.
 *
 * Regola chiave: "wrong" dipende dall'ULTIMA risposta errata, non dal box basso.
 * Così una domanda azzeccata (box 2) NON viene trattata come sbagliata.
 */
export function categorizeQuiz(
  lState: QuizLeitnerState | null,
  isCompleted: boolean,
  isWrong: boolean
): QuizCategory {
  // MASTERED: consolidata → esclusa dal ripasso
  if (isMastered(lState)) {
    return 'mastered';
  }

  // UNSEEN: mai tentata
  if (!isCompleted && !lState) {
    return 'unseen';
  }

  // WRONG: ultima risposta ERRATA (vero errore da recuperare) o mai saputa (box 1)
  if (isWrong || (lState && lState.box <= 1)) {
    return 'wrong';
  }

  // LEARNING: in apprendimento — 1-2 risposte corrette (box 2-3)
  if (lState && lState.box <= 3) {
    return 'learning';
  }

  // CONSOLIDATED: box 4+ ma non ancora padroneggiata
  if (lState) {
    return 'consolidated';
  }

  // Completata senza stato Leitner (dati legacy) → da rivedere
  return 'learning';
}

/**
 * Calcola il bonus overdue: quanto la domanda è in ritardo sulla revisione.
 * > 1.0 = in ritardo (urgente), < 1.0 = non ancora il momento.
 */
export function getOverdueMultiplier(state: QuizLeitnerState, now: number): number {
  const boxInterval = BOX_INTERVALS[state.box];
  if (boxInterval === 0) {
    // Box 0-1: sempre urgente, cresce col tempo
    const daysSince = (now - state.lastAttemptAt) / DAY_MS;
    return Math.max(1, 1 + daysSince * 0.3);
  }
  const overdueRatio = (now - state.lastAttemptAt) / (boxInterval * DAY_MS);
  return Math.max(0.2, Math.min(2.5, overdueRatio));
}

/**
 * Calcola il peso di selezione DENTRO un tier.
 * Usato per decidere quali domande scegliere all'interno della stessa categoria.
 */
export function calculateTierWeight(
  state: QuizLeitnerState | null,
  now: number,
  category: QuizCategory
): number {
  // Base weights per categoria (per varietà intra-tier)
  switch (category) {
    case 'unseen':
      return 80 + Math.random() * 20; // 80-100, randomizzato per varietà

    case 'wrong': {
      if (!state) return 90;
      const errorRate = state.totalAttempts > 0
        ? 1 - (state.totalCorrect / state.totalAttempts)
        : 0.5;
      const overdue = getOverdueMultiplier(state, now);
      return (70 + errorRate * 30) * overdue; // 70-200+
    }

    case 'learning': {
      if (!state) return 40;
      const overdue = getOverdueMultiplier(state, now);
      return 40 * overdue; // 8-100
    }

    case 'consolidated': {
      if (!state) return 5;
      const overdue = getOverdueMultiplier(state, now);
      return 5 * overdue; // 1-12.5
    }

    case 'mastered':
      return 0; // Mai selezionata

    default:
      return 50;
  }
}

/**
 * Aggiorna lo stato Leitner di un quiz dopo una risposta
 */
export function updateQuizLeitnerState(
  state: QuizLeitnerState | null,
  quizId: string,
  materia: string,
  correct: boolean
): QuizLeitnerState {
  const now = Date.now();

  // Prima volta che si vede questo quiz
  if (!state) {
    const newBox = correct ? 2 : 1;
    return {
      quizId,
      materia,
      box: newBox,
      totalAttempts: 1,
      totalCorrect: correct ? 1 : 0,
      consecutiveCorrect: correct ? 1 : 0,
      lastAttemptAt: now,
      nextReviewAt: now + BOX_INTERVALS[newBox] * DAY_MS,
    };
  }

  if (correct) {
    // Promuovi di 1 box (max 7)
    const newBox = Math.min(7, state.box + 1);
    const newConsecutive = state.consecutiveCorrect + 1;

    return {
      ...state,
      box: newBox,
      totalAttempts: state.totalAttempts + 1,
      totalCorrect: state.totalCorrect + 1,
      consecutiveCorrect: newConsecutive,
      lastAttemptAt: now,
      nextReviewAt: now + BOX_INTERVALS[newBox] * DAY_MS,
    };
  } else {
    // Errore: retrocedi. Se era alto (>=5) vai a box 2, altrimenti box 1
    const newBox = state.box >= 5 ? 2 : 1;

    return {
      ...state,
      box: newBox,
      totalAttempts: state.totalAttempts + 1,
      consecutiveCorrect: 0,
      lastAttemptAt: now,
      nextReviewAt: now + BOX_INTERVALS[newBox] * DAY_MS,
    };
  }
}

/**
 * Calcola il peso di selezione per un quiz.
 * Peso più alto = più probabilità di essere selezionato.
 */
export function calculateSelectionWeight(
  state: QuizLeitnerState | null,
  now: number
): number {
  // Mai vista: peso fisso per garantire esplorazione
  if (!state) return BOX_WEIGHT[0];

  const daysSinceLastAttempt = (now - state.lastAttemptAt) / DAY_MS;
  const boxInterval = BOX_INTERVALS[state.box];

  // Fattore scadenza: quanto è in ritardo sulla revisione
  // > 1 = in ritardo (aumenta peso), < 1 = troppo presto (diminuisce peso)
  let overdueMultiplier: number;
  if (boxInterval === 0) {
    // Box 0-1: sempre urgente
    overdueMultiplier = Math.max(1, 1 + daysSinceLastAttempt * 0.5);
  } else {
    const overdueRatio = daysSinceLastAttempt / boxInterval;
    // Clamp tra 0.1 (troppo presto) e 3 (molto in ritardo)
    overdueMultiplier = Math.max(0.1, Math.min(3, overdueRatio));
  }

  // Fattore errori: più errori storici = più peso
  const errorRate = state.totalAttempts > 0
    ? 1 - (state.totalCorrect / state.totalAttempts)
    : 0;
  const errorMultiplier = 1 + errorRate; // range 1.0 - 2.0

  // Peso finale
  const baseWeight = BOX_WEIGHT[state.box] ?? BOX_WEIGHT[0];
  return baseWeight * errorMultiplier * overdueMultiplier;
}

/**
 * Selezione casuale pesata senza ripetizione (Weighted Random Sampling).
 * Seleziona n elementi da items, dove ogni elemento ha un peso.
 */
export function weightedRandomSample<T>(
  items: Array<{ item: T; weight: number }>,
  n: number
): T[] {
  if (items.length <= n) return items.map(i => i.item);

  const result: T[] = [];
  const remaining = [...items];

  for (let i = 0; i < n && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, r) => sum + r.weight, 0);
    let random = Math.random() * totalWeight;

    for (let j = 0; j < remaining.length; j++) {
      random -= remaining[j].weight;
      if (random <= 0) {
        result.push(remaining[j].item);
        remaining.splice(j, 1);
        break;
      }
    }
  }

  return result;
}
