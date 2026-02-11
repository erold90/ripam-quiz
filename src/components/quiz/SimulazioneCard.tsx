'use client';

import { Quiz } from '@/types/quiz';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { formatTempoRimanente } from '@/lib/quiz-loader';
import { Clock, Flag, ChevronRight, SkipForward } from 'lucide-react';

interface SimulazioneCardProps {
  quiz: Quiz & { materia: string };
  rispostaSelezionata: string | null;
  onSelezionaRisposta: (id: string) => void;
  onProssimo: () => void;
  onSalta: () => void;
  onTermina: () => void;
  indice: number;
  totale: number;
  tempoRimanente: number;
}

export function SimulazioneCard({
  quiz,
  rispostaSelezionata,
  onSelezionaRisposta,
  onProssimo,
  onSalta,
  onTermina,
  indice,
  totale,
  tempoRimanente,
}: SimulazioneCardProps) {
  const progress = ((indice + 1) / totale) * 100;
  const tempoPercentuale = (tempoRimanente / (60 * 60)) * 100;
  const tempoScadendo = tempoRimanente < 300; // meno di 5 minuti

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      {/* Header con timer e progressione */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <Badge variant="outline">
                {indice + 1}/{totale}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {quiz.materia.replace('-', ' ')}
              </Badge>
            </div>
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-lg font-medium",
              tempoScadendo ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 animate-pulse" : "bg-muted"
            )}>
              <Clock className="w-5 h-5" />
              {formatTempoRimanente(tempoRimanente)}
            </div>
          </div>
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <Progress
              value={tempoPercentuale}
              className={cn("h-1", tempoScadendo && "bg-red-200 [&>div]:bg-red-500")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quiz */}
      <Card>
        <CardContent className="p-6 md:p-8">
          {/* Domanda */}
          <h2 className="text-lg md:text-xl font-medium mb-6 leading-relaxed">
            {quiz.domanda}
          </h2>

          {/* Risposte */}
          <div className="space-y-3 mb-6">
            {quiz.risposte.map((risposta) => {
              const isSelected = rispostaSelezionata === risposta.id;

              return (
                <button
                  key={risposta.id}
                  onClick={() => onSelezionaRisposta(risposta.id)}
                  className={cn(
                    "w-full p-4 rounded-lg border-2 text-left transition-all duration-200",
                    "flex items-start gap-3",
                    "touch-manipulation",
                    isSelected && "border-primary bg-primary/5",
                    !isSelected && "border-border hover:border-primary/50 hover:bg-accent/50"
                  )}
                >
                  <span className={cn(
                    "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-medium mt-0.5",
                    isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                  )}>
                    {risposta.id.toUpperCase()}
                  </span>
                  <span className="text-sm md:text-base leading-relaxed">
                    {risposta.testo}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Pulsanti azione */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onSalta}
              className="h-12"
            >
              <SkipForward className="w-4 h-4 mr-2" />
              Salta
            </Button>
            <Button
              onClick={onProssimo}
              className="flex-1 h-12 text-base"
            >
              {indice < totale - 1 ? (
                <>
                  Conferma
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  <Flag className="w-4 h-4 mr-2" />
                  Termina Simulazione
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pulsante termina anticipatamente */}
      <div className="text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={onTermina}
          className="text-muted-foreground"
        >
          Termina anticipatamente
        </Button>
      </div>
    </div>
  );
}
