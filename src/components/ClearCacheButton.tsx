'use client';

import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';

export function ClearCacheButton() {
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    setClearing(true);
    try {
      // 1. Deregistra tutti i service worker
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }

      // 2. Svuota tutte le cache del browser
      if ('caches' in window) {
        const names = await caches.keys();
        for (const name of names) {
          await caches.delete(name);
        }
      }

      // 3. Force reload senza cache
      window.location.reload();
    } catch (err) {
      console.error('Errore pulizia cache:', err);
      window.location.reload();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={handleClear}
        disabled={clearing}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 text-white text-sm font-medium shadow-lg hover:bg-red-700 active:bg-red-800 disabled:opacity-50 transition-colors"
      >
        {clearing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        Svuota Cache
      </button>
    </div>
  );
}
