import {
	Building2,
	Check,
	Edit2,
	IdCard,
	MapPin,
	MapPinned,
	Phone,
	RefreshCw,
	Search,
	UserPlus,
	X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../AppContext";
import { PullToRefresh } from "../components/PullToRefresh";
import { ClientSkeleton } from "../components/Skeleton";
import { apiService } from "../services/apiService";
import type { Client } from "../types";

export default function Clients() {
	const { clients, selectedClient, setSelectedClient, refreshData, isLoading } =
		useApp();
	const navigate = useNavigate();
	const [search, setSearch] = useState("");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingClient, setEditingClient] = useState<Partial<Client> | null>(
		null,
	);
	const [isSaving, setIsSaving] = useState(false);

	const filteredClients = clients.filter(
		(c) =>
			c.name.toLowerCase().includes(search.toLowerCase()) ||
			c.email.toLowerCase().includes(search.toLowerCase()),
	);

	const handleSaveClient = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!editingClient?.name || !editingClient?.email) return;

		setIsSaving(true);
		try {
			const success = await apiService.saveClient(editingClient);
			if (success) {
				setIsModalOpen(false);
				setEditingClient(null);
				await refreshData();
			} else {
				alert("Error al guardar cliente");
			}
		} catch (e) {
			console.error(e);
			alert("Error de red");
		} finally {
			setIsSaving(false);
		}
	};

	const openEdit = (client: Client) => {
		setEditingClient(client);
		setIsModalOpen(true);
	};

	const handleSelectClient = (client: Client) => {
		setSelectedClient(client);
	};

	return (
		<PullToRefresh onRefresh={() => refreshData(false)}>
			<div className="space-y-4 min-h-[50vh]">
				<div className="flex items-center justify-between">
					<h2 id="clients-title" className="text-2xl font-bold">
						Clientes
					</h2>
					<button
						id="clients-add-btn"
						onClick={() => {
							setEditingClient({
								name: "",
								email: "",
								phone: "",
								address: "",
								billing_city: "",
								billing_state: "",
								cuit: "",
							});
							setIsModalOpen(true);
						}}
						className="p-2 text-primary hover:bg-surface-variant transition-colors rounded-full"
					>
						<UserPlus size={24} />
					</button>{" "}
				</div>

				<div className="relative">
					<Search
						className="absolute left-3 top-1/2 -translate-y-1/2 text-outline"
						size={20}
					/>
					<input
						id="clients-search-input"
						type="text"
						placeholder="Buscar por nombre o correo..."
						className="w-full bg-surface-variant py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>

				<div className="space-y-3">
					{isLoading
						? Array(6)
								.fill(0)
								.map((_, i) => <ClientSkeleton key={i} />)
						: filteredClients.map((client) => {
								const isSelected = selectedClient?.id === client.id;
								return (
									<Card
										key={client.id}
										className={cn(
											"card-premium p-4 border-2 transition-all",
											isSelected ? "border-primary" : "border-transparent",
										)}
									>
										<div className="flex justify-between items-start">
											<div
												className="flex-1 cursor-pointer"
												onClick={() => handleSelectClient(client)}
											>
												<h4 className="font-semibold text-lg text-foreground">
													{client.name}
												</h4>
												<p className="text-xs text-primary font-bold mb-2">
													{client.email}
												</p>
												<div className="flex flex-col gap-1 text-xs text-muted-foreground">
													<p className="flex items-center gap-1">
														<Phone size={12} /> {client.phone || "Sin teléfono"}
													</p>
													<p className="flex items-center gap-1">
														<MapPin size={12} />{" "}
														{client.address || "Sin dirección"}
													</p>
												</div>
											</div>
											<Button
												variant="ghost"
												size="icon"
												onClick={(e) => {
													e.stopPropagation();
													openEdit(client);
												}}
											>
												<Edit2 size={16} />
											</Button>
										</div>
										<Button
											className={cn(
												"w-full mt-4 h-9 rounded-xl font-bold",
												isSelected && "bg-green-600 hover:bg-green-700",
											)}
											onClick={() => handleSelectClient(client)}
										>
											{isSelected ? (
												<>
													<Check size={16} className="mr-2" /> Seleccionado
												</>
											) : (
												"Seleccionar"
											)}
										</Button>
									</Card>
								);
							})}
				</div>

				{selectedClient && (
					<div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[calc(448px-2rem)] bg-primary-container p-3 flex justify-between items-center shadow-lg border border-primary/20 z-40">
						<div className="flex-1">
							<span className="text-[0.625rem] uppercase font-black text-primary animate-pulse">
								Cliente para pedido
							</span>
							<p className="text-sm font-bold text-on-primary-container truncate">
								{selectedClient.name}
							</p>
						</div>
						<div className="flex flex-col gap-2">
							<button
								onClick={() => navigate("/carrito")}
								className="m3-button-filled w-full"
							>
								Ver Carrito
							</button>
							<button
								onClick={() => setSelectedClient(null)}
								className="text-[0.625rem] font-bold text-outline uppercase w-full"
							>
								Quitar
							</button>
						</div>
					</div>
				)}

				{/* Add/Edit Modal */}
				<AnimatePresence>
					{isModalOpen && (
						<div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-0 sm:p-4">
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								onClick={() => !isSaving && setIsModalOpen(false)}
								className="absolute inset-0 bg-black/50"
							/>
							<motion.div
								initial={{ y: "100%" }}
								animate={{ y: 0 }}
								exit={{ y: "100%" }}
								className="relative w-full max-w-md bg-surface p-6 shadow-2xl space-y-6"
							>
								<div className="flex justify-between items-center">
									<h3 className="text-xl font-bold">
										{editingClient?.id ? "Editar Cliente" : "Nuevo Cliente"}
									</h3>
									<button onClick={() => setIsModalOpen(false)} className="p-1">
										<X />
									</button>
								</div>

								<form onSubmit={handleSaveClient} className="space-y-4">
									<div className="space-y-1">
										<label className="text-[0.625rem] font-bold uppercase text-outline">
											Nombre Completo
										</label>
										<input
											required
											className="w-full bg-surface-variant p-3 focus:ring-2 focus:ring-primary outline-none"
											value={editingClient?.name || ""}
											onChange={(e) =>
												setEditingClient((prev) => ({
													...prev,
													name: e.target.value,
												}))
											}
										/>
									</div>
									<div className="space-y-1">
										<label className="text-[0.625rem] font-bold uppercase text-outline">
											Correo Electrónico
										</label>
										<input
											required
											type="email"
											className="w-full bg-surface-variant p-3 focus:ring-2 focus:ring-primary outline-none"
											value={editingClient?.email || ""}
											onChange={(e) =>
												setEditingClient((prev) => ({
													...prev,
													email: e.target.value,
												}))
											}
										/>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-1">
											<label className="text-[0.625rem] font-bold uppercase text-outline">
												Teléfono
											</label>
											<input
												className="w-full bg-surface-variant p-3 focus:ring-2 focus:ring-primary outline-none"
												value={editingClient?.phone || ""}
												onChange={(e) =>
													setEditingClient((prev) => ({
														...prev,
														phone: e.target.value,
													}))
												}
											/>
										</div>
										<div className="space-y-1">
											<label className="text-[0.625rem] font-bold uppercase text-outline">
												Dirección
											</label>
											<input
												className="w-full bg-surface-variant p-3 focus:ring-2 focus:ring-primary outline-none"
												value={editingClient?.address || ""}
												onChange={(e) =>
													setEditingClient((prev) => ({
														...prev,
														address: e.target.value,
													}))
												}
											/>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-1">
											<label className="text-[0.625rem] font-bold uppercase text-outline flex items-center gap-1">
												<Building2 size={12} /> Localidad
											</label>
											<input
												className="w-full bg-surface-variant p-3 focus:ring-2 focus:ring-primary outline-none"
												value={editingClient?.billing_city || ""}
												onChange={(e) =>
													setEditingClient((prev) => ({
														...prev,
														billing_city: e.target.value,
													}))
												}
											/>
										</div>
										<div className="space-y-1">
											<label className="text-[0.625rem] font-bold uppercase text-outline flex items-center gap-1">
												<MapPinned size={12} /> Provincia
											</label>
											<select
												className="w-full bg-surface-variant p-3 focus:ring-2 focus:ring-primary outline-none appearance-none"
												value={editingClient?.billing_state || ""}
												onChange={(e) =>
													setEditingClient((prev) => ({
														...prev,
														billing_state: e.target.value,
													}))
												}
											>
												<option value="">Seleccionar provincia</option>
												<option value="Buenos Aires">Buenos Aires</option>
												<option value="Ciudad Autónoma de Buenos Aires">
													Ciudad Autónoma de Buenos Aires
												</option>
												<option value="Catamarca">Catamarca</option>
												<option value="Chaco">Chaco</option>
												<option value="Chubut">Chubut</option>
												<option value="Córdoba">Córdoba</option>
												<option value="Corrientes">Corrientes</option>
												<option value="Entre Ríos">Entre Ríos</option>
												<option value="Formosa">Formosa</option>
												<option value="Jujuy">Jujuy</option>
												<option value="La Pampa">La Pampa</option>
												<option value="La Rioja">La Rioja</option>
												<option value="Mendoza">Mendoza</option>
												<option value="Misiones">Misiones</option>
												<option value="Neuquén">Neuquén</option>
												<option value="Río Negro">Río Negro</option>
												<option value="Salta">Salta</option>
												<option value="San Juan">San Juan</option>
												<option value="San Luis">San Luis</option>
												<option value="Santa Cruz">Santa Cruz</option>
												<option value="Santa Fe">Santa Fe</option>
												<option value="Santiago del Estero">
													Santiago del Estero
												</option>
												<option value="Tierra del Fuego, Antártida e Islas del Atlántico Sur">
													Tierra del Fuego
												</option>
												<option value="Tucumán">Tucumán</option>
											</select>
										</div>
									</div>
									<div className="space-y-1">
										<label className="text-[0.625rem] font-bold uppercase text-outline flex items-center gap-1">
											<IdCard size={12} /> CUIT
										</label>
										<input
											className="w-full bg-surface-variant p-3 focus:ring-2 focus:ring-primary outline-none"
											value={editingClient?.cuit || ""}
											onChange={(e) =>
												setEditingClient((prev) => ({
													...prev,
													cuit: e.target.value,
												}))
											}
											placeholder="XX-XXXXXXXX-X"
										/>
									</div>
									<button
										type="submit"
										disabled={isSaving}
										className="w-full m3-button-filled py-4 flex items-center justify-center gap-2"
									>
										{isSaving && (
											<RefreshCw size={18} className="animate-spin" />
										)}
										{editingClient?.id ? "Guardar Cambios" : "Crear Cliente"}
									</button>
								</form>
							</motion.div>
						</div>
					)}
				</AnimatePresence>
			</div>
		</PullToRefresh>
	);
}
