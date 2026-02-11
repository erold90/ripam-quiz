'use client';

import { useState } from 'react';
import { useAuth } from '@/components/Providers';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, LogIn, Loader2, CheckCircle2 } from 'lucide-react';

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginDialog({ open, onOpenChange }: LoginDialogProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await signIn(email.trim());
      setSent(true);
    } catch (err) {
      console.error('Login error:', err);
      setError('Errore nell\'invio del link. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      // Reset state on close
      setTimeout(() => {
        setEmail('');
        setSent(false);
        setError(null);
        setLoading(false);
      }, 200);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5" />
            Accedi
          </DialogTitle>
          <DialogDescription>
            Accedi per salvare i tuoi progressi nel cloud e sincronizzarli su tutti i dispositivi.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <h3 className="font-medium mb-2">Link inviato!</h3>
            <p className="text-sm text-muted-foreground">
              Controlla la tua email <strong>{email}</strong> e clicca sul link per accedere.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => { setSent(false); setEmail(''); }}
            >
              Invia di nuovo
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="la-tua@email.it"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <Button type="submit" className="w-full gap-2" disabled={loading || !email.trim()}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Invio in corso...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Invia Magic Link
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Riceverai un link di accesso via email. Nessuna password necessaria.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
