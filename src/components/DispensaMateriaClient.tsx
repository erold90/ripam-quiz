'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { BookOpen } from 'lucide-react';
import { useQuizStore } from '@/store/quiz-store';

const EpubReader = dynamic(
  () => import('@/components/EpubReader').then(mod => ({ default: mod.EpubReader })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <BookOpen className="h-12 w-12 animate-pulse text-primary" />
      </div>
    ),
  }
);

const materiaNames: Record<string, string> = {
  'diritto-ue': "Diritto dell'Unione Europea",
  'contabilita-stato': 'Contabilità di Stato',
  'pubblico-impiego': 'Pubblico Impiego',
};

interface DispensaMateriaClientProps {
  materiaId: string;
}

export function DispensaMateriaClient({ materiaId }: DispensaMateriaClientProps) {
  const router = useRouter();
  const { darkMode } = useQuizStore();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const epubUrl = `/epubs/${materiaId}.epub`;
  const title = materiaNames[materiaId] || materiaId;

  return (
    <div className="h-screen">
      <EpubReader
        url={epubUrl}
        title={title}
        onClose={() => router.push('/dispense')}
        initialDarkMode={darkMode}
      />
    </div>
  );
}
