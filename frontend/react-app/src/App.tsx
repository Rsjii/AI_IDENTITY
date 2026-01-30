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
import { VoiceSetupPage } from './pages/VoiceSetupPage';
import { VoiceManagePage } from './pages/VoiceManagePage';
import { IntegrationsPage } from './pages/Integrations';
import { AdminPage } from './pages/AdminPage';
import { AdminUserPage } from './pages/AdminUserPage';
import { ForgotPasswordResetPage } from './pages/ForgotPasswordResetPage';
import { AccountPage } from './pages/AccountPage';
import { SettingsPage } from './pages/SettingsPage';
import { PricingPage } from './pages/PricingPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ForbiddenPage } from './pages/ForbiddenPage';
import { OnboardingQuizPage } from './pages/OnboardingQuizPage';
import { OnboardingContentPage } from './pages/OnboardingContentPage';
import { OnboardingPlanPage } from './pages/OnboardingPlanPage';
import { OnboardingDeployPage } from './pages/OnboardingDeployPage';
import { OnboardingTrainingPage } from './pages/OnboardingTrainingPage';
import { PublicChatPage } from './pages/PublicChatPage';
import { CreatorDashboardPage } from './pages/CreatorDashboardPage';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
import { CreatorPublicProfile } from './pages/CreatorPublicProfile';
import { MarketplacePage } from './pages/MarketplacePage';
import { MarketplaceListingPage } from './pages/MarketplaceListingPage';
import { MarketplaceManagePage } from './pages/MarketplaceManagePage';
import { VideoSetupPage } from './pages/VideoSetupPage';
import { VideoManagePage } from './pages/VideoManagePage';
import { PhoneSetupPage } from './pages/PhoneSetupPage';



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
              <Route path="/voice/setup" element={<ProtectedRoute><VoiceSetupPage /></ProtectedRoute>} />
              <Route path="/voice/manage" element={<ProtectedRoute><VoiceManagePage /></ProtectedRoute>} />
              <Route path="/integrations" element={<ProtectedRoute><IntegrationsPage /></ProtectedRoute>} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/users/:userId" element={<AdminUserPage />} />
              <Route path="/forgot-password/reset" element={<ForgotPasswordResetPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/pricing" element={<PricingPage />} />

              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/404" element={<NotFoundPage />} />
              <Route path="/403" element={<ForbiddenPage />} />

              <Route path="/onboarding/quiz" element={<ProtectedRoute><OnboardingQuizPage /></ProtectedRoute>} />
              <Route path="/onboarding/content" element={<ProtectedRoute><OnboardingContentPage /></ProtectedRoute>} />
              <Route path="/onboarding/training" element={<ProtectedRoute><OnboardingTrainingPage /></ProtectedRoute>} />
              <Route path="/onboarding/plan" element={<ProtectedRoute><OnboardingPlanPage /></ProtectedRoute>} />
              <Route path="/onboarding/deploy" element={<ProtectedRoute><OnboardingDeployPage /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><CreatorDashboardPage /></ProtectedRoute>} />
              <Route path="/knowledge" element={<ProtectedRoute><KnowledgeBasePage /></ProtectedRoute>} />
              <Route path="/chat/:slug" element={<PublicChatPage />} />
              <Route path="/@:handle" element={<CreatorPublicProfile />} />
              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="/marketplace/:slug" element={<MarketplaceListingPage />} />
              <Route path="/marketplace/manage" element={<ProtectedRoute><MarketplaceManagePage /></ProtectedRoute>} />
              <Route path="/video/setup" element={<ProtectedRoute><VideoSetupPage /></ProtectedRoute>} />
              <Route path="/video/manage" element={<ProtectedRoute><VideoManagePage /></ProtectedRoute>} />
              <Route path="/phone/setup" element={<ProtectedRoute><PhoneSetupPage /></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
