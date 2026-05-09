import { type CSSProperties, memo, useMemo } from 'react';
import { Grid } from 'react-window';
import { cn, formatCurrency } from '../lib/utils';
import type { Product } from '../types';

const getTotalStock = (product: Product): number => {
  let total = product.stock || 0;
  if (product.variations && product.variations.length > 0) {
    total += product.variations.reduce((sum, variation) => sum + (variation.stock || 0), 0);
  }
  return total;
};

interface VirtualizedProductListProps {
  products: Product[];
  cart: { id: string; quantity: number }[];
  onOpenVariationModal: (product: Product) => void;
  addedProductId: string | null;
  isLoading?: boolean;
}

interface GridItemProps {
  columnIndex: number;
  rowIndex: number;
  style: CSSProperties;
  data: {
    products: Product[];
    cart: { id: string; quantity: number }[];
    onOpenVariationModal: (product: Product) => void;
    addedProductId: string | null;
    columns: number;
  };
}

const VirtualizedProductItem = ({ columnIndex, rowIndex, style, data }: GridItemProps) => {
  const { products, cart, onOpenVariationModal, addedProductId, columns } = data;
  const index = rowIndex * columns + columnIndex;
  const product = products[index];

  if (!product) {
    return <div style={style} />;
  }

  const inCart = cart.find((item) => item.id === product.id);
  const isAdded = addedProductId === product.id;
  const totalStock = getTotalStock(product);

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
            <div className="flex-1">
              <p className="text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-1">
                Precio
              </p>
              <p className="text-lg font-black text-danger leading-none">
                {formatCurrency(product.price)}
              </p>
              <div
                className={cn(
                  'mt-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold inline-flex items-center gap-0.5',
                  totalStock > 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error',
                )}
              >
                <span>Stock:</span>
                <span className="font-black">{totalStock}</span>
              </div>
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
    const gridData = useMemo(
      () => ({
        products,
        cart,
        onOpenVariationModal,
        addedProductId,
        columns: 4,
      }),
      [products, cart, onOpenVariationModal, addedProductId],
    );

    const rowCount = Math.ceil(products.length / 4);

    if (isLoading && products.length === 0) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
        <div className="col-span-full card bg-[var(--color-surface-800)] border border-[var(--color-border)] border-dashed py-32 flex flex-col items-center text-center opacity-50">
          <div className="w-20 h-20 bg-[var(--color-surface-900)] rounded-full mb-6"></div>
          <p className="text-2xl font-black">No se encontraron productos</p>
          <p className="text-sm mt-2">Intenta cambiar los filtros o la búsqueda</p>
        </div>
      );
    }

    return (
      <div className="h-[600px]">
        <Grid
          columnCount={4}
          columnWidth={280}
          height={600}
          rowCount={rowCount}
          rowHeight={200}
          itemData={gridData}
          className="gap-2"
          children={VirtualizedProductItem}
        />
      </div>
    );
  },
);

VirtualizedProductList.displayName = 'VirtualizedProductList';
