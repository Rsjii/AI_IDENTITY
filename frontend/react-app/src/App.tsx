import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthPage } from './pages/AuthPage';
import { LandingPage } from './pages/LandingPage';
import { SignupVerifyPage } from './pages/SignupVerifyPage';
import { LoginVerifyPage } from './pages/LoginVerifyPage';
import { SignupProfilePage } from './pages/SignupProfilePage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { IdentitySetupPage } from './pages/IdentitySetupPage';
import { IdentityEditPage } from './pages/IdentityEditPage';
import { MirrorPage } from './pages/MirrorPage';
import { HistoryPage } from './pages/HistoryPage';
import { AdminPage } from './pages/AdminPage';
import { AdminUserPage } from './pages/AdminUserPage';
import { ForgotPasswordResetPage } from './pages/ForgotPasswordResetPage';
import { AccountPage } from './pages/AccountPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';



// Initialize CSRF token on app load
import { getCSRFToken } from './lib/csrf';
getCSRFToken().catch(() => {
  // Ignore errors on initial load
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth" element={<AuthPage />} />
              
              <Route path="/signup/verify" element={<SignupVerifyPage />} />
              <Route path="/login/verify" element={<LoginVerifyPage />} />
              <Route path="/signup/profile" element={<SignupProfilePage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              <Route path="/identity/setup" element={<IdentitySetupPage />} />
              <Route path="/identity/edit" element={<IdentityEditPage />} />
              <Route path="/mirror" element={<ProtectedRoute><MirrorPage /></ProtectedRoute>} />
              <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/users/:userId" element={<AdminUserPage />} />
              <Route path="/forgot-password/reset" element={<ForgotPasswordResetPage />} />
              <Route path="/account" element={<AccountPage />} />

              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
