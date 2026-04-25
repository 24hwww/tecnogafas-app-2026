import { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import { ShoppingCart, Plus, Minus, Search, X, ChevronRight } from 'lucide-react';
import { Product } from '../types';
import { formatCurrency } from '../lib/utils';

export default function Products() {
  const { products, addToCart, cart, updateCartQuantity } = useApp();
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [search, setSearch] = useState('');

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Catálogo</h2>
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

      {/* Product List */}
      <div className="space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-10 opacity-50 space-y-2">
             <div className="flex justify-center"><Search size={48} /></div>
             <p className="text-sm font-medium">No se encontraron productos</p>
          </div>
        ) : (
          filteredProducts.map((product) => {
            const cartItem = getInCart(product.id);
            return (
              <div key={product.id} className="m3-card flex gap-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-semibold text-sm">{product.name}</h4>
                    <p className="text-[10px] text-primary font-bold">Stock: {product.stock}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-lg text-primary">{formatCurrency(product.price)}</span>
                    
                    {cartItem ? (
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
                      <button 
                        onClick={() => addToCart(product, 1)}
                        className="m3-button-filled !px-4 !py-1.5 text-xs flex items-center gap-2 shadow-sm font-bold"
                      >
                        <ShoppingCart size={14} />
                        Agregar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

