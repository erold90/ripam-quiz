'use client';

import { useState, useEffect, useRef } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Quiz } from '@/types/quiz';

const AI_WORKER_URL = 'https://ripamquiz-ai.erold90.workers.dev';

interface AiExplanationProps {
  quiz: Quiz;
  rispostaUtente: string | null;
  materia: string;
}

export function AiExplanation({ quiz, rispostaUtente, materia }: AiExplanationProps) {
  const [spiegazione, setSpiegazione] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    async function fetchExplanation() {
      try {
        const res = await fetch(AI_WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domanda: quiz.domanda,
            risposte: quiz.risposte.map(r => ({
              id: r.id,
              testo: r.testo,
              corretta: r.corretta,
              efficacia: r.efficacia,
            })),
            rispostaUtente,
            materia,
          }),
        });

        if (!res.ok) throw new Error('API error');

        const data = await res.json();
        setSpiegazione(data.spiegazione);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchExplanation();
  }, [quiz, rispostaUtente, materia]);

  if (error) return null;

  return (
    <div className="mt-4 p-4 rounded-lg bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        <p className="text-sm font-medium text-purple-800 dark:text-purple-200">
          Spiegazione AI
        </p>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Generazione spiegazione...</span>
        </div>
      ) : (
        <p className="text-sm text-purple-700 dark:text-purple-300 leading-relaxed">
          {spiegazione}
        </p>
      )}
    </div>
  );
}
