import { useEffect, useState } from "react";
import { kodular } from "../lib/kodularBridge";

export function useNotifications() {
	const [permission, setPermission] = useState<string>("default");

	useEffect(() => {
		const unsub = kodular.on(
			"PERMISSION_RESULT",
			({ permission: perm, status }) => {
				if (perm === "NOTIFICATIONS") {
					setPermission(status as string);
				}
			},
		);

		return unsub;
	}, []);

	const request = () => {
		kodular.requestPermission("NOTIFICATIONS");
	};

	return { permission, request };
}
