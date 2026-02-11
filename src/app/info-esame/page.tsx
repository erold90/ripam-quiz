'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/Header';
import { useQuizStore } from '@/store/quiz-store';
import {
  ArrowLeft,
  GraduationCap,
  Clock,
  Target,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Minus,
  Info,
} from 'lucide-react';

export default function InfoEsamePage() {
  const { darkMode } = useQuizStore();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

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
            <Info className="h-6 w-6" />
            Informazioni Esame
          </h1>
          <p className="text-muted-foreground">
            Concorso RIPAM 3997 posti - Profilo AMM-13 Puglia
          </p>
        </div>

        {/* Panoramica */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">40</p>
              <p className="text-xs text-muted-foreground">Domande</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="h-6 w-6 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold">60</p>
              <p className="text-xs text-muted-foreground">Minuti</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Target className="h-6 w-6 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">30</p>
              <p className="text-xs text-muted-foreground">Punti Max</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <GraduationCap className="h-6 w-6 mx-auto mb-2 text-orange-500" />
              <p className="text-2xl font-bold">21</p>
              <p className="text-xs text-muted-foreground">Soglia Minima</p>
            </CardContent>
          </Card>
        </div>

        {/* Avviso banca dati */}
        <Card className="mb-6 border-yellow-300 dark:border-yellow-700">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-700 dark:text-yellow-400">Banca dati NON pubblicata</p>
              <p className="text-sm text-muted-foreground">
                La banca dati ufficiale non e stata ancora pubblicata. I quiz presenti sono basati sulle materie indicate nel bando.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Sistema punteggio */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Sistema di Punteggio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium">Risposta corretta</p>
                </div>
                <Badge className="bg-green-600">+0,75</Badge>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950">
                <XCircle className="h-5 w-5 text-red-600" />
                <div className="flex-1">
                  <p className="font-medium">Risposta errata</p>
                </div>
                <Badge variant="destructive">-0,25</Badge>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <Minus className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">Risposta non data</p>
                </div>
                <Badge variant="secondary">0</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Distribuzione domande */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Distribuzione Domande</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2 text-sm text-muted-foreground uppercase tracking-wide">
                  Materie Comuni (10 domande)
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Diritto amministrativo</span><Badge variant="outline">2</Badge></div>
                  <div className="flex justify-between"><span>Contratti pubblici</span><Badge variant="outline">1</Badge></div>
                  <div className="flex justify-between"><span>Trattamento dati personali</span><Badge variant="outline">1</Badge></div>
                  <div className="flex justify-between"><span>Diritto penale (reati PA)</span><Badge variant="outline">1</Badge></div>
                  <div className="flex justify-between"><span>Codice amministrazione digitale</span><Badge variant="outline">2</Badge></div>
                  <div className="flex justify-between"><span>Ordinamento del lavoro</span><Badge variant="outline">1</Badge></div>
                  <div className="flex justify-between"><span>Lingua inglese</span><Badge variant="outline">1</Badge></div>
                  <div className="flex justify-between"><span>Competenze informatiche</span><Badge variant="outline">1</Badge></div>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2 text-sm text-muted-foreground uppercase tracking-wide">
                  Materie Specifiche AMM-13 (15 domande)
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Contabilita di Stato</span><Badge variant="outline">5</Badge></div>
                  <div className="flex justify-between"><span>Diritto dell&apos;Unione Europea</span><Badge variant="outline">5</Badge></div>
                  <div className="flex justify-between"><span>Pubblico Impiego</span><Badge variant="outline">5</Badge></div>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2 text-sm text-muted-foreground uppercase tracking-wide">
                  Attitudinali (15 domande)
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Logica e ragionamento</span><Badge variant="outline">7</Badge></div>
                  <div className="flex justify-between"><span>Quesiti situazionali</span><Badge variant="outline">8</Badge></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Piattaforma */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Piattaforma d&apos;Esame</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              L&apos;esame si svolge tramite la piattaforma <strong>Formez PA &quot;Concorsi Smart&quot;</strong>.
              La prova e computer-based e si svolge presso le sedi indicate nella convocazione.
            </p>
            <div className="mt-4">
              <Link href="/simulazione">
                <Button className="w-full gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Prova una Simulazione
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
