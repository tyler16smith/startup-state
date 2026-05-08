import Link from "next/link";
import { getCompanyResultSummary } from "~/components/startup/company-map/company-display";
import { Button } from "~/components/ui/button";
import type { Company } from "~/lib/startup-api";

type ResultCompanyRowProps = {
	active: boolean;
	company: Company;
	onClearSelected: () => void;
	onSelect: () => void;
};

export function ResultCompanyRow({
	active,
	company,
	onClearSelected,
	onSelect,
}: ResultCompanyRowProps) {
	const summary = getCompanyResultSummary(company);

	return (
		<div
			className="rounded-md px-3 py-3 transition hover:bg-white/80 data-[active=true]:bg-white data-[active=true]:shadow-sm"
			data-active={active}
		>
			<button className="w-full text-left" onClick={onSelect} type="button">
				<p className="font-medium text-slate-950">{company.name}</p>
				{summary && (
					<p className="mt-1 text-muted-foreground text-sm">{summary}</p>
				)}
			</button>
			{active && (
				<div className="mt-3 flex gap-2">
					<Button asChild size="sm">
						<Link href={`/companies/${company.id}`}>Open profile</Link>
					</Button>
					<Button onClick={onClearSelected} size="sm" variant="outline">
						Close
					</Button>
				</div>
			)}
		</div>
	);
}
