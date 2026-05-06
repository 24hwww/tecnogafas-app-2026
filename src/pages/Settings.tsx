import { Moon, Settings as SettingsIcon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApp } from "../AppContext";
import { kodular } from "../lib/kodularBridge";

export default function Settings() {
	const {
		primaryColor,
		fontSize,
		globalPin,
		theme,
		setPrimaryColor,
		setFontSize,
		setGlobalPin,
		setTheme,
	} = useApp();
	const [pinInput, setPinInput] = useState(globalPin || "");
	const [pushEnabled, setPushEnabled] = useState(false);
	const [showPin, _setShowPin] = useState(false);

	useEffect(() => {
		if ("Notification" in window) {
			setPushEnabled(Notification.permission === "granted");
		}
	}, []);

	const enablePush = async () => {
		if (!("Notification" in window) || !("serviceWorker" in navigator)) {
			alert("Tu navegador no soporta notificaciones push");
			return;
		}
		const perm = await Notification.requestPermission();
		setPushEnabled(perm === "granted");
	};

	const handleSavePin = () => {
		if (pinInput.length === 8) {
			setGlobalPin(pinInput);
			alert("PIN guardado.");
			kodular.send("PIN_CHANGED", { pin: pinInput });
		} else {
			setGlobalPin(null);
			setPinInput("");
			alert("PIN eliminado.");
		}
	};

	return (
		<div className="space-y-6">
			<h2 className="text-2xl font-bold flex items-center gap-3">
				<SettingsIcon className="text-primary" /> Configuraciones
			</h2>

			<section className="space-y-4">
				<h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
					Cuenta
				</h3>
				<Card className="card-premium p-4 space-y-4">
					<Input
						type={showPin ? "text" : "password"}
						placeholder="PIN de 8 dígitos"
						value={pinInput}
						onChange={(e) =>
							setPinInput(e.target.value.replace(/\D/g, "").slice(0, 8))
						}
					/>
					<Button onClick={handleSavePin} className="w-full">
						{globalPin ? "Actualizar PIN" : "Vincular Cuenta"}
					</Button>
				</Card>
			</section>

			<section className="space-y-4">
				<h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
					Notificaciones
				</h3>
				<Card className="card-premium p-4">
					<Button
						variant={pushEnabled ? "default" : "outline"}
						className="w-full"
						onClick={enablePush}
						disabled={pushEnabled}
					>
						{pushEnabled
							? "Notificaciones Activadas"
							: "Habilitar Notificaciones"}
					</Button>
				</Card>
			</section>

			<section className="space-y-4">
				<h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
					Apariencia
				</h3>
				<Card className="card-premium p-4 space-y-4">
					<div className="grid grid-cols-2 gap-2">
						<Button
							variant={theme === "light" ? "default" : "outline"}
							onClick={() => setTheme("light")}
						>
							<Sun className="mr-2" size={16} /> Claro
						</Button>
						<Button
							variant={theme === "dark" ? "default" : "outline"}
							onClick={() => setTheme("dark")}
						>
							<Moon className="mr-2" size={16} /> Oscuro
						</Button>
					</div>
					<div className="flex items-center gap-4">
						<div
							className="w-12 h-12 rounded-full cursor-pointer border-2 border-border"
							style={{ backgroundColor: primaryColor }}
						>
							<input
								type="color"
								value={primaryColor}
								onChange={(e) => setPrimaryColor(e.target.value)}
								className="opacity-0 w-full h-full"
							/>
						</div>
						<span className="font-bold">Color de Énfasis</span>
					</div>
				</Card>
			</section>
		</div>
	);
}
