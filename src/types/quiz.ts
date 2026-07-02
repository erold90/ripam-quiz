// Tipi per i Quiz

export interface Risposta {
  id: string;
  testo: string;
  corretta: boolean;
  efficacia?: 'alta' | 'neutra' | 'bassa';
}

export interface Quiz {
  id: string;
  domanda: string;
  risposte: Risposta[];
  spiegazione?: string;
}

export interface Materia {
  id: string;
  nome: string;
  file: string;
  categoria: 'comuni' | 'specifiche' | 'logica' | 'situazionali';
  domande_esame: number;
  totaleQuiz?: number;
  icona: string;
}

export interface MateriaData {
  materia?: string;
  id?: string;
  nome: string;
  descrizione?: string;
  totaleQuiz?: number;
  quiz: Quiz[];
}

export interface QuizIndex {
  concorso: string;
  descrizione: string;
  struttura_esame: {
    domande_totali: number;
    tempo_minuti: number;
    punteggio_max: number;
    soglia_superamento: number;
    punteggi_conoscenze_logica: {
      corretta: number;
      errata: number;
      non_data: number;
    };
    punteggi_situazionali: {
      piu_efficace: number;
      neutra: number;
      meno_efficace: number;
    };
  };
  materie: Materia[];
}

// Tipi per il progresso utente

export interface UserProgress {
  id: string;
  user_id: string;
  quiz_id: string;
  materia: string;
  risposta_data: string | null;
  corretto: boolean | null;
  tempo_risposta_ms: number;
  created_at: string;
}

export interface StatisticheMateria {
  totale: number;
  corrette: number;
  errate: number;
  non_risposte: number;
  percentuale: number;
}

export interface UserStats {
  id: string;
  user_id: string;
  totale_risposte: number;
  risposte_corrette: number;
  tempo_totale_ms: number;
  ultima_sessione: string | null;
  stats_per_materia: Record<string, StatisticheMateria>;
  updated_at: string;
}

export interface Simulazione {
  id: string;
  user_id: string;
  punteggio: number;
  tempo_impiegato_ms: number;
  risposte: SimulazioneRisposta[];
  completata: boolean;
  created_at: string;
}

export interface SimulazioneRisposta {
  quiz_id: string;
  materia: string;
  risposta_data: string | null;
  corretto: boolean | null;
  efficacia?: 'alta' | 'neutra' | 'bassa' | null;
  tempo_ms: number;
}

// Riepilogo leggero di una simulazione completata (per storico + andamento).
export interface SimulazioneSummary {
  id: string;
  data: number;        // timestamp di completamento
  punteggio: number;   // su 30
  superato: boolean;   // >= 21
  corrette: number;
  errate: number;
  saltate: number;
  totale: number;
  tempoMs: number;
  perMateria: Record<string, { corrette: number; errate: number; totale: number }>;
}

// Tipi per il sistema Leitner Adattivo

export interface QuizLeitnerState {
  quizId: string;
  materia: string;
  box: number;                // legacy (0-7), mantenuto per compatibilità
  totalAttempts: number;
  totalCorrect: number;
  consecutiveCorrect: number; // risposte GIUSTE di fila (2 = padroneggiata)
  consecutiveWrong: number;   // risposte SBAGLIATE di fila (2 = ripetile, 3 = non sai)
  lastAttemptAt: number;      // timestamp
  nextReviewAt: number;       // timestamp
}

// Tipi per lo stato dell'app

export interface QuizSessionState {
  materia: string | null;
  quizCorrente: Quiz | null;
  indice: number;
  rispostaSelezionata: string | null;
  mostraSoluzione: boolean;
  tempoInizio: number;
  risposte: SimulazioneRisposta[];
}

export interface SimulazioneState extends QuizSessionState {
  tempoRimanente: number;
  completata: boolean;
  punteggio: number | null;
}
