/**
 * Skeleton loader for chat interface
 */

import { Skeleton } from './Skeleton';

export function ChatSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* User message skeleton */}
      <div className="flex justify-end">
        <div className="max-w-[80%] space-y-2">
          <Skeleton className="h-4 w-16 ml-auto" />
          <div className="bg-bg-tertiary rounded-lg p-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>

      {/* AI message skeleton */}
      <div className="flex justify-start">
        <div className="max-w-[80%] space-y-2">
          <Skeleton className="h-4 w-20" />
          <div className="bg-bg-secondary rounded-lg p-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>

      {/* Another AI message skeleton */}
      <div className="flex justify-start">
        <div className="max-w-[80%] space-y-2">
          <Skeleton className="h-4 w-20" />
          <div className="bg-bg-secondary rounded-lg p-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatInputSkeleton() {
  return (
    <div className="flex gap-2 items-end">
      <Skeleton className="h-24 flex-1 rounded-lg" />
      <Skeleton className="h-10 w-24 rounded-lg" />
    </div>
  );
}

