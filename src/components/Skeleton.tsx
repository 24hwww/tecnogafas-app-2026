import React from 'react';
import { cn } from '../lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('skeleton bg-[var(--color-surface-900)]', className)} />;
}

export function ProductSkeleton() {
  return (
    <div className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] rounded-[2rem] p-6 space-y-4 animate-pulse">
      <div className="space-y-3">
        <Skeleton className="w-1/4 h-3 rounded" />
        <Skeleton className="w-3/4 h-5 rounded-lg" />
      </div>
      <div className="flex justify-between items-end pt-4">
        <div className="space-y-2">
          <Skeleton className="w-16 h-3 rounded" />
          <Skeleton className="w-24 h-8 rounded-lg" />
        </div>
        <Skeleton className="w-14 h-14 rounded-2xl" />
      </div>
    </div>
  );
}

export function ClientSkeleton() {
  return (
    <div className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] rounded-2xl p-5 flex flex-row items-center gap-4 animate-pulse">
      <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="w-1/3 h-5 rounded" />
        <Skeleton className="w-1/2 h-3 rounded" />
      </div>
      <Skeleton className="w-10 h-10 rounded-xl" />
    </div>
  );
}

export function OrderSkeleton() {
  return (
    <div className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] rounded-2xl p-5 space-y-4 animate-pulse">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <Skeleton className="w-24 h-3 rounded" />
          <Skeleton className="w-40 h-6 rounded-lg" />
        </div>
        <Skeleton className="w-20 h-6 rounded-full" />
      </div>
      <div className="pt-4 border-t border-[var(--color-border)]/10 flex justify-between">
        <Skeleton className="w-16 h-4 rounded" />
        <Skeleton className="w-32 h-6 rounded-lg" />
      </div>
    </div>
  );
}
