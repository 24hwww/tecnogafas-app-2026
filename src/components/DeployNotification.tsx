import { RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useApp } from "../AppContext";

export function DeployNotification() {
	const { deployEvent } = useApp();

	return (
		<AnimatePresence>
			{deployEvent && (
				<motion.div
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -20 }}
					className="fixed top-20 left-4 right-4 z-50 bg-primary/95 text-on-primary p-4 rounded-xl shadow-lg border border-primary-container flex items-center gap-4"
				>
					<RefreshCw className="animate-spin" size={24} />
					<div>
						<h4 className="font-bold text-sm">Nueva Versión Desplegada</h4>
						<p className="text-xs opacity-90">
							{deployEvent.content?.message ||
								"La aplicación ha sido actualizada."}
						</p>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
