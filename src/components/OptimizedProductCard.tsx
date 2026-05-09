import { Check, Package, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import React, { memo } from 'react';
import { cn, formatCurrency } from '../lib/utils';
import type { Product } from '../types';

interface OptimizedProductCardProps {
  product: Product;
  inCart: boolean;
  isAdded: boolean;
  onOpenVariationModal: (product: Product) => void;
}

export const OptimizedProductCard = memo<OptimizedProductCardProps>(
  ({ product, inCart, isAdded, onOpenVariationModal }) => {
    return (
      <motion.div
        layout
        className={cn(
          'card bg-[var(--color-surface-800)] border border-[var(--color-border)] rounded-[2rem] overflow-hidden hover:border-primary/40 transition-all group shadow-sm flex flex-col',
          isAdded && 'ring-2 ring-primary scale-[1.02]',
        )}
      >
        <div className="p-6 space-y-4 flex-1 flex flex-col">
          <div className="flex-1">
            <h3 className="text-lg font-bold leading-tight line-clamp-2">{product.name}</h3>
          </div>

          <div className="pt-4 border-t border-[var(--color-border)]/10 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-1">
                Precio
              </p>
              <p className="text-2xl font-black text-danger leading-none">
                {formatCurrency(product.price)}
              </p>
            </div>
            <button
              onClick={() => onOpenVariationModal(product)}
              className={cn(
                'btn btn-primary rounded-2xl h-14 w-14 shadow-lg shadow-primary/20 p-0',
                inCart && 'btn-success shadow-success/20',
              )}
            >
              {inCart ? <Check size={24} /> : <Plus size={24} />}
            </button>
          </div>
        </div>
      </motion.div>
    );
  },
);

OptimizedProductCard.displayName = 'OptimizedProductCard';
