import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Loader2, X } from "lucide-react";
import Link from "next/link";
import { CompanyProfileContent } from "~/components/startup/company-profile-content";
import { Button } from "~/components/ui/button";
import type { Company } from "~/lib/startup-api";

type SelectedCompanyPanelProps = {
	company: Company | null;
	loading: boolean;
	mapToken?: string;
	onClose: () => void;
};

export function SelectedCompanyPanel({
	company,
	loading,
	mapToken,
	onClose,
}: SelectedCompanyPanelProps) {
	return (
		<AnimatePresence>
			{company ? (
				<motion.aside
					animate={{ opacity: 1, x: 0 }}
					className="absolute top-32 bottom-4 left-4 z-20 flex w-[min(28rem,calc(100%-2rem))] flex-col overflow-hidden rounded-lg border border-white/70 bg-slate-50/95 shadow-2xl backdrop-blur-md md:top-20"
					exit={{ opacity: 0, x: -24 }}
					initial={{ opacity: 0, x: -24 }}
					transition={{ duration: 0.24, ease: "easeOut" }}
				>
					<div className="flex items-start justify-between gap-3 border-white/70 border-b bg-white/80 px-4 py-3">
						<div className="min-w-0">
							<p className="truncate font-semibold text-slate-950">
								{company.name}
							</p>
							<p className="text-muted-foreground text-sm">
								{company.sector ?? "Company profile"}
							</p>
						</div>
						<div className="flex shrink-0 items-center gap-1">
							<Button asChild size="icon-sm" variant="ghost">
								<Link
									aria-label="Open full company page"
									href={`/companies/${company.id}`}
								>
									<ExternalLink className="size-4" />
								</Link>
							</Button>
							<Button
								aria-label="Close company profile"
								onClick={onClose}
								size="icon-sm"
								type="button"
								variant="ghost"
							>
								<X className="size-4" />
							</Button>
						</div>
					</div>
					<div className="relative min-h-0 flex-1 overflow-y-auto p-4">
						{loading ? (
							<div className="absolute top-4 right-4 z-10 rounded-full border bg-white/90 p-2 text-emerald-700 shadow-sm">
								<Loader2 className="size-4 animate-spin" />
							</div>
						) : null}
						<CompanyProfileContent
							company={company}
							layout="panel"
							mapToken={mapToken}
						/>
					</div>
				</motion.aside>
			) : null}
		</AnimatePresence>
	);
}
