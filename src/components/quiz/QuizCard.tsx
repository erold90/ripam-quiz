'use client';

import { Quiz } from '@/types/quiz';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AiExplanation } from './AiExplanation';

interface QuizCardProps {
  quiz: Quiz;
  rispostaSelezionata: string | null;
  mostraSoluzione: boolean;
  onSelezionaRisposta: (id: string) => void;
  onConferma: () => void;
  onProssimo: () => void;
  indice: number;
  totale: number;
  materia?: string;
}

export function QuizCard({
  quiz,
  rispostaSelezionata,
  mostraSoluzione,
  onSelezionaRisposta,
  onConferma,
  onProssimo,
  indice,
  totale,
  materia,
}: QuizCardProps) {
  const rispostaCorretta = quiz.risposte.find(r => r.corretta);
  const isCorretta = rispostaCorretta?.id === rispostaSelezionata;

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardContent className="p-6 md:p-8">
        {/* Header con progressione */}
        <div className="flex justify-between items-center mb-6">
          <Badge variant="outline" className="text-sm">
            Domanda {indice + 1} di {totale}
          </Badge>
          {mostraSoluzione && (
            <Badge variant={isCorretta ? "default" : "destructive"} className="text-sm">
              {isCorretta ? "Corretta!" : "Sbagliata"}
            </Badge>
          )}
        </div>

        {/* Domanda */}
        <h2 className="text-lg md:text-xl font-medium mb-6 leading-relaxed">
          {quiz.domanda}
        </h2>

        {/* Risposte */}
        <div className="space-y-3 mb-6">
          {quiz.risposte.map((risposta) => {
            const isSelected = rispostaSelezionata === risposta.id;
            const isCorrect = risposta.corretta;
            const showAsCorrect = mostraSoluzione && isCorrect;
            const showAsWrong = mostraSoluzione && isSelected && !isCorrect;

            return (
              <button
                key={risposta.id}
                onClick={() => !mostraSoluzione && onSelezionaRisposta(risposta.id)}
                disabled={mostraSoluzione}
                className={cn(
                  "w-full p-4 rounded-lg border-2 text-left transition-all duration-200",
                  "flex items-start gap-3",
                  "touch-manipulation",
                  !mostraSoluzione && isSelected && "border-primary bg-primary/5",
                  !mostraSoluzione && !isSelected && "border-border hover:border-primary/50 hover:bg-accent/50",
                  showAsCorrect && "border-green-500 bg-green-50 dark:bg-green-950",
                  showAsWrong && "border-red-500 bg-red-50 dark:bg-red-950",
                  mostraSoluzione && !showAsCorrect && !showAsWrong && "opacity-50"
                )}
              >
                <span className="flex-shrink-0 mt-0.5">
                  {mostraSoluzione ? (
                    showAsCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : showAsWrong ? (
                      <XCircle className="w-5 h-5 text-red-600" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground" />
                    )
                  ) : (
                    <span className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-medium",
                      isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                    )}>
                      {risposta.id.toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="text-sm md:text-base leading-relaxed">
                  {risposta.testo}
                </span>
              </button>
            );
          })}
        </div>

        {/* Spiegazione statica */}
        {mostraSoluzione && quiz.spiegazione && (
          <div className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
              Spiegazione:
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
              {quiz.spiegazione}
            </p>
          </div>
        )}

        {/* Spiegazione AI per risposte sbagliate */}
        {mostraSoluzione && !isCorretta && rispostaSelezionata && materia && (
          <div className="mb-6">
            <AiExplanation
              key={`${quiz.id}-${rispostaSelezionata}`}
              quiz={quiz}
              rispostaUtente={rispostaSelezionata}
              materia={materia}
            />
          </div>
        )}

        {/* Pulsanti azione */}
        <div className="flex gap-3">
          {!mostraSoluzione ? (
            <Button
              onClick={onConferma}
              disabled={!rispostaSelezionata}
              className="flex-1 h-12 text-base"
            >
              Conferma Risposta
            </Button>
          ) : (
            <Button
              onClick={onProssimo}
              className="flex-1 h-12 text-base"
            >
              {indice < totale - 1 ? "Prossima Domanda" : "Termina"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
