import type { ReactNode } from 'react';
import { BrandMark } from '@/components/BrandMark';

type AuthShellProps = {
  children?: ReactNode;
  /** Quiet message instead of the form panel (session checks). */
  loading?: boolean;
  loadingLabel?: string;
};

export function AuthShell({
  children,
  loading = false,
  loadingLabel = 'Checking session…',
}: AuthShellProps) {
  return (
    <div className="atmosphere atmosphere-grain relative flex min-h-svh flex-col overflow-hidden">
      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-12 sm:px-6">
        <div className="animate-fade-rise space-y-8">
          <header className="text-center sm:text-left">
            <BrandMark size="hero" />
          </header>

          {loading ? (
            <p className="text-sm text-muted-foreground">{loadingLabel}</p>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
