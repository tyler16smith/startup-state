"use client";

import {
	ChevronUp,
	FlaskConical,
	LayoutDashboard,
	LogOut,
	PanelLeftClose,
	PanelLeftOpen,
	Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import type React from "react";
import { useState } from "react";
import { TrialSyncWidget } from "~/components/billing/trial-sync-widget";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
import { Separator } from "~/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { useDemoMode } from "~/context/demo-mode-context";
import { cn } from "~/lib/utils";
import Logo from "../common/logo";

const topLevelItems = [
	{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

function NavLink({
	href,
	label,
	icon: Icon,
	pathname,
	collapsed = false,
	onClick,
}: {
	href: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	pathname: string;
	collapsed?: boolean;
	onClick?: () => void;
}) {
	const active =
		href === "/dashboard"
			? pathname === "/dashboard"
			: pathname.startsWith(href);
	const link = (
		<Link
			aria-label={collapsed ? label : undefined}
			className={cn(
				"flex items-center gap-3 rounded-md py-2 text-sm transition-colors",
				collapsed ? "justify-center px-2" : "px-3",
				active
					? "bg-primary text-primary-foreground"
					: "text-black hover:bg-muted-foreground/10",
			)}
			href={href}
			onClick={onClick}
		>
			<Icon className="h-4 w-4" />
			{!collapsed && label}
		</Link>
	);

	if (collapsed) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>{link}</TooltipTrigger>
				<TooltipContent side="right">{label}</TooltipContent>
			</Tooltip>
		);
	}

	return link;
}

export function Sidebar({
	collapsible,
	onClose,
}: {
	collapsible?: boolean;
	onClose?: () => void;
} = {}) {
	const pathname = usePathname();
	const { isDemoMode, enterDemoMode, exitDemoMode } = useDemoMode();
	const { data: session } = useSession();
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [collapsed, setCollapsed] = useState(false);
	const canCollapse = collapsible ?? !onClose;
	const isCollapsed = canCollapse && collapsed;

	const name = isDemoMode ? "Demo Mode" : (session?.user?.name ?? "Account");
	const email = isDemoMode ? "" : (session?.user?.email ?? "");
	const initials = isDemoMode
		? "DM"
		: name
				.split(" ")
				.map((n) => n[0])
				.join("")
				.toUpperCase()
				.slice(0, 2);

	return (
		<aside
			className={cn(
				"relative flex h-full flex-col border-r bg-card bg-muted transition-[width] duration-200",
				isCollapsed ? "w-16" : "w-64",
			)}
		>
			<div
				className={cn(
					"flex h-16 items-center",
					isCollapsed ? "justify-center px-3" : "justify-between px-6",
				)}
			>
				<Logo showText={!isCollapsed} size="md" />
				{canCollapse && (
					<Button
						aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
						className={cn(
							"text-muted-foreground hover:text-foreground",
							isCollapsed &&
								"absolute top-4 left-full z-20 ml-3 border bg-card shadow-sm",
						)}
						onClick={() => setCollapsed((current) => !current)}
						size="icon-sm"
						type="button"
						variant="ghost"
					>
						{isCollapsed ? (
							<PanelLeftOpen className="h-4 w-4" />
						) : (
							<PanelLeftClose className="h-4 w-4" />
						)}
					</Button>
				)}
			</div>
			<nav
				className={cn(
					"flex flex-1 flex-col gap-1 overflow-y-auto p-3",
					isCollapsed && "px-2",
				)}
			>
				{topLevelItems.map((item) => (
					<NavLink
						key={item.href}
						{...item}
						collapsed={isCollapsed}
						onClick={onClose}
						pathname={pathname}
					/>
				))}
				<div className="mt-auto space-y-1 pt-3">
					{!isDemoMode && !isCollapsed && <TrialSyncWidget />}
				</div>
			</nav>

			{/* Profile popout */}
			<div className={cn("border-t p-3", isCollapsed && "px-2")}>
				<Popover onOpenChange={setPopoverOpen} open={popoverOpen}>
					{isCollapsed ? (
						<Tooltip>
							<TooltipTrigger asChild>
								<PopoverTrigger asChild>
									<button
										aria-label={name}
										className="flex w-full items-center justify-center rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted-foreground/10"
										type="button"
									>
										<Avatar className="h-7 w-7 shrink-0">
											{!isDemoMode && (
												<AvatarImage
													alt={name}
													src={session?.user?.image ?? ""}
												/>
											)}
											<AvatarFallback className="text-xs">
												{initials}
											</AvatarFallback>
										</Avatar>
									</button>
								</PopoverTrigger>
							</TooltipTrigger>
							<TooltipContent side="right">{name}</TooltipContent>
						</Tooltip>
					) : (
						<PopoverTrigger asChild>
							<button
								className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted-foreground/10"
								type="button"
							>
								<Avatar className="h-7 w-7 shrink-0">
									{!isDemoMode && (
										<AvatarImage alt={name} src={session?.user?.image ?? ""} />
									)}
									<AvatarFallback className="text-xs">
										{initials}
									</AvatarFallback>
								</Avatar>
								<div className="min-w-0 flex-1 text-left">
									<p className="truncate font-medium text-sm leading-tight">
										{name}
									</p>
									{email && (
										<p className="truncate text-muted-foreground text-xs leading-tight">
											{email}
										</p>
									)}
								</div>
								<ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
							</button>
						</PopoverTrigger>
					)}
					<PopoverContent
						align={isCollapsed ? "end" : "start"}
						className="w-56 p-1 shadow-[0_0_10px_rgba(0,0,0,0.2)]"
						side={isCollapsed ? "right" : "top"}
						sideOffset={8}
					>
						{!isDemoMode && (
							<>
								<Link
									className="flex w-full items-center gap-2 rounded-sm p-2 text-sm transition-colors hover:bg-muted"
									href="/dashboard/settings"
									onClick={() => {
										setPopoverOpen(false);
										onClose?.();
									}}
								>
									<Settings className="h-4 w-4" />
									Account settings
								</Link>
								<button
									className="flex w-full items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted"
									onClick={() => {
										setPopoverOpen(false);
										onClose?.();
										void enterDemoMode();
									}}
									type="button"
								>
									<FlaskConical className="h-4 w-4" />
									Enter Demo Mode
								</button>
								<Separator className="my-1" />
							</>
						)}
						<button
							className="flex w-full items-center gap-2 rounded-sm p-2 text-destructive text-sm transition-colors hover:bg-muted"
							onClick={() => {
								setPopoverOpen(false);
								onClose?.();
								if (isDemoMode) void exitDemoMode();
								else void signOut({ callbackUrl: "/auth/signin" });
							}}
							type="button"
						>
							<LogOut className="h-4 w-4" />
							{isDemoMode ? "Exit demo mode" : "Sign out"}
						</button>
					</PopoverContent>
				</Popover>
			</div>
		</aside>
	);
}
