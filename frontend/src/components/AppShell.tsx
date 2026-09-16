import type { ReactNode } from 'react';
import { BrandMark } from '@/components/BrandMark';

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="atmosphere atmosphere-grain relative flex min-h-svh flex-col overflow-hidden">
      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-12 sm:px-6">
        <div className="animate-fade-rise space-y-10">
          <BrandMark size="lg" />
          {children}
        </div>
      </div>
    </div>
  );
}
