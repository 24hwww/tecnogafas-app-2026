import { motion } from 'motion/react';
import type { ReactNode } from 'react';

interface OptimizedPageTransitionProps {
  children: ReactNode;
  pathname: string;
}

export function OptimizedPageTransition({ children, pathname }: OptimizedPageTransitionProps) {
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{
        duration: 0.1,
        ease: [0.4, 0, 0.2, 1],
      }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}
