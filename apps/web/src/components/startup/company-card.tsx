import { ArrowUpRight, MapPin, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type { Company } from "~/lib/startup-api";

export function CompanyCard({ company }: { company: Company }) {
	const photo = company.photos.at(0);
	return (
		<article className="overflow-hidden rounded-lg border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
			<div className="relative aspect-[16/7] bg-slate-100">
				{photo ? (
					<Image
						alt={photo.altText || company.name}
						className="object-cover"
						fill
						src={photo.url}
						unoptimized
					/>
				) : (
					<div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,#0f172a,#0f766e)] text-white">
						<span className="font-semibold text-2xl">
							{company.name.slice(0, 2).toUpperCase()}
						</span>
					</div>
				)}
			</div>
			<div className="p-5">
				<div className="flex flex-wrap items-center gap-2">
					{company.sector && (
						<Badge className="rounded-md">{company.sector}</Badge>
					)}
					<Badge className="rounded-md" variant="secondary">
						{company.hiringStatus.replace(/_/g, " ").toLowerCase()}
					</Badge>
				</div>
				<Link href={`/companies/${company.id}`}>
					<h3 className="mt-3 truncate font-semibold text-xl leading-tight hover:text-emerald-700">
						{company.name}
					</h3>
				</Link>
				<p className="mt-2 line-clamp-3 text-muted-foreground text-sm">
					{company.description || "Utah startup ecosystem listing."}
				</p>
				<div className="mt-4 flex flex-wrap gap-4 text-muted-foreground text-sm">
					{company.city && (
						<span className="flex items-center gap-1">
							<MapPin className="size-4" />
							{company.city}
						</span>
					)}
					{company.employeeRange && (
						<span className="flex items-center gap-1">
							<Users className="size-4" />
							{company.employeeRange}
						</span>
					)}
				</div>
				<div className="mt-5 flex justify-end">
					<Button asChild size="sm" variant="outline">
						<Link href={`/companies/${company.id}`}>
							Profile <ArrowUpRight className="size-4" />
						</Link>
					</Button>
				</div>
			</div>
		</article>
	);
}
