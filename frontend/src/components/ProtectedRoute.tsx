import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthShell } from '@/components/AuthShell';
import { useAuth } from '@/features/auth/useAuth';

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <AuthShell loading loadingLabel="Checking session…" />
    );
  }

  if (status === 'anonymous') {
    return (
      <Navigate to="/signin" replace state={{ from: location.pathname }} />
    );
  }

  return <Outlet />;
}
