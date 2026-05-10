import { ArrowDown, Loader2 } from 'lucide-react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 60], [0, 1]);
  const scale = useTransform(y, [0, 60], [0.5, 1]);
  const rotate = useTransform(y, [0, 80], [0, 180]);

  const PULL_THRESHOLD = 80;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let startY = 0;
    let isPulling = false;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (window.scrollY === 0 && touch) {
        startY = touch.pageY;
        isPulling = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || isRefreshing) return;
      const touch = e.touches[0];
      if (!touch) return;
      const currentY = touch.pageY;
      const diff = currentY - startY;
      if (diff > 0) {
        const newY = diff ** 0.8;
        y.set(newY);
        if (diff > 10 && e.cancelable) e.preventDefault();
      } else {
        isPulling = false;
        y.set(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling || isRefreshing) return;
      isPulling = false;
      if (y.get() >= PULL_THRESHOLD) {
        setIsRefreshing(true);
        animate(y, 100, { duration: 0.2 });
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          animate(y, 0, { duration: 0.3, delay: 0.5 });
        }
      } else {
        animate(y, 0, { duration: 0.2 });
      }
    };

    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh, isRefreshing, y]);

  return (
    <div ref={containerRef} className="relative w-full">
      <motion.div
        style={{ y, opacity, scale }}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-base-200 shadow-lg rounded-full p-2 text-primary border border-[var(--color-border)] flex items-center justify-center h-10 w-10"
      >
        {isRefreshing ? (
          <Loader2 className="animate-spin" size={20} />
        ) : (
          <motion.div style={{ rotate }}>
            <ArrowDown size={20} />
          </motion.div>
        )}
      </motion.div>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
};
