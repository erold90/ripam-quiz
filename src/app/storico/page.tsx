'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/Header';
import { useQuizStore } from '@/store/quiz-store';
import { getUserSimulazioni, SARA_USER_ID } from '@/lib/supabase';
import {
  ArrowLeft,
  History,
  Trophy,
  Target,
  Clock,
  GraduationCap,
  Play,
  TrendingUp,
} from 'lucide-react';

interface SimulazioneRecord {
  id: string;
  punteggio: number;
  tempo_impiegato_ms: number;
  risposte: Array<{
    quiz_id: string;
    materia: string;
    risposta_data: string | null;
    corretto: boolean | null;
    tempo_ms: number;
  }>;
  created_at: string;
}

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

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

function formatTempo(ms: number): string {
  const minuti = Math.floor(ms / 60000);
  const secondi = Math.floor((ms % 60000) / 1000);
  return `${minuti}m ${secondi}s`;
}

// ========== SVG Chart Component ==========
function ScoreChart({ simulazioni }: { simulazioni: SimulazioneRecord[] }) {
  // Ordina dal più vecchio al più recente
  const sorted = [...simulazioni].reverse();
  if (sorted.length < 2) return null;

  const W = 600;
  const H = 200;
  const PAD_LEFT = 40;
  const PAD_RIGHT = 16;
  const PAD_TOP = 20;
  const PAD_BOTTOM = 32;
  const chartW = W - PAD_LEFT - PAD_RIGHT;
  const chartH = H - PAD_TOP - PAD_BOTTOM;

  const maxScore = 30;
  const soglia = 21;

  const points = sorted.map((s, i) => ({
    x: PAD_LEFT + (i / (sorted.length - 1)) * chartW,
    y: PAD_TOP + chartH - (s.punteggio / maxScore) * chartH,
    punteggio: s.punteggio,
    date: formatDateShort(s.created_at),
    superato: s.punteggio >= soglia,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const sogliaY = PAD_TOP + chartH - (soglia / maxScore) * chartH;

  // Media mobile (ultimi 3)
  const media = sorted.length >= 3
    ? sorted.slice(-3).reduce((acc, s) => acc + s.punteggio, 0) / 3
    : null;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Andamento Punteggi
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          {/* Grid lines */}
          {[0, 10, 20, 30].map(v => {
            const y = PAD_TOP + chartH - (v / maxScore) * chartH;
            return (
              <g key={v}>
                <line x1={PAD_LEFT} y1={y} x2={W - PAD_RIGHT} y2={y}
                  stroke="currentColor" strokeOpacity={0.1} strokeDasharray="4 4" />
                <text x={PAD_LEFT - 6} y={y + 4} textAnchor="end"
                  className="fill-muted-foreground" fontSize="10">{v}</text>
              </g>
            );
          })}

          {/* Soglia 21 */}
          <line x1={PAD_LEFT} y1={sogliaY} x2={W - PAD_RIGHT} y2={sogliaY}
            stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 3" />
          <text x={W - PAD_RIGHT + 2} y={sogliaY + 3}
            className="fill-amber-500" fontSize="9" fontWeight="600">21</text>

          {/* Area sotto la linea */}
          <path
            d={`${linePath} L ${points[points.length - 1].x} ${PAD_TOP + chartH} L ${points[0].x} ${PAD_TOP + chartH} Z`}
            fill="url(#areaGradient)" opacity={0.3}
          />

          {/* Linea principale */}
          <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round" />

          {/* Punti */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={4}
                fill={p.superato ? '#22c55e' : '#ef4444'} stroke="white" strokeWidth={2} />
              {/* Label date ogni N punti */}
              {(i === 0 || i === points.length - 1 || (points.length <= 10) || i % Math.ceil(points.length / 6) === 0) && (
                <text x={p.x} y={H - 6} textAnchor="middle"
                  className="fill-muted-foreground" fontSize="8">{p.date}</text>
              )}
            </g>
          ))}

          {/* Gradient */}
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* Stats riassuntive */}
        <div className="flex items-center justify-between mt-3 text-sm">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              Superato
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              Non superato
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-0 border-t-2 border-dashed border-amber-500" />
              Soglia 21
            </span>
          </div>
          {media !== null && (
            <span className="text-muted-foreground">
              Media ultime 3: <strong className={media >= 21 ? 'text-green-600' : 'text-red-600'}>{media.toFixed(1)}</strong>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function StoricoPage() {
  const [simulazioni, setSimulazioni] = useState<SimulazioneRecord[]>([]);
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
    async function loadStorico() {
      const { data } = await getUserSimulazioni(SARA_USER_ID);
      if (data) {
        setSimulazioni(data as SimulazioneRecord[]);
      }
      setLoading(false);
    }
    loadStorico();
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
            <History className="h-6 w-6" />
            Storico Simulazioni
          </h1>
          <p className="text-muted-foreground">
            Tutte le simulazioni completate ({simulazioni.length} totali)
          </p>
        </div>

        {simulazioni.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
              <h2 className="text-lg font-medium mb-2">Nessuna simulazione salvata</h2>
              <p className="text-muted-foreground mb-4">
                Completa una simulazione per vederla qui.
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
          <>
            {/* Grafico andamento */}
            <ScoreChart simulazioni={simulazioni} />

            {/* Lista simulazioni */}
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
          </>
        )}
      </main>
    </div>
  );
}
