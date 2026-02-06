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
              <Card key={item.id} className="bg-bg-secondary border-border-default hover:border-accent-primary/50 transition-all relative">
                {item.isFeatured && (
                  <div className="absolute top-2 right-2 z-10">
                    <Badge className="bg-accent-primary text-white">Featured</Badge>
                  </div>
                )}
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center gap-3">
                    {item.creator.profileImage && (
                      <img
                        src={item.creator.profileImage}
                        className="w-10 h-10 rounded-full"
                        alt={item.creator.name}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-text-primary truncate">
                        {item.creator.name || item.creator.handle}
                      </div>
                      <div className="text-xs text-text-secondary">@{item.creator.handle}</div>
                    </div>
                  </div>
                  
                  <div className="text-sm text-text-secondary line-clamp-3">
                    {item.description || 'No description yet.'}
                  </div>

                  {/* Stats Row: Rating + Subscribers */}
                  <div className="flex items-center gap-3 text-sm">
                    {item.rating && (
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
                    {item.freeTrialQuestions > 0 && (
                      <Badge variant="outline" className="text-xs">
                        Free Trial
                      </Badge>
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

                  {/* Category + Price */}
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-border-default">
                    <span className="text-text-secondary">{item.category || 'General'}</span>
                    <span className="font-semibold text-text-primary">
                      ${(item.subscriptionPriceCents / 100).toFixed(2)}/{item.currency || 'USD'}
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => (window.location.href = `/marketplace/${item.slug}`)}
                  >
                    View Details
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

