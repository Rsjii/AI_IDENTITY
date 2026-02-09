import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Star, MessageSquare, Users, CheckCircle2, Zap, Edit, Settings } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/contexts/AuthContext';
import { getLastBillingCountry, setLastBillingCountry, type BillingCountry } from '@/lib/planCheckout';

interface Listing {
  id: string;
  slug: string;
  description: string;
  category: string | null;
  subscriptionPriceCents: number;
  currency: string;
  rating: number | null;
  freeTrialQuestions: number;
  totalSubscribers: number;
  payPerChatPriceCents: number | null;
  freeMessageLimit: number | null;
  tags: string[];
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
  const nav = useNavigate();
  const { state } = useAuth();
  const isAuthed = state.status === 'authenticated';
  const user = state.status === 'authenticated' ? state.user : null;
  const userId = user?.id;
  const [listing, setListing] = useState<Listing | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [previewAsUser, setPreviewAsUser] = useState(false);

  const userPhone = state.status === 'authenticated' ? (state.user as any)?.phone || '' : '';
  const defaultBillingCountry: BillingCountry = useMemo(() => {
    const stored = getLastBillingCountry();
    if (stored) return stored;

    const p = String(userPhone || '').trim();
    if (p.startsWith('+91') || p.startsWith('91')) return 'IN';

    if (typeof navigator !== 'undefined') {
      const lang = navigator.language || '';
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (lang.toLowerCase().includes('-in') || tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') return 'IN';
    }

    return 'OTHER';
  }, [userPhone]);

  const [billingCountry] = useState<BillingCountry>(defaultBillingCountry);

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
        setLastBillingCountry(billingCountry);
        const res = await apiFetch<{ gateway: 'lemonsqueezy'; url: string } | { gateway: 'razorpay'; keyId: string; order: { id: string; amount: number; currency: string }; listingId: string }>('/api/marketplace/subscriptions/checkout', {
          method: 'POST',
          body: JSON.stringify({ listingId: listing.id, billingCountry }),
        });
        
        if (res.gateway === 'lemonsqueezy') {
          window.location.href = res.url;
          return;
        }

        // Razorpay path
        if (!window.Razorpay) {
          showToast('Razorpay not loaded', 'error');
          setSubscribing(false);
          return;
        }

        const rz = new window.Razorpay({
          key: res.keyId,
          amount: res.order.amount,
          currency: res.order.currency,
          order_id: res.order.id,
          name: 'Selflyx',
          description: `Subscribe to ${listing.creator.name || listing.creator.handle || 'creator'}`,
          handler: async (resp: any) => {
            try {
              await apiFetch('/api/marketplace/subscriptions/verify', {
                method: 'POST',
                body: JSON.stringify({
                  listingId: res.listingId,
                  orderId: res.order.id,
                  paymentId: resp.razorpay_payment_id,
                  signature: resp.razorpay_signature,
                }),
              });
              showToast('Subscription activated!', 'success');
              // Reload page to show subscription status
              window.location.reload();
            } catch (e: any) {
              showToast(e.message || 'Payment verification failed', 'error');
              setSubscribing(false);
            }
          },
          modal: {
            ondismiss: () => {
              setSubscribing(false);
            },
          },
        });

        rz.open();
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

  const handleStartChat = () => {
    // ✅ FIX: Use creator.handle instead of listing.slug
    // Marketplace slug (e.g., "abhai-997442") is different from chat slug (e.g., "abhai")
    // Chat URL uses User.handle, not marketplace_listings.slug
    if (listing?.creator?.handle) {
      window.location.href = `/chat/${listing.creator.handle}`;
    } else {
      showToast('Chat link not available', 'error');
    }
  };

  const formatSubscribers = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  // Check if current user is the creator
  const isOwnClone = userId && listing && userId === listing.creator.id;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Hero Section */}
        <Card className="bg-bg-secondary border-border-default">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-4">
              {listing.creator.profileImage && (
                <img
                  src={listing.creator.profileImage}
                  className="w-16 h-16 rounded-full"
                  alt={listing.creator.name}
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-semibold text-text-primary">
                    {listing.creator.name || listing.creator.handle}
                  </h1>
                  {listing.creator.creatorTitle && (
                    <Badge variant="outline">{listing.creator.creatorTitle}</Badge>
                  )}
                </div>
                <div className="text-sm text-text-secondary mb-2">@{listing.creator.handle}</div>
                {listing.creator.bio && (
                  <p className="text-sm text-text-secondary mb-3">{listing.creator.bio}</p>
                )}
                
                {/* Stats Row */}
                <div className="flex items-center gap-4 text-sm">
                  {listing.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">{listing.rating.toFixed(1)}</span>
                      <span className="text-text-secondary">({reviews.length} reviews)</span>
                    </div>
                  )}
                  {listing.totalSubscribers > 0 && (
                    <div className="flex items-center gap-1 text-text-secondary">
                      <Users className="h-4 w-4" />
                      <span>{formatSubscribers(listing.totalSubscribers)} subscribers</span>
                    </div>
                  )}
                  <span className="text-text-secondary">{listing.category || 'General'}</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="text-text-secondary pt-2">
              {listing.description || 'No description yet.'}
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              {(listing.creator.creatorTags || []).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {listing.tags && listing.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pricing & Actions */}
        {isOwnClone && !previewAsUser ? (
          <Card className="bg-blue-50 dark:bg-blue-950 border-2 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                ✏️ This is YOUR AI Clone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700">
                <AlertDescription>
                  <strong>Creator Access:</strong> You have full access for testing. Regular users see payment options here.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <h4 className="font-medium text-sm">Your Pricing (visible to users):</h4>
                {listing.subscriptionPriceCents > 0 && (
                  <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-md">
                    <div>
                      <div className="font-semibold">Subscription</div>
                      <div className="text-xs text-text-secondary">Unlimited conversations</div>
                    </div>
                    <div className="text-lg font-bold">
                      ${(listing.subscriptionPriceCents / 100).toFixed(2)}
                      <span className="text-sm font-normal text-text-secondary">/mo</span>
                    </div>
                  </div>
                )}

                {listing.payPerChatPriceCents && listing.payPerChatPriceCents > 0 && (
                  <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-md">
                    <div>
                      <div className="font-semibold">Pay Per Chat</div>
                      <div className="text-xs text-text-secondary">24h access</div>
                    </div>
                    <div className="text-lg font-bold">
                      ${(listing.payPerChatPriceCents / 100).toFixed(2)}
                    </div>
                  </div>
                )}

                {listing.freeMessageLimit !== null && listing.freeMessageLimit > 0 && (
                  <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-md">
                    <div>
                      <div className="font-semibold">Free Tier</div>
                      <div className="text-xs text-text-secondary">
                        {listing.freeMessageLimit} messages/day
                      </div>
                    </div>
                    <div className="text-lg font-bold text-green-500">Free</div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 pt-2">
                <Button
                  onClick={handleStartChat}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  size="lg"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Test Your AI (Free for You)
                </Button>
                <Button
                  onClick={() => nav('/dashboard')}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Go to Dashboard
                </Button>
                <Button
                  onClick={() => nav('/marketplace/manage')}
                  variant="outline"
                  className="w-full"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Listing
                </Button>
              </div>

              {/* Preview Toggle */}
              <div className="pt-4 border-t">
                <Label className="flex items-center gap-2 cursor-pointer">
                  <Switch
                    checked={previewAsUser}
                    onCheckedChange={setPreviewAsUser}
                  />
                  <span className="text-sm">Preview as end user (see payment flow)</span>
                </Label>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-bg-secondary border-border-default">
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {listing.subscriptionPriceCents > 0 && (
                  <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-md">
                    <div>
                      <div className="font-semibold">Subscription</div>
                      <div className="text-sm text-text-secondary">Unlimited conversations</div>
                    </div>
                    <div className="text-lg font-bold text-text-primary">
                      ${(listing.subscriptionPriceCents / 100).toFixed(2)}/{listing.currency || 'USD'}
                      <span className="text-sm font-normal text-text-secondary">/month</span>
                    </div>
                  </div>
                )}

                {listing.payPerChatPriceCents && listing.payPerChatPriceCents > 0 && (
                  <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-md">
                    <div>
                      <div className="font-semibold">Pay Per Chat</div>
                      <div className="text-sm text-text-secondary">One-time payment, 24h access</div>
                    </div>
                    <div className="text-lg font-bold text-text-primary">
                      ${(listing.payPerChatPriceCents / 100).toFixed(2)}/{listing.currency || 'USD'}
                    </div>
                  </div>
                )}

                {listing.freeMessageLimit !== null && listing.freeMessageLimit > 0 && (
                  <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-md">
                    <div>
                      <div className="font-semibold">Free Tier</div>
                      <div className="text-sm text-text-secondary">
                        {listing.freeMessageLimit} messages per day
                      </div>
                    </div>
                    <div className="text-lg font-bold text-green-500">Free</div>
                  </div>
                )}

                {listing.freeTrialQuestions > 0 && (
                  <div className="p-3 bg-accent-primary/10 border border-accent-primary/20 rounded-md">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-accent-primary" />
                      <span className="text-sm font-medium">
                        Free trial: {listing.freeTrialQuestions} questions included
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  onClick={handleStartChat}
                  className="flex-1"
                  size="lg"
                  disabled={Boolean(isOwnClone && !previewAsUser)}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Start Chat Now
                </Button>
                {listing.subscriptionPriceCents > 0 && !isOwnClone && (
                  <Button
                    onClick={handleSubscribe}
                    disabled={subscribing}
                    variant="outline"
                    className="flex-1"
                    size="lg"
                  >
                    {subscribing ? 'Starting...' : 'Subscribe for Unlimited'}
                  </Button>
                )}
              </div>

              {isOwnClone && previewAsUser && (
                <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
                  <AlertDescription className="text-sm">
                    <strong>Preview Mode:</strong> You're viewing this as an end user would see it.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* What's Included */}
        <Card className="bg-bg-secondary border-border-default">
          <CardHeader>
            <CardTitle>What's Included</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {listing.subscriptionPriceCents > 0 && (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">Unlimited Conversations</div>
                    <div className="text-sm text-text-secondary">
                      Chat as much as you want with your subscription
                    </div>
                  </div>
                </div>
              )}
              
              {listing.freeMessageLimit !== null && listing.freeMessageLimit > 0 && (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">{listing.freeMessageLimit} Free Messages Daily</div>
                    <div className="text-sm text-text-secondary">
                      Start chatting without any payment
                    </div>
                  </div>
                </div>
              )}

              {listing.payPerChatPriceCents && listing.payPerChatPriceCents > 0 && (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">Pay Per Chat Option</div>
                    <div className="text-sm text-text-secondary">
                      One-time payment for 24 hours of unlimited access
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">Fast Response Time</div>
                  <div className="text-sm text-text-secondary">
                    Get instant AI-powered responses
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">Personalized AI Responses</div>
                  <div className="text-sm text-text-secondary">
                    Trained on creator's knowledge and style
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {isAuthed && (
          <Card className="bg-bg-secondary border-border-default mb-6">
            <CardContent className="pt-6">
              {isOwnClone ? (
                <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
                  <AlertDescription>
                    <strong>Note:</strong> You cannot review your own AI. Reviews from your users will appear here.
                  </AlertDescription>
                </Alert>
              ) : !showReviewForm ? (
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

        {/* Reviews Section */}
        <Card className="bg-bg-secondary border-border-default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Reviews
              {reviews.length > 0 && (
                <Badge variant="secondary">({reviews.length})</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {reviews.length === 0 ? (
              <div className="text-text-secondary text-sm text-center py-4">
                No reviews yet. Be the first to review!
              </div>
            ) : (
              reviews.map((r) => (
                <div key={r.id} className="border-b border-border-default pb-4 last:border-0">
                  <div className="flex items-start gap-3">
                    {r.user.profileImage && (
                      <img
                        src={r.user.profileImage}
                        className="w-8 h-8 rounded-full"
                        alt={r.user.name}
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-semibold text-sm">{r.user.name || r.user.handle}</div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-3 w-3 ${
                                star <= r.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-text-tertiary'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-text-tertiary">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {r.comment && (
                        <div className="text-sm text-text-secondary mt-1">{r.comment}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

