import { Search, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function TopHeader({ title }: { title: string }) {
	const navigate = useNavigate();

	return (
		<header className="fixed top-0 left-0 right-0 h-16 px-4 flex items-center justify-between bg-background/80 backdrop-blur-xl z-50 pt-safe-area">
			<h2 className="text-xl font-bold tracking-tight">{title}</h2>
			<div className="flex gap-1">
				<Button variant="ghost" size="icon" className="rounded-full">
					<Search size={20} />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="rounded-full"
					onClick={() => navigate("/configuracion")}
				>
					<Settings size={20} />
				</Button>
			</div>
		</header>
	);
}
