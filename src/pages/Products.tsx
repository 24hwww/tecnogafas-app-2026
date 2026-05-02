import { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import { ShoppingCart, Plus, Minus, Search, X, ChevronRight, Check, Filter } from 'lucide-react';
import { motion } from 'motion/react';
import { Product, ProductVariation } from '../types';
import { formatCurrency } from '../lib/utils';
import { ProductSkeleton } from '../components/Skeleton';
import { PullToRefresh } from '../components/PullToRefresh';

export default function Products() {
  const { products, addToCart, cart, updateCartQuantity, isLoading, refreshData } = useApp();
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showZeroPrice, setShowZeroPrice] = useState(true);
  const [search, setSearch] = useState('');
  const [variationModalProduct, setVariationModalProduct] = useState<Product | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [variationQuantity, setVariationQuantity] = useState(1);
  const [addedProductId, setAddedProductId] = useState<string | null>(null);

  const triggerAddedAnimation = (id: string) => {
    setAddedProductId(id);
    setTimeout(() => setAddedProductId(null), 1000);
  };

  // Helper to parse "Termino:Anteojos|Slug:anteojos;Termino:Receta|Slug:receta"
  const parseFiltros = (filtros: string): string[] => {
    if (!filtros) return [];
    return filtros.split(';').map(part => {
      const match = part.match(/Termino:([^|]+)/);
      return match ? match[1] : '';
    }).filter(t => t !== '');
  };

  const productFiltrosMap = useMemo(() => {
    const map = new Map<string, string[]>();
    products.forEach(p => {
      map.set(p.id, parseFiltros(p.description));
    });
    return map;
  }, [products]);

  const filteredProducts = products.filter(p => {
    const pFiltros = productFiltrosMap.get(p.id) || [];
    const matchesFilters = activeFilters.every((f, i) => pFiltros[i] === f);
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesPrice = showZeroPrice || p.price > 0;
    return matchesFilters && matchesSearch && matchesPrice;
  });

  const nextLevel = activeFilters.length;
  
  const availableNextTerms = useMemo(() => {
    const terms = new Set<string>();
    products.forEach(p => {
      const pFiltros = productFiltrosMap.get(p.id) || [];
      const matchesActive = activeFilters.every((f, i) => pFiltros[i] === f);
      if (matchesActive && pFiltros[nextLevel]) {
        terms.add(pFiltros[nextLevel]);
      }
    });
    return Array.from(terms);
  }, [products, activeFilters, nextLevel, productFiltrosMap]);

  const handleAddFilter = (term: string) => {
    setActiveFilters([...activeFilters, term]);
  };

  const handleRemoveFilter = (index: number) => {
    setActiveFilters(activeFilters.slice(0, index));
  };

  const getInCart = (id: string) => cart.find(item => item.id === id);

  const handleOpenVariationModal = (product: Product) => {
    setVariationModalProduct(product);
    const hasVariations = product.variations && product.variations.length > 0;
    if (hasVariations) {
      const firstAvailable = product.variations?.find(v => v.stock > 0) || product.variations?.[0] || null;
      setSelectedVariation(firstAvailable);
      setVariationQuantity(1);
    } else {
      setSelectedVariation(null);
      setVariationQuantity(1);
    }
  };

  const handleAddToCartFromModal = () => {
    if (!variationModalProduct) return;
    
    if (selectedVariation) {
      const productToAdd = {
        ...variationModalProduct,
        id: `${variationModalProduct.id}-${selectedVariation.vid}`,
        name: `${variationModalProduct.name} - ${selectedVariation.title}`,
        price: selectedVariation.price,
        stock: selectedVariation.stock,
        vid: selectedVariation.vid
      };
      addToCart(productToAdd, variationQuantity);
      triggerAddedAnimation(productToAdd.id);
    } else {
      addToCart(variationModalProduct, variationQuantity);
      triggerAddedAnimation(variationModalProduct.id);
    }
    setVariationModalProduct(null);
  };

  return (
    <PullToRefresh onRefresh={() => refreshData(false)}>
      <div className="space-y-4 min-h-[50vh]">
        <div className="flex items-center justify-between">
          <h2 id="products-title" className="text-2xl font-bold">Productos</h2>
          <button 
            id="products-filters-btn"
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 hover:bg-surface-variant transition-all ${showFilters ? 'text-primary bg-primary/10' : 'text-outline'}`}
            title="Filtros por categoría"
          >
            <Filter size={24} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" size={20} />
          <input 
            id="products-search-input"
            type="text" 
            placeholder="Buscar productos..." 
            className="w-full bg-surface-variant py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {showFilters && (
          <div className="space-y-2 pb-2">
            {/* Hierarchical Breadcrumbs */}
            <div className="flex flex-wrap items-center gap-2 p-1">
              <button
                onClick={() => setActiveFilters([])}
                className={`px-3 py-1 text-xs font-bold transition-all ${
                  activeFilters.length === 0 ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-variant text-on-surface-variant'
                }`}
              >
                Todos
              </button>
              {activeFilters.map((f, i) => (
                <div key={i} className="flex items-center gap-1 animate-in slide-in-from-left-2 fade-in">
                  <ChevronRight size={14} className="text-outline" />
                  <div className="flex items-center bg-primary-container text-on-primary-container px-3 py-1 text-xs font-bold gap-1 shadow-sm">
                    {f}
                    <button 
                      onClick={() => handleRemoveFilter(i)}
                      className="hover:bg-primary/10 p-0.5"
                    >
                      <X size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Sequential Filter Options */}
            <div className="flex items-center gap-2 mb-4 p-2 bg-surface-variant/50">
               <input 
                 type="checkbox" 
                 id="showZeroPrice" 
                 checked={showZeroPrice} 
                 onChange={(e) => setShowZeroPrice(e.target.checked)}
                 className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
               />
               <label htmlFor="showZeroPrice" className="text-xs font-bold text-on-surface-variant uppercase">Mostrar productos precio 0</label>
             </div>
            {availableNextTerms.length > 0 && (
              <div className="space-y-2">
                <p className="text-[0.625rem] font-black uppercase text-outline tracking-widest pl-1">Filtrar por {nextLevel === 0 ? 'Categoría' : 'Sub-Categoría'}</p>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                  {availableNextTerms.map(term => (
                    <button
                      key={term}
                      onClick={() => handleAddFilter(term)}
                      className="px-4 py-2 bg-surface-variant border border-white/5 text-primary text-xs font-bold whitespace-nowrap shadow-sm hover:bg-primary/5 active:scale-95 transition-all"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Product List */}
        <div className="space-y-3">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => <ProductSkeleton key={i} />)
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-10 opacity-50 space-y-2">
               <div className="flex justify-center"><Search size={48} /></div>
               <p className="text-sm font-medium">No se encontraron productos</p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const cartItem = getInCart(product.id);
              const hasVariations = product.variations && product.variations.length > 0;
              return (
                <div key={product.id} className="m3-card flex gap-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-semibold text-sm leading-tight mb-1">{product.name}</h4>
                      <div className="flex flex-col gap-0.5 mb-2">
                        <span className="text-[0.625rem] text-yellow-500 font-bold">Stock: {product.stock}</span>
                        <span className="font-bold text-lg text-black">{formatCurrency(product.price)}</span>
                      </div>
                    </div>
                    <div className="mt-1">
                      {cartItem && !hasVariations ? (
                        <div className="flex items-center justify-center bg-primary-container px-1 py-1 border border-primary/20 w-full">
                          <button id={`products-decrease-qty-${product.id}`} onClick={() => updateCartQuantity(product.id, cartItem.quantity - 1)} className="p-1.5 text-on-primary-container hover:bg-primary/10 flex-1 flex justify-center">
                            <Minus size={14} />
                          </button>
                          <span className="mx-4 font-black text-sm">{cartItem.quantity}</span>
                          <button id={`products-increase-qty-${product.id}`} onClick={() => updateCartQuantity(product.id, cartItem.quantity + 1)} className="p-1.5 text-on-primary-container hover:bg-primary/10 flex-1 flex justify-center">
                            <Plus size={14} />
                          </button>
                        </div>
                      ) : (
                        <motion.button 
                          id={`products-add-btn-${product.id}`}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleOpenVariationModal(product)}
                          className={`m3-button-filled w-full !py-2 text-xs flex items-center justify-center gap-2 font-bold ${addedProductId === product.id ? '!bg-green-600' : ''}`}
                        >
                         {addedProductId === product.id ? <Check size={14} /> : <ShoppingCart size={14} />}
                          {addedProductId === product.id ? 'Agregado' : (hasVariations ? 'Seleccionar...' : 'Agregar')}
                        </motion.button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* Variation Modal */}
        {variationModalProduct && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="m3-card bg-white w-full max-w-sm flex flex-col max-h-[90vh] shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="p-4 border-b border-surface-variant flex justify-between items-center">
                <h3 id="products-variation-modal-title" className="font-black text-lg">{variationModalProduct.name}</h3>
                <button onClick={() => setVariationModalProduct(null)} className="p-1 hover:bg-surface-variant rounded-full text-outline">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-4 flex-1 overflow-y-auto space-y-4 scroll-smooth">
                <div className="space-y-2">
                  {variationModalProduct.variations && variationModalProduct.variations.length > 0 ? (
                    variationModalProduct.variations.map(v => (
                      <button
                        key={v.vid}
                        disabled={v.stock === 0}
                        onClick={() => setSelectedVariation(v)}
                        className={`w-full p-4 border text-left rounded-xl transition-all ${
                          v.stock === 0 ? 'opacity-40 grayscale cursor-not-allowed border-dashed' : 
                          selectedVariation?.vid === v.vid ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-surface-variant hover:border-outline/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`${v.stock === 0 ? 'text-outline' : 'font-bold'} text-sm`}>{v.title}</span>
                            {v.stock === 0 && <span className="text-[10px] bg-outline/10 px-1.5 py-0.5 rounded uppercase font-black text-outline">Sin Stock</span>}
                          </div>
                          {addedProductId === `${variationModalProduct.id}-${v.vid}` && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-green-600">
                              <Check size={16} />
                            </motion.div>
                          )}
                        </div>
                        <div className="flex justify-between items-baseline mt-1">
                          <span className="text-xs text-outline font-medium">Stock: {v.stock}</span>
                          <span className={`text-base font-black ${v.stock === 0 ? 'text-outline/40' : 'text-primary'}`}>{formatCurrency(v.price)}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className={`p-6 border rounded-2xl text-center ${variationModalProduct.stock === 0 ? 'bg-outline/5 border-dashed border-outline/20' : 'bg-primary/5 border-primary/10'}`}>
                      <p className={`text-sm font-bold ${variationModalProduct.stock === 0 ? 'text-outline' : 'text-primary'}`}>
                        {variationModalProduct.stock === 0 ? 'Producto Agotado' : 'Producto base'}
                      </p>
                      <p className={`text-sm font-black mt-1 ${variationModalProduct.stock === 0 ? 'text-outline/40' : 'text-primary-900'}`}>{formatCurrency(variationModalProduct.price)}</p>
                      <p className="text-xs text-outline mt-1 font-medium">Stock disponible: {variationModalProduct.stock}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-surface-variant/20 border-t border-surface-variant space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-outline uppercase tracking-wider">Cantidad</span>
                  <div className="flex items-center bg-white border border-outline/20 rounded-full overflow-hidden shadow-sm">
                    <button 
                      disabled={(selectedVariation ? selectedVariation.stock === 0 : variationModalProduct.stock === 0)}
                      onClick={() => setVariationQuantity(Math.max(1, variationQuantity - 1))}
                      className="p-2 px-3 hover:bg-primary/5 text-primary active:bg-primary/10 transition-colors disabled:opacity-30"
                    >
                      <Minus size={18} />
                    </button>
                    <input 
                      type="number" 
                      min="1" 
                      disabled={(selectedVariation ? selectedVariation.stock === 0 : variationModalProduct.stock === 0)}
                      value={variationQuantity}
                      onChange={(e) => setVariationQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-12 text-center bg-transparent focus:outline-none font-black text-primary disabled:text-outline/40"
                    />
                    <button 
                      disabled={(selectedVariation ? selectedVariation.stock === 0 : variationModalProduct.stock === 0)}
                      onClick={() => setVariationQuantity(variationQuantity + 1)}
                      className="p-2 px-3 hover:bg-primary/5 text-primary active:bg-primary/10 transition-colors disabled:opacity-30"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    id="products-variation-modal-cancel-btn"
                    onClick={() => setVariationModalProduct(null)} 
                    className="flex-1 py-3 text-sm font-bold text-outline hover:bg-surface-variant rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <motion.button 
                    id="products-variation-modal-confirm-btn"
                    whileHover={!(selectedVariation ? selectedVariation.stock === 0 : variationModalProduct.stock === 0) ? { scale: 1.02 } : {}}
                    whileTap={!(selectedVariation ? selectedVariation.stock === 0 : variationModalProduct.stock === 0) ? { scale: 0.98 } : {}}
                    onClick={handleAddToCartFromModal}
                    disabled={variationQuantity < 1 || (selectedVariation ? selectedVariation.stock === 0 : variationModalProduct.stock === 0)}
                    className="flex-[2] py-3 bg-primary text-on-primary rounded-xl font-black text-sm shadow-lg shadow-primary/20 disabled:bg-outline/20 disabled:text-outline disabled:shadow-none disabled:cursor-not-allowed"
                  >
                    { (selectedVariation ? selectedVariation.stock === 0 : variationModalProduct.stock === 0) ? 'Sin Stock' : 'Confirmar Selección' }
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}

