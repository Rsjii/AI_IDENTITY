import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileQuestion, Home, ArrowLeft, Search } from 'lucide-react';

export function NotFoundPage() {
  return (
    <Layout>
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-2xl w-full space-y-8">
          <Card className="glass border-2 shadow-xl">
            <CardHeader className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-6 animate-pulse">
                  <FileQuestion className="h-16 w-16 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <CardTitle className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                404
              </CardTitle>
              <CardDescription className="text-xl font-semibold">Page Not Found</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="space-y-3">
                <p className="text-muted-foreground text-base">
                  The page you're looking for doesn't exist or has been moved.
                </p>
                <p className="text-sm text-muted-foreground">
                  Check the URL or navigate back to continue.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/"
                  className={buttonVariants({
                    variant: "default",
                    size: "lg",
                    className: "shadow-md flex items-center gap-2",
                  })}
                >
                  <Home className="h-4 w-4" />
                  Go Home
                </Link>
                <Button 
                  variant="outline" 
                  size="lg" 
                  onClick={() => window.history.back()}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Search className="h-5 w-5" />
                  <span className="text-sm font-medium">Quick Links</span>
                </div>
                <div className="flex flex-wrap gap-3 justify-center">
                  <Link to="/mirror" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    Mirror
                  </Link>
                  <Link to="/history" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    History
                  </Link>
                  <Link to="/identity/edit" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    Identity
                  </Link>
                  <Link to="/account" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    Account
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

