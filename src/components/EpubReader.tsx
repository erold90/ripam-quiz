'use client';

import { useEffect, useRef, useState } from 'react';
import ePub, { Book, Rendition } from 'epubjs';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Minus, Plus } from 'lucide-react';

interface EpubReaderProps {
  url: string;
  title: string;
  onClose: () => void;
  initialDarkMode?: boolean;
}

export function EpubReader({ url, title, onClose, initialDarkMode = false }: EpubReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [currentPage, setCurrentPage] = useState('');
  const [fontSize, setFontSize] = useState(100);
  const [darkMode, setDarkMode] = useState(initialDarkMode);

  useEffect(() => {
    if (!viewerRef.current) return;

    const book = ePub(url);
    bookRef.current = book;

    const rendition = book.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      spread: 'none',
      flow: 'paginated',
    });

    renditionRef.current = rendition;

    rendition.display();

    rendition.on('relocated', (location: { start: { cfi: string } }) => {
      setCurrentPage(location.start.cfi);
    });

    // Apply initial styles
    applyTheme(rendition, initialDarkMode);

    return () => {
      book.destroy();
    };
  }, [url]);

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

  function applyTheme(rendition: Rendition, dark: boolean) {
    if (dark) {
      rendition.themes.override('color', '#e5e5e5');
      rendition.themes.override('background', '#171717');
    } else {
      rendition.themes.override('color', '#171717');
      rendition.themes.override('background', '#ffffff');
    }
  }

  const goNext = () => renditionRef.current?.next();
  const goPrev = () => renditionRef.current?.prev();

  const increaseFontSize = () => setFontSize(prev => Math.min(prev + 10, 150));
  const decreaseFontSize = () => setFontSize(prev => Math.max(prev - 10, 70));

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

      {/* Reader */}
      <div ref={viewerRef} className="flex-1 overflow-hidden" />

      {/* Navigation */}
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
    </div>
  );
}
