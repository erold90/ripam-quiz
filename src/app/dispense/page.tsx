'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/Header';
import { useQuizStore } from '@/store/quiz-store';
import {
  ArrowLeft,
  BookOpen,
  Flag,
  Coins,
  BadgeCheck,
  FileText,
  GraduationCap,
} from 'lucide-react';

interface Capitolo {
  id: string;
  titolo: string;
  sommario: string;
}

interface Dispensa {
  id: string;
  titolo: string;
  descrizione: string;
  fonte: string;
  icona: string;
  colore: string;
  capitoli: Capitolo[];
}

interface DispenseIndex {
  versione: string;
  ultimoAggiornamento: string;
  dispense: Dispensa[];
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Flag,
  Coins,
  BadgeCheck,
};

const colorMap: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  green: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
};

export default function DispensePage() {
  const [data, setData] = useState<DispenseIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const { darkMode } = useQuizStore();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    fetch('/dispense/index.json')
      .then(res => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
            <FileText className="h-6 w-6" />
            Dispense di Studio
          </h1>
          <p className="text-muted-foreground">
            Materiale di studio per le materie del concorso
          </p>
        </div>

        <div className="space-y-6">
          {data?.dispense.map((dispensa) => {
            const IconComponent = iconMap[dispensa.icona] || BookOpen;
            const colorClass = colorMap[dispensa.colore] || colorMap.blue;

            return (
              <Card key={dispensa.id}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`p-3 rounded-lg ${colorClass}`}>
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold">{dispensa.titolo}</h2>
                      <p className="text-sm text-muted-foreground">{dispensa.descrizione}</p>
                      <p className="text-xs text-muted-foreground mt-1">Fonte: {dispensa.fonte}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {dispensa.capitoli.map((capitolo, idx) => (
                      <div
                        key={capitolo.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <Badge variant="outline" className="w-7 h-7 flex items-center justify-center rounded-full text-xs">
                          {idx + 1}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{capitolo.titolo}</p>
                          <p className="text-xs text-muted-foreground truncate">{capitolo.sommario}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Link href={`/dispense/${dispensa.id}`}>
                    <Button className="w-full mt-4 gap-2">
                      <BookOpen className="h-4 w-4" />
                      Leggi Dispensa
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
