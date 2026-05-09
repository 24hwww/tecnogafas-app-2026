import {
  ArrowRight,
  Check,
  ChevronRight,
  Filter,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { PullToRefresh } from '../components/PullToRefresh';
import { ProductSkeleton } from '../components/Skeleton';
import { useCart } from '../contexts/CartContext';
import { cn, formatCurrency } from '../lib/utils';
import type { Product } from '../types';

interface ProductCardProps {
  product: Product;
  inCart: { id: string; quantity: number } | undefined;
  isAdded: boolean;
  onOpenVariationModal: (product: Product) => void;
}

const getTotalStock = (product: Product): number => {
  let total = product.stock || 0;
  if (product.variations && product.variations.length > 0) {
    total += product.variations.reduce((sum, variation) => sum + (variation.stock || 0), 0);
  }
  return total;
};

const ProductCard = memo(({ product, inCart, isAdded, onOpenVariationModal }: ProductCardProps) => {
  const totalStock = getTotalStock(product);

  return (
    <motion.div
      layout
      key={product.id}
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
          <div className="flex-1">
            <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-1">
              Precio
            </p>
            <p className="text-2xl font-black text-danger leading-none">
              {formatCurrency(product.price)}
            </p>
            <div
              className={cn(
                'mt-2 px-2 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1',
                totalStock > 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error',
              )}
            >
              <span>Stock:</span>
              <span className="font-black">{totalStock}</span>
            </div>
          </div>
          <button
            onClick={() => onOpenVariationModal(product)}
            disabled={totalStock === 0}
            className={cn(
              'btn btn-primary rounded-2xl h-14 w-14 shadow-lg shadow-primary/20 p-0',
              inCart && 'btn-success shadow-success/20',
              totalStock === 0 && 'opacity-30 cursor-not-allowed',
            )}
          >
            {inCart ? <Check size={24} /> : <Plus size={24} />}
          </button>
        </div>
      </div>
    </motion.div>
  );
});

ProductCard.displayName = 'ProductCard';

export default function Products() {
  const { products, isLoading, refreshData } = useApp();
  const { addToCart, cart } = useCart();
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showZeroPrice] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'price' | 'stock'>('default');
  const [variationModalProduct, setVariationModalProduct] = useState<Product | null>(null);
  const [variationQuantities, setVariationQuantities] = useState<Record<string, number>>({});
  const [addedProductId, setAddedProductId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastProductName, setToastProductName] = useState('');

  const triggerAddedAnimation = useCallback((id: string, productName: string = '') => {
    setAddedProductId(id);
    setToastProductName(productName);
    setToastMessage(`${productName} agregado al carrito`);
    setShowToast(true);
    
    // Auto-hide toast after 2 seconds
    setTimeout(() => {
      setShowToast(false);
    }, 2000);
    
    setTimeout(() => setAddedProductId(null), 1000);
  }, []);

  const parseFiltros = (filtros: string): string[] => {
    if (!filtros) return [];
    return filtros
      .split(';')
      .map((part) => {
        const match = part.match(/Termino:([^|]+)/);
        return match ? match[1] : '';
      })
      .filter((t): t is string => t !== '');
  };

  const productFiltrosMap = useMemo(() => {
    const map = new Map<string, string[]>();
    products.forEach((p) => {
      map.set(p.id, parseFiltros(p.description));
    });
    return map;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((p) => {
      const pFiltros = productFiltrosMap.get(p.id) || [];
      const matchesFilters = activeFilters.every((f, i) => pFiltros[i] === f);
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesPrice = showZeroPrice || p.price > 0;
      return matchesFilters && matchesSearch && matchesPrice;
    });

    // Apply sorting
    if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'price') {
      filtered.sort((a, b) => b.price - a.price); // High to low
    } else if (sortBy === 'stock') {
      filtered.sort((a, b) => {
        const totalStockA = getTotalStock(a);
        const totalStockB = getTotalStock(b);
        return totalStockB - totalStockA; // High to low
      });
    }

    return filtered;
  }, [products, productFiltrosMap, activeFilters, search, showZeroPrice, sortBy]);

  const nextLevel = activeFilters.length;

  const availableNextTerms = useMemo(() => {
    const terms = new Set<string>();
    products.forEach((p) => {
      const pFiltros = productFiltrosMap.get(p.id) || [];
      const matchesActive = activeFilters.every((f, i) => pFiltros[i] === f);
      if (matchesActive && pFiltros[nextLevel]) {
        terms.add(pFiltros[nextLevel]);
      }
    });
    return Array.from(terms);
  }, [products, activeFilters, nextLevel, productFiltrosMap]);

  const handleAddFilter = useCallback(
    (term: string) => setActiveFilters([...activeFilters, term]),
    [activeFilters],
  );
  const handleRemoveFilter = useCallback(
    (index: number) => setActiveFilters(activeFilters.slice(0, index)),
    [activeFilters],
  );

  const getInCart = useCallback((id: string) => cart.find((item) => item.id === id), [cart]);

  const handleOpenVariationModal = (product: Product) => {
    setVariationModalProduct(product);
    const initialQuantities: Record<string, number> = {};
    if (product.variations && product.variations.length > 0) {
      product.variations.forEach((v) => {
        initialQuantities[v.vid] = 0;
      });
    } else {
      initialQuantities['base'] = 1;
    }
    setVariationQuantities(initialQuantities);
  };

  const updateVariationQuantity = useCallback((vid: string, delta: number) => {
    setVariationQuantities((prev) => ({
      ...prev,
      [vid]: Math.max(0, (prev[vid] || 0) + delta),
    }));
  }, []);

  const handleAddToCartFromModal = useCallback(() => {
    if (!variationModalProduct) return;
    let anyAdded = false;
    Object.entries(variationQuantities).forEach(([vid, quantity]) => {
      if (quantity <= 0) return;
      anyAdded = true;
      if (vid === 'base') {
        addToCart(variationModalProduct, quantity);
        triggerAddedAnimation(variationModalProduct.id, variationModalProduct.name);
      } else {
        const variation = variationModalProduct.variations?.find((v) => v.vid === vid);
        if (variation) {
          const productToAdd = {
            ...variationModalProduct,
            id: `${variationModalProduct.id}-${variation.vid}`,
            name: `${variationModalProduct.name} - ${variation.title}`,
            price: variation.price,
            stock: variation.stock,
            vid: variation.vid,
          };
          addToCart(productToAdd, quantity);
          triggerAddedAnimation(productToAdd.id, productToAdd.name);
        }
      }
    });
    if (anyAdded) setVariationModalProduct(null);
  }, [variationModalProduct, variationQuantities, addToCart, triggerAddedAnimation]);

  const totalSelected = Object.values(variationQuantities).reduce((acc, q) => acc + q, 0);

  return (
    <PullToRefresh onRefresh={() => refreshData(false)}>
      <div className="space-y-8 max-w-7xl mx-auto pb-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 id="products-title" className="text-3xl font-black tracking-tight">
              Catálogo
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Productos</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'btn btn-ghost rounded-2xl gap-2 h-12 bg-[var(--color-surface-800)] border border-[var(--color-border)] px-6',
                showFilters && 'text-primary border-primary/30 bg-primary/5',
              )}
            >
              <Filter size={18} /> <span>Filtros</span>
            </button>
            <div className="flex items-center gap-2 bg-[var(--color-surface-800)] px-4 py-2.5 rounded-2xl border border-[var(--color-border)]">
              <span className="text-xs font-bold text-[var(--color-text-muted)]">Total:</span>
              <span className="text-sm font-black text-primary">{filteredProducts.length}</span>
            </div>
          </div>
        </div>

        <div className="relative group">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-primary transition-colors"
            size={20}
          />
          <input
            id="products-search-input"
            type="text"
            placeholder="Buscar por nombre, modelo o código..."
            className="w-full pl-12 pr-4 py-4 bg-[var(--color-surface-800)] rounded-3xl border border-[var(--color-border)] focus:ring-2 focus:ring-primary/20 outline-none font-medium text-base transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="overflow-hidden space-y-4"
          >
            <div className="flex flex-wrap items-center gap-2 p-1">
              <button
                onClick={() => setActiveFilters([])}
                className={cn(
                  'btn btn-sm rounded-xl h-10 px-5',
                  activeFilters.length === 0
                    ? 'btn-primary'
                    : 'btn-ghost bg-[var(--color-surface-800)]',
                )}
              >
                Todos
              </button>
              {activeFilters.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <ChevronRight size={14} className="opacity-30" />
                  <button
                    onClick={() => handleRemoveFilter(i)}
                    className="btn btn-sm btn-primary rounded-xl h-10 gap-2"
                  >
                    {f} <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {availableNextTerms.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {availableNextTerms.map((term) => (
                  <button
                    key={term}
                    onClick={() => handleAddFilter(term)}
                    className="btn btn-ghost btn-sm bg-[var(--color-surface-800)] rounded-xl h-12 justify-between border border-[var(--color-border)] hover:border-primary/30"
                  >
                    <span className="truncate">{term}</span>
                    <ArrowRight size={14} className="opacity-30" />
                  </button>
                ))}
              </div>
            )}

            <div className="border-t border-[var(--color-border)]/10 pt-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
                Ordenar por
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => setSortBy('default')}
                  className={cn(
                    'btn btn-sm rounded-xl h-10 justify-between border border-[var(--color-border)]',
                    sortBy === 'default'
                      ? 'btn-primary'
                      : 'btn-ghost bg-[var(--color-surface-800)]',
                  )}
                >
                  <span>Defecto</span>
                </button>
                <button
                  onClick={() => setSortBy('name')}
                  className={cn(
                    'btn btn-sm rounded-xl h-10 justify-between border border-[var(--color-border)]',
                    sortBy === 'name' ? 'btn-primary' : 'btn-ghost bg-[var(--color-surface-800)]',
                  )}
                >
                  <span>A-Z</span>
                </button>
                <button
                  onClick={() => setSortBy('price')}
                  className={cn(
                    'btn btn-sm rounded-xl h-10 justify-between border border-[var(--color-border)]',
                    sortBy === 'price' ? 'btn-primary' : 'btn-ghost bg-[var(--color-surface-800)]',
                  )}
                >
                  <span>Precio ↓</span>
                </button>
                <button
                  onClick={() => setSortBy('stock')}
                  className={cn(
                    'btn btn-sm rounded-xl h-10 justify-between border border-[var(--color-border)]',
                    sortBy === 'stock' ? 'btn-primary' : 'btn-ghost bg-[var(--color-surface-800)]',
                  )}
                >
                  <span>Stock ↓</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {isLoading ? (
            Array(8)
              .fill(0)
              .map((_, i) => <ProductSkeleton key={i} />)
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full card bg-[var(--color-surface-800)] border border-[var(--color-border)] border-dashed py-32 flex flex-col items-center text-center opacity-50">
              <Package size={80} className="mb-6" />
              <p className="text-2xl font-black">No se encontraron productos</p>
              <p className="text-sm mt-2">Intenta cambiar los filtros o la búsqueda</p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const inCart = getInCart(product.id);
              const isAdded = addedProductId === product.id;
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  inCart={inCart}
                  isAdded={isAdded}
                  onOpenVariationModal={handleOpenVariationModal}
                />
              );
            })
          )}
        </div>

        {/* Variation Modal */}
        <AnimatePresence>
          {variationModalProduct && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/90 backdrop-blur-xl"
                onClick={() => setVariationModalProduct(null)}
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="relative bg-[var(--color-surface-800)] border border-[var(--color-border)] sm:rounded-[2.5rem] rounded-t-[1.5rem] sm:rounded-t-[2.5rem] w-full sm:max-w-lg max-h-[100vh] sm:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl sm:mx-4 mx-0"
              >
                <div className="sm:p-5 p-6 border-b border-[var(--color-border)]/10 bg-primary/5 flex justify-between items-start gap-4">
                  <div className="flex gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[var(--color-surface-900)] rounded-2xl flex items-center justify-center border border-[var(--color-border)] shrink-0">
                      <Package className="text-primary/40 hidden sm:block" size={30} />
                      <Package className="text-primary/40 sm:hidden" size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg sm:text-xl font-bold tracking-tight line-clamp-2">
                        {variationModalProduct.name}
                      </h3>
                      <p className="text-sm text-[var(--color-text-muted)] mt-1 font-medium">
                        {formatCurrency(variationModalProduct.price)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setVariationModalProduct(null)}
                    className="btn btn-ghost btn-square btn-sm rounded-xl flex-shrink-0"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto sm:p-6 p-6 space-y-6">
                  <div className="grid gap-3 sm:gap-4">
                    {variationModalProduct.variations &&
                    variationModalProduct.variations.length > 0 ? (
                      variationModalProduct.variations.map((v) => (
                        <div
                          key={v.vid}
                          className={cn(
                            'p-4 sm:p-5 bg-[var(--color-surface-900)] rounded-2xl sm:rounded-3xl border border-[var(--color-border)] space-y-3 sm:space-y-4',
                            v.stock === 0 && 'opacity-50',
                          )}
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-sm sm:text-base truncate">{v.title}</p>
                            <div className="flex items-center justify-between gap-2 mt-2">
                              <p className="text-xs font-bold text-primary">
                                {(variationQuantities[v.vid] || 0) > 0
                                  ? `Total: ${formatCurrency(v.price * (variationQuantities[v.vid] || 0))}`
                                  : formatCurrency(v.price)}
                              </p>
                              <div
                                className={cn(
                                  'px-2 py-1 rounded-full text-xs font-bold shrink-0',
                                  v.stock > 0
                                    ? 'bg-success/10 text-success'
                                    : 'bg-error/10 text-error',
                                )}
                              >
                                Stock: {v.stock}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between bg-[var(--color-surface-800)]/50 p-3 pl-4 rounded-2xl border border-[var(--color-border)]/10">
                            <div className="flex items-center gap-2 w-full">
                              <button
                                onClick={() => updateVariationQuantity(v.vid, -1)}
                                disabled={v.stock === 0}
                                className={cn(
                                  'btn btn-ghost btn-square rounded-xl bg-[var(--color-surface-700)] hover:bg-error/20 hover:text-error border border-[var(--color-border)]/20 transition-all duration-200 h-10 w-10 sm:h-12 sm:w-12 shadow-sm hover:shadow-md',
                                  v.stock === 0 &&
                                    'opacity-30 cursor-not-allowed bg-[var(--color-surface-600)]',
                                )}
                              >
                                <Minus size={18} className="shrink-0 hidden sm:block" />
                                <Minus size={16} className="shrink-0 sm:hidden" />
                              </button>
                              <div className="flex-1 flex items-center justify-center">
                                <span className="w-12 sm:w-14 text-center font-black text-lg sm:text-xl bg-[var(--color-surface-900)] rounded-xl py-2 sm:py-2.5 border border-[var(--color-border)]/20 shadow-inner">
                                  {variationQuantities[v.vid] || 0}
                                </span>
                              </div>
                              <button
                                onClick={() => updateVariationQuantity(v.vid, 1)}
                                disabled={
                                  v.stock === 0 || (variationQuantities[v.vid] || 0) >= v.stock
                                }
                                className={cn(
                                  'btn btn-ghost btn-square rounded-xl bg-[var(--color-surface-700)] hover:bg-primary/20 hover:text-primary border border-[var(--color-border)]/20 transition-all duration-200 h-10 w-10 sm:h-12 sm:w-12 shadow-sm hover:shadow-md',
                                  (v.stock === 0 || (variationQuantities[v.vid] || 0) >= v.stock) &&
                                    'opacity-30 cursor-not-allowed bg-[var(--color-surface-600)]',
                                )}
                              >
                                <Plus size={18} className="shrink-0 hidden sm:block" />
                                <Plus size={16} className="shrink-0 sm:hidden" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div
                        className={cn(
                          'p-4 sm:p-5 bg-[var(--color-surface-900)] rounded-2xl sm:rounded-3xl border border-[var(--color-border)] space-y-3 sm:space-y-4',
                          variationModalProduct.stock === 0 && 'opacity-50',
                        )}
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-sm sm:text-base">Unidad Base</p>
                          <div className="flex items-center justify-between gap-2 mt-2">
                            <p className="text-xs font-bold text-primary">
                              {(variationQuantities['base'] || 0) > 0
                                ? `Total: ${formatCurrency(variationModalProduct.price * (variationQuantities['base'] || 0))}`
                                : formatCurrency(variationModalProduct.price)}
                            </p>
                            <div
                              className={cn(
                                'px-2 py-1 rounded-full text-xs font-bold shrink-0',
                                variationModalProduct.stock > 0
                                  ? 'bg-success/10 text-success'
                                  : 'bg-error/10 text-error',
                              )}
                            >
                              Stock: {variationModalProduct.stock}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between bg-[var(--color-surface-800)]/50 p-3 pl-4 rounded-2xl border border-[var(--color-border)]/10">
                          <div className="flex items-center gap-2 w-full">
                            <button
                              onClick={() => updateVariationQuantity('base', -1)}
                              disabled={variationModalProduct.stock === 0}
                              className={cn(
                                'btn btn-ghost btn-square rounded-xl bg-[var(--color-surface-700)] hover:bg-error/20 hover:text-error border border-[var(--color-border)]/20 transition-all duration-200 h-10 w-10 sm:h-12 sm:w-12 shadow-sm hover:shadow-md',
                                variationModalProduct.stock === 0 &&
                                  'opacity-30 cursor-not-allowed bg-[var(--color-surface-600)]',
                              )}
                            >
                              <Minus size={18} className="shrink-0 hidden sm:block" />
                              <Minus size={16} className="shrink-0 sm:hidden" />
                            </button>
                            <div className="flex-1 flex items-center justify-center">
                              <span className="w-12 sm:w-14 text-center font-black text-lg sm:text-xl bg-[var(--color-surface-900)] rounded-xl py-2 sm:py-2.5 border border-[var(--color-border)]/20 shadow-inner">
                                {variationQuantities['base'] || 0}
                              </span>
                            </div>
                            <button
                              onClick={() => updateVariationQuantity('base', 1)}
                              disabled={
                                variationModalProduct.stock === 0 ||
                                (variationQuantities['base'] || 0) >= variationModalProduct.stock
                              }
                              className={cn(
                                'btn btn-ghost btn-square rounded-xl bg-[var(--color-surface-700)] hover:bg-primary/20 hover:text-primary border border-[var(--color-border)]/20 transition-all duration-200 h-10 w-10 sm:h-12 sm:w-12 shadow-sm hover:shadow-md',
                                (variationModalProduct.stock === 0 ||
                                  (variationQuantities['base'] || 0) >=
                                    variationModalProduct.stock) &&
                                  'opacity-30 cursor-not-allowed bg-[var(--color-surface-600)]',
                              )}
                            >
                              <Plus size={18} className="shrink-0 hidden sm:block" />
                              <Plus size={16} className="shrink-0 sm:hidden" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="sm:p-8 p-6 bg-[var(--color-surface-900)] border-t border-[var(--color-border)]">
                  <button
                    onClick={handleAddToCartFromModal}
                    disabled={totalSelected === 0}
                    className="btn btn-primary btn-lg w-full rounded-2xl h-14 sm:h-16 font-black text-base sm:text-lg gap-3"
                  >
                    <ShoppingCart size={22} className="hidden sm:block" />
                    <ShoppingCart size={20} className="sm:hidden" />
                    {totalSelected > 0 ? `Agregar ${totalSelected} items` : 'Seleccione cantidad'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* DaisyUI Toast for Product Added */}
        <AnimatePresence>
          {showToast && (
            <div className="toast toast-top toast-center z-50">
              <div className="alert alert-success shadow-lg min-w-[300px] max-w-[90vw]">
                <div className="flex items-center gap-3">
                  <ShoppingCart size={20} />
                  <div>
                    <div className="font-bold">{toastMessage}</div>
                    <div className="text-xs opacity-80">Producto agregado exitosamente</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowToast(false)}
                  className="btn btn-ghost btn-sm btn-square"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </PullToRefresh>
  );
}
