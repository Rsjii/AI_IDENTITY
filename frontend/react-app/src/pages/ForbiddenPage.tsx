import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldOff, Home, ArrowLeft } from 'lucide-react';

export function ForbiddenPage() {
  return (
    <Layout>
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-2xl w-full space-y-8">
          <Card className="glass border-2 border-red-200 dark:border-red-800 shadow-xl">
            <CardHeader className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30 p-6 shadow-lg">
                  <ShieldOff className="h-16 w-16 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <CardTitle className="text-6xl font-bold bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-400 dark:to-orange-400 bg-clip-text text-transparent">
                403
              </CardTitle>
              <CardDescription className="text-xl font-semibold">Access Forbidden</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="space-y-3">
                <p className="text-muted-foreground text-base">
                  You don't have permission to access this resource.
                </p>
                <p className="text-sm text-muted-foreground">
                  If you believe this is an error, please contact support.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild variant="default" size="lg" className="shadow-md">
                  <Link to="/" className="flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    Go Home
                  </Link>
                </Button>
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
                  <ShieldOff className="h-5 w-5" />
                  <span className="text-sm font-medium">What can you do?</span>
                </div>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>• Make sure you're logged in with the correct account</p>
                  <p>• Contact your administrator if you need access</p>
                  <p>• Return to the home page and try again</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

