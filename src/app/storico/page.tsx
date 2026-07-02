'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Header } from '@/components/layout/Header';
import { useQuizStore } from '@/store/quiz-store';
import { SimulazioneSummary } from '@/types/quiz';
import {
  ArrowLeft,
  History,
  Trophy,
  Target,
  Clock,
  Play,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

function formatData(ts: number): string {
  return new Date(ts).toLocaleDateString('it-IT', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatDataShort(ts: number): string {
  return new Date(ts).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

function formatTempo(ms: number): string {
  const minuti = Math.floor(ms / 60000);
  const secondi = Math.floor((ms % 60000) / 1000);
  return `${minuti}m ${secondi}s`;
}

function nomeMateria(id: string): string {
  return id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ========== Grafico andamento punteggi (SVG, nessuna libreria) ==========
function ScoreChart({ simulazioni }: { simulazioni: SimulazioneSummary[] }) {
  const sorted = [...simulazioni].sort((a, b) => a.data - b.data); // vecchie → recenti
  if (sorted.length < 2) return null;

  const W = 600, H = 200;
  const PAD_LEFT = 40, PAD_RIGHT = 16, PAD_TOP = 20, PAD_BOTTOM = 32;
  const chartW = W - PAD_LEFT - PAD_RIGHT;
  const chartH = H - PAD_TOP - PAD_BOTTOM;
  const maxScore = 30, soglia = 21;

  const points = sorted.map((s, i) => ({
    x: PAD_LEFT + (i / (sorted.length - 1)) * chartW,
    y: PAD_TOP + chartH - (Math.max(0, s.punteggio) / maxScore) * chartH,
    date: formatDataShort(s.data),
    superato: s.punteggio >= soglia,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const sogliaY = PAD_TOP + chartH - (soglia / maxScore) * chartH;
  const media3 = sorted.length >= 3
    ? sorted.slice(-3).reduce((acc, s) => acc + s.punteggio, 0) / 3
    : null;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5" /> Andamento Punteggi
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          {[0, 10, 20, 30].map(v => {
            const y = PAD_TOP + chartH - (v / maxScore) * chartH;
            return (
              <g key={v}>
                <line x1={PAD_LEFT} y1={y} x2={W - PAD_RIGHT} y2={y} stroke="currentColor" strokeOpacity={0.1} strokeDasharray="4 4" />
                <text x={PAD_LEFT - 6} y={y + 4} textAnchor="end" className="fill-muted-foreground" fontSize="10">{v}</text>
              </g>
            );
          })}
          <line x1={PAD_LEFT} y1={sogliaY} x2={W - PAD_RIGHT} y2={sogliaY} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 3" />
          <text x={W - PAD_RIGHT + 2} y={sogliaY + 3} className="fill-amber-500" fontSize="9" fontWeight="600">21</text>
          <path d={`${linePath} L ${points[points.length - 1].x} ${PAD_TOP + chartH} L ${points[0].x} ${PAD_TOP + chartH} Z`} fill="url(#areaGrad)" opacity={0.3} />
          <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={4} fill={p.superato ? '#22c55e' : '#ef4444'} stroke="white" strokeWidth={2} />
              {(i === 0 || i === points.length - 1 || points.length <= 10 || i % Math.ceil(points.length / 6) === 0) && (
                <text x={p.x} y={H - 6} textAnchor="middle" className="fill-muted-foreground" fontSize="8">{p.date}</text>
              )}
            </g>
          ))}
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        <div className="flex items-center justify-between mt-3 text-sm">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Superato</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Non superato</span>
          </div>
          {media3 !== null && (
            <span className="text-muted-foreground">
              Media ultime 3: <strong className={media3 >= 21 ? 'text-green-600' : 'text-red-600'}>{media3.toFixed(1)}</strong>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function StoricoPage() {
  const { simulazioniStorico, darkMode } = useQuizStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const simulazioni = [...simulazioniStorico].sort((a, b) => b.data - a.data);

  // Metriche aggregate
  const prove = simulazioni.length;
  const ultimo = simulazioni[0] ?? null;
  const migliore = prove > 0 ? Math.max(...simulazioni.map(s => s.punteggio)) : 0;
  const media = prove > 0 ? simulazioni.reduce((a, s) => a + s.punteggio, 0) / prove : 0;
  const superate = simulazioni.filter(s => s.superato).length;
  const tempoMedio = prove > 0 ? simulazioni.reduce((a, s) => a + s.tempoMs, 0) / prove : 0;

  // Rendimento per materia aggregato su tutte le simulazioni
  const perMateriaAgg: Record<string, { corrette: number; totale: number }> = {};
  for (const sim of simulazioni) {
    for (const [m, s] of Object.entries(sim.perMateria || {})) {
      if (!perMateriaAgg[m]) perMateriaAgg[m] = { corrette: 0, totale: 0 };
      perMateriaAgg[m].corrette += s.corrette;
      perMateriaAgg[m].totale += s.totale;
    }
  }
  const materieRank = Object.entries(perMateriaAgg)
    .map(([m, s]) => ({ id: m, perc: s.totale > 0 ? Math.round((s.corrette / s.totale) * 100) : 0, ...s }))
    .sort((a, b) => a.perc - b.perc);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-4 py-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 mb-4"><ArrowLeft className="h-4 w-4" /> Torna alla home</Button>
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2"><History className="h-6 w-6" /> Andamento Simulazioni</h1>
          <p className="text-muted-foreground">Come vai in condizioni d&apos;esame ({prove} {prove === 1 ? 'prova' : 'prove'})</p>
        </div>

        {prove === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
              <h2 className="text-lg font-medium mb-2">Nessuna simulazione ancora</h2>
              <p className="text-muted-foreground mb-4">Completa una simulazione per iniziare a monitorare i tuoi punteggi.</p>
              <Link href="/simulazione"><Button className="gap-2"><Play className="h-4 w-4" /> Inizia una Simulazione</Button></Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Riepilogo numerico */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Card><CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${ultimo && ultimo.superato ? 'text-green-600' : 'text-orange-600'}`}>{ultimo ? ultimo.punteggio.toFixed(2) : '—'}</p>
                <p className="text-xs text-muted-foreground">Ultimo /30</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${media >= 21 ? 'text-green-600' : 'text-orange-600'}`}>{media.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Media /30</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-yellow-600">{migliore.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Migliore</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{superate}/{prove}</p>
                <p className="text-xs text-muted-foreground">Superate ({Math.round((superate / prove) * 100)}%)</p>
              </CardContent></Card>
            </div>

            {/* Grafico */}
            <ScoreChart simulazioni={simulazioni} />

            {/* Dove perdi punti per materia */}
            {materieRank.length > 0 && (
              <Card className="mb-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" /> Rendimento per materia (in simulazione)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2.5">
                    {materieRank.map(m => (
                      <div key={m.id} className="flex items-center gap-3">
                        <span className="flex-1 truncate text-sm font-medium">{nomeMateria(m.id)}</span>
                        <span className="text-xs text-muted-foreground w-12 text-right tabular-nums">{m.corrette}/{m.totale}</span>
                        <div className="w-28">
                          <Progress value={m.perc} className={m.perc < 50 ? '[&>div]:bg-red-500 h-2' : m.perc < 70 ? '[&>div]:bg-yellow-500 h-2' : 'h-2'} />
                        </div>
                        <Badge variant={m.perc >= 70 ? 'default' : m.perc >= 50 ? 'secondary' : 'destructive'} className="w-12 justify-center">{m.perc}%</Badge>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">Tempo medio per prova: {formatTempo(tempoMedio)}</p>
                </CardContent>
              </Card>
            )}

            {/* Lista prove */}
            <h2 className="text-lg font-semibold mb-3">Tutte le prove</h2>
            <div className="space-y-3">
              {simulazioni.map((sim) => (
                <Card key={sim.id} className={sim.superato ? 'border-green-200 dark:border-green-800' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {sim.superato ? <Trophy className="h-5 w-5 text-yellow-500" /> : <Target className="h-5 w-5 text-orange-500" />}
                        <span className="font-medium">{sim.punteggio.toFixed(2)}/30</span>
                        <Badge variant={sim.superato ? 'default' : 'destructive'}>{sim.superato ? 'Superato' : 'Non superato'}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatData(sim.data)}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      <span className="text-green-600">{sim.corrette} corrette</span>
                      <span className="text-red-600">{sim.errate} errate</span>
                      <span>{sim.saltate} saltate</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatTempo(sim.tempoMs)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
