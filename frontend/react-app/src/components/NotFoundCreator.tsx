import { Link } from 'react-router-dom';
import { buttonVariants } from '@/components/ui/button';

export function NotFoundCreator({
  title = 'Creator not found',
  subtitle = "The AI you're looking for doesn't exist or has been removed.",
  exploreHref = '/explore',
}: {
  title?: string;
  subtitle?: string;
  exploreHref?: string;
}) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center space-y-4">
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        <p className="text-text-secondary">{subtitle}</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link to={exploreHref} className={buttonVariants({ variant: 'default', size: 'lg' })}>
            Explore AIs
          </Link>
          <Link to="/" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}