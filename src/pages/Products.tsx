import { Check, ChevronRight, Filter, Minus, Plus, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useApp } from "../AppContext";
import { PullToRefresh } from "../components/PullToRefresh";
import { ProductSkeleton } from "../components/Skeleton";
import { formatCurrency } from "../lib/utils";
import type { Product, ProductVariation } from "../types";

export default function Products() {
	const {
		products,
		addToCart,
		cart,
		updateCartQuantity,
		isLoading,
		refreshData,
	} = useApp();
	const [activeFilters, setActiveFilters] = useState<string[]>([]);
	const [showFilters, setShowFilters] = useState(false);
	const [showZeroPrice, _setShowZeroPrice] = useState(true);
	const [search, setSearch] = useState("");
	const [variationModalProduct, setVariationModalProduct] =
		useState<Product | null>(null);
	const [selectedVariation, setSelectedVariation] =
		useState<ProductVariation | null>(null);
	const [variationQuantity, setVariationQuantity] = useState(1);
	const [addedProductId, setAddedProductId] = useState<string | null>(null);

	const triggerAddedAnimation = (id: string) => {
		setAddedProductId(id);
		setTimeout(() => setAddedProductId(null), 1000);
	};

	const parseFiltros = useCallback((filtros: string): string[] => {
		if (!filtros) return [];
		return filtros
			.split(";")
			.map((part) => {
				const match = part.match(/Termino:([^|]+)/);
				return match ? match[1] : "";
			})
			.filter((t) => t !== "");
	}, []);

	const productFiltrosMap = useMemo(() => {
		const map = new Map<string, string[]>();
		products.forEach((p) => {
			map.set(p.id, parseFiltros(p.description));
		});
		return map;
	}, [products, parseFiltros]);

	const filteredProducts = products.filter((p) => {
		const pFiltros = productFiltrosMap.get(p.id) || [];
		const matchesFilters = activeFilters.every((f, i) => pFiltros[i] === f);
		const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
		const matchesPrice = showZeroPrice || p.price > 0;
		return matchesFilters && matchesSearch && matchesPrice;
	});

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

	const handleAddFilter = (term: string) => {
		setActiveFilters([...activeFilters, term]);
	};

	const handleRemoveFilter = (index: number) => {
		setActiveFilters(activeFilters.slice(0, index));
	};

	const getInCart = (id: string) => cart.find((item) => item.id === id);

	const handleOpenVariationModal = (product: Product) => {
		setVariationModalProduct(product);
		const hasVariations = product.variations && product.variations.length > 0;
		if (hasVariations) {
			const firstAvailable =
				product.variations?.find((v) => v.stock > 0) ||
				product.variations?.[0] ||
				null;
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
				vid: selectedVariation.vid,
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
			<div className="space-y-6">
				<div className="flex items-center justify-between gap-4">
					<Input
						placeholder="Buscar productos..."
						className="h-12 bg-secondary rounded-xl border-none pl-10"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
					<Button
						variant={showFilters ? "secondary" : "outline"}
						size="icon"
						className="shrink-0 h-12 w-12 rounded-xl"
						onClick={() => setShowFilters(!showFilters)}
					>
						<Filter size={20} />
					</Button>
				</div>

				{showFilters && (
					<div className="space-y-4 p-4 bg-secondary rounded-2xl animate-in slide-in-from-top-2">
						<div className="flex flex-wrap items-center gap-2">
							<Button
								size="sm"
								variant={activeFilters.length === 0 ? "default" : "outline"}
								className="rounded-full text-xs"
								onClick={() => setActiveFilters([])}
							>
								Todos
							</Button>
							{activeFilters.map((f, i) => (
								<div key={`filter-${f}-${i}`} className="flex items-center gap-1">
									<ChevronRight size={14} className="text-muted-foreground" />
									<Button
										size="sm"
										className="rounded-full text-xs"
										onClick={() => handleRemoveFilter(i)}
									>
										{f} <X size={12} className="ml-1" />
									</Button>
								</div>
							))}
						</div>

						{availableNextTerms.length > 0 && (
							<div className="flex gap-2 overflow-x-auto pb-2">
								{availableNextTerms.map((term) => (
									<Button
										key={term}
										size="sm"
										variant="outline"
										className="rounded-xl"
										onClick={() => handleAddFilter(term)}
									>
										{term}
									</Button>
								))}
							</div>
						)}
					</div>
				)}

				<div className="space-y-3">
					{isLoading ? (
						Array(6)
							.fill(0)
							.map((_, i) => <ProductSkeleton key={`product-skeleton-${i}`} />)
					) : filteredProducts.length === 0 ? (
						<div className="text-center py-20 text-muted-foreground">
							No hay productos
						</div>
					) : (
						filteredProducts.map((product) => {
							const cartItem = getInCart(product.id);
							const hasVariations =
								product.variations && product.variations.length > 0;
							const isAdded =
								addedProductId === product.id ||
								addedProductId?.startsWith(`${product.id}-`);
							return (
								<Card
									key={product.id}
									className={cn(
										"card-premium p-4 flex gap-4 transition-all",
										isAdded && "ring-2 ring-primary",
									)}
								>
									<div className="flex-1 flex flex-col justify-between">
										<div>
											<h4 className="font-semibold text-sm text-foreground">
												{product.name}
											</h4>
											<div className="flex items-center gap-2 mt-1">
												<Badge variant="outline" className="text-[10px]">
													{product.stock} en stock
												</Badge>
												<span className="font-bold text-lg">
													{formatCurrency(product.price)}
												</span>
											</div>
										</div>
										<div className="mt-4">
											{cartItem && !hasVariations ? (
												<div className="flex items-center border rounded-xl overflow-hidden">
													<Button
														variant="ghost"
														size="icon"
														className="h-9 w-9"
														onClick={() =>
															updateCartQuantity(
																product.id,
																cartItem.quantity - 1,
															)
														}
													>
														<Minus size={16} />
													</Button>
													<span className="font-bold text-sm w-8 text-center">
														{cartItem.quantity}
													</span>
													<Button
														variant="ghost"
														size="icon"
														className="h-9 w-9"
														onClick={() =>
															updateCartQuantity(
																product.id,
																cartItem.quantity + 1,
															)
														}
													>
														<Plus size={16} />
													</Button>
												</div>
											) : (
												<Button
													className="w-full h-9 rounded-xl font-bold"
													onClick={() => handleOpenVariationModal(product)}
												>
													{isAdded ? (
														<>
															<Check size={16} className="mr-2" /> Agregado
														</>
													) : (
														"Agregar"
													)}
												</Button>
											)}
										</div>
									</div>
								</Card>
							);
						})
					)}
				</div>

				<Dialog
					open={!!variationModalProduct}
					onOpenChange={() => setVariationModalProduct(null)}
				>
					<DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden">
						<div className="p-4 border-b">
							<h3 className="font-bold text-lg">
								{variationModalProduct?.name}
							</h3>
						</div>
						<div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
							{variationModalProduct?.variations?.map((v) => (
								<button
									type="button"
									key={v.vid}
									disabled={v.stock === 0}
									onClick={() => setSelectedVariation(v)}
									className={cn(
										"w-full p-4 border rounded-2xl text-left transition-all",
										selectedVariation?.vid === v.vid &&
											"border-primary bg-primary/5",
									)}
								>
									<p className="font-semibold">{v.title}</p>
									<p className="text-sm font-bold text-primary">
										{formatCurrency(v.price)}
									</p>
								</button>
							))}
						</div>
						<div className="p-4 border-t">
							<Button
								className="w-full h-12 rounded-xl font-bold"
								onClick={handleAddToCartFromModal}
							>
								Confirmar Selección
							</Button>
						</div>
					</DialogContent>
				</Dialog>
			</div>
		</PullToRefresh>
	);
}
