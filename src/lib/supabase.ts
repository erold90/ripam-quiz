import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper per salvare il progresso
export async function saveProgress(
  userId: string,
  quizId: string,
  materia: string,
  rispostaData: string | null,
  corretto: boolean | null,
  tempoRispostaMs: number
) {
  const { error } = await supabase
    .from('user_progress')
    .upsert({
      user_id: userId,
      quiz_id: quizId,
      materia,
      risposta_data: rispostaData,
      corretto,
      tempo_risposta_ms: tempoRispostaMs,
    }, {
      onConflict: 'user_id,quiz_id'
    });

  if (error) {
    console.error('Errore salvando progresso:', error);
  }

  return { error };
}

// Helper per aggiornare le statistiche
export async function updateStats(
  userId: string,
  materia: string,
  corretto: boolean,
  tempoMs: number
) {
  // Prima otteniamo le stats attuali
  const { data: currentStats } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .single();

  const statsPerMateria = currentStats?.stats_per_materia || {};
  const materiaStats = statsPerMateria[materia] || {
    totale: 0,
    corrette: 0,
    errate: 0,
    non_risposte: 0,
    percentuale: 0
  };

  materiaStats.totale += 1;
  if (corretto) {
    materiaStats.corrette += 1;
  } else {
    materiaStats.errate += 1;
  }
  materiaStats.percentuale = Math.round((materiaStats.corrette / materiaStats.totale) * 100);
  statsPerMateria[materia] = materiaStats;

  const { error } = await supabase
    .from('user_stats')
    .upsert({
      user_id: userId,
      totale_risposte: (currentStats?.totale_risposte || 0) + 1,
      risposte_corrette: (currentStats?.risposte_corrette || 0) + (corretto ? 1 : 0),
      tempo_totale_ms: (currentStats?.tempo_totale_ms || 0) + tempoMs,
      ultima_sessione: new Date().toISOString(),
      stats_per_materia: statsPerMateria,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    });

  return { error };
}

// Helper per salvare simulazione
export async function saveSimulazione(
  userId: string,
  punteggio: number,
  tempoMs: number,
  risposte: Array<{
    quiz_id: string;
    materia: string;
    risposta_data: string | null;
    corretto: boolean | null;
    tempo_ms: number;
  }>
) {
  const { data, error } = await supabase
    .from('simulazioni')
    .insert({
      user_id: userId,
      punteggio,
      tempo_impiegato_ms: tempoMs,
      risposte,
      completata: true
    })
    .select()
    .single();

  return { data, error };
}

// Helper per ottenere il progresso dell'utente
export async function getUserProgress(userId: string) {
  const { data, error } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId);

  return { data, error };
}

// Helper per ottenere le statistiche
export async function getUserStats(userId: string) {
  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .single();

  return { data, error };
}

// Helper per ottenere le simulazioni
export async function getUserSimulazioni(userId: string) {
  const { data, error } = await supabase
    .from('simulazioni')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return { data, error };
}
