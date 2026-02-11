'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Header } from '@/components/layout/Header';
import { QuizCard } from '@/components/quiz/QuizCard';
import { useQuizStore } from '@/store/quiz-store';
import { getQuizByMateria, getQuizIndex } from '@/lib/quiz-loader';
import { Quiz, MateriaData, Materia } from '@/types/quiz';
import { ArrowLeft, GraduationCap, RotateCcw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/components/Providers';
import { syncQuizAnswer } from '@/lib/cloud-sync';

interface QuizMateriaClientProps {
  paramsPromise: Promise<{ materia: string }>;
}

export default function QuizMateriaClient({ paramsPromise }: QuizMateriaClientProps) {
  const params = use(paramsPromise);
  const materiaId = params.materia;

  const [materiaInfo, setMateriaInfo] = useState<Materia | null>(null);
  const [materiaData, setMateriaData] = useState<MateriaData | null>(null);
  const [quizList, setQuizList] = useState<Quiz[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionStats, setSessionStats] = useState({ corrette: 0, totale: 0 });

  const {
    rispostaSelezionata,
    mostraSoluzione,
    selezionaRisposta,
    confermaRisposta,
    prossimoQuiz,
    terminaSessione,
    darkMode,
    statsPerMateria,
    updateLeitnerSingle,
  } = useQuizStore();
  const { user } = useAuth();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Carica dati materia
  useEffect(() => {
    async function loadData() {
      try {
        const index = await getQuizIndex();
        const info = index.materie.find(m => m.id === materiaId);
        setMateriaInfo(info || null);

        const data = await getQuizByMateria(materiaId);
        setMateriaData(data);

        // Mescola i quiz
        const shuffled = [...data.quiz].sort(() => Math.random() - 0.5);
        setQuizList(shuffled);
      } catch (error) {
        console.error('Errore caricamento quiz:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    return () => {
      terminaSessione();
    };
  }, [materiaId, terminaSessione]);

  const currentQuiz = quizList[currentIndex];

  const handleConferma = useCallback(() => {
    if (!currentQuiz || !rispostaSelezionata) return;

    const rispostaCorretta = currentQuiz.risposte.find(r => r.corretta);
    const isCorretta = rispostaCorretta?.id === rispostaSelezionata;

    setSessionStats(prev => ({
      corrette: prev.corrette + (isCorretta ? 1 : 0),
      totale: prev.totale + 1,
    }));

    // Aggiorna stato Leitner
    updateLeitnerSingle(currentQuiz.id, materiaId, isCorretta);

    // Salva su cloud (fire-and-forget)
    if (user) {
      syncQuizAnswer(user.id, currentQuiz.id, materiaId, rispostaSelezionata, isCorretta, Date.now() - Date.now());
    }

    confermaRisposta();
  }, [currentQuiz, rispostaSelezionata, confermaRisposta, updateLeitnerSingle, materiaId, user]);

  const handleProssimo = useCallback(() => {
    if (currentIndex < quizList.length - 1) {
      setCurrentIndex(prev => prev + 1);
      prossimoQuiz();
    } else {
      setSessionComplete(true);
    }
  }, [currentIndex, quizList.length, prossimoQuiz]);

  const handleRicomincia = useCallback(() => {
    const shuffled = [...(materiaData?.quiz || [])].sort(() => Math.random() - 0.5);
    setQuizList(shuffled);
    setCurrentIndex(0);
    setSessionComplete(false);
    setSessionStats({ corrette: 0, totale: 0 });
    prossimoQuiz();
  }, [materiaData, prossimoQuiz]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <GraduationCap className="h-12 w-12 animate-pulse text-primary" />
      </div>
    );
  }

  if (!materiaData || !materiaInfo) {
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

  // Schermata fine sessione
  if (sessionComplete) {
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
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-3xl font-bold text-green-600">{sessionStats.corrette}</p>
                  <p className="text-sm text-muted-foreground">Corrette</p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-3xl font-bold">{sessionStats.totale - sessionStats.corrette}</p>
                  <p className="text-sm text-muted-foreground">Errate</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-4xl font-bold mb-2">{percentuale}%</p>
                <Progress value={percentuale} className="h-3" />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleRicomincia} className="flex-1 gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Ricomincia
                </Button>
                <Link href="/quiz" className="flex-1">
                  <Button variant="outline" className="w-full">
                    Altre Materie
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Statistiche globali materia */}
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

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container px-4 py-6 max-w-4xl mx-auto">
        {/* Header materia */}
        <div className="mb-6">
          <Link href="/quiz">
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" />
              Tutte le materie
            </Button>
          </Link>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-xl font-bold">{materiaInfo.nome}</h1>
              <p className="text-sm text-muted-foreground">{materiaData.descrizione}</p>
            </div>
            <Badge variant="outline">
              {quizList.length} quiz disponibili
            </Badge>
          </div>

          {/* Progress bar sessione */}
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Progresso sessione</span>
              <span>{currentIndex + 1}/{quizList.length}</span>
            </div>
            <Progress value={((currentIndex + 1) / quizList.length) * 100} className="h-2" />
          </div>
        </div>

        {/* Quiz Card */}
        {currentQuiz && (
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
        )}
      </main>
    </div>
  );
}
