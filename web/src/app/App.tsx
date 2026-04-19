import { CssBaseline } from '@mui/material';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '../shared/auth/AuthContext';
import { router } from './router';

export function App() {
  return (
    <AuthProvider>
      <CssBaseline />
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
