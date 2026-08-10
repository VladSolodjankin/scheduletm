import { Navigate, createBrowserRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { InviteAcceptPage } from '../pages/InviteAcceptPage';
import { AppointmentsPage } from '../pages/AppointmentsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { SpecialistsPage } from '../pages/SpecialistsPage';
import { ServicesPage } from '../pages/ServicesPage';
import { UsersPage } from '../pages/UsersPage';
import { NotificationLogsPage } from '../pages/NotificationLogsPage';
import { ErrorLogsPage } from '../pages/ErrorLogsPage';
import { PrivacyPolicyPage } from '../pages/PrivacyPolicyPage';
import { SecurityPolicyPage } from '../pages/SecurityPolicyPage';
import { PublicPagesPage } from '../pages/PublicPagesPage';
import { PublicPageEditorPage } from '../pages/PublicPageEditorPage';
import { PublicPageViewPage } from '../pages/PublicPageViewPage';
import { PublicPageBookingPage } from '../pages/PublicPageBookingPage';
import { PublicAppointmentStatusPage } from '../pages/PublicAppointmentStatusPage';
import { useAuth } from '../shared/auth/AuthContext';
import { WebUserRole } from '../shared/types/roles';
import { PublicPageLayout } from '../components/layout/PublicPageLayout';
import { registerPublicPageBlocks } from '../features/public-page-builder/config/registerBlocks';

registerPublicPageBlocks();

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicOnlyRoute({ children }: { children: ReactElement }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/appointments" replace /> : children;
}

function RoleRoute({ children }: { children: ReactElement }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return user?.role === WebUserRole.ProductOwner || user?.role === WebUserRole.Owner || user?.role === WebUserRole.Admin
    ? children
    : <Navigate to="/appointments" replace />;
}

function ServicesRoleRoute({ children }: { children: ReactElement }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return user?.role === WebUserRole.ProductOwner
    || user?.role === WebUserRole.Owner
    || user?.role === WebUserRole.Admin
    || user?.role === WebUserRole.Specialist
    ? children
    : <Navigate to="/appointments" replace />;
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
        path: '/privacy-policy',
        element: <PrivacyPolicyPage />
      },
      {
        path: '/security-policy',
        element: <SecurityPolicyPage />
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
        path: '/settings/:tab?',
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
        path: '/services',
        element: <ServicesRoleRoute><ServicesPage /></ServicesRoleRoute>
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
      {
        path: '/public-pages',
        element: <RoleRoute><PublicPagesPage /></RoleRoute>
      },
      {
        path: '/public-pages/new',
        element: <RoleRoute><PublicPageEditorPage /></RoleRoute>
      },
      {
        path: '/public-pages/:profileId/edit',
        element: <RoleRoute><PublicPageEditorPage /></RoleRoute>
      },
    ]
  },
  {
    element: <PublicPageLayout />,
    children: [
      { path: '/:slug/booking', element: <PublicPageBookingPage /> },
      { path: '/:slug/appointment-status', element: <PublicAppointmentStatusPage /> },
      { path: '/:slug', element: <PublicPageViewPage /> },
    ]
  }
]);
