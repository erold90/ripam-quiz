import {
  saveProgress,
  updateStats,
  saveSimulazione,
  loadUserData,
  getUserStats,
  getUserSimulazioni,
  saveFullStats,
} from '@/lib/supabase';
import type { SimulazioneRisposta, StatisticheMateria } from '@/types/quiz';

// Fire-and-forget: salva progresso singolo quiz su cloud
export async function syncQuizAnswer(
  userId: string,
  quizId: string,
  materia: string,
  rispostaData: string | null,
  corretto: boolean,
  tempoMs: number
) {
  try {
    await Promise.all([
      saveProgress(userId, quizId, materia, rispostaData, corretto, tempoMs),
      updateStats(userId, materia, corretto, tempoMs),
    ]);
  } catch (err) {
    console.error('[CloudSync] Errore sync quiz:', err);
  }
}

// Fire-and-forget: salva simulazione completata su cloud
export async function syncSimulazione(
  userId: string,
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
      tempo_ms: r.tempo_ms,
    }));
    await saveSimulazione(userId, punteggio, tempoMs, risposteForDb);
  } catch (err) {
    console.error('[CloudSync] Errore sync simulazione:', err);
  }
}

// Sync stats complete al cloud
export async function syncStatsToCloud(
  userId: string,
  statsPerMateria: Record<string, StatisticheMateria>,
  totaleRisposte: number,
  risposteCorrette: number
) {
  try {
    await saveFullStats(userId, {
      totale_risposte: totaleRisposte,
      risposte_corrette: risposteCorrette,
      ultima_sessione: new Date().toISOString(),
      stats_per_materia: statsPerMateria,
    });
  } catch (err) {
    console.error('[CloudSync] Errore sync stats:', err);
  }
}

// Carica dati dal cloud e restituisci per merge locale
export async function loadFromCloud(userId: string) {
  try {
    const [progressResult, statsResult, simulazioniResult] = await Promise.all([
      loadUserData(userId),
      getUserStats(userId),
      getUserSimulazioni(userId),
    ]);

    const progress = progressResult.data || [];
    const stats = statsResult.data;
    const simulazioni = simulazioniResult.data || [];

    // Costruisci set di quiz completati e sbagliati dal cloud
    const quizCompletati = new Set<string>();
    const quizSbagliati = new Set<string>();
    const statsPerMateria: Record<string, StatisticheMateria> = {};

    for (const p of progress) {
      quizCompletati.add(p.quiz_id);
      if (p.corretto === false) {
        quizSbagliati.add(p.quiz_id);
      }
    }

    // Stats dal cloud
    if (stats?.stats_per_materia) {
      Object.assign(statsPerMateria, stats.stats_per_materia);
    }

    return {
      quizCompletati,
      quizSbagliati,
      statsPerMateria,
      simulazioniCount: simulazioni.length,
      simulazioni,
      cloudStats: stats,
    };
  } catch (err) {
    console.error('[CloudSync] Errore load from cloud:', err);
    return null;
  }
}

// Merge dati locali + cloud (il dato con piu risposte vince)
export function mergeLocalAndCloud(
  localStats: Record<string, StatisticheMateria>,
  cloudStats: Record<string, StatisticheMateria>,
  localCompletati: Set<string>,
  cloudCompletati: Set<string>,
  localSbagliati: Set<string>,
  cloudSbagliati: Set<string>,
) {
  // Merge quiz completati (unione)
  const mergedCompletati = new Set([...localCompletati, ...cloudCompletati]);
  const mergedSbagliati = new Set([...localSbagliati, ...cloudSbagliati]);
  // Rimuovi da sbagliati quelli che non sono piu sbagliati localmente
  for (const id of mergedSbagliati) {
    if (localCompletati.has(id) && !localSbagliati.has(id)) {
      mergedSbagliati.delete(id);
    }
  }

  // Merge stats (prendi quello con piu risposte totali per materia)
  const mergedStats: Record<string, StatisticheMateria> = {};
  const allMaterie = new Set([...Object.keys(localStats), ...Object.keys(cloudStats)]);

  for (const materia of allMaterie) {
    const local = localStats[materia];
    const cloud = cloudStats[materia];

    if (!local) {
      mergedStats[materia] = cloud;
    } else if (!cloud) {
      mergedStats[materia] = local;
    } else {
      // Prendi quello con piu risposte totali
      mergedStats[materia] = local.totale >= cloud.totale ? local : cloud;
    }
  }

  return {
    quizCompletati: mergedCompletati,
    quizSbagliati: mergedSbagliati,
    statsPerMateria: mergedStats,
  };
}
