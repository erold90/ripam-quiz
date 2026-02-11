'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Minus, Plus, AlertTriangle } from 'lucide-react';

interface EpubReaderProps {
  url: string;
  title: string;
  onClose: () => void;
  initialDarkMode?: boolean;
}

export function EpubReader({ url, title, onClose, initialDarkMode = false }: EpubReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renditionRef = useRef<any>(null);
  const [fontSize, setFontSize] = useState(100);
  const [darkMode, setDarkMode] = useState(initialDarkMode);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!viewerRef.current) return;

    let destroyed = false;

    async function loadEpub() {
      try {
        const ePubModule = await import('epubjs');
        const ePub = ePubModule.default;

        if (destroyed) return;

        const book = ePub(url);
        bookRef.current = book;

        book.ready.then(() => {
          if (destroyed) return;
          setLoading(false);
        }).catch((err: Error) => {
          if (destroyed) return;
          console.error('EPUB ready error:', err);
          setError('Errore nel caricamento del libro. Riprova.');
          setLoading(false);
        });

        const rendition = book.renderTo(viewerRef.current!, {
          width: '100%',
          height: '100%',
          spread: 'none',
          flow: 'paginated',
        });

        renditionRef.current = rendition;

        rendition.display().catch((err: Error) => {
          if (destroyed) return;
          console.error('EPUB display error:', err);
          setError('Impossibile visualizzare il contenuto.');
          setLoading(false);
        });

        // Apply initial styles
        applyTheme(rendition, initialDarkMode);
      } catch (err) {
        if (destroyed) return;
        console.error('EPUB load error:', err);
        setError('Errore nel caricamento della libreria EPUB.');
        setLoading(false);
      }
    }

    loadEpub();

    return () => {
      destroyed = true;
      try {
        bookRef.current?.destroy();
      } catch {
        // ignore cleanup errors
      }
    };
  }, [url, initialDarkMode]);

  useEffect(() => {
    if (renditionRef.current) {
      applyTheme(renditionRef.current, darkMode);
    }
  }, [darkMode]);

  useEffect(() => {
    if (renditionRef.current) {
      renditionRef.current.themes.fontSize(`${fontSize}%`);
    }
  }, [fontSize]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyTheme(rendition: any, dark: boolean) {
    try {
      if (dark) {
        rendition.themes.override('color', '#e5e5e5');
        rendition.themes.override('background', '#171717');
      } else {
        rendition.themes.override('color', '#171717');
        rendition.themes.override('background', '#ffffff');
      }
    } catch {
      // ignore theme errors during initialization
    }
  }

  const goNext = () => {
    try { renditionRef.current?.next(); } catch { /* ignore */ }
  };
  const goPrev = () => {
    try { renditionRef.current?.prev(); } catch { /* ignore */ }
  };

  const increaseFontSize = () => setFontSize(prev => Math.min(prev + 10, 150));
  const decreaseFontSize = () => setFontSize(prev => Math.max(prev - 10, 70));

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center h-full gap-4 p-8 ${darkMode ? 'bg-neutral-900 text-neutral-200' : 'bg-white text-neutral-900'}`}>
        <AlertTriangle className="h-16 w-16 text-orange-500" />
        <h2 className="text-lg font-medium">Errore Dispensa</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">{error}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose}>
            Torna indietro
          </Button>
          <Button onClick={() => { setError(null); setLoading(true); window.location.reload(); }}>
            Riprova
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${darkMode ? 'bg-neutral-900 text-neutral-200' : 'bg-white text-neutral-900'}`}>
      {/* Toolbar */}
      <div className={`flex items-center justify-between px-4 py-2 border-b ${darkMode ? 'border-neutral-700 bg-neutral-800' : 'border-neutral-200 bg-neutral-50'}`}>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
        <h2 className="text-sm font-medium truncate max-w-[50%]">{title}</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={decreaseFontSize}>
            <Minus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={increaseFontSize}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Caricamento dispensa...</p>
          </div>
        </div>
      )}

      {/* Reader */}
      <div ref={viewerRef} className={`flex-1 overflow-hidden ${loading ? 'hidden' : ''}`} />

      {/* Navigation */}
      {!loading && (
        <div className={`flex items-center justify-between px-4 py-2 border-t ${darkMode ? 'border-neutral-700 bg-neutral-800' : 'border-neutral-200 bg-neutral-50'}`}>
          <Button variant="ghost" size="sm" onClick={goPrev} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Indietro
          </Button>
          <Button variant="ghost" size="sm" onClick={goNext} className="gap-1">
            Avanti
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
