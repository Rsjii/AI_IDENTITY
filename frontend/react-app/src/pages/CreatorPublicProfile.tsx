import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MessageSquare, Star, ExternalLink, Loader2 } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';

interface CreatorProfile {
  displayName: string;
  handle: string;
  bio: string;
  avatarUrl: string | null;
  expertise: string;
  topics: string;
  stats: {
    totalChats: number;
    rating: number;
    totalRatings: number;
  };
  socialLinks: {
    twitter?: string | null;
    instagram?: string | null;
    youtube?: string | null;
    website?: string | null;
  };
}

export function CreatorPublicProfile() {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) {
      setLoading(false);
      return;
    }

    fetch(`/api/public/creator/${encodeURIComponent(handle)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.creator) {
          setProfile(data.creator);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [handle]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Creator not found</h1>
            <Button onClick={() => navigate('/')}>Go Home</Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-bg-primary">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 py-20">
          <div className="max-w-4xl mx-auto px-6 text-center">
            {profile.avatarUrl && (
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                className="w-32 h-32 rounded-full mx-auto mb-6 border-4 border-white shadow-xl object-cover"
              />
            )}
            <h1 className="text-4xl font-bold text-text-primary mb-2">{profile.displayName}</h1>
            <p className="text-xl text-text-secondary mb-6">@{profile.handle}</p>
            <div className="flex items-center justify-center gap-6 mb-8">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-accent-primary" />
                <span className="text-text-secondary">{profile.stats.totalChats.toLocaleString()} conversations</span>
              </div>
              {profile.stats.totalRatings > 0 && (
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  <span className="text-text-secondary">
                    {profile.stats.rating.toFixed(1)}/5 ({profile.stats.totalRatings} ratings)
                  </span>
                </div>
              )}
            </div>
            <Button
              onClick={() => navigate(`/chat/${profile.handle}`)}
              className="bg-accent-gradient text-white px-8 py-6 text-lg hover:opacity-90"
            >
              <MessageSquare className="h-5 w-5 mr-2" />
              Chat with {profile.displayName}'s AI
            </Button>
          </div>
        </div>

        {/* About Section */}
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="glass">
              <CardContent className="pt-6">
                <h2 className="text-2xl font-bold text-text-primary mb-4">About</h2>
                {profile.bio ? (
                  <p className="text-text-secondary mb-6">{profile.bio}</p>
                ) : (
                  <p className="text-text-secondary mb-6">No bio available.</p>
                )}

                {profile.expertise && (
                  <>
                    <h3 className="text-lg font-semibold text-text-primary mb-2">Expertise</h3>
                    <p className="text-text-secondary mb-4">{profile.expertise}</p>
                  </>
                )}

                {profile.topics && (
                  <>
                    <h3 className="text-lg font-semibold text-text-primary mb-2">Topics</h3>
                    <p className="text-text-secondary">{profile.topics}</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="pt-6">
                <h2 className="text-2xl font-bold text-text-primary mb-4">Connect</h2>
                <div className="space-y-3">
                  {profile.socialLinks.twitter && (
                    <a
                      href={profile.socialLinks.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-text-secondary hover:text-accent-primary transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Twitter
                    </a>
                  )}
                  {profile.socialLinks.instagram && (
                    <a
                      href={profile.socialLinks.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-text-secondary hover:text-accent-primary transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Instagram
                    </a>
                  )}
                  {profile.socialLinks.youtube && (
                    <a
                      href={profile.socialLinks.youtube}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-text-secondary hover:text-accent-primary transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      YouTube
                    </a>
                  )}
                  {profile.socialLinks.website && (
                    <a
                      href={profile.socialLinks.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-text-secondary hover:text-accent-primary transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Website
                    </a>
                  )}
                  {!profile.socialLinks.twitter && 
                   !profile.socialLinks.instagram && 
                   !profile.socialLinks.youtube && 
                   !profile.socialLinks.website && (
                    <p className="text-text-tertiary text-sm">No social links available.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}







