import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { AuthShell } from '@/components/AuthShell';
import { useAuth } from '@/contexts/AuthContext';
import { usePreventBack } from '@/hooks/useOnboardingGuard';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function SignupProfilePage() {
  const navigate = useNavigate();
  const q = useQuery();
  const { refresh } = useAuth();

  const email = q.get('email') || '';
  const nextParam = q.get('next') || '';
  const safeNext = nextParam.startsWith('/') ? nextParam : '';

  // ✅ Prevent back navigation - profile is mandatory
  usePreventBack();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors({ ...fieldErrors, profileImage: 'Image must be less than 5MB' });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setFieldErrors({ ...fieldErrors, profileImage: 'File must be an image' });
      return;
    }

    setUploadingImage(true);
    try {
      // Convert to base64 for now (you can implement actual file upload to S3/Cloudinary later)
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setFieldErrors({ ...fieldErrors, profileImage: 'Failed to upload image' });
      setUploadingImage(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setFieldErrors({});
    try {
      await apiFetch<{ redirect?: string }>(
        '/api/auth/signup/profile',
        {
          method: 'POST',
          body: JSON.stringify({
            email,
            name,
            username: username.toLowerCase(),
            phone: phone || undefined,
            profileImage: profileImage || null,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        }
      );
      // ✅ Refresh auth state to update profileCompleted status
      await refresh();
      // ✅ Go back to what user originally tried to open
      navigate(safeNext || '/onboarding/quiz', { replace: true });
    } catch (err: any) {
      // Check if error has field-specific validation errors
      if (err.fieldErrors) {
        setFieldErrors(err.fieldErrors);
      } else {
        setError(err.message || 'Profile save failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Complete your profile" subtitle="Required step to continue - we need to know who you are!">
      <Card className="glass shadow-sm">
        <CardHeader>
          <CardTitle>Tell us about yourself</CardTitle>
          <CardDescription>This information will be used for your AI identity.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input value={email} type="email" readOnly disabled />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your full name" />
              {fieldErrors.name && (
                <p className="text-xs text-destructive">{fieldErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                required
                placeholder="yourname"
                maxLength={30}
              />
              {fieldErrors.username ? (
                <p className="text-xs text-destructive">{fieldErrors.username}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Your profile will be: /@{username || 'username'} • Only letters, numbers, and underscores
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Profile Image (optional)</label>
              <div className="flex items-center gap-4">
                {profileImage && (
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-muted">
                    <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                />
              </div>
              {uploadingImage && (
                <p className="text-xs text-muted-foreground">Uploading...</p>
              )}
              {fieldErrors.profileImage && (
                <p className="text-xs text-destructive">{fieldErrors.profileImage}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Phone (optional)</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 1234567890" />
              {fieldErrors.phone ? (
                <p className="text-xs text-destructive">{fieldErrors.phone}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Format: +[country code] [10 digits]</p>
              )}
            </div>

            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}