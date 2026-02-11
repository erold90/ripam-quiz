'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Home, BarChart3, BookOpen, FileText, History, GraduationCap, LogIn, LogOut, User, Loader2 } from 'lucide-react';
import { useQuizStore } from '@/store/quiz-store';
import { useAuth } from '@/components/Providers';
import { LoginDialog } from '@/components/LoginDialog';

export function Header() {
  const { darkMode, toggleDarkMode } = useQuizStore();
  const { user, loading, signOut } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await signOut();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg hidden sm:inline">RIPAM Quiz</span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Home</span>
              </Button>
            </Link>
            <Link href="/quiz">
              <Button variant="ghost" size="sm" className="gap-2">
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Studio</span>
              </Button>
            </Link>
            <Link href="/dispense">
              <Button variant="ghost" size="sm" className="gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Dispense</span>
              </Button>
            </Link>
            <Link href="/statistiche">
              <Button variant="ghost" size="sm" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Statistiche</span>
              </Button>
            </Link>
            <Link href="/storico">
              <Button variant="ghost" size="sm" className="gap-2">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">Storico</span>
              </Button>
            </Link>

            {/* Auth button */}
            {loading ? (
              <Button variant="ghost" size="icon" disabled>
                <Loader2 className="h-4 w-4 animate-spin" />
              </Button>
            ) : user ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                disabled={loggingOut}
                className="gap-2 text-muted-foreground"
                title={user.email || 'Utente'}
              >
                {loggingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline max-w-[100px] truncate text-xs">
                      {user.email?.split('@')[0]}
                    </span>
                    <LogOut className="h-3 w-3" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLoginOpen(true)}
                className="gap-2"
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Accedi</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              className="ml-1"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </nav>
        </div>
      </header>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}
