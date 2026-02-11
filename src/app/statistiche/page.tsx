'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Header } from '@/components/layout/Header';
import { useQuizStore } from '@/store/quiz-store';
import { getQuizIndex } from '@/lib/quiz-loader';
import { deleteAllUserData, SARA_USER_ID } from '@/lib/supabase';
import { loadAllFromSupabase } from '@/lib/cloud-sync';
import { QuizIndex } from '@/types/quiz';
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Target,
  Clock,
  TrendingUp,
  RotateCcw,
  CheckCircle2,
  XCircle,
  GraduationCap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function StatistichePage() {
  const [quizData, setQuizData] = useState<QuizIndex | null>(null);
  const [loading, setLoading] = useState(true);

  const {
    statsPerMateria,
    quizCompletati,
    quizSbagliati,
    resetStatistiche,
    darkMode,
  } = useQuizStore();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    async function loadData() {
      const data = await getQuizIndex();
      setQuizData(data);
      setLoading(false);
    }
    loadData();
  }, []);

  // Calcoli statistiche globali
  const totaleRisposte = Object.values(statsPerMateria).reduce((acc, s) => acc + s.totale, 0);
  const totaleCorrette = Object.values(statsPerMateria).reduce((acc, s) => acc + s.corrette, 0);
  const totaleErrate = Object.values(statsPerMateria).reduce((acc, s) => acc + s.errate, 0);
  const percentualeGlobale = totaleRisposte > 0 ? Math.round((totaleCorrette / totaleRisposte) * 100) : 0;

  // Materie ordinate per performance
  const materieOrdinate = quizData?.materie
    .map(m => ({
      ...m,
      stats: statsPerMateria[m.id],
    }))
    .filter(m => m.stats && m.stats.totale > 0)
    .sort((a, b) => (a.stats?.percentuale || 0) - (b.stats?.percentuale || 0)) || [];

  // Punti deboli (sotto 60%)
  const puntiDeboli = materieOrdinate.filter(m => (m.stats?.percentuale || 0) < 60);

  // Punti di forza (sopra 80%)
  const puntiForza = materieOrdinate.filter(m => (m.stats?.percentuale || 0) >= 80);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <GraduationCap className="h-12 w-12 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container px-4 py-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" />
              Torna alla home
            </Button>
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                Le Tue Statistiche
              </h1>
              <p className="text-muted-foreground">
                Monitora i tuoi progressi nello studio
              </p>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Resettare le statistiche?</DialogTitle>
                  <DialogDescription>
                    Questa azione cancellerà tutti i tuoi progressi. Non può essere annullata.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="destructive" onClick={async () => {
                    resetStatistiche();
                    await deleteAllUserData(SARA_USER_ID);
                    loadAllFromSupabase();
                  }}>
                    Conferma Reset
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <BookOpen className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{quizCompletati.size}</p>
              <p className="text-xs text-muted-foreground">Quiz unici</p>
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
              <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">{totaleCorrette}</p>
              <p className="text-xs text-muted-foreground">Corrette</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <XCircle className="h-6 w-6 mx-auto mb-2 text-red-500" />
              <p className="text-2xl font-bold">{totaleErrate}</p>
              <p className="text-xs text-muted-foreground">Errate</p>
            </CardContent>
          </Card>
        </div>

        {/* Punti deboli */}
        {puntiDeboli.length > 0 && (
          <Card className="mb-6 border-orange-200 dark:border-orange-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-orange-600">
                <TrendingUp className="h-5 w-5" />
                Aree da Migliorare
              </CardTitle>
              <CardDescription>
                Concentrati su queste materie per migliorare
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {puntiDeboli.map(m => (
                  <Link key={m.id} href={`/quiz/${m.id}`}>
                    <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="font-medium">{m.nome}</span>
                          <span className="text-red-600 font-medium">
                            {m.stats?.percentuale}%
                          </span>
                        </div>
                        <Progress value={m.stats?.percentuale || 0} className="h-2" />
                      </div>
                      <Badge variant="outline">Studia</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Statistiche per materia */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dettaglio per Materia</CardTitle>
          </CardHeader>
          <CardContent>
            {materieOrdinate.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nessuna statistica disponibile. Inizia a studiare!
              </p>
            ) : (
              <div className="space-y-4">
                {quizData?.materie.map(materia => {
                  const stats = statsPerMateria[materia.id];
                  if (!stats) {
                    return (
                      <div key={materia.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                        <div className="flex-1">
                          <p className="font-medium">{materia.nome}</p>
                          <p className="text-sm text-muted-foreground">Non iniziato</p>
                        </div>
                        <Link href={`/quiz/${materia.id}`}>
                          <Button size="sm" variant="outline">Inizia</Button>
                        </Link>
                      </div>
                    );
                  }

                  return (
                    <div key={materia.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium truncate">{materia.nome}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              {stats.corrette}/{stats.totale}
                            </span>
                            <Badge
                              variant={stats.percentuale >= 70 ? "default" : stats.percentuale >= 50 ? "secondary" : "destructive"}
                            >
                              {stats.percentuale}%
                            </Badge>
                          </div>
                        </div>
                        <Progress
                          value={stats.percentuale}
                          className={cn(
                            "h-2",
                            stats.percentuale < 50 && "[&>div]:bg-red-500",
                            stats.percentuale >= 50 && stats.percentuale < 70 && "[&>div]:bg-yellow-500"
                          )}
                        />
                      </div>
                      <Link href={`/quiz/${materia.id}`}>
                        <Button size="sm" variant="ghost">
                          Studia
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Consigli */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Consigli per lo Studio</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Punta a raggiungere almeno il 70% in ogni materia</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Fai simulazioni regolari per abituarti al tempo</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Rivedi le domande sbagliate per consolidare</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Leggi sempre le spiegazioni, anche quando rispondi correttamente</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
