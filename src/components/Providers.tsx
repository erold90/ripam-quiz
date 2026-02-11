'use client';

import { useEffect } from 'react';
import { ReactNode } from 'react';
import { loadAllFromSupabase } from '@/lib/cloud-sync';

function DataLoader() {
  useEffect(() => {
    loadAllFromSupabase();
  }, []);
  return null;
}

function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          console.log('SW registered:', reg.scope);
          reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (installing) {
              installing.addEventListener('statechange', () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('Nuova versione disponibile');
                }
              });
            }
          });
        })
        .catch(err => console.error('SW error:', err));
    }
  }, []);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      <DataLoader />
      <ServiceWorkerRegistration />
      {children}
    </>
  );
}
