import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, Copy, Trash2, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch, apiFetchForm } from '@/lib/api';

export function AccountPage() {
  const { state, refresh } = useAuth();

  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [timeZone, setTimeZone] = useState('');
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Extension tokens state
  const [tokens, setTokens] = useState<any[]>([]);
  const [newToken, setNewToken] = useState<{ token: string; tokenId: string } | null>(null);
  const [tokenLabel, setTokenLabel] = useState('');
  const [creatingToken, setCreatingToken] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'authenticated') {
      setName(state.user.name || '');
      setHandle(state.user.handle || '');
      setBio(state.user.bio || '');
      setDob((state.user.dob as any) || '');
      setPhone(state.user.phone || '');
      setTimeZone((state.user as any).timeZone || '');
      loadTokens();
    }
  }, [state]);

  const loadTokens = async () => {
    if (state.status !== 'authenticated') return;
    setLoadingTokens(true);
    try {
      const res = await apiFetch<{ success: true; rows: any[] }>('/api/extension/tokens');
      setTokens(res.rows || []);
    } catch (e: any) {
      console.error('Failed to load tokens:', e);
    } finally {
      setLoadingTokens(false);
    }
  };

  const createToken = async () => {
    setCreatingToken(true);
    setError('');
    try {
      const res = await apiFetch<{ success: true; token: string; tokenId: string; label?: string }>('/api/extension/token', {
        method: 'POST',
        body: JSON.stringify({ label: tokenLabel || undefined }),
      });
      setNewToken({ token: res.token, tokenId: res.tokenId });
      setTokenLabel('');
      await loadTokens();
    } catch (e: any) {
      setError(e.message || 'Failed to create token.');
    } finally {
      setCreatingToken(false);
    }
  };

  const revokeToken = async (tokenId: string) => {
    if (!confirm('Revoke this token? It will stop working immediately.')) return;
    try {
      await apiFetch(`/api/extension/token/${tokenId}`, { method: 'DELETE' });
      await loadTokens();
    } catch (e: any) {
      setError(e.message || 'Failed to revoke token.');
    }
  };

  const copyToken = (token: string, tokenId: string) => {
    navigator.clipboard.writeText(token);
    setCopiedTokenId(tokenId);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  const onSave = async () => {
    setSaving(true);
    setError('');
    try {
      await apiFetch('/api/profile/update', {
        method: 'POST',
        body: JSON.stringify({
          name,
          handle,
          bio,
          dob,
          phone,
          timeZone,
        }),
      });
      await refresh();
    } catch (e: any) {
      setError(e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  if (state.status === 'loading') {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Loading…</CardTitle>
              <CardDescription>Please wait</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }

  if (state.status === 'unauthenticated') {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Sign in required</CardTitle>
              <CardDescription>Please login to manage your account.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Account</h1>
          <p className="text-muted-foreground mt-1">{state.user.email}</p>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Edit what's saved in backend.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input value={state.user.email} readOnly disabled />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Username</label>
              <Input
                value={handle}
                onChange={(e) =>
                  setHandle(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20)
                  )
                }
              />
              <p className="text-xs text-muted-foreground">3–20 chars, a-z 0-9 _ - (backend enforced).</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">DOB</label>
                <Input value={dob} onChange={(e) => setDob(e.target.value)} placeholder="YYYY-MM-DD" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 1234567890" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Bio</label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Timezone</label>
              <Input value={timeZone} onChange={(e) => setTimeZone(e.target.value)} placeholder="Asia/Kolkata" />
              <p className="text-xs text-muted-foreground">Example: Asia/Kolkata, America/New_York</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Avatar</label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setProfileImageFile(e.target.files?.[0] || null)}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!profileImageFile || saving}
                onClick={async () => {
                  if (!profileImageFile) return;
                  setSaving(true);
                  setError('');
                  try {
                    const fd = new FormData();
                    fd.append('profileImageFile', profileImageFile);
                    await apiFetchForm('/api/profile/update', { method: 'POST', body: fd });
                    await refresh();
                    setProfileImageFile(null);
                  } catch (e: any) {
                    setError(e.message || 'Upload failed.');
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Upload avatar
              </Button>
            </div>

            <Button className="w-full" onClick={onSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Extension Tokens Section */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Extension Tokens</CardTitle>
            <CardDescription>Create tokens for Gmail/LinkedIn extensions. Store securely — shown once.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {newToken ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Token created! Copy it now — you won't see it again.</p>
                    <div className="flex gap-2">
                      <Input value={newToken.token} readOnly className="font-mono text-xs" />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToken(newToken.token, newToken.tokenId)}
                      >
                        {copiedTokenId === newToken.tokenId ? (
                          <>
                            <Check className="h-4 w-4 mr-1" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-1" /> Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setNewToken(null)}>
                      Close
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="flex gap-2">
              <Input
                placeholder="Label (optional, e.g., 'Chrome on MacBook')"
                value={tokenLabel}
                onChange={(e) => setTokenLabel(e.target.value)}
                maxLength={100}
              />
              <Button onClick={createToken} disabled={creatingToken}>
                {creatingToken ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  'Create Token'
                )}
              </Button>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Your Tokens</h3>
              {loadingTokens ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : tokens.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tokens yet. Create one above.</p>
              ) : (
                <div className="space-y-2">
                  {tokens.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{t.label || 'Unnamed token'}</div>
                        <div className="text-xs text-muted-foreground">
                          Created: {new Date(t.createdAt).toLocaleDateString()}
                          {t.lastUsedAt ? ` • Last used: ${new Date(t.lastUsedAt).toLocaleDateString()}` : ' • Never used'}
                          {t.revokedAt ? ` • Revoked: ${new Date(t.revokedAt).toLocaleDateString()}` : ''}
                        </div>
                      </div>
                      {!t.revokedAt ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => revokeToken(t.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Revoked</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

