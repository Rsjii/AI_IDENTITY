import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MessageCircle, Star, Zap, Loader2 } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { NotFoundCreator } from '@/components/NotFoundCreator';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiFetch, buildApiUrl } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/contexts/AuthContext';

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
  listingId?: string | null;
};

export function CreatorPublicProfile() {
  const { handle } = useParams<{ handle: string }>();
  const { state } = useAuth();
  const isAuthed = state.status === 'authenticated';
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    const cleanHandle = handle?.replace(/^@/, '') || '';
    if (!cleanHandle) {
      setError('Invalid handle');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    apiFetch<{ success: boolean; creator?: Creator; error?: string }>(
      `/api/public/creator/${encodeURIComponent(cleanHandle)}`
    )
      .then((d) => {
        if (!d?.success || !d.creator) {
          setError(d?.error || 'Creator not found');
          return;
        }
        setCreator(d.creator);
      })
      .catch((e: any) => {
        if (e.status === 404) {
          setError('Creator not found');
        } else {
          setError(e.message || 'Failed to load creator profile');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [handle]);

  const submitReview = async () => {
    if (!creator?.listingId || !userRating) return;
    setSubmittingReview(true);
    try {
      await apiFetch('/api/marketplace/reviews', {
        method: 'POST',
        body: JSON.stringify({
          listingId: creator.listingId,
          rating: userRating,
          comment: reviewComment.trim() || undefined,
        }),
      });
      showToast('Review submitted!', 'success');
      setShowReviewForm(false);
      setUserRating(0);
      setReviewComment('');
    } catch (e: any) {
      showToast(e.message || 'Failed to submit review', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

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
        <NotFoundCreator
          title="Creator Not Found"
          subtitle={error || 'The creator you are looking for does not exist.'}
          exploreHref="/explore"
        />
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
                src={creator.avatarUrl.startsWith('/uploads/') ? buildApiUrl(creator.avatarUrl) : creator.avatarUrl}
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

          {/* Rating Form (if listing exists and user is authenticated) */}
          {isAuthed && creator.listingId && (
            <div className="mb-6 pt-6 border-t border-border-default">
              <Card className="bg-bg-secondary border-border-default">
                <CardContent className="pt-6">
                  {!showReviewForm ? (
                    <Button 
                      variant="outline" 
                      onClick={() => setShowReviewForm(true)}
                      className="w-full"
                    >
                      Leave a Review
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <Label>Rating</Label>
                        <div className="flex gap-2 mt-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => setUserRating(star)}
                              className={`text-2xl transition-colors ${
                                star <= userRating 
                                  ? 'text-yellow-500 fill-yellow-500' 
                                  : 'text-text-tertiary hover:text-yellow-400'
                              }`}
                            >
                              <Star className="h-6 w-6" />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label>Comment (optional)</Label>
                        <textarea
                          className="w-full min-h-[100px] border rounded-md px-3 py-2 bg-background mt-2"
                          placeholder="Share your experience..."
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          maxLength={1000}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={submitReview} disabled={!userRating || submittingReview}>
                          {submittingReview ? 'Submitting...' : 'Submit Review'}
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowReviewForm(false);
                          setUserRating(0);
                          setReviewComment('');
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
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
