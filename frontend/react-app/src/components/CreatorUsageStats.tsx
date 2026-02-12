/**
 * Creator Usage Stats Component
 * Displays token usage statistics for creators on their dashboard
 * Shows quota usage, storage usage, and upgrade options
 */

import { TrendingUp, Database, Zap, AlertTriangle, ArrowUp, MessageSquare } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface CreatorUsageStatsProps {
  // Plan info
  planTier: 'free' | 'starter' | 'growth' | 'scale';

  // Token usage
  tokensUsed: number;
  tokenQuota: number;
  conversationsCount: number;

  // Storage usage
  storageUsedMB: number;
  storageQuotaMB: number;

  // Period info
  periodStart: Date;
  periodEnd: Date;

  // Actions
  onUpgradePlan?: () => void;
  onViewDetails?: () => void;
}

export function CreatorUsageStats({
  planTier,
  tokensUsed,
  tokenQuota,
  conversationsCount,
  storageUsedMB,
  storageQuotaMB,
  periodStart,
  periodEnd,
  onUpgradePlan,
  onViewDetails,
}: CreatorUsageStatsProps) {
  // Calculate percentages
  const tokenPercentage = (tokensUsed / tokenQuota) * 100;
  const storagePercentage = (storageUsedMB / storageQuotaMB) * 100;

  // Determine warning levels
  const isTokenWarning = tokenPercentage >= 80 && tokenPercentage < 90;
  const isTokenCritical = tokenPercentage >= 90;
  const isStorageWarning = storagePercentage >= 80 && storagePercentage < 90;
  const isStorageCritical = storagePercentage >= 90;

  // Format numbers
  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  const formatStorage = (mb: number): string => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  // Format dates
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
  };

  // Plan info
  const planInfo = {
    free: { name: 'Free', color: 'text-gray-600' },
    starter: { name: 'Starter', color: 'text-blue-600' },
    growth: { name: 'Growth', color: 'text-purple-600' },
    scale: { name: 'Scale', color: 'text-green-600' },
  };

  const currentPlan = planInfo[planTier];

  return (
    <div className="space-y-4">
      {/* Plan Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className={`h-5 w-5 ${currentPlan.color}`} />
                {currentPlan.name} Plan
              </CardTitle>
              <CardDescription>
                Billing period: {formatDate(periodStart)} - {formatDate(periodEnd)}
              </CardDescription>
            </div>
            {onUpgradePlan && planTier !== 'scale' && (
              <Button onClick={onUpgradePlan} className="bg-gradient-to-r from-blue-500 to-purple-500">
                <ArrowUp className="h-4 w-4 mr-2" />
                Upgrade Plan
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Token Usage */}
      <Card className={isTokenCritical || isTokenWarning ? 'border-orange-500' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Token Usage
              </CardTitle>
              <CardDescription>API tokens consumed this billing period</CardDescription>
            </div>
            {(isTokenWarning || isTokenCritical) && (
              <AlertTriangle className={`h-5 w-5 ${isTokenCritical ? 'text-red-500' : 'text-orange-500'}`} />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold">{formatTokens(tokensUsed)}</div>
                <div className="text-sm text-text-secondary">
                  of {formatTokens(tokenQuota)} tokens
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold">{Math.round(tokenPercentage)}%</div>
                <div className="text-sm text-text-secondary">used</div>
              </div>
            </div>

            <Progress
              value={tokenPercentage}
              className="h-2"
              indicatorClassName={
                isTokenCritical
                  ? 'bg-red-500'
                  : isTokenWarning
                  ? 'bg-orange-500'
                  : 'bg-blue-500'
              }
            />

            {isTokenCritical && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm font-medium text-red-900 dark:text-red-100">
                  ⚠️ Critical: {Math.round(tokenPercentage)}% quota used
                </p>
                <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                  Your avatars will stop responding at 100%. Upgrade your plan to avoid downtime.
                </p>
              </div>
            )}

            {isTokenWarning && !isTokenCritical && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                  ⚠️ Warning: {Math.round(tokenPercentage)}% quota used
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                  Consider upgrading your plan to avoid hitting the limit.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 text-sm">
              <span className="text-text-secondary">Conversations this period:</span>
              <span className="font-semibold">{conversationsCount.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Storage Usage */}
      <Card className={isStorageCritical || isStorageWarning ? 'border-orange-500' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5" />
                Storage Usage
              </CardTitle>
              <CardDescription>Files, voices, and videos uploaded</CardDescription>
            </div>
            {(isStorageWarning || isStorageCritical) && (
              <AlertTriangle className={`h-5 w-5 ${isStorageCritical ? 'text-red-500' : 'text-orange-500'}`} />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold">{formatStorage(storageUsedMB)}</div>
                <div className="text-sm text-text-secondary">
                  of {formatStorage(storageQuotaMB)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold">{Math.round(storagePercentage)}%</div>
                <div className="text-sm text-text-secondary">used</div>
              </div>
            </div>

            <Progress
              value={storagePercentage}
              className="h-2"
              indicatorClassName={
                isStorageCritical
                  ? 'bg-red-500'
                  : isStorageWarning
                  ? 'bg-orange-500'
                  : 'bg-green-500'
              }
            />

            {isStorageCritical && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm font-medium text-red-900 dark:text-red-100">
                  ⚠️ Storage Full: {Math.round(storagePercentage)}% used
                </p>
                <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                  You can't upload new files. Upgrade your plan to get more storage.
                </p>
              </div>
            )}

            {isStorageWarning && !isStorageCritical && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                  ⚠️ Storage Warning: {Math.round(storagePercentage)}% used
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                  Running low on storage space. Uploads will be blocked at 100%.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/20">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{conversationsCount}</div>
                <div className="text-sm text-text-secondary">Conversations</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/20">
                <MessageSquare className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {Math.round((conversationsCount / (tokenQuota / 2000)) * 100)}%
                </div>
                <div className="text-sm text-text-secondary">Engagement Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/20">
                <Zap className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{currentPlan.name}</div>
                <div className="text-sm text-text-secondary">Current Plan</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Details Button */}
      {onViewDetails && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={onViewDetails}>
            View Detailed Usage Report
          </Button>
        </div>
      )}
    </div>
  );
}

export default CreatorUsageStats;
