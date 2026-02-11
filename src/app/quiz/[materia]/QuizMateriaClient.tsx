'use client';

import { useEffect, useState, useCallback, useRef, use } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Header } from '@/components/layout/Header';
import { QuizCard } from '@/components/quiz/QuizCard';
import { useQuizStore } from '@/store/quiz-store';
import { getQuizIndex, generaQuizStudio, countQuizByCategory } from '@/lib/quiz-loader';
import { Quiz, Materia } from '@/types/quiz';
import {
  ArrowLeft,
  GraduationCap,
  RotateCcw,
  CheckCircle2,
  Play,
  Sparkles,
  XCircle,
  BookOpen,
  RefreshCw,
  Square,
} from 'lucide-react';
import { syncQuizAnswer } from '@/lib/cloud-sync';
import { cn } from '@/lib/utils';

type StudioFilter = 'all' | 'unseen' | 'wrong' | 'review';

interface QuizCounts {
  total: number;
  unseen: number;
  wrong: number;
  review: number;
  mastered: number;
}

const FILTERS: Array<{
  id: StudioFilter;
  label: string;
  description: string;
  countKey: keyof QuizCounts;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  { id: 'all', label: 'Tutto', description: 'Ordinamento intelligente', countKey: 'total', icon: Sparkles, color: 'text-primary' },
  { id: 'unseen', label: 'Nuove', description: 'Mai affrontate', countKey: 'unseen', icon: BookOpen, color: 'text-blue-600' },
  { id: 'wrong', label: 'Sbagliate', description: 'Da ripassare', countKey: 'wrong', icon: XCircle, color: 'text-red-600' },
  { id: 'review', label: 'Ripasso', description: 'Risposte giuste da consolidare', countKey: 'review', icon: RefreshCw, color: 'text-yellow-600' },
];

const SESSION_SIZES = [50, 100, 200] as const;

interface QuizMateriaClientProps {
  paramsPromise: Promise<{ materia: string }>;
}

export default function QuizMateriaClient({ paramsPromise }: QuizMateriaClientProps) {
  const params = use(paramsPromise);
  const materiaId = params.materia;

  // Phase
  const [phase, setPhase] = useState<'setup' | 'studying' | 'complete'>('setup');

  // Setup state
  const [filter, setFilter] = useState<StudioFilter>('all');
  const [sessionSize, setSessionSize] = useState<number | null>(50);
  const [counts, setCounts] = useState<QuizCounts | null>(null);
  const [materiaInfo, setMateriaInfo] = useState<Materia | null>(null);
  const [loading, setLoading] = useState(true);
  const [startLoading, setStartLoading] = useState(false);

  // Study state
  const [quizList, setQuizList] = useState<Quiz[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionStats, setSessionStats] = useState({ corrette: 0, totale: 0 });
  const tempoInizioRef = useRef(Date.now());

  const {
    rispostaSelezionata,
    mostraSoluzione,
    selezionaRisposta,
    prossimoQuiz,
    darkMode,
    statsPerMateria,
    leitnerStates,
    quizCompletati,
    quizSbagliati,
    updateLeitnerSingle,
    aggiornaStatistiche,
  } = useQuizStore();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Load materia info and counts
  useEffect(() => {
    async function loadData() {
      try {
        const index = await getQuizIndex();
        const info = index.materie.find(m => m.id === materiaId);
        setMateriaInfo(info || null);

        const quizCounts = await countQuizByCategory(materiaId, quizCompletati, quizSbagliati, leitnerStates);
        setCounts(quizCounts);
      } catch (error) {
        console.error('Errore caricamento materia:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [materiaId]);

  // Available count for current filter
  const availableCount = counts ? counts[FILTERS.find(f => f.id === filter)!.countKey] : 0;
  const effectiveSize = sessionSize === null
    ? availableCount
    : Math.min(sessionSize, availableCount);

  // Start study session
  const handleStart = useCallback(async () => {
    setStartLoading(true);
    try {
      const limit = sessionSize === null ? undefined : sessionSize;
      const quiz = await generaQuizStudio(materiaId, leitnerStates, quizCompletati, quizSbagliati, filter, limit);
      setQuizList(quiz);
      setCurrentIndex(0);
      setSessionStats({ corrette: 0, totale: 0 });
      tempoInizioRef.current = Date.now();
      prossimoQuiz();
      setPhase('studying');
    } catch (error) {
      console.error('Errore avvio studio:', error);
    } finally {
      setStartLoading(false);
    }
  }, [materiaId, leitnerStates, quizCompletati, quizSbagliati, filter, sessionSize, prossimoQuiz]);

  const currentQuiz = quizList[currentIndex];

  // Handle answer confirmation
  const handleConferma = useCallback(() => {
    if (!currentQuiz || !rispostaSelezionata) return;

    const rispostaCorretta = currentQuiz.risposte.find(r => r.corretta);
    const isCorretta = rispostaCorretta?.id === rispostaSelezionata;
    const tempoMs = Date.now() - tempoInizioRef.current;

    setSessionStats(prev => ({
      corrette: prev.corrette + (isCorretta ? 1 : 0),
      totale: prev.totale + 1,
    }));

    // Update Leitner
    updateLeitnerSingle(currentQuiz.id, materiaId, isCorretta);

    // Update local stats
    aggiornaStatistiche(materiaId, isCorretta);

    // Update local sets
    const store = useQuizStore.getState();
    const newCompletati = new Set(store.quizCompletati);
    const newSbagliati = new Set(store.quizSbagliati);
    newCompletati.add(currentQuiz.id);
    if (isCorretta) {
      newSbagliati.delete(currentQuiz.id);
    } else {
      newSbagliati.add(currentQuiz.id);
    }
    useQuizStore.setState({
      quizCompletati: newCompletati,
      quizSbagliati: newSbagliati,
      mostraSoluzione: true,
    });

    // Sync to Supabase
    syncQuizAnswer(currentQuiz.id, materiaId, rispostaSelezionata, isCorretta, tempoMs);
  }, [currentQuiz, rispostaSelezionata, updateLeitnerSingle, materiaId, aggiornaStatistiche]);

  // Next question
  const handleProssimo = useCallback(() => {
    if (currentIndex < quizList.length - 1) {
      setCurrentIndex(prev => prev + 1);
      tempoInizioRef.current = Date.now();
      prossimoQuiz();
    } else {
      setPhase('complete');
    }
  }, [currentIndex, quizList.length, prossimoQuiz]);

  // End session early
  const handleTermina = useCallback(() => {
    setPhase('complete');
  }, []);

  // Restart
  const handleRicomincia = useCallback(() => {
    setPhase('setup');
    const store = useQuizStore.getState();
    countQuizByCategory(materiaId, store.quizCompletati, store.quizSbagliati, store.leitnerStates)
      .then(setCounts);
  }, [materiaId]);

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <GraduationCap className="h-12 w-12 animate-pulse text-primary" />
      </div>
    );
  }

  if (!materiaInfo) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container px-4 py-6 max-w-4xl mx-auto">
          <p className="text-center text-muted-foreground">Materia non trovata</p>
          <Link href="/quiz" className="flex justify-center mt-4">
            <Button>Torna alle materie</Button>
          </Link>
        </main>
      </div>
    );
  }

  // ========== SETUP PHASE ==========
  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container px-4 py-6 max-w-2xl mx-auto">
          <Link href="/quiz">
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" />
              Tutte le materie
            </Button>
          </Link>

          <Card>
            <CardContent className="p-6">
              {/* Header materia */}
              <div className="text-center mb-6">
                <h1 className="text-xl font-bold mb-1">{materiaInfo.nome}</h1>
                <p className="text-sm text-muted-foreground">{counts?.total || 0} quiz disponibili</p>
              </div>

              {/* Counts grid */}
              {counts && (
                <div className="grid grid-cols-4 gap-2 mb-6">
                  <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
                    <p className="text-xl font-bold text-blue-600">{counts.unseen}</p>
                    <p className="text-[10px] text-muted-foreground">Nuove</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950">
                    <p className="text-xl font-bold text-red-600">{counts.wrong}</p>
                    <p className="text-[10px] text-muted-foreground">Sbagliate</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950">
                    <p className="text-xl font-bold text-yellow-600">{counts.review}</p>
                    <p className="text-[10px] text-muted-foreground">Ripasso</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950">
                    <p className="text-xl font-bold text-green-600">{counts.mastered}</p>
                    <p className="text-[10px] text-muted-foreground">OK</p>
                  </div>
                </div>
              )}

              {/* Filter selection */}
              <div className="mb-6">
                <h3 className="text-sm font-medium mb-3">Cosa vuoi studiare?</h3>
                <div className="grid grid-cols-2 gap-2">
                  {FILTERS.map(f => {
                    const count = counts ? counts[f.countKey] : 0;
                    const isDisabled = f.id !== 'all' && count === 0;
                    const Icon = f.icon;

                    return (
                      <button
                        key={f.id}
                        onClick={() => !isDisabled && setFilter(f.id)}
                        disabled={isDisabled}
                        className={cn(
                          "p-3 rounded-lg border-2 text-left transition-all",
                          filter === f.id && "border-primary bg-primary/5",
                          filter !== f.id && !isDisabled && "border-border hover:border-primary/30",
                          isDisabled && "opacity-40 cursor-not-allowed border-border"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Icon className={cn("h-4 w-4", f.color)} />
                            <span className="text-sm font-medium">{f.label}</span>
                          </div>
                          <Badge variant="secondary" className="text-xs">{count}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{f.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Session size */}
              <div className="mb-6">
                <h3 className="text-sm font-medium mb-3">Quante domande?</h3>
                <div className="flex gap-2">
                  {SESSION_SIZES.map(size => (
                    <button
                      key={size}
                      onClick={() => setSessionSize(size)}
                      disabled={availableCount === 0}
                      className={cn(
                        "flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-all",
                        sessionSize === size ? "border-primary bg-primary text-primary-foreground" : "border-border",
                        sessionSize !== size && availableCount > 0 && "hover:border-primary/30",
                        availableCount === 0 && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                  <button
                    onClick={() => setSessionSize(null)}
                    disabled={availableCount === 0}
                    className={cn(
                      "flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-all",
                      sessionSize === null ? "border-primary bg-primary text-primary-foreground" : "border-border",
                      sessionSize !== null && availableCount > 0 && "hover:border-primary/30",
                      availableCount === 0 && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    Tutte
                  </button>
                </div>
              </div>

              {/* Start button */}
              <Button
                onClick={handleStart}
                disabled={availableCount === 0 || startLoading}
                className="w-full h-12 text-base gap-2"
              >
                {startLoading ? (
                  <span className="animate-pulse">Caricamento...</span>
                ) : (
                  <>
                    <Play className="h-5 w-5" />
                    Inizia Studio ({effectiveSize} domande)
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // ========== STUDY PHASE ==========
  if (phase === 'studying' && currentQuiz) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container px-4 py-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <div>
                <h1 className="text-lg font-bold">{materiaInfo.nome}</h1>
                <p className="text-xs text-muted-foreground">
                  {filter === 'all' ? 'Tutto' : filter === 'unseen' ? 'Nuove' : filter === 'wrong' ? 'Sbagliate' : 'Ripasso'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{currentIndex + 1}/{quizList.length}</Badge>
                <Button variant="ghost" size="sm" onClick={handleTermina} className="gap-1.5">
                  <Square className="h-3.5 w-3.5" />
                  Termina
                </Button>
              </div>
            </div>
            <Progress value={((currentIndex + (mostraSoluzione ? 1 : 0)) / quizList.length) * 100} className="h-2" />
          </div>

          {/* Quiz Card */}
          <QuizCard
            quiz={currentQuiz}
            rispostaSelezionata={rispostaSelezionata}
            mostraSoluzione={mostraSoluzione}
            onSelezionaRisposta={selezionaRisposta}
            onConferma={handleConferma}
            onProssimo={handleProssimo}
            indice={currentIndex}
            totale={quizList.length}
          />
        </main>
      </div>
    );
  }

  // ========== COMPLETE PHASE ==========
  const percentuale = sessionStats.totale > 0
    ? Math.round((sessionStats.corrette / sessionStats.totale) * 100)
    : 0;
  const superato = percentuale >= 70;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-4 py-6 max-w-2xl mx-auto">
        <Card className="text-center">
          <CardContent className="p-8">
            <CheckCircle2 className={`h-16 w-16 mx-auto mb-4 ${superato ? 'text-green-500' : 'text-orange-500'}`} />
            <h1 className="text-2xl font-bold mb-2">Sessione Completata!</h1>
            <p className="text-muted-foreground mb-6">{materiaInfo.nome}</p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950">
                <p className="text-3xl font-bold text-green-600">{sessionStats.corrette}</p>
                <p className="text-sm text-muted-foreground">Corrette</p>
              </div>
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950">
                <p className="text-3xl font-bold text-red-600">{sessionStats.totale - sessionStats.corrette}</p>
                <p className="text-sm text-muted-foreground">Errate</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-4xl font-bold mb-2">{percentuale}%</p>
              <Progress value={percentuale} className="h-3" />
              {sessionStats.totale < quizList.length && (
                <p className="text-xs text-muted-foreground mt-2">
                  Completate {sessionStats.totale} di {quizList.length} domande
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleRicomincia} className="flex-1 gap-2">
                <RotateCcw className="h-4 w-4" />
                Nuova Sessione
              </Button>
              <Link href="/quiz" className="flex-1">
                <Button variant="outline" className="w-full">
                  Altre Materie
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Global stats for materia */}
        {statsPerMateria[materiaId] && (
          <Card className="mt-6">
            <CardContent className="p-4">
              <h3 className="font-medium mb-2">Statistiche Totali</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Risposte totali: {statsPerMateria[materiaId].totale}</p>
                <p>Corrette: {statsPerMateria[materiaId].corrette}</p>
                <p>Percentuale globale: {statsPerMateria[materiaId].percentuale}%</p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
