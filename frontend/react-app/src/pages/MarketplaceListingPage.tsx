import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Star } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/contexts/AuthContext';

interface Listing {
  id: string;
  slug: string;
  description: string;
  category: string | null;
  subscriptionPriceCents: number;
  currency: string;
  rating: number | null;
  freeTrialQuestions: number;
  creator: {
    id: string;
    handle: string;
    name: string;
    profileImage: string | null;
    bio: string;
    creatorTitle: string;
    creatorTags: string[];
  };
}

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: { handle: string; name: string; profileImage: string | null };
}

export function MarketplaceListingPage() {
  const { slug = '' } = useParams();
  const { state } = useAuth();
  const isAuthed = state.status === 'authenticated';
  const [listing, setListing] = useState<Listing | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await fetch(`/api/marketplace/listings/${encodeURIComponent(slug)}`).then((r) => r.json());
      setListing(data);
      const reviewData = await fetch(`/api/marketplace/reviews/${encodeURIComponent(data.id)}`).then((r) => r.json());
      setReviews(reviewData.items || []);
      setLoading(false);
    };
    load().catch(() => setLoading(false));
  }, [slug]);

  const handleSubscribe = async () => {
    if (!listing) return;
    setSubscribing(true);
    try {
      if (listing.subscriptionPriceCents > 0) {
        const res = await apiFetch<{ url: string }>('/api/marketplace/subscriptions/checkout', {
          method: 'POST',
          body: JSON.stringify({ listingId: listing.id }),
        });
        window.location.href = res.url;
        return;
      }
      await apiFetch('/api/marketplace/subscriptions/start', {
        method: 'POST',
        body: JSON.stringify({ listingId: listing.id }),
      });
      showToast('Subscription started.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to subscribe', 'error');
    } finally {
      setSubscribing(false);
    }
  };

  const submitReview = async () => {
    if (!listing || !userRating) return;
    setSubmittingReview(true);
    try {
      await apiFetch('/api/marketplace/reviews', {
        method: 'POST',
        body: JSON.stringify({
          listingId: listing.id,
          rating: userRating,
          comment: reviewComment.trim() || undefined,
        }),
      });
      showToast('Review submitted!', 'success');
      setShowReviewForm(false);
      setUserRating(0);
      setReviewComment('');
      // Reload reviews
      const reviewData = await fetch(`/api/marketplace/reviews/${encodeURIComponent(listing.id)}`).then((r) => r.json());
      setReviews(reviewData.items || []);
    } catch (e: any) {
      showToast(e.message || 'Failed to submit review', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-6 py-10 text-text-secondary">Loading...</div>
      </Layout>
    );
  }

  if (!listing) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-6 py-10">Listing not found.</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <Card className="bg-bg-secondary border-border-default">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              {listing.creator.profileImage && (
                <img
                  src={listing.creator.profileImage}
                  className="w-12 h-12 rounded-full"
                  alt={listing.creator.name}
                />
              )}
              <div>
                <div className="text-xl font-semibold text-text-primary">
                  {listing.creator.name || listing.creator.handle}
                </div>
                <div className="text-sm text-text-secondary">@{listing.creator.handle}</div>
              </div>
            </div>
            <div className="text-text-secondary">{listing.description || 'No description yet.'}</div>
            <div className="flex flex-wrap gap-2">
              {(listing.creator.creatorTags || []).map((tag) => (
                <span key={tag} className="text-xs bg-bg-tertiary px-2 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-text-secondary">
                {listing.category || 'General'} • Rating {listing.rating ?? 'N/A'}
              </div>
              <div className="text-lg font-semibold">
                ${(listing.subscriptionPriceCents / 100).toFixed(2)}/{listing.currency || 'USD'}
              </div>
            </div>
            <Button onClick={handleSubscribe} disabled={subscribing}>
              {subscribing ? 'Starting...' : 'Subscribe'}
            </Button>
            {listing.freeTrialQuestions > 0 && (
              <div className="text-xs text-text-tertiary">
                Includes {listing.freeTrialQuestions} free trial questions.
              </div>
            )}
          </CardContent>
        </Card>

        {isAuthed && (
          <Card className="bg-bg-secondary border-border-default mb-6">
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
        )}

        <Card className="bg-bg-secondary border-border-default">
          <CardContent className="pt-6 space-y-3">
            <h3 className="text-lg font-semibold">Reviews</h3>
            {reviews.length === 0 && <div className="text-text-secondary text-sm">No reviews yet.</div>}
            {reviews.map((r) => (
              <div key={r.id} className="border-b border-border-default pb-3">
                <div className="text-sm font-semibold">{r.user.name || r.user.handle}</div>
                <div className="text-xs text-text-tertiary">Rating: {r.rating}/5</div>
                {r.comment && <div className="text-sm text-text-secondary mt-1">{r.comment}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

