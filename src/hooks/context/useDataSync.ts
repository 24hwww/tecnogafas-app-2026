import { get, set } from "idb-keyval";
import { useCallback } from "react";
import { apiService } from "../../services/apiService";
import type { Client, Order, Product, Seller } from "../../types";

export function useDataSync(
	_globalPin: string | null,
	setProducts: (p: Product[]) => void,
	setClients: (c: Client[]) => void,
	setOrders: (o: Order[]) => void,
	setTotalOrders: (t: number) => void,
	setGrandTotalOrders: (t: number) => void,
	setDashboardOrders: (o: Order[]) => void,
	setSellers: (s: Seller[]) => void,
	_setAppVersionInfo: (v: any) => void,
	_setCurrentAppVersion: (v: string | null) => void,
	_setHasNewVersion: (h: boolean) => void,
	setIsLoading: (l: boolean) => void,
	setConnectionStatus?: (
		status: "online" | "offline" | "syncing" | "error",
	) => void,
) {
	const refreshData = useCallback(
		async (showLoading = true) => {
			if (showLoading) setIsLoading(true);
			setConnectionStatus?.("syncing");

			try {
				const [p, c, o, s] = await Promise.all([
					apiService.getProducts(),
					apiService.getClients(),
					apiService.getOrders(1, 25, undefined),
					apiService.getSellers(),
				]);

				// Sort orders by createdAt (post_date) descending - most recent first
				const sortedOrders = [...o.orders].sort(
					(a, b) =>
						new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
				);

				setProducts(p);
				setClients(c);
				setOrders(sortedOrders);
				setTotalOrders(o.total);
				setGrandTotalOrders(o.total);
				setDashboardOrders(sortedOrders.slice(0, 5));
				setSellers(s);

				// Save to IndexedDB cache
				try {
					await set("tecnogafas_products", p);
					await set("tecnogafas_clients", c);
					const cachedOrders = sortedOrders.map(
						({ rawData, ...rest }: any) => rest,
					);
					await set("tecnogafas_orders", cachedOrders);
					await set("tecnogafas_sellers", s);
				} catch (cacheError) {
					console.warn("Failed to save to local storage cache", cacheError);
				}

				setConnectionStatus?.("online");
			} catch (error) {
				console.error(
					"Failed to fetch data, using cached data if available",
					error,
				);
				setConnectionStatus?.("error");

				// Load from cache if API fails
				try {
					const cachedProducts = await get<Product[]>("tecnogafas_products");
					const cachedClients = await get<Client[]>("tecnogafas_clients");
					const cachedOrders = await get<Order[]>("tecnogafas_orders");
					const cachedSellers = await get<Seller[]>("tecnogafas_sellers");

					if (cachedProducts) setProducts(cachedProducts);
					if (cachedClients) setClients(cachedClients);
					if (cachedOrders) {
						setOrders(cachedOrders);
						setTotalOrders(cachedOrders.length);
						setGrandTotalOrders(cachedOrders.length);
						setDashboardOrders(cachedOrders.slice(0, 5));
					}
					if (cachedSellers) setSellers(cachedSellers);

					console.log("📦 Loaded data from cache after API error");
				} catch (cacheError) {
					console.error("Failed to load from cache", cacheError);
				}
			} finally {
				if (showLoading) setIsLoading(false);
			}
		},
		[
			setProducts,
			setClients,
			setOrders,
			setTotalOrders,
			setGrandTotalOrders,
			setDashboardOrders,
			setSellers,
			setIsLoading,
			setConnectionStatus,
		],
	);

	return { refreshData };
}
