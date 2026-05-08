"use client";

import {
	Building2,
	ChevronUp,
	Compass,
	LogOut,
	Map as MapIcon,
	Settings,
	Shield,
	ShieldCheck,
	Sparkles,
	User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
import { USER_ROLE } from "~/lib/user-role";
import { cn } from "~/lib/utils";

const navItems = [
	{ href: "/founder", label: "Navigator", icon: Compass },
	{ href: "/resources", label: "Resources", icon: Sparkles },
	{ href: "/map", label: "Map", icon: MapIcon },
	{ href: "/companies/new", label: "Add company", icon: Building2 },
];

function NavLink({
	href,
	label,
	icon: Icon,
	pathname,
}: {
	href: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	pathname: string;
}) {
	const active =
		pathname === href || (href !== "/" && pathname.startsWith(href));
	return (
		<Link
			className={cn(
				"flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
				active
					? "bg-slate-950 text-white"
					: "text-slate-800 hover:bg-slate-100",
			)}
			href={href}
		>
			<Icon className="h-4 w-4" />
			{label}
		</Link>
	);
}

export function StartupSidebar() {
	const pathname = usePathname();
	const { data: session } = useSession();
	const [popoverOpen, setPopoverOpen] = useState(false);

	const name = session?.user?.name ?? "Account";
	const email = session?.user?.email ?? "";
	const initials = name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

	return (
		<aside className="flex w-64 flex-shrink-0 flex-col border-slate-200 border-r bg-gray-50">
			{/* Logo */}
			<div className="flex h-16 items-center px-6">
				<Link className="flex items-center gap-2 font-semibold" href="/">
					<span className="flex size-8 items-center justify-center rounded-lg bg-slate-950 text-white">
						<ShieldCheck className="size-4" />
					</span>
					<span className="text-sm">Startup State Navigator</span>
				</Link>
			</div>

			{/* Nav */}
			<nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
				{session?.user?.role === USER_ROLE.ADMIN && (
					<NavLink
						href="/admin"
						icon={Shield}
						label="Admin Tools"
						pathname={pathname}
					/>
				)}
				{navItems.map((item) => (
					<NavLink key={item.href} {...item} pathname={pathname} />
				))}
			</nav>

			{/* Profile footer */}
			<div className="border-slate-200 border-t p-3">
				<Popover onOpenChange={setPopoverOpen} open={popoverOpen}>
					<PopoverTrigger asChild>
						<button
							className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-slate-100"
							type="button"
						>
							<Avatar className="h-7 w-7 shrink-0">
								<AvatarImage alt={name} src={session?.user?.image ?? ""} />
								<AvatarFallback className="text-xs">
									{session ? initials : <User className="h-3 w-3" />}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1 text-left">
								<p className="truncate font-medium text-sm leading-tight">
									{name}
								</p>
								{email && (
									<p className="truncate text-slate-500 text-xs leading-tight">
										{email}
									</p>
								)}
							</div>
							<ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
						</button>
					</PopoverTrigger>
					<PopoverContent
						align="start"
						className="w-56 p-1 shadow-[0_0_10px_rgba(0,0,0,0.15)]"
						side="top"
						sideOffset={8}
					>
						<Link
							className="flex w-full items-center gap-2 rounded-sm p-2 text-sm transition-colors hover:bg-slate-100"
							href="/settings"
							onClick={() => setPopoverOpen(false)}
						>
							<Settings className="h-4 w-4" />
							Account settings
						</Link>
						<button
							className="flex w-full items-center gap-2 rounded-sm p-2 text-sm transition-colors hover:bg-slate-100"
							onClick={() => void signOut({ callbackUrl: "/auth/signin" })}
							type="button"
						>
							<LogOut className="h-4 w-4" />
							Sign out
						</button>
					</PopoverContent>
				</Popover>
			</div>
		</aside>
	);
}
