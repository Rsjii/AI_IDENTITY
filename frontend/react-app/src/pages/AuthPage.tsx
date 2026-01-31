import { useMemo, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Layout } from '@/components/Layout';
import { apiFetch } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Chrome, Loader2 } from 'lucide-react';
import { PasswordStrengthMeter } from '@/components/PasswordStrengthMeter';
import { useAuth } from '@/contexts/AuthContext';

type TabType = 'login' | 'signup';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function oauthErrorMessage(code: string) {
  if (code === 'google_oauth_not_configured') return 'Google login is not configured on the server.';
  if (code === 'google_auth_failed') return 'Google login failed. Please try again.';
  if (code === 'user_not_found') return 'Google login failed (user not found). Please try again.';
  if (code === 'internal_error') return 'Something went wrong. Please try again.';
  return 'Authentication error. Please try again.';
}

export function AuthPage() {
  const navigate = useNavigate();
  const { state, refresh } = useAuth();
  const q = useQuery();

  // ADD: if already logged in, never show auth page (handles Back button too)
  useEffect(() => {
    if (state.status === 'authenticated') {
      navigate('/onboarding', { replace: true });
    }
  }, [state.status, navigate]);

  // OPTIONAL: avoid flicker
  if (state.status === 'authenticated') return null;

  const [activeTab, setActiveTab] = useState<TabType>('login');
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string>(() => {
    const code = q.get('error');
    return code ? oauthErrorMessage(code) : '';
  });

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Signup state
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupReferralCode, setSignupReferralCode] = useState('');
  const [emailError, setEmailError] = useState('');

  // ✅ Reduce noisy background calls: check email only when user leaves the field (onBlur).
  const checkEmailAvailability = async () => {
    if (!signupEmail || !signupEmail.includes('@')) {
      setEmailError('');
      return;
    }
    try {
      const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(signupEmail)}`);
      const data = await res.json();
      if (data.exists) {
        setEmailError('This email is already registered. Try logging in instead.');
      } else {
        setEmailError('');
      }
    } catch {
      // ignore
    }
  };

  const goGoogle = () => {
    // Backend mounted at: /api/auth/google
    window.location.assign('/api/auth/google');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await apiFetch<{ message: string; redirect: string; token?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPassword, rememberMe }),
      });

      await refresh(); // ✅ IMPORTANT: update auth state using /api/auth/me

      if (result.redirect) {
        const redirectPath = result.redirect.startsWith('/') ? result.redirect : '/' + result.redirect;
        navigate(redirectPath, { replace: true }); // ✅ avoid back button weirdness
      } else {
        setError('Login successful but no redirect provided.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await apiFetch<{ message: string; redirect: string }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: signupEmail,
          password: signupPassword,
          referralCode: signupReferralCode || undefined,
        }),
      });

      if (result.redirect) {
        const redirectPath = result.redirect.startsWith('/') ? result.redirect : '/' + result.redirect;
        navigate(redirectPath, { replace: true });
      } else {
        setError('Signup successful but no redirect provided.');
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout showNavbar={false}>
      <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
        {/* background blobs */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/25 bg-blob" />
          <div className="absolute left-10 bottom-10 h-64 w-64 rounded-full bg-primary/15 bg-blob" />
        </div>

        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="text-xl font-bold tracking-tight">
              Selflyx<span className="text-primary">.</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">Ultra clean auth — fast, secure, modern.</div>
          </div>

          <Card className="glass shadow-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">Welcome</CardTitle>
              <CardDescription className="text-center">Sign in to continue, or create an account.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Progress Indicator for Signup */}
              {activeTab === 'signup' && (
                <div className="mb-4">
                  <div className="text-xs text-muted-foreground mb-2">Step 1 of 4: Create Account</div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-1 flex-1 rounded ${
                          step === 1 ? 'bg-primary' : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* OAuth - Prominently at top */}
              <Button type="button" className="w-full bg-white text-gray-900 hover:bg-gray-100 border border-gray-300" onClick={goGoogle} disabled={loading}>
                <Chrome className="mr-2 h-4 w-4" />
                Continue with Google
              </Button>

              <div className="relative">
                <div className="h-px w-full bg-border" />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                  or continue with email
                </div>
              </div>

              {error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                {/* LOGIN */}
                <TabsContent value="login" className="space-y-4 mt-4">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="login-email" className="text-sm font-medium">
                        Email
                      </label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="you@example.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label htmlFor="login-password" className="text-sm font-medium">
                          Password
                        </label>

                        <Link
                          to="/forgot-password/reset"
                          className="text-xs text-primary underline-offset-4 hover:underline"
                        >
                          Forgot password?
                        </Link>
                      </div>

                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="remember-me"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="remember-me" className="text-sm cursor-pointer text-muted-foreground">
                        Remember me for 30 days
                      </label>
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Logging in...
                        </>
                      ) : (
                        'Login'
                      )}
                    </Button>
                  </form>
                </TabsContent>

                {/* SIGNUP */}
                <TabsContent value="signup" className="space-y-4 mt-4">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="signup-email" className="text-sm font-medium">
                        Email
                      </label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@example.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        onBlur={checkEmailAvailability}
                        required
                        disabled={loading}
                        className={emailError ? 'border-red-500' : ''}
                      />
                      {emailError && (
                        <p className="text-sm text-red-500">{emailError}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="signup-password" className="text-sm font-medium">
                        Password
                      </label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        required
                        disabled={loading}
                        minLength={8}
                      />
                      <PasswordStrengthMeter password={signupPassword} />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="referral-code" className="text-sm font-medium">
                        Referral Code (optional)
                      </label>
                      <Input
                        id="referral-code"
                        type="text"
                        placeholder="Enter referral code"
                        value={signupReferralCode}
                        onChange={(e) => setSignupReferralCode(e.target.value)}
                        disabled={loading}
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing up...
                        </>
                      ) : (
                        'Sign Up'
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="mt-2 text-center text-xs text-muted-foreground">
                By continuing, you agree to a clean and secure experience.
              </div>

              <div className="mt-3 text-center">
                <Link to="/" className="text-sm text-primary underline-offset-4 hover:underline">
                  ← Back to home
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}