import { MapPinned, X } from "lucide-react";
import { ResultCompanyRow } from "~/components/startup/company-map/result-company-row";
import { EmptyState } from "~/components/startup/empty-state";
import type { Company } from "~/lib/startup-api";

type ResultsPanelProps = {
	activeFilterCount: number;
	companies: Company[];
	onClearSelected: () => void;
	onClose: () => void;
	onFocusCompany: (company: Company) => void;
	open: boolean;
	selectedCompanyId?: string;
};

export function ResultsPanel({
	activeFilterCount,
	companies,
	onClearSelected,
	onClose,
	onFocusCompany,
	open,
	selectedCompanyId,
}: ResultsPanelProps) {
	if (!open) return null;

	return (
		<aside className="absolute top-36 left-4 z-10 flex max-h-[calc(100%-10rem)] w-[min(24rem,calc(100%-2rem))] flex-col overflow-hidden rounded-lg border border-white/70 bg-white/80 shadow-2xl backdrop-blur-md md:top-20">
			<div className="flex items-start justify-between gap-3 border-white/60 border-b px-4 py-3">
				<div>
					<p className="font-semibold text-slate-950">
						{companies.length}{" "}
						{companies.length === 1 ? "company" : "companies"}
					</p>
					<p className="text-muted-foreground text-sm">
						{activeFilterCount ? "Filtered map results" : "Map results"}
					</p>
				</div>
				<button
					aria-label="Close results"
					className="fade-in-out flex size-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition transition-all duration-300 hover:bg-gray-200 hover:text-slate-950"
					onClick={onClose}
					type="button"
				>
					<X className="size-4" />
				</button>
			</div>
			<div className="overflow-y-auto p-2">
				{companies.length === 0 ? (
					<div className="p-6">
						<EmptyState
							description="Adjust your filters or add a company listing for this part of the ecosystem."
							icon={MapPinned}
							title="No companies found for this view"
						/>
					</div>
				) : (
					<div className="space-y-1">
						{companies.map((company) => (
							<ResultCompanyRow
								active={selectedCompanyId === company.id}
								company={company}
								key={company.id}
								onClearSelected={onClearSelected}
								onSelect={() => onFocusCompany(company)}
							/>
						))}
					</div>
				)}
			</div>
		</aside>
	);
}
