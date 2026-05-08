import { ChevronRight } from "lucide-react";
import Link from "next/link";

type BreadcrumbItem = {
	label: string;
	href?: string;
};

export function PageBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
	return (
		<nav
			aria-label="Breadcrumb"
			className="mb-6 flex items-center gap-1.5 text-sm"
		>
			{items.map((item, index) => {
				const isLast = index === items.length - 1;
				return (
					<span className="flex items-center gap-1.5" key={item.label}>
						{index > 0 && (
							<ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
						)}
						{isLast || !item.href ? (
							<span
								className={
									isLast
										? "font-medium text-slate-950"
										: "text-muted-foreground"
								}
							>
								{item.label}
							</span>
						) : (
							<Link
								className="text-muted-foreground transition-colors hover:text-slate-950"
								href={item.href}
							>
								{item.label}
							</Link>
						)}
					</span>
				);
			})}
		</nav>
	);
}
