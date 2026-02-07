import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';

interface MarketplaceItem {
  id: string;
  slug: string;
  description: string;
  category: string | null;
  subscriptionPriceCents: number;
  currency: string;
  rating: number | null;
  totalSubscribers: number;
  tags: string[];
  freeTrialQuestions: number;
  isFeatured?: boolean;
  payPerChatPriceCents?: number | null;
  creator: {
    handle: string;
    name: string;
    profileImage: string | null;
  };
}

export function MarketplacePage() {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('popular');

  const fetchListings = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    if (sort) params.set('sort', sort);
    const res = await fetch(`/api/marketplace/listings?${params.toString()}`);
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchListings().catch(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Marketplace</h1>
          <p className="text-text-secondary mt-1">Discover expert AI clones.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <Input
            placeholder="Search by topic, description, or creator"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Input
            placeholder="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <select
            className="border rounded-md px-3 py-2 bg-background"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="popular">Popular</option>
            <option value="trending">Trending</option>
            <option value="newest">Newest</option>
            <option value="rating">Top Rated</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
          </select>
          <Button onClick={fetchListings}>Search</Button>
        </div>

        {loading ? (
          <div className="text-text-secondary">Loading...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {items.map((item) => (
              <Card key={item.id} className="bg-bg-secondary border-border-default hover:border-accent-primary/50 transition-all relative overflow-hidden">
                {/* Price Badge - Top Right (Prominent) */}
                {item.subscriptionPriceCents > 0 ? (
                  <div className="absolute top-3 right-3 z-10">
                    <Badge className="bg-accent-primary text-white text-base font-bold px-3 py-1.5 shadow-lg">
                      ${(item.subscriptionPriceCents / 100).toFixed(2)}/mo
                    </Badge>
                  </div>
                ) : (
                  <div className="absolute top-3 right-3 z-10">
                    <Badge variant="outline" className="text-text-secondary border-border-default text-sm px-2 py-1">
                      Free
                    </Badge>
                  </div>
                )}
                
                {/* Featured Badge - Top Left */}
                {item.isFeatured && (
                  <div className="absolute top-3 left-3 z-10">
                    <Badge className="bg-yellow-500 text-white">⭐ Featured</Badge>
                  </div>
                )}
                
                <CardContent className="pt-6 space-y-3">
                  {/* Creator Info */}
                  <div className="flex items-center gap-3">
                    {item.creator.profileImage && (
                      <img
                        src={item.creator.profileImage}
                        className="w-12 h-12 rounded-full border-2 border-accent-primary/20"
                        alt={item.creator.name}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-text-primary truncate text-lg">
                        {item.creator.name || item.creator.handle}
                      </div>
                      <div className="text-xs text-text-secondary">@{item.creator.handle}</div>
                    </div>
                  </div>
                  
                  {/* Description */}
                  <div className="text-sm text-text-secondary line-clamp-3">
                    {item.description || 'No description yet.'}
                  </div>

                  {/* Pricing Options - More Prominent */}
                  <div className="bg-bg-tertiary rounded-lg p-3 border border-border-default">
                    {item.subscriptionPriceCents > 0 ? (
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-text-tertiary">Subscription</span>
                        <span className="font-bold text-lg text-text-primary">
                          ${(item.subscriptionPriceCents / 100).toFixed(2)}/{item.currency || 'USD'}
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs text-text-tertiary mb-2 text-center py-1">
                        Subscription pricing not set
                      </div>
                    )}
                    {item.payPerChatPriceCents && item.payPerChatPriceCents > 0 && (
                      <div className="flex items-center justify-between text-xs pt-2 border-t border-border-default">
                        <span className="text-text-tertiary">Pay-per-chat</span>
                        <span className="font-semibold text-text-primary">
                          ${(item.payPerChatPriceCents / 100).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {item.freeTrialQuestions > 0 && (
                      <div className="mt-2 pt-2 border-t border-border-default">
                        <Badge variant="outline" className="text-green-600 border-green-600 bg-green-500/10 text-xs">
                          🆓 {item.freeTrialQuestions} free questions
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Stats Row */}
                  <div className="flex items-center gap-3 text-sm">
                    {item.rating && item.rating > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{item.rating.toFixed(1)}</span>
                      </div>
                    )}
                    {item.totalSubscribers > 0 && (
                      <span className="text-text-secondary">
                        {item.totalSubscribers >= 1000 
                          ? `${(item.totalSubscribers / 1000).toFixed(1)}k` 
                          : item.totalSubscribers} subscribers
                      </span>
                    )}
                  </div>

                  {/* Tags */}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {item.tags.length > 3 && (
                        <span className="text-xs text-text-tertiary">+{item.tags.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Category */}
                  <div className="text-xs text-text-tertiary">
                    {item.category || 'General'}
                  </div>

                  {/* Action Button */}
                  <Button
                    variant="outline"
                    className="w-full hover:bg-accent-primary hover:text-white transition-colors"
                    onClick={() => (window.location.href = `/marketplace/${item.slug}`)}
                  >
                    View Details →
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

