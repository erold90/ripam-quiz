'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { useQuizStore } from '@/store/quiz-store';
import { getQuizIndex, countRipasso } from '@/lib/quiz-loader';
import { QuizIndex } from '@/types/quiz';
import {
  GraduationCap, BookOpen, ArrowLeft, RefreshCw, CheckCircle2,
  Scale, Gavel, Monitor, Building, Globe, Laptop, Calculator, Flag, Users, Brain,
  MessageCircle, ShieldCheck, Landmark, ScrollText, BadgeCheck, Signature, Coins,
  Building2, Languages, Puzzle, Presentation,
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Scale, Gavel, Monitor, Building, Globe, Laptop, Calculator, Flag, Users, Brain, MessageCircle,
  ShieldCheck, Landmark, ScrollText, BadgeCheck, Signature, Coins, Building2, Languages, Puzzle, Presentation,
};

interface MateriaRipasso {
  id: string;
  nome: string;
  icona: string;
  sempre: number; // sempre sbagliate
  mista: number;  // a volte sì, a volte no
  totale: number;
}

export default function RipassoPage() {
  const [, setQuizData] = useState<QuizIndex | null>(null);
  const [materie, setMaterie] = useState<MateriaRipasso[]>([]);
  const [loading, setLoading] = useState(true);
  const { leitnerStates, darkMode } = useQuizStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    async function load() {
      const data = await getQuizIndex();
      setQuizData(data);
      const rows: MateriaRipasso[] = [];
      for (const m of data.materie) {
        const r = await countRipasso(m.id, leitnerStates);
        rows.push({ id: m.id, nome: m.nome, icona: m.icona, sempre: r.sempre, mista: r.mista, totale: r.sempre + r.mista });
      }
      setMaterie(rows);
      setLoading(false);
    }
    load();
  }, [leitnerStates]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <GraduationCap className="h-12 w-12 animate-pulse text-primary" />
      </div>
    );
  }

  const daRipassare = materie.filter(m => m.totale > 0).sort((a, b) => b.sempre - a.sempre || b.totale - a.totale);
  const totaleGlobale = materie.reduce((a, m) => a + m.totale, 0);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-4 py-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 mb-4"><ArrowLeft className="h-4 w-4" /> Torna alla home</Button>
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2"><RefreshCw className="h-6 w-6" /> Ripasso</h1>
          <p className="text-muted-foreground">Solo le domande che hai sbagliato, materia per materia</p>
        </div>

        {totaleGlobale === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500/60" />
              <h2 className="text-lg font-medium mb-2">Nessun errore da ripassare!</h2>
              <p className="text-muted-foreground mb-4">
                Le domande che sbagli in studio o in simulazione compariranno qui, così le potrai consolidare.
              </p>
              <div className="flex gap-2 justify-center">
                <Link href="/quiz"><Button variant="outline">Studia</Button></Link>
                <Link href="/simulazione"><Button>Simulazione</Button></Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {daRipassare.map(m => {
              const Icon = iconMap[m.icona] || BookOpen;
              return (
                <Link key={m.id} href={`/ripasso/${m.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-lg bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{m.nome}</h3>
                          <div className="flex items-center gap-3 mt-1 text-xs">
                            {m.sempre > 0 && <span className="text-red-500">{m.sempre} sempre sbagliate</span>}
                            {m.mista > 0 && <span className="text-yellow-600">{m.mista} a volte</span>}
                          </div>
                        </div>
                        <Badge className="text-sm">{m.totale}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
