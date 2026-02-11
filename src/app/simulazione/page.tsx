'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Header } from '@/components/layout/Header';
import { SimulazioneCard } from '@/components/quiz/SimulazioneCard';
import { useQuizStore } from '@/store/quiz-store';
import { generaQuizSimulazione, calcolaPunteggio, formatTempoRimanente } from '@/lib/quiz-loader';
import { Quiz, SimulazioneRisposta } from '@/types/quiz';
import { syncSimulazioneAnswer, syncSimulazione } from '@/lib/cloud-sync';
import {
  Play,
  Trophy,
  XCircle,
  CheckCircle2,
  Clock,
  Target,
  ArrowLeft,
  Home,
  RotateCcw,
  GraduationCap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type SimulazionePhase = 'intro' | 'inProgress' | 'completed';

export default function SimulazionePage() {
  const [phase, setPhase] = useState<SimulazionePhase>('intro');
  const [quizList, setQuizList] = useState<Array<Quiz & { materia: string }>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rispostaSelezionata, setRispostaSelezionata] = useState<string | null>(null);
  const [risposte, setRisposte] = useState<SimulazioneRisposta[]>([]);
  const [tempoRimanente, setTempoRimanente] = useState(60 * 60); // 60 minuti
  const [tempoInizio, setTempoInizio] = useState(0);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { darkMode, leitnerStates, updateLeitnerFromSimulazione, incrementSimulazioni, aggiornaStatistiche } = useQuizStore();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Timer
  useEffect(() => {
    if (phase === 'inProgress' && tempoRimanente > 0) {
      timerRef.current = setInterval(() => {
        setTempoRimanente(prev => {
          if (prev <= 1) {
            handleTermina();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [phase]);

  const handleStart = async () => {
    setLoading(true);
    try {
      const quiz = await generaQuizSimulazione(leitnerStates);
      setQuizList(quiz);
      setCurrentIndex(0);
      setRisposte([]);
      setRispostaSelezionata(null);
      setTempoRimanente(60 * 60);
      setTempoInizio(Date.now());
      setPhase('inProgress');
    } catch (error) {
      console.error('Errore generazione simulazione:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRisposta = useCallback((id: string) => {
    setRispostaSelezionata(id);
  }, []);

  // Registra risposta e sincronizza con Supabase
  const registraRisposta = useCallback((
    quiz: Quiz & { materia: string },
    rispostaData: string | null,
    isCorretta: boolean | null,
    tempoMs: number
  ) => {
    const nuovaRisposta: SimulazioneRisposta = {
      quiz_id: quiz.id,
      materia: quiz.materia,
      risposta_data: rispostaData,
      corretto: isCorretta,
      tempo_ms: tempoMs,
    };

    setRisposte(prev => [...prev, nuovaRisposta]);

    // Sync immediato con Supabase per ogni risposta
    syncSimulazioneAnswer(quiz.id, quiz.materia, rispostaData, isCorretta, tempoMs);

    // Aggiorna stats locali se ha risposto (non saltata)
    if (isCorretta !== null) {
      aggiornaStatistiche(quiz.materia, isCorretta);
    }
  }, [aggiornaStatistiche]);

  const handleProssimo = useCallback(() => {
    const quiz = quizList[currentIndex];
    const rispostaCorretta = quiz.risposte.find(r => r.corretta);
    const isCorretta = rispostaSelezionata ? rispostaCorretta?.id === rispostaSelezionata : null;
    const tempoMs = Date.now() - tempoInizio;

    registraRisposta(quiz, rispostaSelezionata, isCorretta, tempoMs);

    if (currentIndex < quizList.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setRispostaSelezionata(null);
      setTempoInizio(Date.now());
    } else {
      handleTermina();
    }
  }, [currentIndex, quizList, rispostaSelezionata, tempoInizio, registraRisposta]);

  const handleSalta = useCallback(() => {
    const quiz = quizList[currentIndex];
    const tempoMs = Date.now() - tempoInizio;

    registraRisposta(quiz, null, null, tempoMs);

    if (currentIndex < quizList.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setRispostaSelezionata(null);
      setTempoInizio(Date.now());
    } else {
      handleTermina();
    }
  }, [currentIndex, quizList, tempoInizio, registraRisposta]);

  const handleTermina = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setPhase('completed');
  }, []);

  // Quando la simulazione è completata: salva record e aggiorna leitner
  useEffect(() => {
    if (phase === 'completed' && risposte.length > 0) {
      updateLeitnerFromSimulazione(risposte);
      incrementSimulazioni();

      // Salva record simulazione su Supabase
      const tempoTotaleMs = (60 * 60 - tempoRimanente) * 1000;
      syncSimulazione(calcolaPunteggio(risposte), tempoTotaleMs, risposte);
    }
  }, [phase]);

  // Calcolo risultati
  const punteggio = calcolaPunteggio(risposte);
  const corrette = risposte.filter(r => r.corretto === true).length;
  const errate = risposte.filter(r => r.corretto === false).length;
  const nonRisposte = risposte.filter(r => r.corretto === null).length;
  const superato = punteggio >= 21;

  // Statistiche per materia
  const statsByMateria = risposte.reduce((acc, r) => {
    if (!acc[r.materia]) {
      acc[r.materia] = { corrette: 0, errate: 0, totale: 0 };
    }
    acc[r.materia].totale++;
    if (r.corretto === true) acc[r.materia].corrette++;
    if (r.corretto === false) acc[r.materia].errate++;
    return acc;
  }, {} as Record<string, { corrette: number; errate: number; totale: number }>);

  // Intro
  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container px-4 py-6 max-w-2xl mx-auto">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 mb-6">
              <ArrowLeft className="h-4 w-4" />
              Torna alla home
            </Button>
          </Link>

          <Card>
            <CardHeader className="text-center pb-2">
              <GraduationCap className="h-16 w-16 mx-auto mb-4 text-primary" />
              <CardTitle className="text-2xl">Simulazione Esame</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-center text-muted-foreground">
                Affronta una simulazione realistica del concorso RIPAM 3997
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted text-center">
                  <p className="text-2xl font-bold">40</p>
                  <p className="text-sm text-muted-foreground">Domande</p>
                </div>
                <div className="p-4 rounded-lg bg-muted text-center">
                  <p className="text-2xl font-bold">60</p>
                  <p className="text-sm text-muted-foreground">Minuti</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <h4 className="font-medium">Regole:</h4>
                <ul className="text-muted-foreground space-y-1">
                  <li>• Risposta corretta: +0,75 punti</li>
                  <li>• Risposta errata: -0,25 punti</li>
                  <li>• Risposta non data: 0 punti</li>
                  <li>• Soglia superamento: 21/30 punti</li>
                </ul>
              </div>

              <Button
                onClick={handleStart}
                disabled={loading}
                className="w-full h-12 text-lg gap-2"
              >
                {loading ? (
                  <span className="animate-pulse">Caricamento...</span>
                ) : (
                  <>
                    <Play className="h-5 w-5" />
                    Inizia Simulazione
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // In corso
  if (phase === 'inProgress') {
    const currentQuiz = quizList[currentIndex];

    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container px-4 py-6 max-w-3xl mx-auto">
          <SimulazioneCard
            quiz={currentQuiz}
            rispostaSelezionata={rispostaSelezionata}
            onSelezionaRisposta={handleRisposta}
            onProssimo={handleProssimo}
            onSalta={handleSalta}
            onTermina={handleTermina}
            indice={currentIndex}
            totale={quizList.length}
            tempoRimanente={tempoRimanente}
          />
        </main>
      </div>
    );
  }

  // Completato
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-4 py-6 max-w-3xl mx-auto">
        <Card className="mb-6">
          <CardContent className="p-8 text-center">
            {superato ? (
              <Trophy className="h-20 w-20 mx-auto mb-4 text-yellow-500" />
            ) : (
              <Target className="h-20 w-20 mx-auto mb-4 text-orange-500" />
            )}

            <h1 className="text-3xl font-bold mb-2">
              {superato ? 'Congratulazioni!' : 'Simulazione Completata'}
            </h1>

            <p className={cn(
              "text-lg mb-6",
              superato ? "text-green-600" : "text-orange-600"
            )}>
              {superato
                ? 'Hai superato la soglia di 21 punti!'
                : 'Non hai raggiunto la soglia di 21 punti'}
            </p>

            {/* Punteggio */}
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-muted mb-6">
              <span className="text-4xl font-bold">{punteggio.toFixed(2)}</span>
              <span className="text-muted-foreground text-xl">/30</span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-600" />
                <p className="text-2xl font-bold text-green-600">{corrette}</p>
                <p className="text-sm text-muted-foreground">Corrette</p>
              </div>
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950">
                <XCircle className="h-6 w-6 mx-auto mb-2 text-red-600" />
                <p className="text-2xl font-bold text-red-600">{errate}</p>
                <p className="text-sm text-muted-foreground">Errate</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold">{nonRisposte}</p>
                <p className="text-sm text-muted-foreground">Non risposte</p>
              </div>
            </div>

            {/* Tempo impiegato */}
            <p className="text-muted-foreground mb-6">
              Tempo impiegato: {formatTempoRimanente(60 * 60 - tempoRimanente)}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleStart} className="flex-1 gap-2">
                <RotateCcw className="h-4 w-4" />
                Nuova Simulazione
              </Button>
              <Link href="/" className="flex-1">
                <Button variant="outline" className="w-full gap-2">
                  <Home className="h-4 w-4" />
                  Torna alla Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Dettaglio per materia */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Risultati per Materia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(statsByMateria).map(([materia, stats]) => {
                const perc = stats.totale > 0
                  ? Math.round((stats.corrette / stats.totale) * 100)
                  : 0;

                return (
                  <div key={materia} className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium capitalize truncate">
                          {materia.replace('-', ' ')}
                        </span>
                        <span className={cn(
                          perc >= 70 ? "text-green-600" : perc >= 50 ? "text-yellow-600" : "text-red-600"
                        )}>
                          {stats.corrette}/{stats.totale}
                        </span>
                      </div>
                      <Progress value={perc} className="h-2" />
                    </div>
                    <Badge variant={perc >= 70 ? "default" : perc >= 50 ? "secondary" : "destructive"}>
                      {perc}%
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
