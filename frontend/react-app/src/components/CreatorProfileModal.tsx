import { Link } from 'react-router-dom';
import { X, Star, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildApiUrl } from '@/lib/api';

type Creator = {
  slug: string;
  handle?: string;
  displayName?: string;
  avatarUrl?: string | null;
  bio?: string;
  expertise?: string;
  topics?: string;
  stats?: { totalChats: number; rating: number; totalRatings: number };
  socialLinks?: { twitter?: string | null; instagram?: string | null; youtube?: string | null; website?: string | null };
};

export function CreatorProfileModal({
  creator,
  onClose,
}: {
  creator: Creator;
  onClose: () => void;
}) {
  // Use handle first, fallback to slug
  const handleOrSlug = creator.handle || creator.slug;
  const profileHref = creator.handle ? `/@${creator.handle}` : `/@${creator.slug}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center md:justify-center" onClick={onClose}>
      <div
        className="bg-bg-secondary w-full md:max-w-lg md:rounded-lg rounded-t-2xl border border-border-default p-4 md:p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {creator.avatarUrl ? (
              <img src={creator.avatarUrl.startsWith('/uploads/') ? buildApiUrl(creator.avatarUrl) : creator.avatarUrl} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-accent-primary/20 flex items-center justify-center">
                <span className="font-semibold text-accent-primary">
                  {(creator.displayName || handleOrSlug || 'C').slice(0, 1).toUpperCase()}
                </span>
              </div>
            )}

            <div className="min-w-0">
              <div className="font-semibold text-text-primary truncate">
                {creator.displayName || handleOrSlug}
              </div>
              <div className="text-sm text-text-secondary truncate">{creator.expertise || 'AI Assistant'}</div>
              {creator.stats ? (
                <div className="flex items-center gap-4 text-xs text-text-tertiary mt-1">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                    {(creator.stats.rating || 0).toFixed(1)} ({creator.stats.totalRatings || 0})
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    {(creator.stats.totalChats || 0).toLocaleString()} chats
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <Button variant="ghost" size="icon" onClick={onClose} className="h-11 w-11">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {creator.bio ? <p className="text-sm text-text-secondary mt-4">{creator.bio}</p> : null}

        {creator.topics ? (
          <div className="mt-4">
            <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-1">Topics</div>
            <div className="text-sm text-text-secondary">{creator.topics}</div>
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-3">
          <Link to={profileHref} className="text-sm text-accent-primary hover:underline">
            View full profile →
          </Link>
          <div className="text-xs text-text-tertiary">@{handleOrSlug}</div>
        </div>
      </div>
    </div>
  );
}