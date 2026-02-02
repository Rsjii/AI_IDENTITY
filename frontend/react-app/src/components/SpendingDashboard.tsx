import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, Users, Download, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { showToast } from '@/lib/toast';

interface TopCreator {
  creatorId: string;
  name: string;
  handle: string;
  avatar: string | null;
  amount: number;
  sessionCount: number;
}

interface SpendingStats {
  totalSpentCents: number;
  monthlySpentCents: number;
  topCreators: TopCreator[];
}

export function SpendingDashboard() {
  const [stats, setStats] = useState<SpendingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadSpendingStats();
  }, []);

  const loadSpendingStats = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ success: boolean } & SpendingStats>('/api/user/conversations/spending-stats');
      if (res.success) {
        setStats({
          totalSpentCents: res.totalSpentCents,
          monthlySpentCents: res.monthlySpentCents,
          topCreators: res.topCreators,
        });
      }
    } catch (error) {
      console.error('Failed to load spending stats:', error);
      showToast('Failed to load spending statistics', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportSpending = async () => {
    setExporting(true);
    try {
      // Export user spending history
      const response = await fetch('/api/user/conversations/spending-export', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spending-history-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('Spending history exported successfully', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showToast('Failed to export spending history', 'error');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Your Spending
          </CardTitle>
          <CardDescription>Track your investments in creator conversations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-accent-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Your Spending
          </CardTitle>
          <CardDescription>Track your investments in creator conversations</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-text-secondary py-8">No spending data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Your Spending
        </CardTitle>
        <CardDescription>Track your investments in creator conversations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-bg-tertiary rounded-lg p-4 border border-border-default">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">This Month</p>
                <p className="text-2xl font-bold text-text-primary">
                  {formatCurrency(stats.monthlySpentCents)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-bg-tertiary rounded-lg p-4 border border-border-default">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">All Time</p>
                <p className="text-2xl font-bold text-text-primary">
                  {formatCurrency(stats.totalSpentCents)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Creators */}
        <div>
          <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Top Creators
          </h3>

          {stats.topCreators.length === 0 ? (
            <p className="text-center text-text-secondary py-8 text-sm">
              No spending history yet. Start chatting with creators!
            </p>
          ) : (
            <div className="space-y-3">
              {stats.topCreators.map((creator, index) => (
                <div
                  key={creator.creatorId}
                  className="flex items-center gap-3 p-3 bg-bg-tertiary rounded-lg border border-border-default hover:bg-bg-elevated transition-colors"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-primary/20 text-accent-primary font-semibold text-sm">
                    {index + 1}
                  </div>

                  {creator.avatar ? (
                    <img
                      src={creator.avatar}
                      alt={creator.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-accent-primary/20 flex items-center justify-center">
                      <span className="text-sm font-semibold text-accent-primary">
                        {creator.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-primary truncate">{creator.name}</p>
                    <p className="text-xs text-text-secondary">
                      {creator.sessionCount} session{creator.sessionCount !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold text-text-primary">{formatCurrency(creator.amount)}</p>
                    <p className="text-xs text-text-secondary">
                      {formatCurrency(Math.round(creator.amount / creator.sessionCount))}/session
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Export Button */}
        <div className="pt-4 border-t border-border-default">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleExportSpending}
            disabled={exporting}
          >
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export Spending History
              </>
            )}
          </Button>
          <p className="text-xs text-text-tertiary text-center mt-2">
            Download your complete spending history as CSV
          </p>
        </div>

        {/* Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>Note:</strong> 75% of your payments go directly to creators. The remaining 25% covers platform
            fees, payment processing, and infrastructure costs.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
