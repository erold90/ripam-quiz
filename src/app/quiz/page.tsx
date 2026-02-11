'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Header } from '@/components/layout/Header';
import { useQuizStore } from '@/store/quiz-store';
import { getQuizIndex } from '@/lib/quiz-loader';
import { QuizIndex } from '@/types/quiz';
import {
  GraduationCap,
  BookOpen,
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
  ArrowLeft,
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Scale, Gavel, Monitor, Building, Globe, Laptop,
  Calculator, Flag, Users, Brain, MessageCircle,
  ShieldCheck, Landmark, ScrollText, BadgeCheck, Signature, Coins, Building2, Languages, Puzzle, Presentation,
};

export default function QuizPage() {
  const [quizData, setQuizData] = useState<QuizIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const { statsPerMateria, darkMode } = useQuizStore();

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
          <h1 className="text-2xl font-bold">Studia per Materia</h1>
          <p className="text-muted-foreground">
            Seleziona una materia per iniziare a studiare
          </p>
        </div>

        <div className="space-y-6">
          {quizData?.materie.map((materia) => {
            const IconComponent = iconMap[materia.icona] || BookOpen;
            const stats = statsPerMateria[materia.id];
            const progress = stats ? stats.percentuale : 0;

            return (
              <Link key={materia.id} href={`/quiz/${materia.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-primary/10">
                        <IconComponent className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{materia.nome}</h3>
                          <Badge variant="outline" className="text-xs">
                            {materia.domande_esame} in esame
                          </Badge>
                        </div>
                        {stats ? (
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                {stats.corrette}/{stats.totale} corrette
                              </span>
                              <span className={cn(
                                "font-medium",
                                progress >= 70 ? "text-green-600" : progress >= 50 ? "text-yellow-600" : "text-red-600"
                              )}>
                                {progress}%
                              </span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Non ancora iniziato
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
