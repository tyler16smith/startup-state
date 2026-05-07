import {
	Building2,
	Compass,
	Map as MapIcon,
	ShieldCheck,
	Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";

const navItems = [
	{ href: "/founder", label: "Navigator", icon: Compass },
	{ href: "/resources", label: "Resources", icon: Sparkles },
	{ href: "/map", label: "Map", icon: MapIcon },
	{ href: "/companies/new", label: "Add company", icon: Building2 },
];

export function SiteShell({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen bg-[#f8faf9] text-slate-950">
			<header className="sticky top-0 z-40 border-slate-200 border-b bg-white/90 backdrop-blur">
				<div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
					<Link className="flex items-center gap-2 font-semibold" href="/">
						<span className="flex size-9 items-center justify-center rounded-lg bg-slate-950 text-white">
							<ShieldCheck className="size-5" />
						</span>
						<span>Startup State Navigator</span>
					</Link>
					<nav className="hidden items-center gap-1 md:flex">
						{navItems.map((item) => (
							<Button asChild key={item.href} size="sm" variant="ghost">
								<Link href={item.href}>
									<item.icon className="size-4" />
									{item.label}
								</Link>
							</Button>
						))}
					</nav>
					<Button asChild className="hidden sm:inline-flex" size="sm">
						<Link href="/founder">Start intake</Link>
					</Button>
				</div>
			</header>
			{children}
		</div>
	);
}
