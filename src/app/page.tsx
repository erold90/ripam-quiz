'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/Header';
import { useQuizStore } from '@/store/quiz-store';
import { getQuizIndex } from '@/lib/quiz-loader';
import { QuizIndex } from '@/types/quiz';
import {
  GraduationCap,
  BookOpen,
  Timer,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
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
};

export default function Home() {
  const [quizData, setQuizData] = useState<QuizIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const { statsPerMateria, quizCompletati, darkMode } = useQuizStore();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getQuizIndex();
        setQuizData(data);
      } catch (error) {
        console.error('Errore caricamento dati:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Calcola statistiche globali
  const totaleRisposte = Object.values(statsPerMateria).reduce((acc, s) => acc + s.totale, 0);
  const totaleCorrette = Object.values(statsPerMateria).reduce((acc, s) => acc + s.corrette, 0);
  const percentualeGlobale = totaleRisposte > 0 ? Math.round((totaleCorrette / totaleRisposte) * 100) : 0;

  if (loading) {
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

      <main className="container px-4 py-6 md:py-8 max-w-6xl mx-auto">
        {/* Hero Section */}
        <section className="mb-8 md:mb-12">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              RIPAM 3997 - AMM-13
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Preparati al concorso per {quizData?.descrizione}
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4 text-center">
                <BookOpen className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{quizCompletati.size}</p>
                <p className="text-xs text-muted-foreground">Quiz completati</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Target className="h-6 w-6 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold">{percentualeGlobale}%</p>
                <p className="text-xs text-muted-foreground">Precisione</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Timer className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold">60</p>
                <p className="text-xs text-muted-foreground">Minuti esame</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-6 w-6 mx-auto mb-2 text-orange-500" />
                <p className="text-2xl font-bold">21/30</p>
                <p className="text-xs text-muted-foreground">Soglia superamento</p>
              </CardContent>
            </Card>
          </div>

          {/* CTA Simulazione */}
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold mb-1">Pronto per una simulazione?</h2>
                  <p className="text-muted-foreground">
                    40 domande in 60 minuti, come l'esame reale
                  </p>
                </div>
                <Link href="/simulazione">
                  <Button size="lg" className="gap-2 w-full md:w-auto">
                    <Play className="h-5 w-5" />
                    Inizia Simulazione
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Materie Section */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Studia per Materia</h2>

          {/* Materie Comuni */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <Badge variant="secondary">Comuni</Badge>
              <span className="text-sm">10 domande in esame</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {quizData?.materie
                .filter(m => m.categoria === 'comuni')
                .map((materia) => {
                  const IconComponent = iconMap[materia.icona] || BookOpen;
                  const stats = statsPerMateria[materia.id];
                  const progress = stats ? stats.percentuale : 0;

                  return (
                    <Link key={materia.id} href={`/quiz/${materia.id}`}>
                      <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <IconComponent className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{materia.nome}</h4>
                              <p className="text-xs text-muted-foreground">
                                {materia.domande_esame} domande in esame
                              </p>
                              {stats && (
                                <div className="mt-2">
                                  <div className="flex justify-between text-xs mb-1">
                                    <span>{stats.totale} risposte</span>
                                    <span className={cn(
                                      progress >= 70 ? "text-green-600" : progress >= 50 ? "text-yellow-600" : "text-red-600"
                                    )}>{progress}%</span>
                                  </div>
                                  <Progress value={progress} className="h-1.5" />
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
            </div>
          </div>

          {/* Materie Specifiche AMM */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <Badge variant="default">Specifiche AMM</Badge>
              <span className="text-sm">15 domande in esame</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {quizData?.materie
                .filter(m => m.categoria === 'specifiche')
                .map((materia) => {
                  const IconComponent = iconMap[materia.icona] || BookOpen;
                  const stats = statsPerMateria[materia.id];
                  const progress = stats ? stats.percentuale : 0;

                  return (
                    <Link key={materia.id} href={`/quiz/${materia.id}`}>
                      <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10">
                              <IconComponent className="h-5 w-5 text-blue-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{materia.nome}</h4>
                              <p className="text-xs text-muted-foreground">
                                {materia.domande_esame} domande in esame
                              </p>
                              {stats && (
                                <div className="mt-2">
                                  <div className="flex justify-between text-xs mb-1">
                                    <span>{stats.totale} risposte</span>
                                    <span className={cn(
                                      progress >= 70 ? "text-green-600" : progress >= 50 ? "text-yellow-600" : "text-red-600"
                                    )}>{progress}%</span>
                                  </div>
                                  <Progress value={progress} className="h-1.5" />
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
            </div>
          </div>

          {/* Logica e Situazionali */}
          <div>
            <h3 className="text-lg font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <Badge variant="outline">Logica & Situazionali</Badge>
              <span className="text-sm">15 domande in esame</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {quizData?.materie
                .filter(m => m.categoria === 'logica' || m.categoria === 'situazionali')
                .map((materia) => {
                  const IconComponent = iconMap[materia.icona] || BookOpen;
                  const stats = statsPerMateria[materia.id];
                  const progress = stats ? stats.percentuale : 0;

                  return (
                    <Link key={materia.id} href={`/quiz/${materia.id}`}>
                      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-purple-500/10">
                              <IconComponent className="h-5 w-5 text-purple-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium">{materia.nome}</h4>
                              <p className="text-xs text-muted-foreground">
                                {materia.domande_esame} domande in esame
                              </p>
                              {stats && (
                                <div className="mt-2">
                                  <div className="flex justify-between text-xs mb-1">
                                    <span>{stats.totale} risposte</span>
                                    <span className={cn(
                                      progress >= 70 ? "text-green-600" : progress >= 50 ? "text-yellow-600" : "text-red-600"
                                    )}>{progress}%</span>
                                  </div>
                                  <Progress value={progress} className="h-1.5" />
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
            </div>
          </div>
        </section>

        {/* Info Esame */}
        <section className="mt-12">
          <Card>
            <CardHeader>
              <CardTitle>Struttura Esame</CardTitle>
              <CardDescription>Informazioni sulla prova scritta</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Punteggio</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li className="flex justify-between">
                      <span>Risposta corretta:</span>
                      <span className="text-green-600 font-medium">+0,75 punti</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Risposta errata:</span>
                      <span className="text-red-600 font-medium">-0,25 punti</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Non risposta:</span>
                      <span className="text-muted-foreground font-medium">0 punti</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Soglie</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li className="flex justify-between">
                      <span>Punteggio massimo:</span>
                      <span className="font-medium">30 punti</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Soglia superamento:</span>
                      <span className="text-primary font-medium">21 punti</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Tempo disponibile:</span>
                      <span className="font-medium">60 minuti</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 mt-12">
        <div className="container text-center text-sm text-muted-foreground">
          <p>Concorso RIPAM 3997 posti - Profilo AMM-13 Puglia</p>
          <p className="mt-1">141 posti disponibili in Puglia</p>
        </div>
      </footer>
    </div>
  );
}
