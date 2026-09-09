import { Navigate, createBrowserRouter } from 'react-router-dom';
import { lazy, type ReactElement } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { useAuth } from '../shared/auth/AuthContext';
import { WebUserRole } from '../shared/types/roles';
import { PublicPageLayout } from '../components/layout/PublicPageLayout';
import { MeetliThemeBoundary } from '../shared/theme/MeetliThemeBoundary';

const LoginPage = lazy(() => import('../pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('../pages/RegisterPage').then((module) => ({ default: module.RegisterPage })));
const InviteAcceptPage = lazy(() => import('../pages/InviteAcceptPage').then((module) => ({ default: module.InviteAcceptPage })));
const AppointmentsPage = lazy(() => import('../pages/AppointmentsPage').then((module) => ({ default: module.AppointmentsPage })));
const SettingsPage = lazy(() => import('../pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const SpecialistsPage = lazy(() => import('../pages/SpecialistsPage').then((module) => ({ default: module.SpecialistsPage })));
const ServicesPage = lazy(() => import('../pages/ServicesPage').then((module) => ({ default: module.ServicesPage })));
const UsersPage = lazy(() => import('../pages/UsersPage').then((module) => ({ default: module.UsersPage })));
const NotificationLogsPage = lazy(() => import('../pages/NotificationLogsPage').then((module) => ({ default: module.NotificationLogsPage })));
const ErrorLogsPage = lazy(() => import('../pages/ErrorLogsPage').then((module) => ({ default: module.ErrorLogsPage })));
const PrivacyPolicyPage = lazy(() => import('../pages/PrivacyPolicyPage').then((module) => ({ default: module.PrivacyPolicyPage })));
const SecurityPolicyPage = lazy(() => import('../pages/SecurityPolicyPage').then((module) => ({ default: module.SecurityPolicyPage })));
const PublicPagesPage = lazy(async () => {
  const [pageModule, registryModule] = await Promise.all([
    import('../pages/PublicPagesPage'),
    import('../features/public-page-builder/config/registerBlocks')
  ]);
  registryModule.registerPublicPageBlocks();
  return { default: pageModule.PublicPagesPage };
});
const PublicPageEditorPage = lazy(async () => {
  const [pageModule, registryModule] = await Promise.all([
    import('../pages/PublicPageEditorPage'),
    import('../features/public-page-builder/config/registerBlocks')
  ]);
  registryModule.registerPublicPageBlocks();
  return { default: pageModule.PublicPageEditorPage };
});
const PublicPageViewPage = lazy(async () => {
  const [pageModule, registryModule] = await Promise.all([
    import('../pages/PublicPageViewPage'),
    import('../features/public-page-builder/config/registerBlocks')
  ]);
  registryModule.registerPublicPageBlocks();
  return { default: pageModule.PublicPageViewPage };
});
const PublicPageBookingPage = lazy(() => import('../pages/PublicPageBookingPage').then((module) => ({ default: module.PublicPageBookingPage })));
const PublicAppointmentStatusPage = lazy(() => import('../pages/PublicAppointmentStatusPage').then((module) => ({ default: module.PublicAppointmentStatusPage })));

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
    element: <MeetliThemeBoundary />,
    children: [
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
          { path: '/privacy-policy', element: <PrivacyPolicyPage /> },
          { path: '/security-policy', element: <SecurityPolicyPage /> },
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
          { path: '/services', element: <ServicesRoleRoute><ServicesPage /></ServicesRoleRoute> },
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
          { path: '/public-pages', element: <RoleRoute><PublicPagesPage /></RoleRoute> },
          { path: '/public-pages/new', element: <RoleRoute><PublicPageEditorPage /></RoleRoute> },
          { path: '/public-pages/:profileId/edit', element: <RoleRoute><PublicPageEditorPage /></RoleRoute> },
        ]
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
