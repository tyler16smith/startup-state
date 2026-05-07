import {
	ArrowUpRight,
	BriefcaseBusiness,
	Calendar,
	MapPin,
	Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyCard } from "~/components/startup/company-card";
import { SiteShell } from "~/components/startup/site-shell";
import { Button } from "~/components/ui/button";
import type { Company } from "~/lib/startup-api";
import { getCompany } from "~/lib/startup-server-api";

export default async function CompanyProfilePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	let company: Company;
	try {
		company = await getCompany(id);
	} catch {
		notFound();
	}
	const photos = company.photos.length
		? company.photos
		: [{ url: "", altText: company.name }];
	return (
		<SiteShell>
			<main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
				<section
					className="overflow-hidden rounded-lg border bg-white shadow-sm"
					id="company-overview"
				>
					<div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
						<div className="p-6 sm:p-8">
							<p className="font-medium text-emerald-700 text-sm">
								{company.sector ?? "Utah startup"}
							</p>
							<h1 className="mt-3 font-semibold text-5xl tracking-normal">
								{company.name}
							</h1>
							<p className="mt-5 max-w-3xl text-muted-foreground leading-7">
								{company.description ??
									"A Utah ecosystem company profile ready for richer imported data."}
							</p>
							<div className="mt-6 flex flex-wrap gap-3">
								<Button asChild>
									<Link href={`/companies/${company.id}/claim`}>
										Claim this listing
									</Link>
								</Button>
								{company.websiteUrl && (
									<Button asChild variant="outline">
										<a
											href={company.websiteUrl}
											rel="noreferrer"
											target="_blank"
										>
											Website <ArrowUpRight className="size-4" />
										</a>
									</Button>
								)}
							</div>
						</div>
						<div className="relative min-h-80 bg-slate-100">
							{photos[0]?.url ? (
								<Image
									alt={photos[0].altText ?? company.name}
									className="object-cover"
									fill
									src={photos[0].url}
									unoptimized
								/>
							) : (
								<div className="flex h-full min-h-80 items-center justify-center bg-[linear-gradient(135deg,#0f172a,#0f766e)] text-white">
									<span className="font-semibold text-5xl">
										{company.name.slice(0, 2).toUpperCase()}
									</span>
								</div>
							)}
						</div>
					</div>
				</section>
				<section
					className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4"
					id="company-facts"
				>
					<Fact
						icon={Users}
						label="Employees"
						value={
							company.employeeRange ??
							company.employees?.toString() ??
							"Unknown"
						}
					/>
					<Fact
						icon={Calendar}
						label="Founded"
						value={company.yearFounded?.toString() ?? "Unknown"}
					/>
					<Fact
						icon={MapPin}
						label="Location"
						value={
							[company.city, company.county].filter(Boolean).join(", ") ||
							"Utah"
						}
					/>
					<Fact
						icon={BriefcaseBusiness}
						label="Hiring"
						value={company.hiringStatus.replace(/_/g, " ").toLowerCase()}
					/>
				</section>
				<section className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
					<div
						className="rounded-lg border bg-white p-6 shadow-sm"
						id="company-details"
					>
						<h2 className="font-semibold text-2xl">Company details</h2>
						<dl className="mt-5 grid gap-4 text-sm md:grid-cols-2">
							<Detail label="LinkedIn" value={company.linkedinUrl} />
							<Detail
								label="Address"
								value={[
									company.address,
									company.city,
									company.state,
									company.postalCode,
								]
									.filter(Boolean)
									.join(", ")}
							/>
							<Detail label="Stage" value={company.stage} />
							<Detail label="Job postings" value={company.jobPostingsUrl} />
						</dl>
					</div>
					<div
						className="rounded-lg border bg-white p-6 shadow-sm"
						id="company-map"
					>
						<h2 className="font-semibold text-2xl">Map preview</h2>
						<div className="mt-4 flex aspect-square items-center justify-center rounded-lg bg-slate-100 text-center text-muted-foreground text-sm">
							{company.latitude && company.longitude
								? `${company.latitude}, ${company.longitude}`
								: "Coordinates not available yet"}
						</div>
					</div>
				</section>
				{company.related?.length ? (
					<section className="mt-10" id="company-related">
						<h2 className="mb-4 font-semibold text-2xl">Related companies</h2>
						<div className="grid gap-5 md:grid-cols-3">
							{company.related.map((item) => (
								<CompanyCard company={item} key={item.id} />
							))}
						</div>
					</section>
				) : null}
			</main>
		</SiteShell>
	);
}

function Fact({
	icon: Icon,
	label,
	value,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string;
}) {
	return (
		<div className="rounded-lg border bg-white p-5 shadow-sm">
			<Icon className="size-5 text-emerald-700" />
			<p className="mt-3 text-muted-foreground text-sm">{label}</p>
			<p className="mt-1 font-semibold capitalize">{value}</p>
		</div>
	);
}

function Detail({ label, value }: { label: string; value?: string | null }) {
	return (
		<div>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="mt-1 break-words font-medium">{value || "Not listed"}</dd>
		</div>
	);
}
