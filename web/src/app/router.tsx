import { Navigate, createBrowserRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { InviteAcceptPage } from '../pages/InviteAcceptPage';
import { AppointmentsPage } from '../pages/AppointmentsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { SpecialistsPage } from '../pages/SpecialistsPage';
import { UsersPage } from '../pages/UsersPage';
import { NotificationLogsPage } from '../pages/NotificationLogsPage';
import { ErrorLogsPage } from '../pages/ErrorLogsPage';
import { useAuth } from '../shared/auth/AuthContext';

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicOnlyRoute({ children }: { children: ReactElement }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/appointments" replace /> : children;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="/login" replace /> },
      {
        path: '/login',
        element: (
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        )
      },
      {
        path: '/register',
        element: (
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        )
      },
      {
        path: '/invite/accept',
        element: (
          <PublicOnlyRoute>
            <InviteAcceptPage />
          </PublicOnlyRoute>
        )
      },
      {
        path: '/verify-email',
        element: (
          <PublicOnlyRoute>
            <InviteAcceptPage />
          </PublicOnlyRoute>
        )
      },
      {
        path: '/appointments',
        element: (
          <ProtectedRoute>
            <AppointmentsPage />
          </ProtectedRoute>
        )
      },
      {
        path: '/settings',
        element: (
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        )
      },
      {
        path: '/specialists',
        element: (
          <ProtectedRoute>
            <SpecialistsPage />
          </ProtectedRoute>
        )
      },
      {
        path: '/users',
        element: (
          <ProtectedRoute>
            <UsersPage />
          </ProtectedRoute>
        )
      },
      {
        path: '/notification-logs',
        element: (
          <ProtectedRoute>
            <NotificationLogsPage />
          </ProtectedRoute>
        )
      },

      {
        path: '/error-logs',
        element: (
          <ProtectedRoute>
            <ErrorLogsPage />
          </ProtectedRoute>
        )
      },
    ]
  }
]);
