import { RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useApp } from "../AppContext";
import { Sidebar } from "./Sidebar";

export function Layout({ children }: { children: ReactNode }) {
	const { isLoading, apiError } = useApp();

	return (
		<div className="flex min-h-screen bg-background">
			{/* Loading Overlay */}
			<AnimatePresence>
				{isLoading && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 bg-background/80 z-[100] flex flex-col items-center justify-center backdrop-blur-md"
					>
						<div className="relative">
							<RefreshCw className="w-12 h-12 text-primary animate-spin mb-4" />
							<div className="absolute inset-0 w-12 h-12 bg-primary/20 rounded-full animate-ping" />
						</div>
						<p className="text-sm font-bold text-primary animate-pulse tracking-widest uppercase">
							Sincronizando...
						</p>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Sidebar */}
			<Sidebar />

			{/* Main Content */}
			<main className="flex-1 overflow-y-auto pt-20 pb-20">
				<div className="px-4 pb-safe-area">
					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.3 }}
					>
						{apiError && (
							<div className="bg-destructive/10 text-destructive text-xs font-semibold py-2 px-3 rounded-xl mb-4 text-center">
								{apiError}
							</div>
						)}
						{children}
					</motion.div>
				</div>
			</main>
		</div>
	);
}
