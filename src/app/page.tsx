'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/Header';
import { useQuizStore } from '@/store/quiz-store';
import { getQuizIndex, getAllQuiz } from '@/lib/quiz-loader';
import { QuizIndex } from '@/types/quiz';
import {
  GraduationCap,
  BookOpen,
  Target,
  TrendingUp,
  Play,
  Scale,
  Gavel,
  Monitor,
  Building,
  Globe,
  Laptop,
  Calculator,
  Flag,
  Users,
  Brain,
  MessageCircle,
  ClipboardList,
  AlertCircle,
  Sparkles,
  Clock,
  ShieldCheck,
  Landmark,
  ScrollText,
  BadgeCheck,
  Signature,
  Coins,
  Building2,
  Languages,
  Puzzle,
  Presentation,
  Trash2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Scale, Gavel, Monitor, Building, Globe, Laptop, Calculator, Flag, Users, Brain, MessageCircle,
  ShieldCheck, Landmark, ScrollText, BadgeCheck, Signature, Coins, Building2, Languages, Puzzle, Presentation,
};

// Categorie Leitner con colori
const LEITNER_CATEGORIES = [
  { label: 'Padroneggiato', boxes: [5, 6, 7], color: 'bg-green-500', textColor: 'text-green-600' },
  { label: 'In apprendimento', boxes: [3, 4], color: 'bg-blue-500', textColor: 'text-blue-600' },
  { label: 'Ripetile', boxes: [2], color: 'bg-yellow-500', textColor: 'text-yellow-600' },
  { label: 'Non sai', boxes: [1], color: 'bg-red-500', textColor: 'text-red-600' },
  { label: 'Nuove', boxes: [0], color: 'bg-gray-300 dark:bg-gray-600', textColor: 'text-gray-500' },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'Buonanotte';
  if (hour < 12) return 'Buongiorno';
  if (hour < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

function ClearCacheButton() {
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    setClearing(true);
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const names = await caches.keys();
        for (const name of names) {
          await caches.delete(name);
        }
      }
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  return (
    <button
      onClick={handleClear}
      disabled={clearing}
      className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 active:bg-red-800 disabled:opacity-50 transition-colors"
    >
      {clearing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
      Svuota Cache e Ricarica
    </button>
  );
}

export default function Home() {
  const [quizData, setQuizData] = useState<QuizIndex | null>(null);
  const [totalQuizCount, setTotalQuizCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const {
    statsPerMateria,
    quizCompletati,
    quizSbagliati,
    simulazioniCount,
    leitnerStates,
    darkMode,
    dataLoaded,
  } = useQuizStore();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Carica dati quiz
  useEffect(() => {
    async function loadData() {
      try {
        const data = await getQuizIndex();
        setQuizData(data);

        const allQuiz = await getAllQuiz();
        const total = Object.values(allQuiz).reduce((acc, q) => acc + q.length, 0);
        setTotalQuizCount(total);
      } catch (error) {
        console.error('Errore caricamento dati:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Statistiche globali (safe: filtra valori senza totale)
  const totaleRisposte = Object.values(statsPerMateria).reduce((acc, s) => acc + (s.totale || 0), 0);
  const totaleCorrette = Object.values(statsPerMateria).reduce((acc, s) => acc + (s.corrette || 0), 0);
  const percentualeGlobale = totaleRisposte > 0 ? Math.round((totaleCorrette / totaleRisposte) * 100) : 0;

  // Calcolo categorie Leitner
  const leitnerCounts = useMemo(() => {
    const counts = LEITNER_CATEGORIES.map(cat => ({
      ...cat,
      count: 0,
    }));

    const trackedQuizIds = new Set<string>();
    for (const [quizId, state] of Object.entries(leitnerStates)) {
      trackedQuizIds.add(quizId);
      const catIndex = counts.findIndex(c => c.boxes.includes(state.box));
      if (catIndex >= 0) counts[catIndex].count++;
    }

    const nuoveIndex = counts.findIndex(c => c.boxes.includes(0));
    if (nuoveIndex >= 0) {
      counts[nuoveIndex].count = Math.max(0, totalQuizCount - trackedQuizIds.size);
    }

    return counts;
  }, [leitnerStates, totalQuizCount]);

  const totalTracked = leitnerCounts.reduce((acc, c) => acc + c.count, 0);
  const nuoveCount = leitnerCounts.find(c => c.boxes.includes(0))?.count || 0;
  const progressoApprendimento = totalTracked > 0
    ? Math.round(((totalTracked - nuoveCount) / totalTracked) * 100)
    : 0;

  // Materia piu debole
  const materiaDebole = useMemo(() => {
    if (!quizData) return null;
    let worst: { nome: string; id: string; perc: number } | null = null;

    for (const materia of quizData.materie) {
      const stats = statsPerMateria[materia.id];
      if (stats && stats.totale >= 5) {
        if (!worst || stats.percentuale < worst.perc) {
          worst = { nome: materia.nome, id: materia.id, perc: stats.percentuale };
        }
      }
    }

    return worst;
  }, [quizData, statsPerMateria]);

  // Materie da migliorare (sotto 70%)
  const materieDaMigliorare = useMemo(() => {
    if (!quizData) return [];
    return quizData.materie
      .map(m => ({ ...m, stats: statsPerMateria[m.id] }))
      .filter(m => m.stats && m.stats.totale > 0 && m.stats.percentuale < 70)
      .sort((a, b) => (a.stats?.percentuale || 0) - (b.stats?.percentuale || 0));
  }, [quizData, statsPerMateria]);

  // Tempo stimato di studio
  const tempoStimato = useMemo(() => {
    const daRipassare = leitnerCounts.filter(c => !c.boxes.includes(0) && !c.boxes.includes(5) && !c.boxes.includes(6) && !c.boxes.includes(7))
      .reduce((acc, c) => acc + c.count, 0);
    const minuti = Math.round((daRipassare * 30) / 60);
    if (minuti < 60) return `${minuti} min`;
    const ore = Math.floor(minuti / 60);
    return `${ore}h ${minuti % 60}min`;
  }, [leitnerCounts]);

  if (loading || !dataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <GraduationCap className="h-12 w-12 mx-auto mb-4 animate-pulse text-primary" />
          <p className="text-muted-foreground">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container px-4 py-6 max-w-4xl mx-auto">
        {/* Saluto */}
        <section className="mb-6">
          <h1 className="text-2xl font-bold">
            {getGreeting()}, Sara!
          </h1>
          <p className="text-muted-foreground">
            Continua la tua preparazione per il concorso RIPAM
          </p>
        </section>

        {/* 4 Stat Cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <BookOpen className="h-5 w-5 mx-auto mb-1.5 text-primary" />
              <p className="text-2xl font-bold">{quizCompletati.size}</p>
              <p className="text-xs text-muted-foreground">Quiz completati</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Target className="h-5 w-5 mx-auto mb-1.5 text-green-500" />
              <p className="text-2xl font-bold">{percentualeGlobale}%</p>
              <p className="text-xs text-muted-foreground">Precisione</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <ClipboardList className="h-5 w-5 mx-auto mb-1.5 text-blue-500" />
              <p className="text-2xl font-bold">{simulazioniCount}</p>
              <p className="text-xs text-muted-foreground">Simulazioni</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <AlertCircle className="h-5 w-5 mx-auto mb-1.5 text-red-500" />
              <p className="text-2xl font-bold">{quizSbagliati.size}</p>
              <p className="text-xs text-muted-foreground">Da ripassare</p>
            </CardContent>
          </Card>
        </section>

        {/* Cosa studiare oggi */}
        <section className="mb-6">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-lg">Cosa studiare oggi</h2>
              </div>

              {/* Progress Apprendimento */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Progresso apprendimento</span>
                  <span className="font-medium">{progressoApprendimento}%</span>
                </div>
                <Progress value={progressoApprendimento} className="h-2.5" />
              </div>

              {/* Categorie colorate */}
              <div className="grid grid-cols-5 gap-2 mb-4">
                {leitnerCounts.map((cat) => (
                  <div key={cat.label} className="text-center">
                    <div className={cn('w-full h-2 rounded-full mb-1.5', cat.color)} />
                    <p className="text-lg font-bold">{cat.count}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{cat.label}</p>
                  </div>
                ))}
              </div>

              {/* Info aggiuntive */}
              <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-3">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>Tempo stimato: {tempoStimato}</span>
                </div>
                {materiaDebole && (
                  <span>
                    Concentrati su: <Link href={`/quiz/${materiaDebole.id}`} className="text-primary font-medium hover:underline">{materiaDebole.nome.toLowerCase()}</Link>
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* CTA: Studio libero e Simulazione */}
        <section className="grid grid-cols-2 gap-3 mb-6">
          <Link href="/quiz">
            <Button variant="outline" className="w-full h-14 gap-2 text-base">
              <BookOpen className="h-5 w-5" />
              Studio libero
            </Button>
          </Link>
          <Link href="/simulazione">
            <Button className="w-full h-14 gap-2 text-base">
              <Play className="h-5 w-5" />
              Simulazione
            </Button>
          </Link>
        </section>

        {/* Materie da migliorare */}
        {materieDaMigliorare.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              Materie da migliorare
            </h2>
            <div className="space-y-2">
              {materieDaMigliorare.slice(0, 4).map(m => (
                <Link key={m.id} href={`/quiz/${m.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-medium text-sm">{m.nome}</span>
                        <span className={cn(
                          'text-sm font-medium',
                          (m.stats?.percentuale || 0) < 50 ? 'text-red-600' : 'text-yellow-600'
                        )}>
                          {m.stats?.percentuale}%
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress
                          value={m.stats?.percentuale || 0}
                          className={cn(
                            'h-1.5 flex-1',
                            (m.stats?.percentuale || 0) < 50 && '[&>div]:bg-red-500',
                            (m.stats?.percentuale || 0) >= 50 && (m.stats?.percentuale || 0) < 70 && '[&>div]:bg-yellow-500'
                          )}
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {m.stats?.corrette}/{m.stats?.totale}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Studia per Materia */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Studia per Materia</h2>
          <div className="space-y-2">
            {quizData?.materie.map((materia) => {
              const IconComponent = iconMap[materia.icona] || BookOpen;
              const stats = statsPerMateria[materia.id];
              const progress = stats ? stats.percentuale : 0;

              return (
                <Link key={materia.id} href={`/quiz/${materia.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-primary/10">
                          <IconComponent className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-medium text-sm truncate">{materia.nome}</h3>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {materia.domande_esame} in esame
                            </Badge>
                          </div>
                          {stats ? (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">
                                  {stats.corrette}/{stats.totale} corrette
                                </span>
                                <span className={cn(
                                  'font-medium',
                                  progress >= 70 ? 'text-green-600' : progress >= 50 ? 'text-yellow-600' : 'text-red-600'
                                )}>
                                  {progress}%
                                </span>
                              </div>
                              <Progress value={progress} className="h-1.5" />
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Non ancora iniziato</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Bottone Svuota Cache - fisso in fondo */}
        <section className="pb-6">
          <ClearCacheButton />
        </section>
      </main>
    </div>
  );
}
