import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
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

  useEffect(() => {
    if (state.status === 'authenticated') {
      setName(state.user.name || '');
      setHandle(state.user.handle || '');
      setBio(state.user.bio || '');
      setDob((state.user.dob as any) || '');
      setPhone(state.user.phone || '');
      setTimeZone((state.user as any).timeZone || '');
    }
  }, [state]);

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
      </div>
    </Layout>
  );
}

