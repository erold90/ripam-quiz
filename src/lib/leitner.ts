import { QuizLeitnerState } from '@/types/quiz';

// Intervalli indicativi di ripasso per box (giorni) — informativi (nextReviewAt).
const BOX_INTERVALS: Record<number, number> = {
  0: 0, 1: 0, 2: 1, 3: 3, 4: 7, 5: 14, 6: 30, 7: 60,
};

export const DAY_MS = 24 * 60 * 60 * 1000;

// ===== I 5 STATI DI STUDIO =====
// Priorità di ripasso decrescente dopo le "nuove": nonSai → ripetile → apprendimento.
export type QuizCategory = 'nuova' | 'nonSai' | 'ripetile' | 'apprendimento' | 'padroneggiata';

/**
 * Stato di una domanda in base alle risposte CONSECUTIVE:
 *  - padroneggiata: 2 giuste di fila  → esclusa da studio e simulazione (0%)
 *  - nonSai:        3 sbagliate di fila
 *  - ripetile:      2 sbagliate di fila
 *  - apprendimento: già vista ma in bilico (1 giusta, 1 sbagliata, o alternanza)
 *  - nuova:         mai affrontata
 */
export function statoQuiz(lState: QuizLeitnerState | null, isCompleted: boolean): QuizCategory {
  if (!lState) return isCompleted ? 'apprendimento' : 'nuova';
  const cc = lState.consecutiveCorrect || 0;
  const cw = lState.consecutiveWrong || 0;
  if (cc >= 2) return 'padroneggiata';
  if (cw >= 3) return 'nonSai';
  if (cw >= 2) return 'ripetile';
  return 'apprendimento';
}

export function isPadroneggiata(lState: QuizLeitnerState | null): boolean {
  return !!lState && (lState.consecutiveCorrect || 0) >= 2;
}

// ===== RIPASSO: basato sullo STORICO degli errori (non sullo stato "incerto") =====
export type CategoriaRipasso = 'sempre' | 'mista';

/**
 * Una domanda entra nel Ripasso SOLO se è stata sbagliata almeno una volta
 * e non è ancora padroneggiata (2 giuste di fila).
 *  - 'sempre': mai azzeccata (corrette = 0)
 *  - 'mista':  a volte giusta, a volte sbagliata (almeno 1 giusta e 1 errore)
 *  - null:     mai fatta, sempre giusta, o già padroneggiata → NON nel ripasso
 */
export function categoriaRipasso(lState: QuizLeitnerState | null): CategoriaRipasso | null {
  if (!lState || lState.totalAttempts === 0) return null;      // mai fatta
  if ((lState.consecutiveCorrect || 0) >= 2) return null;      // padroneggiata → risolta
  const errori = lState.totalAttempts - lState.totalCorrect;
  if (errori <= 0) return null;                                // mai sbagliata → non è ripasso
  return lState.totalCorrect === 0 ? 'sempre' : 'mista';
}

/**
 * Aggiorna lo stato di una domanda dopo una risposta.
 * Traccia sia le giuste consecutive sia le sbagliate consecutive.
 */
export function updateQuizLeitnerState(
  state: QuizLeitnerState | null,
  quizId: string,
  materia: string,
  correct: boolean
): QuizLeitnerState {
  const now = Date.now();

  if (!state) {
    const box = correct ? 2 : 1;
    return {
      quizId,
      materia,
      box,
      totalAttempts: 1,
      totalCorrect: correct ? 1 : 0,
      consecutiveCorrect: correct ? 1 : 0,
      consecutiveWrong: correct ? 0 : 1,
      lastAttemptAt: now,
      nextReviewAt: now + BOX_INTERVALS[box] * DAY_MS,
    };
  }

  if (correct) {
    const box = Math.min(7, state.box + 1);
    return {
      ...state,
      box,
      totalAttempts: state.totalAttempts + 1,
      totalCorrect: state.totalCorrect + 1,
      consecutiveCorrect: (state.consecutiveCorrect || 0) + 1,
      consecutiveWrong: 0,
      lastAttemptAt: now,
      nextReviewAt: now + BOX_INTERVALS[box] * DAY_MS,
    };
  }

  const box = state.box >= 5 ? 2 : 1;
  return {
    ...state,
    box,
    totalAttempts: state.totalAttempts + 1,
    consecutiveCorrect: 0,
    consecutiveWrong: (state.consecutiveWrong || 0) + 1,
    lastAttemptAt: now,
    nextReviewAt: now + BOX_INTERVALS[box] * DAY_MS,
  };
}
