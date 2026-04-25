import React from 'react';
import { cn } from '../lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div 
      className={cn(
        "bg-surface-variant animate-pulse",
        className
      )}
    />
  );
}

export function ProductSkeleton() {
  return (
    <div className="m3-card space-y-4">
      <Skeleton className="w-full h-40" />
      <div className="space-y-2">
        <Skeleton className="w-3/4 h-4" />
        <Skeleton className="w-1/2 h-4" />
      </div>
      <div className="flex justify-between items-center pt-2">
        <Skeleton className="w-20 h-6" />
        <Skeleton className="w-10 h-10" />
      </div>
    </div>
  );
}

export function ClientSkeleton() {
  return (
    <div className="m3-card !p-4 flex items-center gap-4">
      <Skeleton className="w-12 h-12" />
      <div className="flex-1 space-y-2">
        <Skeleton className="w-1/3 h-4" />
        <Skeleton className="w-1/2 h-3" />
      </div>
      <Skeleton className="w-8 h-8 rounded-full" />
    </div>
  );
}

export function OrderSkeleton() {
  return (
    <div className="m3-card space-y-4">
      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="w-32 h-4" />
          <Skeleton className="w-24 h-3" />
        </div>
        <Skeleton className="w-20 h-6" />
      </div>
      <div className="pt-2 border-t border-white/5 flex justify-between">
        <Skeleton className="w-16 h-4" />
        <Skeleton className="w-24 h-4" />
      </div>
    </div>
  );
}
