import { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import { ShoppingCart, Plus, Minus, Search, X, ChevronRight, Check, Filter } from 'lucide-react';
import { motion } from 'motion/react';
import { Product, ProductVariation } from '../types';
import { formatCurrency } from '../lib/utils';
import { ProductSkeleton } from '../components/Skeleton';

export default function Products() {
  const { products, addToCart, cart, updateCartQuantity, isLoading } = useApp();
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
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
    const hasStock = p.stock > 0;
    const hasPrice = p.price > 0;
    return matchesFilters && matchesSearch && hasStock && hasPrice;
  });

  const nextLevel = activeFilters.length;
  
  const availableNextTerms = useMemo(() => {
    const terms = new Set<string>();
    products.forEach(p => {
      const pFiltros = productFiltrosMap.get(p.id) || [];
      const matchesActive = activeFilters.every((f, i) => pFiltros[i] === f);
      const hasStock = p.stock > 0;
      const hasPrice = p.price > 0;
      if (matchesActive && pFiltros[nextLevel] && hasStock && hasPrice) {
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
    const firstAvailable = product.variations?.find(v => v.stock > 0) || null;
    setSelectedVariation(firstAvailable);
    setVariationQuantity(firstAvailable ? 1 : 0);
  };

  const handleAddToCartWithVariation = () => {
    if (!variationModalProduct || !selectedVariation) return;
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
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Catálogo</h2>
        <button 
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
          {availableNextTerms.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase text-outline tracking-widest pl-1">Filtrar por {nextLevel === 0 ? 'Categoría' : 'Sub-Categoría'}</p>
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
                    <h4 className="font-semibold text-sm">{product.name}</h4>
                    <p className="text-[10px] text-primary font-bold">Stock: {product.stock}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-lg text-primary">{formatCurrency(product.price)}</span>
                    
                    {cartItem && !hasVariations ? (
                      <div className="flex items-center bg-primary-container px-1 py-0.5 border border-primary/20">
                        <button onClick={() => updateCartQuantity(product.id, cartItem.quantity - 1)} className="p-1.5 text-on-primary-container hover:bg-primary/10">
                          <Minus size={14} />
                        </button>
                        <span className="mx-2 font-black text-xs">{cartItem.quantity}</span>
                        <button onClick={() => updateCartQuantity(product.id, cartItem.quantity + 1)} className="p-1.5 text-on-primary-container hover:bg-primary/10">
                          <Plus size={14} />
                        </button>
                      </div>
                    ) : (
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          if (hasVariations) {
                            handleOpenVariationModal(product);
                          } else {
                            addToCart(product, 1);
                            triggerAddedAnimation(product.id);
                          }
                        }}
                        className={`m3-button-filled !px-4 !py-1.5 text-xs flex items-center gap-2 shadow-sm font-bold ${addedProductId === product.id ? '!bg-green-600' : ''}`}
                      >
                       {addedProductId === product.id ? <Check size={14} /> : <ShoppingCart size={14} />}
                        {addedProductId === product.id ? 'Agregado' : hasVariations ? 'Seleccionar...' : 'Agregar'}
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="m3-card bg-white w-full max-w-sm space-y-4">
            <h3 className="font-bold text-lg">{variationModalProduct.name}</h3>
            
            <div className="space-y-2">
              {variationModalProduct.variations?.map(v => (
                <button
                  key={v.vid}
                  disabled={v.stock === 0}
                  onClick={() => v.stock > 0 && setSelectedVariation(v)}
                  className={`w-full p-3 border text-left text-sm ${
                    v.stock === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  } ${selectedVariation?.vid === v.vid ? 'border-primary bg-primary/10' : 'border-surface-variant'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{v.title}</span>
                    {addedProductId === `${variationModalProduct.id}-${v.vid}` && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-green-600 bg-green-100 rounded-full p-0.5"
                      >
                        <Check size={14} />
                      </motion.div>
                    )}
                  </div>
                  <div className="text-base font-medium">Stock: {v.stock} | {formatCurrency(v.price)}</div>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <label className="text-sm font-bold">Cantidad:</label>
              <div className="flex items-center border border-surface-variant">
                <button 
                  onClick={() => setVariationQuantity(Math.max(1, variationQuantity - 1))}
                  className="p-2 hover:bg-surface-variant"
                >
                  <Minus size={16} />
                </button>
                <input 
                  type="number" 
                  min="1" 
                  max={selectedVariation?.stock || 0}
                  value={variationQuantity}
                  onChange={(e) => setVariationQuantity(Math.max(1, Math.min(parseInt(e.target.value) || 1, selectedVariation?.stock || 1)))}
                  className="w-16 p-2 text-center border-x border-surface-variant"
                />
                <button 
                  onClick={() => setVariationQuantity(Math.min(selectedVariation?.stock || 0, variationQuantity + 1))}
                  className="p-2 hover:bg-surface-variant"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setVariationModalProduct(null)} className="flex-1 m3-button-outlined">Cancelar</button>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  handleAddToCartWithVariation();
                }}
                disabled={!selectedVariation || variationQuantity > (selectedVariation?.stock || 0) || variationQuantity < 1}
                className="flex-1 m3-button-filled"
              >
                Agregar
              </motion.button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

