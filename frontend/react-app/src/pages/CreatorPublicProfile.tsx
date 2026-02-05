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

type User = {
  id: string;
  handle: string;
  name: string;
  avatarUrl?: string | null;
  userType: 'creator' | 'user';
  memberSince?: string | null;
  // Creator-specific fields
  slug?: string;
  displayName?: string;
  bio?: string;
  expertise?: string;
  topics?: string;
  welcomeMessage?: string | null;
  popularQuestions?: string[];
  stats?: { totalChats: number; rating: number; totalRatings: number };
  priceConfig?: any;
  socialLinks?: any;
  listingId?: string | null;
  // End user-specific fields
  conversationCount?: number; // Only if viewer is a creator
};

export function CreatorPublicProfile() {
  const { handle } = useParams<{ handle: string }>();
  const { state } = useAuth();
  const isAuthed = state.status === 'authenticated';
  const [user, setUser] = useState<User | null>(null);
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
    
    const apiUrl = `/api/public/profile/${encodeURIComponent(cleanHandle)}`;
    
    apiFetch<{ success: boolean; user?: User; error?: string }>(apiUrl)
      .then((d) => {
        if (!d?.success || !d.user) {
          setError(d?.error || 'User not found');
          return;
        }
        setUser(d.user);
      })
      .catch((e: any) => {
        if (e.status === 404) {
          setError('User not found');
        } else if (e.status === 402) {
          setError(e.message || 'Creator unavailable');
        } else {
          setError(e.message || 'Failed to load profile');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [handle]);

  const submitReview = async () => {
    if (!user || user.userType !== 'creator' || !user.listingId || !userRating) return;
    setSubmittingReview(true);
    try {
      await apiFetch('/api/marketplace/reviews', {
        method: 'POST',
        body: JSON.stringify({
          listingId: user.listingId,
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

  if (error || !user) {
    return (
      <Layout>
        <NotFoundCreator
          title="User Not Found"
          subtitle={error || 'The user you are looking for does not exist.'}
          exploreHref="/explore"
        />
      </Layout>
    );
  }

  const isCreator = user.userType === 'creator';
  const chatUrl = isCreator && user.slug ? `/chat/${user.slug}` : `/chat/${handle}`;
  const displayName = isCreator ? (user.displayName || user.name) : user.name;
  const viewerIsCreator = state.user && (state.user as any).userType === 'creator';

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-bg-primary border border-border-default rounded-xl p-8">
          {/* Header */}
          <div className="flex items-start gap-6 mb-6">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl.startsWith('/uploads/') ? buildApiUrl(user.avatarUrl) : user.avatarUrl}
                alt={displayName || handle}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-accent-primary/20 flex items-center justify-center">
                <span className="text-3xl font-semibold text-accent-primary">
                  {(displayName || handle || 'U').slice(0, 1).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-text-primary mb-2">
                {displayName || handle || (isCreator ? 'Creator' : 'User')}
              </h1>
              {isCreator && user.expertise && (
                <p className="text-lg text-text-secondary mb-4">{user.expertise}</p>
              )}
              {!isCreator && user.memberSince && (
                <p className="text-sm text-text-secondary mb-4">
                  Member since {new Date(user.memberSince).toLocaleDateString()}
                </p>
              )}
              <div className="flex items-center gap-6 text-sm text-text-tertiary">
                {isCreator && user.stats && (
                  <>
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      {(user.stats.rating || 0).toFixed(1)} ({user.stats.totalRatings || 0})
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="h-4 w-4" />
                      {(user.stats.totalChats || 0).toLocaleString()} chats
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Zap className="h-4 w-4 text-green-500" />
                      ~2s response time
                    </span>
                  </>
                )}
                {!isCreator && user.conversationCount !== undefined && viewerIsCreator && (
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" />
                    {user.conversationCount} conversation{user.conversationCount !== 1 ? 's' : ''} with you
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Creator-specific content */}
          {isCreator && (
            <>
              {/* Bio */}
              {user.bio && (
                <div className="mb-6">
                  <p className="text-text-secondary leading-relaxed">{user.bio}</p>
                </div>
              )}

              {/* Topics */}
              {user.topics && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-text-primary mb-2">Topics</h2>
                  <p className="text-text-secondary">{user.topics}</p>
                </div>
              )}

              {/* Popular Questions */}
              {user.popularQuestions && user.popularQuestions.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-text-primary mb-3">Popular Questions</h2>
                  <ul className="space-y-2">
                    {user.popularQuestions.map((q, idx) => (
                      <li key={idx} className="text-text-secondary">
                        • {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Rating Form (if listing exists and user is authenticated) */}
              {isAuthed && user.listingId && (
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

              {/* CTA Button for Creator */}
              <div className="mt-8 pt-6 border-t border-border-default">
                <Link
                  to={chatUrl}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-accent-primary text-white rounded-lg font-semibold hover:bg-accent-primary/90 transition-colors"
                >
                  <MessageCircle className="h-5 w-5" />
                  Start Chatting
                </Link>
              </div>
            </>
          )}

          {/* End User content */}
          {!isCreator && viewerIsCreator && (
            <div className="mt-8 pt-6 border-t border-border-default">
              <p className="text-text-secondary mb-4">
                This is a user who has interacted with your AI.
              </p>
              <Button
                variant="outline"
                onClick={() => window.location.href = '/conversations'}
                className="inline-flex items-center gap-2"
              >
                <MessageCircle className="h-5 w-5" />
                View Conversations
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
