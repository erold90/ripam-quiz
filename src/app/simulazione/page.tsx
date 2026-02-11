'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Header } from '@/components/layout/Header';
import { useQuizStore } from '@/store/quiz-store';
import { generaQuizSimulazione, calcolaPunteggio, formatTempoRimanente } from '@/lib/quiz-loader';
import { Quiz, SimulazioneRisposta } from '@/types/quiz';
import { syncSimulazioneAnswer, syncSimulazione } from '@/lib/cloud-sync';
import {
  Play, Trophy, XCircle, CheckCircle2, Clock, Target,
  ArrowLeft, Home, RotateCcw, GraduationCap, ChevronLeft,
  ChevronRight, Square, Eye, Filter, Save, AlertTriangle,
  Flag, Eraser,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Phase = 'intro' | 'inProgress' | 'results' | 'review';

interface QuestionState {
  risposta: string | null;
  visited: boolean;
  flagged: boolean;
}

// ========== Question Palette (during exam) ==========
function QuestionPalette({
  total, currentIndex, states, onNavigate,
}: {
  total: number;
  currentIndex: number;
  states: QuestionState[];
  onNavigate: (index: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    dotRefs.current[currentIndex]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [currentIndex]);

  return (
    <div ref={scrollRef} className="overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
      <div className="flex gap-1 min-w-max">
        {Array.from({ length: total }).map((_, i) => {
          const s = states[i];
          const isAnswered = s?.risposta !== null;
          const isVisited = s?.visited;
          const isFlagged = s?.flagged;
          const isCurrent = currentIndex === i;
          return (
            <button
              key={i}
              ref={el => { dotRefs.current[i] = el; }}
              onClick={() => onNavigate(i)}
              className={cn(
                "w-7 h-7 rounded-full text-[10px] font-semibold flex-shrink-0 transition-all relative",
                "flex items-center justify-center",
                !isVisited && "bg-muted/60 text-muted-foreground/60",
                isVisited && !isAnswered && "bg-yellow-400 text-yellow-900 dark:bg-yellow-500 dark:text-yellow-950",
                isAnswered && "bg-blue-500 text-white",
                isCurrent && "ring-2 ring-foreground ring-offset-1 ring-offset-background scale-110",
              )}
            >
              {i + 1}
              {isFlagged && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-orange-500 rounded-full border border-background" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ========== Review Palette (after exam) ==========
function ReviewPalette({
  indices, currentIdx, results, onNavigate,
}: {
  indices: number[];
  currentIdx: number;
  results: Array<boolean | null>;
  onNavigate: (idx: number) => void;
}) {
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    dotRefs.current[currentIdx]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [currentIdx]);

  return (
    <div className="overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
      <div className="flex gap-1 min-w-max">
        {indices.map((qIdx, i) => {
          const result = results[i];
          const isCurrent = currentIdx === i;
          return (
            <button
              key={qIdx}
              ref={el => { dotRefs.current[i] = el; }}
              onClick={() => onNavigate(i)}
              className={cn(
                "w-7 h-7 rounded-full text-[10px] font-semibold flex-shrink-0 transition-all",
                "flex items-center justify-center",
                result === true && "bg-green-500 text-white",
                result === false && "bg-red-500 text-white",
                result === null && "bg-yellow-400 text-yellow-900",
                isCurrent && "ring-2 ring-foreground ring-offset-1 ring-offset-background scale-110",
              )}
            >
              {qIdx + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ========== Main Page ==========
export default function SimulazionePage() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [quizList, setQuizList] = useState<Array<Quiz & { materia: string }>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<QuestionState[]>([]);
  const [tempoRimanente, setTempoRimanente] = useState(60 * 60);
  const [tempoInizio, setTempoInizio] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showTerminaConfirm, setShowTerminaConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reviewIndices, setReviewIndices] = useState<number[]>([]);
  const [reviewCurrentIdx, setReviewCurrentIdx] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Refs to avoid stale closures
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const quizListRef = useRef(quizList);
  quizListRef.current = quizList;
  const tempoInizioRef = useRef(tempoInizio);
  tempoInizioRef.current = tempoInizio;
  const handleTerminaRef = useRef<() => void>(() => {});

  const { darkMode, leitnerStates, quizCompletati, quizSbagliati, updateLeitnerFromSimulazione, incrementSimulazioni, aggiornaStatistiche } = useQuizStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Timer
  useEffect(() => {
    if (phase === 'inProgress' && tempoRimanente > 0) {
      timerRef.current = setInterval(() => {
        setTempoRimanente(prev => {
          if (prev <= 1) {
            handleTerminaRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // Sync helper
  const syncAnswerToDb = useCallback((index: number, rispostaId: string) => {
    const quiz = quizListRef.current[index];
    if (!quiz) return;
    const corretta = quiz.risposte.find(r => r.corretta);
    const isCorretta = corretta?.id === rispostaId;
    syncSimulazioneAnswer(quiz.id, quiz.materia, rispostaId, isCorretta, Date.now() - tempoInizioRef.current);
    if (isCorretta !== null) aggiornaStatistiche(quiz.materia, isCorretta);
  }, [aggiornaStatistiche]);

  // Computed results
  const currentAnswer = answers[currentIndex]?.risposta || null;
  const answeredCount = answers.filter(a => a.risposta !== null).length;

  const risposte: SimulazioneRisposta[] = useMemo(() => {
    return quizList.map((quiz, i) => {
      const a = answers[i];
      const corretta = quiz.risposte.find(r => r.corretta);
      const isCorretta = a?.risposta ? corretta?.id === a.risposta : null;
      const obj = a?.risposta ? quiz.risposte.find(r => r.id === a.risposta) : null;
      return {
        quiz_id: quiz.id, materia: quiz.materia,
        risposta_data: a?.risposta || null, corretto: isCorretta,
        efficacia: obj?.efficacia ?? null, tempo_ms: 0,
      };
    });
  }, [quizList, answers]);

  const punteggio = calcolaPunteggio(risposte);
  const corrette = risposte.filter(r => r.corretto === true).length;
  const errate = risposte.filter(r => r.corretto === false).length;
  const saltate = risposte.filter(r => r.corretto === null).length;
  const superato = punteggio >= 21;

  const statsByMateria = useMemo(() => {
    return risposte.reduce((acc, r) => {
      if (!acc[r.materia]) acc[r.materia] = { corrette: 0, errate: 0, totale: 0 };
      acc[r.materia].totale++;
      if (r.corretto === true) acc[r.materia].corrette++;
      if (r.corretto === false) acc[r.materia].errate++;
      return acc;
    }, {} as Record<string, { corrette: number; errate: number; totale: number }>);
  }, [risposte]);

  // ===== ACTIONS =====
  const handleStart = async () => {
    setLoading(true);
    try {
      const quiz = await generaQuizSimulazione(leitnerStates, quizCompletati, quizSbagliati);
      setQuizList(quiz);
      setAnswers(quiz.map((_, i) => ({ risposta: null, visited: i === 0, flagged: false })));
      setCurrentIndex(0);
      setTempoRimanente(60 * 60);
      setTempoInizio(Date.now());
      setSaved(false);
      setShowTerminaConfirm(false);
      setPhase('inProgress');
    } catch (error) {
      console.error('Errore generazione simulazione:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAnswer = useCallback((id: string) => {
    setAnswers(prev => {
      const a = [...prev];
      a[currentIndex] = {
        ...a[currentIndex],
        risposta: a[currentIndex].risposta === id ? null : id,
        visited: true,
      };
      return a;
    });
  }, [currentIndex]);

  const handleClearAnswer = useCallback(() => {
    setAnswers(prev => {
      const a = [...prev];
      a[currentIndex] = { ...a[currentIndex], risposta: null };
      return a;
    });
  }, [currentIndex]);

  const handleToggleFlag = useCallback(() => {
    setAnswers(prev => {
      const a = [...prev];
      a[currentIndex] = { ...a[currentIndex], flagged: !a[currentIndex].flagged };
      return a;
    });
  }, [currentIndex]);

  const goToQuestion = useCallback((idx: number) => {
    setCurrentIndex(idx);
    setAnswers(prev => {
      const a = [...prev];
      a[idx] = { ...a[idx], visited: true };
      return a;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const answer = answersRef.current[currentIndex]?.risposta;
    if (answer) syncAnswerToDb(currentIndex, answer);
    if (currentIndex < quizListRef.current.length - 1) {
      goToQuestion(currentIndex + 1);
    } else {
      setShowTerminaConfirm(true);
    }
  }, [currentIndex, syncAnswerToDb, goToQuestion]);

  const handleSkip = useCallback(() => {
    setAnswers(prev => {
      const a = [...prev];
      a[currentIndex] = { ...a[currentIndex], visited: true };
      return a;
    });
    if (currentIndex < quizListRef.current.length - 1) {
      goToQuestion(currentIndex + 1);
    } else {
      setShowTerminaConfirm(true);
    }
  }, [currentIndex, goToQuestion]);

  const handleNavigate = useCallback((targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= quizListRef.current.length) return;
    const currentResp = answersRef.current[currentIndex]?.risposta;
    if (currentResp) syncAnswerToDb(currentIndex, currentResp);
    goToQuestion(targetIndex);
  }, [currentIndex, syncAnswerToDb, goToQuestion]);

  const handleTerminaExam = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    answersRef.current.forEach((a, i) => {
      if (a.risposta) syncAnswerToDb(i, a.risposta);
    });
    setShowTerminaConfirm(false);
    setPhase('results');
  }, [syncAnswerToDb]);

  handleTerminaRef.current = handleTerminaExam;

  const handleStartReview = useCallback((filter: 'all' | 'wrong') => {
    const indices = filter === 'wrong'
      ? risposte.map((r, i) => r.corretto === false ? i : -1).filter(i => i !== -1)
      : Array.from({ length: quizList.length }, (_, i) => i);
    setReviewIndices(indices);
    setReviewCurrentIdx(0);
    setPhase('review');
  }, [risposte, quizList.length]);

  const handleSave = useCallback(async () => {
    const tempoTotaleMs = (60 * 60 - tempoRimanente) * 1000;
    await syncSimulazione(punteggio, tempoTotaleMs, risposte);
    updateLeitnerFromSimulazione(risposte);
    incrementSimulazioni();
    setSaved(true);
  }, [tempoRimanente, punteggio, risposte, updateLeitnerFromSimulazione, incrementSimulazioni]);

  // ===== INTRO =====
  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container px-4 py-6 max-w-2xl mx-auto">
          <Link href="/"><Button variant="ghost" size="sm" className="gap-2 mb-6"><ArrowLeft className="h-4 w-4" /> Torna alla home</Button></Link>
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="text-center">
                <GraduationCap className="h-16 w-16 mx-auto mb-4 text-primary" />
                <h1 className="text-2xl font-bold">Simulazione Esame</h1>
                <p className="text-muted-foreground mt-2">Affronta una simulazione realistica del concorso RIPAM 3997</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted text-center">
                  <p className="text-2xl font-bold">40</p><p className="text-sm text-muted-foreground">Domande</p>
                </div>
                <div className="p-4 rounded-lg bg-muted text-center">
                  <p className="text-2xl font-bold">60</p><p className="text-sm text-muted-foreground">Minuti</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <h4 className="font-medium">Regole (da bando ufficiale):</h4>
                <ul className="text-muted-foreground space-y-1">
                  <li>• Conoscenze/Logica: +0,75 corretta | -0,25 errata | 0 non data</li>
                  <li>• Situazionali: +0,75 efficace | +0,375 neutra | 0 meno efficace</li>
                  <li>• Soglia superamento: 21/30 punti</li>
                </ul>
              </div>
              <div className="space-y-2 text-sm">
                <h4 className="font-medium">Navigazione:</h4>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-muted/60 border" /> Non visitata</span>
                  <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-blue-500" /> Risposta data</span>
                  <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-yellow-400" /> Saltata</span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-muted relative"><span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full" /></span> Segnata
                  </span>
                </div>
              </div>
              <Button onClick={handleStart} disabled={loading} className="w-full h-12 text-lg gap-2">
                {loading ? <span className="animate-pulse">Caricamento...</span> : <><Play className="h-5 w-5" /> Inizia Simulazione</>}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // ===== IN PROGRESS =====
  if (phase === 'inProgress') {
    const quiz = quizList[currentIndex];
    if (!quiz) return null;
    const tempoScadendo = tempoRimanente < 300;
    const isFlagged = answers[currentIndex]?.flagged;
    const flaggedCount = answers.filter(a => a.flagged).length;

    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container px-4 py-3 max-w-3xl mx-auto">
          {/* Header + palette */}
          <Card className="mb-3">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize text-xs">{quiz.materia.replace(/-/g, ' ')}</Badge>
                  <span className="text-xs text-muted-foreground">{answeredCount}/{quizList.length}</span>
                  {flaggedCount > 0 && (
                    <span className="text-xs text-orange-500 flex items-center gap-0.5"><Flag className="w-3 h-3" />{flaggedCount}</span>
                  )}
                </div>
                <div className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-sm font-medium",
                  tempoScadendo ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 animate-pulse" : "bg-muted"
                )}>
                  <Clock className="w-4 h-4" />{formatTempoRimanente(tempoRimanente)}
                </div>
              </div>
              <QuestionPalette total={quizList.length} currentIndex={currentIndex} states={answers} onNavigate={handleNavigate} />
            </CardContent>
          </Card>

          {/* Question */}
          <Card className="mb-3">
            <CardContent className="p-5 md:p-6">
              <h2 className="text-base md:text-lg font-medium mb-5 leading-relaxed">{quiz.domanda}</h2>
              <div className="space-y-2.5">
                {quiz.risposte.map(risposta => {
                  const isSelected = currentAnswer === risposta.id;
                  return (
                    <button
                      key={risposta.id}
                      onClick={() => handleSelectAnswer(risposta.id)}
                      className={cn(
                        "w-full p-3.5 rounded-lg border-2 text-left transition-all flex items-start gap-3 touch-manipulation",
                        isSelected && "border-primary bg-primary/5",
                        !isSelected && "border-border hover:border-primary/50 hover:bg-accent/50"
                      )}
                    >
                      <span className={cn(
                        "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-medium mt-0.5",
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                      )}>{risposta.id.toUpperCase()}</span>
                      <span className="text-sm leading-relaxed">{risposta.testo}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-1.5">
            <Button variant="outline" size="icon" onClick={() => handleNavigate(currentIndex - 1)} disabled={currentIndex === 0} className="h-11 w-11">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant={isFlagged ? "default" : "outline"} size="icon" onClick={handleToggleFlag} className={cn("h-11 w-11", isFlagged && "bg-orange-500 hover:bg-orange-600")}>
              <Flag className="w-4 h-4" />
            </Button>
            {currentAnswer && (
              <Button variant="outline" size="icon" onClick={handleClearAnswer} className="h-11 w-11" title="Cancella risposta">
                <Eraser className="w-4 h-4" />
              </Button>
            )}
            <Button onClick={currentAnswer ? handleConfirm : handleSkip} className="flex-1 h-11">
              {currentAnswer ? <>Conferma <ChevronRight className="w-4 h-4 ml-1" /></> : <>Salta <ChevronRight className="w-4 h-4 ml-1" /></>}
            </Button>
            <Button variant="outline" size="icon" onClick={() => handleNavigate(currentIndex + 1)} disabled={currentIndex >= quizList.length - 1} className="h-11 w-11">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="mt-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setShowTerminaConfirm(true)} className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 gap-1.5">
              <Square className="h-3.5 w-3.5" /> Termina Simulazione
            </Button>
          </div>

          {/* Termina modal */}
          {showTerminaConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowTerminaConfirm(false)}>
              <Card className="w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <CardContent className="p-6 text-center">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-yellow-500" />
                  <h3 className="text-lg font-bold mb-2">Terminare la simulazione?</h3>
                  <div className="text-sm text-muted-foreground space-y-1 mb-4">
                    <p>Risposte date: <strong className="text-blue-600">{answeredCount}</strong></p>
                    <p>Saltate: <strong className="text-yellow-600">{answers.filter(a => a.visited && !a.risposta).length}</strong></p>
                    <p>Non visitate: <strong>{quizList.length - answers.filter(a => a.visited).length}</strong></p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setShowTerminaConfirm(false)} className="flex-1">Continua</Button>
                    <Button variant="destructive" onClick={handleTerminaExam} className="flex-1">Termina</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ===== RESULTS =====
  if (phase === 'results') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container px-4 py-6 max-w-3xl mx-auto">
          <Card className="mb-6">
            <CardContent className="p-6 md:p-8 text-center">
              {superato ? <Trophy className="h-16 w-16 mx-auto mb-4 text-yellow-500" /> : <Target className="h-16 w-16 mx-auto mb-4 text-orange-500" />}
              <h1 className="text-2xl md:text-3xl font-bold mb-2">{superato ? 'Congratulazioni!' : 'Simulazione Completata'}</h1>
              <p className={cn("text-lg mb-6", superato ? "text-green-600" : "text-orange-600")}>
                {superato ? 'Hai superato la soglia di 21 punti!' : 'Non hai raggiunto la soglia di 21 punti'}
              </p>

              <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-muted mb-6">
                <span className="text-4xl font-bold">{punteggio.toFixed(2)}</span>
                <span className="text-muted-foreground text-xl">/30</span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950">
                  <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-600" />
                  <p className="text-2xl font-bold text-green-600">{corrette}</p>
                  <p className="text-xs text-muted-foreground">Corrette</p>
                </div>
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950">
                  <XCircle className="h-5 w-5 mx-auto mb-1 text-red-600" />
                  <p className="text-2xl font-bold text-red-600">{errate}</p>
                  <p className="text-xs text-muted-foreground">Errate</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold">{saltate}</p>
                  <p className="text-xs text-muted-foreground">Non risposte</p>
                </div>
              </div>

              <p className="text-muted-foreground mb-6">Tempo impiegato: {formatTempoRimanente(60 * 60 - tempoRimanente)}</p>

              <div className="flex gap-3 mb-6">
                <Button variant="outline" onClick={() => handleStartReview('all')} className="flex-1 gap-2">
                  <Eye className="h-4 w-4" /> Rivedi tutte
                </Button>
                <Button variant="outline" onClick={() => handleStartReview('wrong')} className="flex-1 gap-2" disabled={errate === 0}>
                  <Filter className="h-4 w-4" /> Solo errate ({errate})
                </Button>
              </div>

              {!saved ? (
                <Button onClick={handleSave} className="w-full h-12 text-base gap-2 mb-4">
                  <Save className="h-5 w-5" /> Salva Simulazione
                </Button>
              ) : (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 flex items-center justify-center gap-2 mb-4">
                  <CheckCircle2 className="h-5 w-5" /> Simulazione salvata nello storico!
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={handleStart} variant="outline" className="flex-1 gap-2"><RotateCcw className="h-4 w-4" /> Nuova</Button>
                <Link href="/" className="flex-1"><Button variant="outline" className="w-full gap-2"><Home className="h-4 w-4" /> Home</Button></Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Risultati per Materia</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(statsByMateria).map(([materia, stats]) => {
                  const perc = stats.totale > 0 ? Math.round((stats.corrette / stats.totale) * 100) : 0;
                  return (
                    <div key={materia} className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium capitalize truncate">{materia.replace(/-/g, ' ')}</span>
                          <span className={cn(perc >= 70 ? "text-green-600" : perc >= 50 ? "text-yellow-600" : "text-red-600")}>{stats.corrette}/{stats.totale}</span>
                        </div>
                        <Progress value={perc} className="h-2" />
                      </div>
                      <Badge variant={perc >= 70 ? "default" : perc >= 50 ? "secondary" : "destructive"}>{perc}%</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // ===== REVIEW =====
  if (phase === 'review' && reviewIndices.length > 0) {
    const qIdx = reviewIndices[reviewCurrentIdx];
    const quiz = quizList[qIdx];
    const userAnswer = answers[qIdx]?.risposta;
    const rispostaCorretta = quiz.risposte.find(r => r.corretta);
    const isCorrect = userAnswer === rispostaCorretta?.id;
    const reviewResults = reviewIndices.map(i => risposte[i].corretto);

    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container px-4 py-3 max-w-3xl mx-auto">
          <Card className="mb-3">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="text-xs">Revisione {reviewCurrentIdx + 1}/{reviewIndices.length}</Badge>
                <Button variant="ghost" size="sm" onClick={() => setPhase('results')}>Torna ai risultati</Button>
              </div>
              <ReviewPalette indices={reviewIndices} currentIdx={reviewCurrentIdx} results={reviewResults} onNavigate={setReviewCurrentIdx} />
            </CardContent>
          </Card>

          <Card className="mb-3">
            <CardContent className="p-5 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="secondary" className="capitalize text-xs">{quiz.materia.replace(/-/g, ' ')}</Badge>
                <Badge variant={isCorrect ? 'default' : userAnswer ? 'destructive' : 'secondary'}>
                  {isCorrect ? 'Corretta' : userAnswer ? 'Sbagliata' : 'Non risposta'}
                </Badge>
              </div>

              <h2 className="text-base md:text-lg font-medium mb-5 leading-relaxed">{quiz.domanda}</h2>

              <div className="space-y-2.5">
                {quiz.risposte.map(risposta => {
                  const isUser = userAnswer === risposta.id;
                  const isCorr = risposta.corretta;
                  return (
                    <div
                      key={risposta.id}
                      className={cn(
                        "w-full p-3.5 rounded-lg border-2 text-left flex items-start gap-3",
                        isCorr && "border-green-500 bg-green-50 dark:bg-green-950",
                        isUser && !isCorr && "border-red-500 bg-red-50 dark:bg-red-950",
                        !isCorr && !isUser && "border-border opacity-50",
                      )}
                    >
                      <span className="flex-shrink-0 mt-0.5">
                        {isCorr ? <CheckCircle2 className="w-5 h-5 text-green-600" /> :
                         isUser ? <XCircle className="w-5 h-5 text-red-600" /> :
                         <span className="w-5 h-5 rounded-full border-2 border-muted-foreground flex items-center justify-center text-xs font-medium">{risposta.id.toUpperCase()}</span>}
                      </span>
                      <div className="flex-1">
                        <span className="text-sm leading-relaxed">{risposta.testo}</span>
                        {risposta.efficacia && quiz.materia === 'situazionali' && (
                          <Badge variant="outline" className="ml-2 text-[10px]">{risposta.efficacia}</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {quiz.spiegazione && (
                <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Spiegazione:</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">{quiz.spiegazione}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setReviewCurrentIdx(prev => Math.max(0, prev - 1))} disabled={reviewCurrentIdx === 0} className="h-11">
              <ChevronLeft className="w-4 h-4 mr-1" /> Prec.
            </Button>
            <Button onClick={() => reviewCurrentIdx < reviewIndices.length - 1 ? setReviewCurrentIdx(prev => prev + 1) : setPhase('results')} className="flex-1 h-11">
              {reviewCurrentIdx < reviewIndices.length - 1 ? <>Prossima <ChevronRight className="w-4 h-4 ml-1" /></> : 'Torna ai risultati'}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return null;
}
