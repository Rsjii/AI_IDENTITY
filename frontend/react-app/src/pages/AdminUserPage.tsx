import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, User, Key, Activity } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export function AdminUserPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const { userId } = useParams();
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is admin, if not redirect to 404
    if (state.status === 'authenticated' && !state.user?.isAdmin) {
      navigate('/404', { replace: true });
      return;
    }
    if (state.status === 'unauthenticated') {
      navigate('/auth', { replace: true });
      return;
    }
    if (state.status === 'loading') {
      return;
    }
  }, [state, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated' || !state.user?.isAdmin) return;

    (async () => {
      setError('');
      setLoading(true);
      try {
        const res = await apiFetch<any>(`/api/admin/users/${userId}`);
        setData(res?.data || null);
      } catch (err: any) {
        // If 403, redirect to 403 page; if 404, redirect to 404 page
        const status = (err as any)?.status;
        if (status === 403) {
          navigate('/403', { replace: true });
          return;
        }
        if (status === 404 || err.message?.includes('Not found')) {
          navigate('/404', { replace: true });
          return;
        }
        setError(err.message || 'Failed to load user.');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, state, navigate]);

  if (state.status === 'loading' || loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12 text-muted-foreground">Loading user details...</div>
        </div>
      </Layout>
    );
  }

  if (state.status !== 'authenticated' || !state.user?.isAdmin) {
    return null; // Will redirect
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <User className="h-7 w-7 text-primary" />
                User Details
              </h1>
              <p className="text-muted-foreground mt-1 font-mono text-sm">{userId}</p>
            </div>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="glass border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User Information
            </CardTitle>
            <CardDescription>Basic account details and status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border-2 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-5 shadow-sm">
              <div className="text-base font-semibold mb-2">{data?.user?.email}</div>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                {data?.user?.name && <span className="font-medium">{data.user.name}</span>}
                <span className={data?.user?.profileCompleted ? 'text-green-600 font-medium' : 'text-red-600'}>
                  {data?.user?.profileCompleted ? 'Profile ✓' : 'Profile ✗'}
                </span>
                {data?.user?.createdAt && (
                  <span>Joined: {new Date(data.user.createdAt).toLocaleDateString()}</span>
                )}
                {data?.user?.timeZone && <span>TZ: {data.user.timeZone}</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {data?.identityVersions && data.identityVersions.length > 0 && (
          <Card className="glass border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Identity Versions
              </CardTitle>
              <CardDescription>All identity versions created by this user</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-semibold">Version</th>
                      <th className="text-left p-3 font-semibold">Status</th>
                      <th className="text-left p-3 font-semibold">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.identityVersions.map((iv: any) => (
                      <tr key={iv.id} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono text-xs">{iv.version}</td>
                        <td className="p-3">
                          <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                            iv.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                            iv.status === 'draft' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          }`}>
                            {iv.status}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {iv.createdAt ? new Date(iv.createdAt).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {data?.extensionTokens && data.extensionTokens.length > 0 && (
          <Card className="glass border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Extension Tokens
              </CardTitle>
              <CardDescription>Chrome extension authentication tokens</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-semibold">Label</th>
                      <th className="text-left p-3 font-semibold">Created</th>
                      <th className="text-left p-3 font-semibold">Last Used</th>
                      <th className="text-left p-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.extensionTokens.map((token: any) => (
                      <tr key={token.id} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-medium">{token.label || '—'}</td>
                        <td className="p-3 text-muted-foreground">
                          {token.createdAt ? new Date(token.createdAt).toLocaleString() : '—'}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : 'Never'}
                        </td>
                        <td className="p-3">
                          <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                            token.revokedAt ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                            'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          }`}>
                            {token.revokedAt ? 'Revoked' : 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="glass border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Mirror Runs
            </CardTitle>
            <CardDescription>Recent AI reply generation activity</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.runs && data.runs.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-semibold">Date</th>
                      <th className="text-left p-3 font-semibold">Platform</th>
                      <th className="text-left p-3 font-semibold">Decision</th>
                      <th className="text-left p-3 font-semibold">Validator</th>
                      <th className="text-left p-3 font-semibold">Tokens</th>
                      <th className="text-left p-3 font-semibold">Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.runs.map((r: any) => (
                      <tr key={r.id} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="p-3 text-muted-foreground text-xs">
                          {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                        </td>
                        <td className="p-3">
                          {r.platform && (
                            <span className="px-3 py-1 text-xs rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                              {r.platform}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {r.decisionAction && (
                            <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                              r.decisionAction === 'reply' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                              r.decisionAction === 'ignore' ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' :
                              'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                            }`}>
                              {r.decisionAction}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {r.validatorStatus && (
                            <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                              r.validatorStatus === 'pass' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                              'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            }`}>
                              {r.validatorStatus}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground font-medium">
                          {((r.tokensIn || 0) + (r.tokensOut || 0)).toLocaleString()}
                        </td>
                        <td className="p-3">
                          {r.confirmEvent && (
                            <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                              r.confirmEvent === 'confirm_yes' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                              'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            }`}>
                              {r.confirmEvent === 'confirm_yes' ? '✓ Liked' : '✗ Disliked'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-12">No runs found for this user.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}