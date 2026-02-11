import { QuizIndex, MateriaData, Quiz, QuizLeitnerState } from '@/types/quiz';
import { calculateSelectionWeight, weightedRandomSample } from '@/lib/leitner';

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

// Genera quiz per simulazione con selezione adattiva Leitner
export async function generaQuizSimulazione(
  leitnerStates?: Record<string, QuizLeitnerState>
): Promise<Array<Quiz & { materia: string }>> {
  const index = await getQuizIndex();
  const quizSimulazione: Array<Quiz & { materia: string }> = [];
  const now = Date.now();

  for (const materia of index.materie) {
    const data = await getQuizByMateria(materia.id);
    const nDomande = materia.domande_esame;

    if (!leitnerStates || Object.keys(leitnerStates).length === 0) {
      // Fallback: shuffle casuale (prima sessione in assoluto)
      const quizMateria = [...data.quiz];
      shuffleArray(quizMateria);
      quizMateria.slice(0, nDomande).forEach(q => {
        quizSimulazione.push({ ...q, materia: materia.id });
      });
    } else {
      // Selezione pesata basata su Leitner
      const weighted = data.quiz.map(q => ({
        item: { ...q, materia: materia.id },
        weight: calculateSelectionWeight(leitnerStates[q.id] || null, now),
      }));

      const selected = weightedRandomSample(weighted, nDomande);
      quizSimulazione.push(...selected);
    }
  }

  // Mescola l'ordine finale
  shuffleArray(quizSimulazione);

  return quizSimulazione;
}

// Genera quiz per studio di una materia (escludi quelli già fatti correttamente)
export async function generaQuizStudio(
  materiaId: string,
  quizGiaFatti?: Set<string>,
  soloErrori?: boolean
): Promise<Quiz[]> {
  const data = await getQuizByMateria(materiaId);
  let quiz = [...data.quiz];

  if (soloErrori && quizGiaFatti) {
    // Filtra solo quelli già sbagliati
    quiz = quiz.filter(q => quizGiaFatti.has(q.id));
  }

  shuffleArray(quiz);
  return quiz;
}

// Utility per mescolare array
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Calcola punteggio simulazione
export function calcolaPunteggio(
  risposte: Array<{ corretto: boolean | null }>
): number {
  let punteggio = 0;

  for (const risposta of risposte) {
    if (risposta.corretto === true) {
      punteggio += 0.75;
    } else if (risposta.corretto === false) {
      punteggio -= 0.25;
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
