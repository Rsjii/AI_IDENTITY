import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface MarketplaceItem {
  id: string;
  slug: string;
  description: string;
  category: string | null;
  subscriptionPriceCents: number;
  currency: string;
  rating: number | null;
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

  const fetchListings = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
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
          <Button onClick={fetchListings}>Search</Button>
        </div>

        {loading ? (
          <div className="text-text-secondary">Loading...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {items.map((item) => (
              <Card key={item.id} className="bg-bg-secondary border-border-default">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center gap-3">
                    {item.creator.profileImage && (
                      <img
                        src={item.creator.profileImage}
                        className="w-10 h-10 rounded-full"
                        alt={item.creator.name}
                      />
                    )}
                    <div>
                      <div className="font-semibold text-text-primary">
                        {item.creator.name || item.creator.handle}
                      </div>
                      <div className="text-xs text-text-secondary">@{item.creator.handle}</div>
                    </div>
                  </div>
                  <div className="text-sm text-text-secondary line-clamp-3">
                    {item.description || 'No description yet.'}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">{item.category || 'General'}</span>
                    <span className="font-semibold">
                      ${(item.subscriptionPriceCents / 100).toFixed(2)}/{item.currency || 'USD'}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => (window.location.href = `/marketplace/${item.slug}`)}
                  >
                    View Listing
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

