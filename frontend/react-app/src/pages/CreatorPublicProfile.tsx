import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MessageCircle, Star, Zap, Loader2 } from 'lucide-react';
import { Layout } from '@/components/Layout';

type Creator = {
  id: string;
  slug: string;
  handle?: string;
  displayName?: string;
  avatarUrl?: string | null;
  bio?: string;
  expertise?: string;
  topics?: string;
  welcomeMessage?: string | null;
  popularQuestions?: string[];
  stats?: { totalChats: number; rating: number; totalRatings: number };
  priceConfig?: any;
  socialLinks?: any;
};

export function CreatorPublicProfile() {
  const { handle } = useParams<{ handle: string }>();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handle) {
      setError('Invalid handle');
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/public/creator/${encodeURIComponent(handle)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.success) {
          setError('Creator not found');
          return;
        }
        setCreator(d.creator);
      })
      .catch(() => {
        setError('Failed to load creator profile');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [handle]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-accent-primary" />
        </div>
      </Layout>
    );
  }

  if (error || !creator) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <h1 className="text-2xl font-bold text-text-primary mb-2">Creator Not Found</h1>
          <p className="text-text-secondary mb-4">{error || 'The creator you are looking for does not exist.'}</p>
          <Link to="/" className="text-accent-primary hover:underline">
            Go to Home
          </Link>
        </div>
      </Layout>
    );
  }

  const chatUrl = creator.slug ? `/chat/${creator.slug}` : `/chat/${handle}`;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-bg-primary border border-border-default rounded-xl p-8">
          {/* Header */}
          <div className="flex items-start gap-6 mb-6">
            {creator.avatarUrl ? (
              <img
                src={creator.avatarUrl}
                alt={creator.displayName || handle}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-accent-primary/20 flex items-center justify-center">
                <span className="text-3xl font-semibold text-accent-primary">
                  {(creator.displayName || handle || 'C').slice(0, 1).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-text-primary mb-2">
                {creator.displayName || handle || 'Creator'}
              </h1>
              {creator.expertise && (
                <p className="text-lg text-text-secondary mb-4">{creator.expertise}</p>
              )}
              <div className="flex items-center gap-6 text-sm text-text-tertiary">
                {creator.stats && (
                  <>
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      {(creator.stats.rating || 0).toFixed(1)} ({creator.stats.totalRatings || 0})
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="h-4 w-4" />
                      {(creator.stats.totalChats || 0).toLocaleString()} chats
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Zap className="h-4 w-4 text-green-500" />
                      ~2s response time
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Bio */}
          {creator.bio && (
            <div className="mb-6">
              <p className="text-text-secondary leading-relaxed">{creator.bio}</p>
            </div>
          )}

          {/* Topics */}
          {creator.topics && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-text-primary mb-2">Topics</h2>
              <p className="text-text-secondary">{creator.topics}</p>
            </div>
          )}

          {/* Popular Questions */}
          {creator.popularQuestions && creator.popularQuestions.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-text-primary mb-3">Popular Questions</h2>
              <ul className="space-y-2">
                {creator.popularQuestions.map((q, idx) => (
                  <li key={idx} className="text-text-secondary">
                    • {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CTA Button */}
          <div className="mt-8 pt-6 border-t border-border-default">
            <Link
              to={chatUrl}
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent-primary text-white rounded-lg font-semibold hover:bg-accent-primary/90 transition-colors"
            >
              <MessageCircle className="h-5 w-5" />
              Start Chatting
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
