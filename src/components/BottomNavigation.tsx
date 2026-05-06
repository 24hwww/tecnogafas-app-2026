import {
	ClipboardList,
	House,
	MessageCircle,
	Package,
	Settings,
	ShoppingCart,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useApp } from "../AppContext";
import { cn } from "../lib/utils";

const navItems = [
	{ path: "/", label: "Inicio", icon: House },
	{ path: "/productos", label: "Productos", icon: Package },
	{ path: "/pedidos", label: "Pedidos", icon: ClipboardList },
	{ path: "/chat", label: "Chat", icon: MessageCircle },
	{ path: "/carrito", label: "Carrito", icon: ShoppingCart },
	{ path: "/configuracion", label: "Config", icon: Settings },
];

export function BottomNavigation() {
	const location = useLocation();
	const { unreadNotifications, cart } = useApp();

	const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);

	return (
		<nav className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-xl border-t border-border/50 pb-safe-area z-50">
			<div className="flex items-center justify-around h-16">
				{navItems.map((item) => {
					const isActive = location.pathname === item.path;
					return (
						<NavLink
							key={item.path}
							to={item.path}
							className={cn(
								"flex flex-col items-center justify-center gap-1 w-full h-full transition-all duration-300",
								isActive
									? "text-primary"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<div
								className={cn(
									"relative p-2 rounded-2xl transition-all duration-300",
									isActive && "bg-primary/10",
								)}
							>
								<item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
								{item.label === "Chat" && unreadNotifications > 0 && (
									<Badge
										variant="destructive"
										className="absolute -top-1 -right-1 w-5 h-5 text-[10px] flex items-center justify-center p-0 animate-bounce"
									>
										{unreadNotifications > 99 ? "99+" : unreadNotifications}
									</Badge>
								)}
								{item.label === "Carrito" && cartItemCount > 0 && (
									<Badge
										variant="default"
										className="absolute -top-1 -right-1 w-5 h-5 text-[10px] flex items-center justify-center p-0 animate-bounce"
									>
										{cartItemCount > 99 ? "99+" : cartItemCount}
									</Badge>
								)}
							</div>
							<span className="text-[10px] font-semibold">
								{item.label === "Config" ? "⚙️" : item.label}
							</span>
						</NavLink>
					);
				})}
			</div>
		</nav>
	);
}
