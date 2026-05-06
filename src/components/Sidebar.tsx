import {
	ChevronLeft,
	ClipboardList,
	House,
	MessageCircle,
	Package,
	Settings,
	ShoppingCart,
	Users,
	X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useApp } from "../AppContext";
import { cn } from "../lib/utils";

const navItems = [
	{ path: "/", label: "Inicio", icon: House },
	{ path: "/productos", label: "Productos", icon: Package },
	{ path: "/clientes", label: "Clientes", icon: Users },
	{ path: "/pedidos", label: "Pedidos", icon: ClipboardList },
	{ path: "/chat", label: "Chat", icon: MessageCircle },
	{ path: "/carrito", label: "Carrito", icon: ShoppingCart },
	{ path: "/configuracion", label: "Configuración", icon: Settings },
];

export function Sidebar() {
	const [isOpen, setIsOpen] = useState(false);
	const location = useLocation();
	const { unreadNotifications, cart } = useApp();

	const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);

	return (
		<>
			{/* Sidebar Overlay for Mobile */}
			<Sheet open={isOpen} onOpenChange={setIsOpen}>
				<SheetContent
					side="left"
					className="w-80 p-0 border-r border-border/50 bg-card"
				>
					{/* Sidebar Header */}
					<div className="p-6 flex items-center justify-between border-b border-border/50">
						<div className="flex items-center space-x-3">
							<div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center text-primary-foreground font-bold text-xl shadow-lg shadow-primary/20">
								T
							</div>
							<div>
								<span className="text-xl font-bold tracking-tight text-foreground">
									Tecnogafas
								</span>
								<p className="text-xs text-muted-foreground">App v1.2.0</p>
							</div>
						</div>
						<Button
							variant="ghost"
							size="icon"
							className="rounded-xl"
							onClick={() => setIsOpen(false)}
						>
							<X size={20} />
						</Button>
					</div>

					{/* Navigation Items */}
					<nav className="flex-1 px-4 py-6 space-y-2">
						{navItems.map((item) => {
							const isActive = location.pathname === item.path;
							return (
								<NavLink
									key={item.path}
									to={item.path}
									onClick={() => setIsOpen(false)}
									className={cn(
										"flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
										isActive
											? "bg-primary text-primary-foreground shadow-lg"
											: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
									)}
								>
									<item.icon
										size={20}
										className={cn(
											"transition-colors",
											isActive
												? "text-primary-foreground"
												: "text-muted-foreground group-hover:text-accent-foreground",
										)}
									/>
									<span className="flex-1">{item.label}</span>
									{item.label === "Carrito" && cartItemCount > 0 && (
										<Badge
											variant="default"
											className="ml-auto animate-bounce-in"
										>
											{cartItemCount > 99 ? "99+" : cartItemCount}
										</Badge>
									)}
									{item.label === "Chat" && unreadNotifications > 0 && (
										<Badge
											variant="destructive"
											className="ml-auto animate-bounce-in"
										>
											{unreadNotifications > 99 ? "99+" : unreadNotifications}
										</Badge>
									)}
								</NavLink>
							);
						})}
					</nav>

					{/* User Session Info */}
					<div className="p-6 border-t border-border/50">
						<div className="flex items-center space-x-4 p-4 rounded-xl bg-muted/50">
							<div className="w-10 h-10 bg-secondary text-secondary-foreground rounded-full flex items-center justify-center">
								<Users size={18} />
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-sm font-semibold text-foreground truncate">
									Sesión de Vendedor
								</p>
								<p className="text-xs text-muted-foreground">API v1.0.0</p>
							</div>
						</div>
					</div>
				</SheetContent>
			</Sheet>

			{/* Sidebar Toggle Button */}
			<Button
				variant="ghost"
				size="icon"
				className="fixed top-4 left-4 z-40 rounded-xl bg-background/80 backdrop-blur-md border border-border/50 shadow-lg"
				onClick={() => setIsOpen(true)}
			>
				<ChevronLeft size={24} />
			</Button>
		</>
	);
}
