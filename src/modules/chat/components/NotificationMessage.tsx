// ============================================================================
// NOTIFICATION MESSAGE - Mensaje de notificación tipo WhatsApp
// Soporta: Pedidos, Alertas, Sistema - con reacciones
// ============================================================================

import {
	AlertTriangle,
	Bell,
	CheckCircle,
	Clock,
	ExternalLink,
	Info,
	Package,
	Settings,
	Truck,
	XCircle,
} from "lucide-react";
import type React from "react";
import { useReactions } from "../hooks/useReactions";
import { formatDistanceToNow } from "../lib/dateUtils";
import { useChat } from "../providers/ChatProvider";
import type { MessageWithAuthor } from "../types";

interface NotificationMessageProps {
	message: MessageWithAuthor;
}

const QUICK_REACTIONS = ["✅", "👀", "❤️", "👍", "🔥"];

const TYPE_ICONS: Record<string, React.ReactNode> = {
	order: <Package className="w-5 h-5 text-blue-500" />,
	alert: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
	system: <Bell className="w-5 h-5 text-gray-500" />,
	notification: <Info className="w-5 h-5 text-blue-400" />,
};

const TYPE_COLORS: Record<string, string> = {
	order: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
	alert:
		"bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
	system: "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700",
	notification:
		"bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
	pending: <Clock className="w-4 h-4" />,
	processing: <Settings className="w-4 h-4" />,
	shipped: <Truck className="w-4 h-4" />,
	completed: <CheckCircle className="w-4 h-4" />,
	cancelled: <XCircle className="w-4 h-4" />,
};

const STATUS_COLORS: Record<string, string> = {
	pending: "bg-yellow-100 text-yellow-700",
	processing: "bg-blue-100 text-blue-700",
	shipped: "bg-purple-100 text-purple-700",
	completed: "bg-green-100 text-green-700",
	cancelled: "bg-red-100 text-red-700",
};

export function NotificationMessage({ message }: NotificationMessageProps) {
	const { currentUser } = useChat();
	const { reactions, toggleReaction } = useReactions({
		messageId: message.id,
		currentUserId: currentUser?.id || null,
	});

	const metadata = message.metadata || {};
	const actionUrl = metadata.action_url as string | undefined;
	const actionLabel = metadata.action_label as string | undefined;
	const priority = metadata.priority as string | undefined;

	// Determinar tipo visual
	const displayType =
		message.type === "order"
			? "order"
			: message.type === "alert"
				? "alert"
				: message.type === "notification"
					? "notification"
					: "system";

	const handleReaction = (emoji: string) => {
		toggleReaction(emoji);
	};

	return (
		<div
			className={`flex flex-col gap-2 group max-w-md ${priority === "urgent" ? "animate-pulse" : ""}`}
		>
			{/* Timestamp separator (if needed) */}
			<div className="flex justify-center">
				<span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
					{formatDistanceToNow(message.created_at)}
				</span>
			</div>

			{/* Message Card */}
			<div
				className={`flex gap-3 p-4 rounded-xl border ${TYPE_COLORS[displayType]} ${priority === "urgent" ? "ring-2 ring-red-400" : ""}`}
			>
				{/* Icon */}
				<div className="flex-shrink-0">
					{displayType === "order" && message.order_data?.status ? (
						<div
							className={`w-10 h-10 rounded-full flex items-center justify-center ${STATUS_COLORS[message.order_data.status as string] || STATUS_COLORS.pending}`}
						>
							{STATUS_ICONS[message.order_data.status as string] || (
								<Package className="w-5 h-5" />
							)}
						</div>
					) : (
						<div className="w-10 h-10 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center shadow-sm">
							{TYPE_ICONS[displayType] || TYPE_ICONS.system}
						</div>
					)}
				</div>

				{/* Content */}
				<div className="flex-1 min-w-0">
					{/* Title */}
					<h4 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">
						{message.content.split(":")[0]}
					</h4>

					{/* Body */}
					<p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
						{message.content.split(":").slice(1).join(":").trim()}
					</p>

					{/* Order-specific details */}
					{message.order_data && (
						<div className="mt-3 p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg">
							<div className="flex items-center justify-between text-sm">
								<span className="text-gray-500">Total:</span>
								<span className="font-semibold text-gray-900 dark:text-white">
									${message.order_data.total}
								</span>
							</div>
							{message.order_data.customer_name && (
								<div className="flex items-center justify-between text-sm mt-1">
									<span className="text-gray-500">Cliente:</span>
									<span className="text-gray-700 dark:text-gray-300">
										{message.order_data.customer_name}
									</span>
								</div>
							)}
							{message.order_data.items_count && (
								<div className="flex items-center justify-between text-sm mt-1">
									<span className="text-gray-500">Items:</span>
									<span className="text-gray-700 dark:text-gray-300">
										{message.order_data.items_count}
									</span>
								</div>
							)}
						</div>
					)}

					{/* Alert-specific details */}
					{message.alert_data && (
						<div className="mt-2">
							<span
								className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
									message.alert_data.level === "error"
										? "bg-red-100 text-red-700"
										: message.alert_data.level === "warning"
											? "bg-yellow-100 text-yellow-700"
											: message.alert_data.level === "success"
												? "bg-green-100 text-green-700"
												: "bg-blue-100 text-blue-700"
								}`}
							>
								{message.alert_data.level?.toUpperCase()}
							</span>
						</div>
					)}

					{/* Action Button */}
					{actionUrl && (
						<a
							href={actionUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1 mt-3 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors"
						>
							{actionLabel || "Ver más"}
							<ExternalLink className="w-3 h-3" />
						</a>
					)}
				</div>
			</div>

			{/* Reactions Bar (WhatsApp style) */}
			<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
				{/* Existing reactions */}
				{reactions.length > 0 && (
					<div className="flex gap-1 mr-2">
						{reactions.map((reaction) => (
							<button
								key={reaction.emoji}
								onClick={() => handleReaction(reaction.emoji)}
								className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-colors ${
									reaction.me
										? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700"
										: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
								}`}
							>
								<span>{reaction.emoji}</span>
								<span className="text-xs font-medium">{reaction.count}</span>
							</button>
						))}
					</div>
				)}

				{/* Quick reaction buttons */}
				<div className="flex gap-0.5">
					{QUICK_REACTIONS.map((emoji) => (
						<button
							key={emoji}
							onClick={() => handleReaction(emoji)}
							className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-lg transition-colors"
							title="Reaccionar"
						>
							{emoji}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
