import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);

// Auto-reload when service worker updates
if ("serviceWorker" in navigator) {
	navigator.serviceWorker.addEventListener("controllerchange", () => {
		window.location.reload();
	});
}
