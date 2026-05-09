import { type CSSProperties, memo, useMemo } from 'react';
import { List } from 'react-window';
import { cn, formatCurrency } from '../lib/utils';
import type { Product } from '../types';

interface VirtualizedProductListProps {
  products: Product[];
  cart: { id: string; quantity: number }[];
  onOpenVariationModal: (product: Product) => void;
  addedProductId: string | null;
  isLoading?: boolean;
}

interface ListItemProps {
  index: number;
  style: CSSProperties;
  data: {
    products: Product[];
    cart: { id: string; quantity: number }[];
    onOpenVariationModal: (product: Product) => void;
    addedProductId: string | null;
  };
}

const VirtualizedProductItem = ({ index, style, data }: ListItemProps) => {
  const { products, cart, onOpenVariationModal, addedProductId } = data;
  const product = products[index];

  if (!product) {
    return <div style={style} />;
  }

  const inCart = cart.find((item) => item.id === product.id);
  const isAdded = addedProductId === product.id;

  return (
    <div style={style} className="p-2">
      <div
        className={cn(
          'card bg-[var(--color-surface-800)] border border-[var(--color-border)] rounded-[2rem] overflow-hidden hover:border-primary/40 transition-all group shadow-sm flex flex-col h-full',
          isAdded && 'ring-2 ring-primary scale-[1.02]',
        )}
      >
        <div className="p-4 space-y-3 flex-1 flex flex-col">
          <div className="flex-1">
            <h3 className="text-sm font-bold leading-tight line-clamp-2">{product.name}</h3>
          </div>

          <div className="pt-3 border-t border-[var(--color-border)]/10 flex items-end justify-between gap-2">
            <div>
              <p className="text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-1">
                Precio
              </p>
              <p className="text-lg font-black text-danger leading-none">
                {formatCurrency(product.price)}
              </p>
            </div>
            <button
              onClick={() => onOpenVariationModal(product)}
              className={cn(
                'btn btn-primary rounded-xl h-12 w-12 shadow-lg shadow-primary/20 p-0 text-xs',
                inCart && 'btn-success shadow-success/20',
              )}
            >
              {inCart ? '✓' : '+'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const VirtualizedProductList = memo(
  ({
    products,
    cart,
    onOpenVariationModal,
    addedProductId,
    isLoading,
  }: VirtualizedProductListProps) => {
    const itemData = useMemo(
      () => ({
        products,
        cart,
        onOpenVariationModal,
        addedProductId,
      }),
      [products, cart, onOpenVariationModal, addedProductId],
    );

    if (isLoading && products.length === 0) {
      return (
        <div className="space-y-4">
          {Array(8)
            .fill(0)
            .map((_, i) => (
              <div
                key={i}
                className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] rounded-[2rem] p-6 animate-pulse"
              >
                <div className="h-4 bg-[var(--color-surface-900)] rounded mb-4"></div>
                <div className="h-8 bg-[var(--color-surface-900)] rounded"></div>
              </div>
            ))}
        </div>
      );
    }

    if (products.length === 0) {
      return (
        <div className="card bg-[var(--color-surface-800)] border border-[var(--color-border)] border-dashed py-32 flex flex-col items-center text-center opacity-50">
          <div className="w-20 h-20 bg-[var(--color-surface-900)] rounded-full mb-6"></div>
          <p className="text-2xl font-black">No se encontraron productos</p>
          <p className="text-sm mt-2">Intenta cambiar los filtros o la búsqueda</p>
        </div>
      );
    }

    return (
      <div className="h-[600px]">
        <List
          height={600}
          itemCount={products.length}
          itemSize={180}
          itemData={itemData}
          className="space-y-2"
          children={VirtualizedProductItem}
        />
      </div>
    );
  },
);

VirtualizedProductList.displayName = 'VirtualizedProductList';
