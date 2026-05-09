import Image from "next/image";
import Link from "next/link";
import {
	getCompanyInitials,
	getCompanyResultSummary,
} from "~/components/startup/company-map/company-display";
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
	const photo = company.photos.at(0);

	return (
		<div
			className="rounded-md px-3 py-3 transition hover:bg-white/80 data-[active=true]:bg-white data-[active=true]:shadow-sm"
			data-active={active}
		>
			<button
				className="grid w-full grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-3 text-left"
				onClick={onSelect}
				type="button"
			>
				<span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-950 font-semibold text-white text-xs shadow-sm">
					{photo ? (
						<Image
							alt={photo.altText || company.name}
							className="object-cover"
							fill
							src={photo.url}
							unoptimized
						/>
					) : (
						getCompanyInitials(company.name)
					)}
				</span>
				<div className="min-w-0">
					<p className="truncate font-medium text-slate-950">{company.name}</p>
					{summary && (
						<p className="mt-1 text-muted-foreground text-sm">{summary}</p>
					)}
				</div>
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
