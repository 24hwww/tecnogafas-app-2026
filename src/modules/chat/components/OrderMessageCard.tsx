// ============================================================================
// ORDER MESSAGE CARD - Card visual para mensajes tipo pedido
// ============================================================================

import {
	CheckCircle,
	Clock,
	ExternalLink,
	Package,
	Settings,
	Truck,
	XCircle,
} from "lucide-react";
import type React from "react";
import type { MessageWithAuthor } from "../types";

interface OrderMessageCardProps {
	message: MessageWithAuthor;
}

const STATUS_CONFIG: Record<
	string,
	{ icon: React.ReactNode; color: string; label: string }
> = {
	pending: {
		icon: <Clock className="w-4 h-4" />,
		color: "bg-yellow-100 text-yellow-700 border-yellow-200",
		label: "Pendiente",
	},
	processing: {
		icon: <Settings className="w-4 h-4" />,
		color: "bg-blue-100 text-blue-700 border-blue-200",
		label: "Procesando",
	},
	shipped: {
		icon: <Truck className="w-4 h-4" />,
		color: "bg-purple-100 text-purple-700 border-purple-200",
		label: "Enviado",
	},
	completed: {
		icon: <CheckCircle className="w-4 h-4" />,
		color: "bg-green-100 text-green-700 border-green-200",
		label: "Completado",
	},
	cancelled: {
		icon: <XCircle className="w-4 h-4" />,
		color: "bg-red-100 text-red-700 border-red-200",
		label: "Cancelado",
	},
};

export function OrderMessageCard({ message }: OrderMessageCardProps) {
	const orderData = message.order_data;

	if (!orderData) {
		return (
			<div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
				<p className="text-sm text-gray-500">
					Información de pedido no disponible
				</p>
			</div>
		);
	}

	const {
		order_number,
		total,
		status = "pending",
		customer_name,
		items_count,
		url,
	} = orderData;

	const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

	return (
		<div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden max-w-sm">
			{/* Header */}
			<div className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
				<div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
					<Package className="w-5 h-5" />
				</div>
				<div className="flex-1 min-w-0">
					<h4 className="font-medium text-gray-900 dark:text-white text-sm">
						Pedido #{order_number}
					</h4>
					<p className="text-xs text-gray-500 dark:text-gray-400">
						{customer_name || "Cliente"}
					</p>
				</div>
				<span
					className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}
				>
					{statusConfig.icon}
					{statusConfig.label}
				</span>
			</div>

			{/* Body */}
			<div className="p-3 space-y-2">
				{/* Total */}
				<div className="flex items-center justify-between">
					<span className="text-sm text-gray-500 dark:text-gray-400">
						Total:
					</span>
					<span className="font-semibold text-gray-900 dark:text-white">
						${typeof total === "number" ? total.toFixed(2) : total}
					</span>
				</div>

				{/* Items count */}
				{items_count && (
					<div className="flex items-center justify-between">
						<span className="text-sm text-gray-500 dark:text-gray-400">
							Productos:
						</span>
						<span className="text-sm text-gray-700 dark:text-gray-300">
							{items_count} {items_count === 1 ? "item" : "items"}
						</span>
					</div>
				)}

				{/* Action Button */}
				{url && (
					<a
						href={url}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center justify-center gap-2 w-full mt-3 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
					>
						<ExternalLink className="w-4 h-4" />
						Ver detalles del pedido
					</a>
				)}
			</div>
		</div>
	);
}
