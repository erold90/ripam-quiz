import { QuizLeitnerState, StatisticheMateria } from '@/types/quiz';

interface MigrationResult {
  statsPerMateria: Record<string, StatisticheMateria>;
  quizCompletati: string[];
  quizSbagliati: string[];
  leitnerStates: Record<string, QuizLeitnerState>;
  simulazioniCount: number;
}

/**
 * Carica i dati di migrazione pre-generati dal file statico.
 * I dati sono stati estratti da Supabase con service_role key e salvati come JSON.
 */
export async function migrateFromSupabase(): Promise<MigrationResult | null> {
  try {
    const response = await fetch('/data/migration-data.json');
    if (!response.ok) return null;

    const data = await response.json();

    if (!data || !data.quizCompletati || data.quizCompletati.length === 0) {
      return null;
    }

    return {
      statsPerMateria: data.statsPerMateria || {},
      quizCompletati: data.quizCompletati || [],
      quizSbagliati: data.quizSbagliati || [],
      leitnerStates: data.leitnerStates || {},
      simulazioniCount: data.simulazioniCount || 0,
    };
  } catch (error) {
    console.error('Errore migrazione dati:', error);
    return null;
  }
}
