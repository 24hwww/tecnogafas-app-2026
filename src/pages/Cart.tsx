import { AlertCircle, Share2, ShoppingBag, Trash2, User } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useApp } from "../AppContext";
import { formatCurrency } from "../lib/utils";

export default function Cart() {
	const {
		cart,
		selectedClient,
		removeFromCart,
		updateCartQuantity,
		shareCart,
	} = useApp();
	const navigate = useNavigate();
	const [isSharing, setIsSharing] = useState(false);
	const [_shareResult, setShareResult] = useState<{
		success: boolean;
		code: string;
		message: string;
		link: string;
	} | null>(null);

	const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

	const handleConfirm = () => {
		navigate("/pago");
	};

	const handleShareCart = async () => {
		if (!selectedClient || cart.length === 0) {
			alert(
				"Debes tener productos en el carrito y un cliente asignado para compartir",
			);
			return;
		}

		setIsSharing(true);
		try {
			const result = await shareCart();
			setShareResult(result);

			if (result.success) {
				if (navigator.clipboard) {
					await navigator.clipboard.writeText(result.link);
					alert(
						"¡Carrito compartido! El enlace ha sido copiado al portapapeles.",
					);
				}

				if (navigator.share) {
					try {
						await navigator.share({
							title: "Carrito Tecnogafas",
							text: `Mira mi carrito: ${result.link}`,
							url: result.link,
						});
					} catch (shareError) {
						console.log("Native share failed:", shareError);
					}
				}
			}
		} catch (error) {
			console.error("Error sharing cart:", error);
			setShareResult({
				success: false,
				code: "",
				message: "Error al compartir carrito",
				link: "",
			});
		} finally {
			setIsSharing(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* Selected Client Section */}
			<Card className="card-premium p-4 border-l-4 border-l-primary">
				<h3 className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 mb-2 tracking-wider">
					<User size={12} /> CLIENTE
				</h3>
				{selectedClient ? (
					<div className="flex justify-between items-center">
						<div>
							<p className="font-bold text-sm text-foreground">
								{selectedClient.name}
							</p>
							<p className="text-xs text-muted-foreground">
								{selectedClient.email}
							</p>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => navigate("/clientes")}
							className="h-8 text-xs font-bold text-primary"
						>
							Cambiar
						</Button>
					</div>
				) : (
					<div className="flex flex-col gap-3 w-full">
						<div className="flex items-center gap-2 text-destructive">
							<AlertCircle size={16} />
							<span className="text-xs font-medium">
								Asigna un cliente para continuar
							</span>
						</div>
						<Button
							variant="outline"
							className="w-full"
							onClick={() => navigate("/clientes")}
						>
							Asignar
						</Button>
					</div>
				)}
			</Card>

			{/* Cart Items */}
			<div className="space-y-3">
				{cart.length === 0 ? (
					<div className="flex flex-col items-center justify-center p-8 text-center space-y-4 rounded-2xl border border-dashed border-border">
						<div className="bg-secondary p-4 rounded-full">
							<ShoppingBag size={32} className="text-muted-foreground" />
						</div>
						<h3 className="font-bold">Carrito Vacío</h3>
						<p className="text-xs text-muted-foreground">
							Agrega productos para comenzar un pedido.
						</p>
					</div>
				) : (
					cart.map((item) => (
						<Card key={item.id} className="card-premium p-4 flex gap-4">
							<div className="flex-1">
								<h4 className="font-semibold text-sm text-foreground">
									{item.name}
								</h4>
								<p className="text-xs text-muted-foreground">
									{formatCurrency(item.price)} c/u
								</p>
								<div className="flex items-center gap-4 mt-2">
									<div className="flex items-center border rounded-xl bg-background">
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8"
											onClick={() =>
												updateCartQuantity(item.id, item.quantity - 1)
											}
										>
											<span className="text-lg font-bold">−</span>
										</Button>
										<span className="px-2 font-bold text-xs">
											{item.quantity}
										</span>
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8"
											onClick={() =>
												updateCartQuantity(item.id, item.quantity + 1)
											}
										>
											<span className="text-lg font-bold">+</span>
										</Button>
									</div>
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8 text-destructive"
										onClick={() => removeFromCart(item.id)}
									>
										<Trash2 size={16} />
									</Button>
								</div>
							</div>
							<div className="text-right flex flex-col justify-between items-end">
								<span className="font-bold text-primary">
									{formatCurrency(item.price * item.quantity)}
								</span>
							</div>
						</Card>
					))
				)}
			</div>

			<Button
				variant="outline"
				className="w-full h-12 border-dashed text-primary border-primary/20 hover:bg-primary/5 rounded-xl"
				onClick={() => navigate("/productos")}
			>
				+ Agregar más productos
			</Button>

			{/* Summary */}
			<div className="sticky bottom-16 bg-background pt-4 pb-2 border-t border-border -mx-4 px-4 space-y-3">
				<div className="flex justify-between items-center mb-2">
					<span className="text-sm font-medium">Total</span>
					<span className="text-xl font-bold">{formatCurrency(total)}</span>
				</div>
				<Button
					onClick={handleShareCart}
					disabled={!selectedClient || cart.length === 0 || isSharing}
					variant="secondary"
					className="w-full h-12 font-bold"
				>
					{isSharing ? (
						"Compartiendo..."
					) : (
						<>
							<Share2 size={16} className="mr-2" /> Compartir Carrito
						</>
					)}
				</Button>
				<Button
					onClick={handleConfirm}
					disabled={!selectedClient || cart.length === 0}
					className="w-full h-12 font-bold"
				>
					Confirmar Pedido
				</Button>
			</div>
		</div>
	);
}
