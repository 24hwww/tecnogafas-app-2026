import { type ReactNode, useEffect } from "react";
import { useApp } from "../AppContext";

export function ThemeWrapper({ children }: { children: ReactNode }) {
	const { primaryColor, fontSize } = useApp();

	useEffect(() => {
		document.documentElement.style.setProperty("--color-primary", primaryColor);
		document.documentElement.style.setProperty("font-size", fontSize);
	}, [primaryColor, fontSize]);

	return <>{children}</>;
}
