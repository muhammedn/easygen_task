import { Navigate, Outlet } from 'react-router-dom';
import { AuthShell } from '@/components/AuthShell';
import { useAuth } from '@/features/auth/useAuth';

export function PublicOnlyRoute() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <AuthShell loading loadingLabel="Checking session…" />
    );
  }

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
