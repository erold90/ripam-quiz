import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Quiz, SimulazioneRisposta, StatisticheMateria, QuizLeitnerState } from '@/types/quiz';
import { updateQuizLeitnerState } from '@/lib/leitner';

interface QuizStore {
  // Stato utente (per ora locale, poi sincronizzato con Supabase)
  userId: string | null;
  isLoggedIn: boolean;

  // Statistiche locali
  statsPerMateria: Record<string, StatisticheMateria>;
  quizCompletati: Set<string>;
  quizSbagliati: Set<string>;
  simulazioniCount: number;

  // Leitner Adattivo
  leitnerStates: Record<string, QuizLeitnerState>;

  // Stato sessione corrente
  sessioneAttiva: boolean;
  materiaCorrente: string | null;
  quizCorrente: Quiz | null;
  indiceCorrente: number;
  rispostaSelezionata: string | null;
  mostraSoluzione: boolean;
  tempoInizio: number;

  // Stato simulazione
  simulazioneAttiva: boolean;
  quizSimulazione: Array<Quiz & { materia: string }>;
  risposteSimulazione: SimulazioneRisposta[];
  tempoRimanente: number;
  simulazioneCompletata: boolean;

  // Theme
  darkMode: boolean;

  // Flag migrazione
  dataMigrated: boolean;

  // Azioni
  setUserId: (id: string | null) => void;
  setLoggedIn: (value: boolean) => void;

  // Azioni quiz
  iniziaQuiz: (materia: string, quiz: Quiz[]) => void;
  selezionaRisposta: (rispostaId: string) => void;
  confermaRisposta: () => void;
  prossimoQuiz: () => void;
  terminaSessione: () => void;

  // Azioni simulazione
  iniziaSimulazione: (quiz: Array<Quiz & { materia: string }>) => void;
  rispondiSimulazione: (rispostaId: string | null) => void;
  prossimaSimulazione: () => void;
  decrementaTempo: () => void;
  terminaSimulazione: () => void;
  incrementSimulazioni: () => void;

  // Azioni statistiche
  aggiornaStatistiche: (materia: string, corretto: boolean) => void;
  resetStatistiche: () => void;

  // Azioni Leitner
  updateLeitnerFromSimulazione: (risposte: SimulazioneRisposta[]) => void;
  updateLeitnerSingle: (quizId: string, materia: string, corretto: boolean) => void;

  // Azione migrazione
  setDataFromMigration: (data: {
    statsPerMateria: Record<string, StatisticheMateria>;
    quizCompletati: string[];
    quizSbagliati: string[];
    leitnerStates: Record<string, QuizLeitnerState>;
    simulazioniCount: number;
  }) => void;

  // Theme
  toggleDarkMode: () => void;
}

export const useQuizStore = create<QuizStore>()(
  persist(
    (set, get) => ({
      // Stato iniziale
      userId: null,
      isLoggedIn: false,
      statsPerMateria: {},
      quizCompletati: new Set(),
      quizSbagliati: new Set(),
      simulazioniCount: 0,
      leitnerStates: {},
      sessioneAttiva: false,
      materiaCorrente: null,
      quizCorrente: null,
      indiceCorrente: 0,
      rispostaSelezionata: null,
      mostraSoluzione: false,
      tempoInizio: 0,
      simulazioneAttiva: false,
      quizSimulazione: [],
      risposteSimulazione: [],
      tempoRimanente: 60 * 60,
      simulazioneCompletata: false,
      darkMode: false,
      dataMigrated: false,

      // Azioni utente
      setUserId: (id) => set({ userId: id }),
      setLoggedIn: (value) => set({ isLoggedIn: value }),

      // Azioni quiz
      iniziaQuiz: (materia, quiz) => set({
        sessioneAttiva: true,
        materiaCorrente: materia,
        quizCorrente: quiz[0] || null,
        indiceCorrente: 0,
        rispostaSelezionata: null,
        mostraSoluzione: false,
        tempoInizio: Date.now(),
      }),

      selezionaRisposta: (rispostaId) => set({ rispostaSelezionata: rispostaId }),

      confermaRisposta: () => {
        const state = get();
        if (!state.quizCorrente || !state.rispostaSelezionata) return;

        const rispostaCorretta = state.quizCorrente.risposte.find(r => r.corretta);
        const isCorretta = rispostaCorretta?.id === state.rispostaSelezionata;

        // Aggiorna statistiche
        if (state.materiaCorrente) {
          get().aggiornaStatistiche(state.materiaCorrente, isCorretta);
        }

        // Aggiorna set quiz completati/sbagliati
        const quizCompletati = new Set(state.quizCompletati);
        const quizSbagliati = new Set(state.quizSbagliati);
        quizCompletati.add(state.quizCorrente.id);
        if (!isCorretta) {
          quizSbagliati.add(state.quizCorrente.id);
        } else {
          quizSbagliati.delete(state.quizCorrente.id);
        }

        set({
          mostraSoluzione: true,
          quizCompletati,
          quizSbagliati,
        });
      },

      prossimoQuiz: () => {
        set({
          rispostaSelezionata: null,
          mostraSoluzione: false,
          tempoInizio: Date.now(),
        });
      },

      terminaSessione: () => set({
        sessioneAttiva: false,
        materiaCorrente: null,
        quizCorrente: null,
        indiceCorrente: 0,
        rispostaSelezionata: null,
        mostraSoluzione: false,
      }),

      // Azioni simulazione
      iniziaSimulazione: (quiz) => set({
        simulazioneAttiva: true,
        quizSimulazione: quiz,
        risposteSimulazione: [],
        indiceCorrente: 0,
        quizCorrente: quiz[0] || null,
        rispostaSelezionata: null,
        tempoRimanente: 60 * 60,
        tempoInizio: Date.now(),
        simulazioneCompletata: false,
      }),

      rispondiSimulazione: (rispostaId) => {
        const state = get();
        const quiz = state.quizSimulazione[state.indiceCorrente];
        if (!quiz) return;

        const rispostaCorretta = quiz.risposte.find(r => r.corretta);
        const isCorretta = rispostaId ? rispostaCorretta?.id === rispostaId : null;

        const nuovaRisposta: SimulazioneRisposta = {
          quiz_id: quiz.id,
          materia: quiz.materia,
          risposta_data: rispostaId,
          corretto: isCorretta,
          tempo_ms: Date.now() - state.tempoInizio,
        };

        set({
          risposteSimulazione: [...state.risposteSimulazione, nuovaRisposta],
        });
      },

      prossimaSimulazione: () => {
        const state = get();
        const nuovoIndice = state.indiceCorrente + 1;

        if (nuovoIndice >= state.quizSimulazione.length) {
          get().terminaSimulazione();
          return;
        }

        set({
          indiceCorrente: nuovoIndice,
          quizCorrente: state.quizSimulazione[nuovoIndice],
          rispostaSelezionata: null,
          tempoInizio: Date.now(),
        });
      },

      decrementaTempo: () => {
        const state = get();
        if (state.tempoRimanente <= 1) {
          get().terminaSimulazione();
          return;
        }
        set({ tempoRimanente: state.tempoRimanente - 1 });
      },

      terminaSimulazione: () => set({
        simulazioneAttiva: false,
        simulazioneCompletata: true,
      }),

      incrementSimulazioni: () => set((state) => ({
        simulazioniCount: state.simulazioniCount + 1,
      })),

      // Azioni statistiche
      aggiornaStatistiche: (materia, corretto) => {
        const state = get();
        const stats = { ...(state.statsPerMateria[materia] || {
          totale: 0,
          corrette: 0,
          errate: 0,
          non_risposte: 0,
          percentuale: 0,
        }) };

        stats.totale += 1;
        if (corretto) {
          stats.corrette += 1;
        } else {
          stats.errate += 1;
        }
        stats.percentuale = Math.round((stats.corrette / stats.totale) * 100);

        set({
          statsPerMateria: {
            ...state.statsPerMateria,
            [materia]: stats,
          },
        });
      },

      resetStatistiche: () => set({
        statsPerMateria: {},
        quizCompletati: new Set(),
        quizSbagliati: new Set(),
        leitnerStates: {},
        simulazioniCount: 0,
        dataMigrated: false,
      }),

      // Azioni Leitner
      updateLeitnerFromSimulazione: (risposte) => {
        const state = get();
        const newLeitnerStates = { ...state.leitnerStates };

        for (const risposta of risposte) {
          if (risposta.corretto === null) continue;

          newLeitnerStates[risposta.quiz_id] = updateQuizLeitnerState(
            newLeitnerStates[risposta.quiz_id] || null,
            risposta.quiz_id,
            risposta.materia,
            risposta.corretto
          );
        }

        set({ leitnerStates: newLeitnerStates });
      },

      updateLeitnerSingle: (quizId, materia, corretto) => {
        const state = get();
        const newLeitnerStates = { ...state.leitnerStates };

        newLeitnerStates[quizId] = updateQuizLeitnerState(
          newLeitnerStates[quizId] || null,
          quizId,
          materia,
          corretto
        );

        set({ leitnerStates: newLeitnerStates });
      },

      // Azione migrazione dati
      setDataFromMigration: (data) => {
        set({
          statsPerMateria: data.statsPerMateria,
          quizCompletati: new Set(data.quizCompletati),
          quizSbagliati: new Set(data.quizSbagliati),
          leitnerStates: data.leitnerStates,
          simulazioniCount: data.simulazioniCount,
          dataMigrated: true,
        });
      },

      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
    }),
    {
      name: 'ripam-quiz-v2',
      partialize: (state) => ({
        userId: state.userId,
        isLoggedIn: state.isLoggedIn,
        statsPerMateria: state.statsPerMateria,
        quizCompletati: Array.from(state.quizCompletati),
        quizSbagliati: Array.from(state.quizSbagliati),
        leitnerStates: state.leitnerStates,
        simulazioniCount: state.simulazioniCount,
        darkMode: state.darkMode,
        dataMigrated: state.dataMigrated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.quizCompletati = new Set(state.quizCompletati as unknown as string[]);
          state.quizSbagliati = new Set(state.quizSbagliati as unknown as string[]);
        }
      },
    }
  )
);
