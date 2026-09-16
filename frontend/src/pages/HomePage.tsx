import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/useAuth';

export function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/signin', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="animate-fade-in-delayed space-y-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Welcome to the application.
          </h1>
          <p className="text-base text-muted-foreground">
            Signed in as {user?.name ?? 'User'}
          </p>
        </div>

        <Button
          variant="outline"
          size="lg"
          className="h-11 border-border/90 bg-card/60 px-6 active:scale-[0.98]"
          onClick={() => {
            void handleLogout();
          }}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? 'Signing out...' : 'Logout'}
        </Button>
      </div>
    </AppShell>
  );
}
