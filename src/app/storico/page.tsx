'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/Header';
import { useQuizStore } from '@/store/quiz-store';
import { getUserSimulazioni } from '@/lib/supabase';
import { useAuth } from '@/components/Providers';
import { Simulazione } from '@/types/quiz';
import {
  ArrowLeft,
  History,
  Trophy,
  Target,
  Clock,
  GraduationCap,
  Play,
} from 'lucide-react';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTempo(ms: number): string {
  const minuti = Math.floor(ms / 60000);
  const secondi = Math.floor((ms % 60000) / 1000);
  return `${minuti}m ${secondi}s`;
}

export default function StoricoPage() {
  const [simulazioni, setSimulazioni] = useState<Simulazione[]>([]);
  const [loading, setLoading] = useState(true);
  const { darkMode } = useQuizStore();
  const { user } = useAuth();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    async function loadStorico() {
      if (user) {
        const { data } = await getUserSimulazioni(user.id);
        if (data) {
          setSimulazioni(data as Simulazione[]);
        }
      }
      setLoading(false);
    }
    loadStorico();
  }, [user]);

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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6" />
            Storico Simulazioni
          </h1>
          <p className="text-muted-foreground">
            Le tue simulazioni d&apos;esame passate
          </p>
        </div>

        {simulazioni.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
              <h2 className="text-lg font-medium mb-2">Nessuna simulazione</h2>
              <p className="text-muted-foreground mb-4">
                {user
                  ? 'Non hai ancora completato nessuna simulazione.'
                  : 'Effettua il login per salvare le tue simulazioni nel cloud.'}
              </p>
              <Link href="/simulazione">
                <Button className="gap-2">
                  <Play className="h-4 w-4" />
                  Inizia una Simulazione
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {simulazioni.map((sim) => {
              const superato = sim.punteggio >= 21;
              const corrette = sim.risposte.filter(r => r.corretto === true).length;
              const errate = sim.risposte.filter(r => r.corretto === false).length;
              const nonRisposte = sim.risposte.filter(r => r.corretto === null).length;

              return (
                <Card key={sim.id} className={superato ? 'border-green-200 dark:border-green-800' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {superato ? (
                          <Trophy className="h-5 w-5 text-yellow-500" />
                        ) : (
                          <Target className="h-5 w-5 text-orange-500" />
                        )}
                        <span className="font-medium">
                          {sim.punteggio.toFixed(2)}/30
                        </span>
                        <Badge variant={superato ? 'default' : 'destructive'}>
                          {superato ? 'Superato' : 'Non superato'}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(sim.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="text-green-600">{corrette} corrette</span>
                      <span className="text-red-600">{errate} errate</span>
                      <span>{nonRisposte} saltate</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTempo(sim.tempo_impiegato_ms)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
