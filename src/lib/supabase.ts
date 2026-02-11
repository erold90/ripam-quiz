import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yrrydyrbfbiehdqssclo.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlycnlkeXJiZmJpZWhkcXNzY2xvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzczODcyNjksImV4cCI6MjA1Mjk2MzI2OX0.QMfRjGnBBgTg_Gj0I2-718620TGeBxVGqPcON5SEkMw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ===== USER PROGRESS =====

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

  if (error) console.error('Errore salvando progresso:', error);
  return { error };
}

export async function loadUserData(userId: string) {
  const { data, error } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId);

  return { data, error };
}

export async function getUserProgress(userId: string) {
  return loadUserData(userId);
}

// ===== USER STATS =====

export async function updateStats(
  userId: string,
  materia: string,
  corretto: boolean,
  tempoMs: number
) {
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

export async function getUserStats(userId: string) {
  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .single();

  return { data, error };
}

export async function saveFullStats(
  userId: string,
  stats: Record<string, unknown>
) {
  const { error } = await supabase
    .from('user_stats')
    .upsert({
      user_id: userId,
      ...stats,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    });

  return { error };
}

// ===== SIMULAZIONI =====

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

export async function getUserSimulazioni(userId: string) {
  const { data, error } = await supabase
    .from('simulazioni')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return { data, error };
}

// ===== DELETE USER DATA =====

export async function deleteAllUserData(userId: string) {
  const { error: err1 } = await supabase
    .from('user_progress')
    .delete()
    .eq('user_id', userId);

  const { error: err2 } = await supabase
    .from('user_stats')
    .delete()
    .eq('user_id', userId);

  return { error: err1 || err2 };
}

// ===== DISPENSE HIGHLIGHTS =====

export async function saveHighlightsBulk(
  userId: string,
  highlights: Array<{
    content_id: string;
    highlight_id: string;
    text: string;
    cfi_range: string;
    color: string;
  }>
) {
  const rows = highlights.map(h => ({
    user_id: userId,
    content_id: h.content_id,
    highlight_id: h.highlight_id,
    text: h.text,
    cfi_range: h.cfi_range,
    color: h.color,
  }));

  const { error } = await supabase
    .from('dispense_highlights')
    .upsert(rows, {
      onConflict: 'user_id,content_id,highlight_id'
    });

  return { error };
}

export async function getHighlights(userId: string, contentId: string) {
  const { data, error } = await supabase
    .from('dispense_highlights')
    .select('*')
    .eq('user_id', userId)
    .eq('content_id', contentId)
    .order('created_at', { ascending: true });

  return { data, error };
}

export async function deleteHighlight(
  userId: string,
  contentId: string,
  highlightId: string
) {
  const { error } = await supabase
    .from('dispense_highlights')
    .delete()
    .eq('user_id', userId)
    .eq('content_id', contentId)
    .eq('highlight_id', highlightId);

  return { error };
}

// ===== READING PROGRESS =====

export async function saveReadingProgress(
  userId: string,
  progress: {
    content_id: string;
    cfi: string;
    percentage: number;
  }
) {
  const { error } = await supabase
    .from('reading_progress')
    .upsert({
      user_id: userId,
      content_id: progress.content_id,
      cfi: progress.cfi,
      percentage: progress.percentage,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,content_id'
    });

  return { error };
}

export async function getReadingProgress(userId: string, contentId: string) {
  const { data, error } = await supabase
    .from('reading_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('content_id', contentId)
    .single();

  return { data, error };
}
