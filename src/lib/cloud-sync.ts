import {
  saveProgress,
  updateStats,
  saveSimulazione,
  loadUserData,
  getUserStats,
  getUserSimulazioni,
  SARA_USER_ID,
} from '@/lib/supabase';
import { useQuizStore } from '@/store/quiz-store';
import type { SimulazioneRisposta, StatisticheMateria } from '@/types/quiz';

// Salva singola risposta quiz su Supabase (awaited)
export async function syncQuizAnswer(
  quizId: string,
  materia: string,
  rispostaData: string | null,
  corretto: boolean,
  tempoMs: number
) {
  try {
    await Promise.all([
      saveProgress(SARA_USER_ID, quizId, materia, rispostaData, corretto, tempoMs),
      updateStats(SARA_USER_ID, materia, corretto, tempoMs),
    ]);
  } catch (err) {
    console.error('[Sync] Errore sync quiz:', err);
  }
}

// Salva risposta singola durante simulazione (solo user_progress, senza stats)
export async function syncSimulazioneAnswer(
  quizId: string,
  materia: string,
  rispostaData: string | null,
  corretto: boolean | null,
  tempoMs: number
) {
  try {
    await saveProgress(SARA_USER_ID, quizId, materia, rispostaData, corretto, tempoMs);
    // Se ha risposto (non saltata), aggiorna anche le stats
    if (corretto !== null) {
      await updateStats(SARA_USER_ID, materia, corretto, tempoMs);
    }
  } catch (err) {
    console.error('[Sync] Errore sync risposta simulazione:', err);
  }
}

// Salva simulazione completata su Supabase
export async function syncSimulazione(
  punteggio: number,
  tempoMs: number,
  risposte: SimulazioneRisposta[]
) {
  try {
    const risposteForDb = risposte.map(r => ({
      quiz_id: r.quiz_id,
      materia: r.materia,
      risposta_data: r.risposta_data,
      corretto: r.corretto,
      efficacia: r.efficacia ?? null,
      tempo_ms: r.tempo_ms,
    }));
    await saveSimulazione(SARA_USER_ID, punteggio, tempoMs, risposteForDb);
  } catch (err) {
    console.error('[Sync] Errore sync simulazione:', err);
  }
}

// Carica TUTTI i dati di Sara da Supabase e aggiorna lo store
export async function loadAllFromSupabase() {
  try {
    const [progressResult, statsResult, simulazioniResult] = await Promise.all([
      loadUserData(SARA_USER_ID),
      getUserStats(SARA_USER_ID),
      getUserSimulazioni(SARA_USER_ID),
    ]);

    const progress = progressResult.data || [];
    const stats = statsResult.data;
    const simulazioni = simulazioniResult.data || [];

    // Ricostruisci set di quiz completati e sbagliati
    const quizCompletati = new Set<string>();
    const quizSbagliati = new Set<string>();

    for (const p of progress) {
      quizCompletati.add(p.quiz_id);
      if (p.corretto === false) {
        quizSbagliati.add(p.quiz_id);
      }
    }

    // Stats per materia dal cloud (filtra chiavi invalide come __quiz_attempts__)
    const rawStats = stats?.stats_per_materia || {};
    const statsPerMateria: Record<string, StatisticheMateria> = {};
    for (const [key, value] of Object.entries(rawStats)) {
      if (key.startsWith('__') || !value || typeof (value as StatisticheMateria).totale !== 'number') continue;
      statsPerMateria[key] = value as StatisticheMateria;
    }

    // Aggiorna lo store Zustand
    useQuizStore.setState({
      quizCompletati,
      quizSbagliati,
      statsPerMateria,
      simulazioniCount: simulazioni.length,
      dataLoaded: true,
    });

    console.log('[Sync] Dati caricati da Supabase:', {
      quiz: quizCompletati.size,
      simulazioni: simulazioni.length,
      materie: Object.keys(statsPerMateria).length,
    });
  } catch (err) {
    console.error('[Sync] Errore caricamento da Supabase:', err);
    useQuizStore.setState({ dataLoaded: true });
  }
}
