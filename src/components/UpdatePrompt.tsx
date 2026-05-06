import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useApp } from "../AppContext";

export function UpdatePrompt() {
	const {
		offlineReady: [offlineReady, setOfflineReady],
		needRefresh: [needRefresh, setNeedRefresh],
		updateServiceWorker,
	} = useRegisterSW({
		onRegistered(r) {
			// biome-ignore lint: Service Worker registration
			if (typeof console !== "undefined") {
				console.log("SW Registered: ", r);
			}
			// Opcionalmente podemos verificar por actualizaciones cada X tiempo (e.g. 1 min)
			if (r) {
				setInterval(() => {
					r.update();
				}, 60 * 1000);
			}
		},
		onRegisterError(error) {
			// biome-ignore lint: Service Worker registration error
			if (typeof console !== "undefined") {
				console.error("SW registration error", error);
			}
		},
	});

	const { hasNewVersion, currentAppVersion, clearAllCaches } = useApp();

	const close = () => {
		setOfflineReady(false);
		setNeedRefresh(false);
	};

	const handleClearCaches = async () => {
		await clearAllCaches();
	};

	return (
		<AnimatePresence>
			{(needRefresh || offlineReady || hasNewVersion) && (
				<motion.div
					initial={{ opacity: 0, y: 50, scale: 0.9 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, scale: 0.9, y: 20 }}
					className="fixed bottom-20 left-4 right-4 z-50 flex items-center justify-center pointer-events-none"
				>
					<div className="bg-surface m3-card border border-primary/20 shadow-2xl p-4 flex flex-col gap-3 pointer-events-auto max-w-sm w-full">
						<div className="flex items-start justify-between">
							<div>
								<h4 id="update-prompt-title" className="font-bold text-sm">
									{hasNewVersion
										? "¡Nueva versión disponible!"
										: needRefresh
											? "¡Nueva actualización!"
											: "App lista"}
								</h4>
								<p className="text-xs text-on-surface-variant mt-1">
									{hasNewVersion
										? `Hay una nueva versión (${currentAppVersion}) disponible. Se recomienda limpiar el cache para ver los cambios.`
										: needRefresh
											? "Hay una nueva versión de la app disponible."
											: "La aplicación está lista para funcionar sin conexión."}
								</p>
							</div>
							<button
								id="update-prompt-close-btn"
								onClick={close}
								className="p-1 hover:bg-surface-variant rounded-full text-outline"
							>
								<X size={16} />
							</button>
						</div>

						{needRefresh && (
							<button
								id="update-prompt-update-btn"
								onClick={() => updateServiceWorker(true)}
								className="m3-button-filled w-full font-bold text-xs py-2.5 flex items-center justify-center gap-2"
							>
								<RefreshCw size={14} className="animate-spin" />
								Actualizar ahora
							</button>
						)}

						{hasNewVersion && (
							<button
								id="update-prompt-clear-btn"
								onClick={handleClearCaches}
								className="w-full font-bold text-xs py-2.5 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
							>
								<Trash2 size={14} />
								Limpiar Cache y Recargar
							</button>
						)}
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
