import { del } from "idb-keyval";
import { useCallback } from "react";

export function useCacheManager(
	refreshData: (showLoading?: boolean) => Promise<void>,
) {
	const forceRefresh = useCallback(
		async (setIsLoading: (l: boolean) => void) => {
			setIsLoading(true);
			try {
				const keysToClear = [
					"tecnogafas_products",
					"tecnogafas_clients",
					"tecnogafas_orders",
					"tecnogafas_sellers",
				];
				await Promise.all(keysToClear.map((key) => del(key)));
				await refreshData(false);
				if ("serviceWorker" in navigator) {
					const registrations =
						await navigator.serviceWorker.getRegistrations();
					for (const registration of registrations) {
						registration.update();
					}
				}
			} catch (error) {
				console.error("Force refresh failed", error);
			} finally {
				setIsLoading(false);
			}
		},
		[refreshData],
	);

	const clearAllCaches = useCallback(async () => {
		try {
			// 1. Limpiar IndexedDB (idb-keyval)
			const keysToClear = [
				"tecnogafas_products",
				"tecnogafas_clients",
				"tecnogafas_orders",
				"tecnogafas_sellers",
				"tecnogafas_drafts",
			];
			await Promise.all(keysToClear.map((key) => del(key)));

			// 2. Limpiar TODO el localStorage de la app
			localStorage.clear();

			// 3. Limpiar sessionStorage
			sessionStorage.clear();

			// 4. Limpiar cachés del service worker
			if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
				navigator.serviceWorker.controller.postMessage({
					type: "CLEAR_ALL_CACHES",
				});
			}

			// 5. Limpiar todas las bases de datos de IndexedDB
			await indexedDB.deleteDatabase("tecnogafas-sync");
			await indexedDB.deleteDatabase("keyval-store"); // idb-keyval default store

			// 6. Limpiar Cache API del navegador
			if ("caches" in window) {
				const cacheNames = await caches.keys();
				await Promise.all(cacheNames.map((name) => caches.delete(name)));
			}

			// 7. Unregister service workers
			if ("serviceWorker" in navigator) {
				const registrations = await navigator.serviceWorker.getRegistrations();
				await Promise.all(registrations.map((reg) => reg.unregister()));
			}

			window.location.reload();
		} catch (error) {
			console.error("Error clearing caches:", error);
		}
	}, []);

	return { forceRefresh, clearAllCaches };
}
