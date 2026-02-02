import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MessageSquare, Star, ExternalLink, Loader2, DollarSign, Zap, Sparkles, Check } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface CreatorProfile {
  displayName: string;
  handle: string;
  bio: string;
  avatarUrl: string | null;
  expertise: string;
  topics: string;
  priceConfig?: {
    enablePayments?: boolean;
    payPerChatTiers?: number[];
    defaultTierCents?: number;
    welcomeMessage?: string;
    popularQuestions?: string[];
  };
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

          {/* Pricing Section */}
          {profile.priceConfig?.enablePayments && profile.priceConfig.payPerChatTiers && (
            <div className="mt-12">
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-6 w-6" />
                    Chat Pricing
                  </CardTitle>
                  <CardDescription>
                    Choose a tier that works for you. All tiers unlock unlimited messages for your session.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    {/* Free Tier */}
                    <div className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-bg-tertiary">
                      <div className="text-center mb-4">
                        <h3 className="text-xl font-bold text-text-primary mb-2">FREE</h3>
                        <p className="text-3xl font-bold text-text-primary">$0</p>
                      </div>
                      <ul className="space-y-2 mb-6">
                        <li className="flex items-start gap-2 text-sm text-text-secondary">
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>3 messages per session</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm text-text-secondary">
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>Try before you buy</span>
                        </li>
                      </ul>
                      <Button variant="outline" className="w-full" onClick={() => navigate(`/chat/${profile.handle}`)}>
                        Start Free Chat
                      </Button>
                    </div>

                    {/* Paid Tiers */}
                    {profile.priceConfig.payPerChatTiers.map((tier, index) => {
                      const isRecommended = tier === (profile.priceConfig?.defaultTierCents || profile.priceConfig?.payPerChatTiers?.[0]);
                      const isPro = index === 1;
                      const isVIP = index >= 2;

                      return (
                        <div
                          key={tier}
                          className={`relative border-2 rounded-lg p-6 ${
                            isRecommended
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : isPro
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                              : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                          }`}
                        >
                          {isRecommended && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs px-3 py-1 rounded-full font-semibold">
                              POPULAR
                            </div>
                          )}
                          <div className="text-center mb-4">
                            <h3 className="text-xl font-bold text-text-primary mb-2">
                              {index === 0 && 'BASIC'}
                              {index === 1 && 'PRO'}
                              {index >= 2 && 'VIP'}
                            </h3>
                            <p className="text-3xl font-bold text-text-primary">
                              ${(tier / 100).toFixed(0)}
                            </p>
                            <p className="text-xs text-text-tertiary mt-1">per session</p>
                          </div>
                          <ul className="space-y-2 mb-6">
                            <li className="flex items-start gap-2 text-sm text-text-secondary">
                              <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                              <span>Unlimited messages</span>
                            </li>
                            <li className="flex items-start gap-2 text-sm text-text-secondary">
                              <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                              <span>Full conversation history</span>
                            </li>
                            <li className="flex items-start gap-2 text-sm text-text-secondary">
                              <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                              <span>Export as PDF/TXT</span>
                            </li>
                            {isPro && (
                              <li className="flex items-start gap-2 text-sm text-text-secondary">
                                <Zap className="h-4 w-4 text-purple-500 flex-shrink-0 mt-0.5" />
                                <span>Priority support</span>
                              </li>
                            )}
                            {isVIP && (
                              <>
                                <li className="flex items-start gap-2 text-sm text-text-secondary">
                                  <Sparkles className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                                  <span>VIP access</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm text-text-secondary">
                                  <Sparkles className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                                  <span>Custom features</span>
                                </li>
                              </>
                            )}
                          </ul>
                          <Button
                            className={`w-full ${
                              isRecommended
                                ? 'bg-blue-500 hover:bg-blue-600'
                                : isPro
                                ? 'bg-purple-500 hover:bg-purple-600'
                                : 'bg-yellow-500 hover:bg-yellow-600'
                            } text-white`}
                            onClick={() => navigate(`/chat/${profile.handle}`)}
                          >
                            Choose {index === 0 ? 'Basic' : index === 1 ? 'Pro' : 'VIP'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-bg-tertiary rounded-lg p-4 border border-border-default">
                    <p className="text-sm text-text-secondary text-center">
                      <strong>75%</strong> of your payment goes directly to {profile.displayName}. The remaining 25%
                      covers platform fees and payment processing.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}











