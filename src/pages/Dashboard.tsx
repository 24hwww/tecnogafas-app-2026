import { get } from "idb-keyval";
import {
	AlertTriangle,
	Download,
	Package,
	RefreshCw,
	ShoppingBag,
	Smartphone,
	TrendingUp,
	Users,
	Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useApp } from "../AppContext";
import { Skeleton } from "../components/Skeleton";
import { cn, formatCurrency, formatTimeBA } from "../lib/utils";

export default function Dashboard() {
	const {
		products,
		clients,
		grandTotalOrders,
		dashboardOrders,
		sellers,
		refreshData,
		clearAllCaches,
		isLoading,
		appVersionInfo,
		drafts,
	} = useApp();
	const navigate = useNavigate();
	const [hasCache, setHasCache] = useState(false);
	const [showDraftsModal, setShowDraftsModal] = useState(false);

	useEffect(() => {
		const checkCache = async () => {
			const cached = await get("tecnogafas_products");
			setHasCache(!!cached);
		};
		checkCache();
	}, []);

	const stats = [
		{
			label: "Vendedores",
			value: sellers.length,
			icon: Users,
			color: "text-green-600",
		},
		{
			label: "Clientes",
			value: clients.length,
			icon: TrendingUp,
			color: "text-blue-600",
		},
		{
			label: "Productos",
			value: products.length,
			icon: Package,
			color: "text-purple-600",
		},
		{
			label: "Pedidos",
			value: grandTotalOrders,
			icon: ShoppingBag,
			color: "text-orange-600",
		},
	];

	const getSellerName = (sellerId: string) =>
		sellers.find((s) => s.id === sellerId)?.name || "Vendedor desconocido";
	const _getOrderNumber = (title: string) => {
		const match = title.match(/#(\d+)/);
		return match ? `#${match[1]}` : "";
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h2 className="text-3xl font-bold">Inicio</h2>
				<div className="flex gap-2">
					<Button
						onClick={() => refreshData()}
						variant="outline"
						size="icon"
						className="rounded-xl"
					>
						<RefreshCw size={20} className={cn(isLoading && "animate-spin")} />
					</Button>
					<Button
						onClick={() =>
							drafts.filter((d) => d.status === "no enviado").length > 0
								? setShowDraftsModal(true)
								: clearAllCaches()
						}
						variant={hasCache ? "destructive" : "outline"}
						size="icon"
						className="rounded-xl"
					>
						<Zap size={20} />
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-4">
				{stats.map((stat) => (
					<Card key={stat.label} className="card-premium p-4">
						<div className="flex items-center justify-between mb-2">
							<span className="text-[10px] font-bold uppercase text-muted-foreground">
								{stat.label}
							</span>
							<div className={cn("p-1.5 rounded-lg bg-secondary", stat.color)}>
								<stat.icon size={14} />
							</div>
						</div>
						<div className="text-2xl font-black">
							{isLoading ? <Skeleton className="h-6 w-12" /> : stat.value}
						</div>
					</Card>
				))}
			</div>

			<div className="space-y-4">
				<div className="flex justify-between items-center">
					<h3 className="text-xl font-bold">Pedidos Recientes</h3>
					<Button
						variant="link"
						onClick={() => navigate("/pedidos")}
						className="text-xs font-bold text-primary"
					>
						Ver todos
					</Button>
				</div>
				<Card className="card-premium overflow-hidden">
					{dashboardOrders.slice(0, 5).map((order) => (
						<div
							key={order.id}
							className="flex justify-between items-center p-4 border-b last:border-0 hover:bg-secondary/50 cursor-pointer"
							onClick={() => navigate("/pedidos")}
						>
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-sm">
									{order.clientName.charAt(0)}
								</div>
								<div>
									<p className="font-bold text-sm">{order.clientName}</p>
									<p className="text-[10px] text-muted-foreground uppercase">
										{formatTimeBA(order.createdAt)} •{" "}
										{getSellerName(order.sellerId)}
									</p>
								</div>
							</div>
							<p className="font-bold text-primary">
								{formatCurrency(order.total || 0)}
							</p>
						</div>
					))}
				</Card>
			</div>

			{appVersionInfo?.success && (
				<Card className="card-premium p-4 flex gap-4 items-center border-l-4 border-primary">
					<Smartphone size={32} className="text-primary" />
					<div className="flex-1">
						<h4 className="font-bold">
							Nueva Versión {appVersionInfo.version}
						</h4>
						<Button size="sm" className="w-full mt-2" asChild>
							<a href={appVersionInfo.apk_url}>
								<Download size={16} className="mr-2" /> Actualizar
							</a>
						</Button>
					</div>
				</Card>
			)}

			<Dialog open={showDraftsModal} onOpenChange={setShowDraftsModal}>
				<DialogContent className="rounded-3xl p-6 text-center">
					<AlertTriangle size={48} className="mx-auto text-destructive mb-4" />
					<h3 className="text-lg font-bold">¿Limpiar datos?</h3>
					<p className="text-sm text-muted-foreground mb-6">
						Hay borradores pendientes. Si limpias el caché, se perderán.
					</p>
					<div className="flex flex-col gap-2">
						<Button
							onClick={() => {
								setShowDraftsModal(false);
								navigate("/pedidos");
							}}
						>
							Ir a Pedidos
						</Button>
						<Button
							variant="outline"
							onClick={() => {
								setShowDraftsModal(false);
								clearAllCaches();
							}}
						>
							Limpiar igual
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
