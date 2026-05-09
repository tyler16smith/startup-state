import {
	ArrowUpRight,
	BriefcaseBusiness,
	Calendar,
	MapPin,
	Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CompanyCard } from "~/components/startup/company-card";
import { Button } from "~/components/ui/button";
import type { Company } from "~/lib/startup-api";

type CompanyProfileLayout = "page" | "panel";

export function CompanyProfileContent({
	company,
	layout = "page",
	mapToken,
}: {
	company: Company;
	layout?: CompanyProfileLayout;
	mapToken?: string;
}) {
	const photos = company.photos.length
		? company.photos
		: [{ url: "", altText: company.name }];
	const isPanel = layout === "panel";
	const showClaimButton = !company.isClaimed;

	return (
		<div className={isPanel ? "space-y-5" : undefined}>
			<section
				className="overflow-hidden rounded-lg border bg-white shadow-sm"
				id="company-overview"
			>
				<div
					className={
						isPanel ? "grid gap-0" : "grid gap-0 lg:grid-cols-[1.1fr_0.9fr]"
					}
				>
					<div className={isPanel ? "p-5" : "p-6 sm:p-8"}>
						<p className="font-medium text-emerald-700 text-sm">
							{company.sector ?? "Utah startup"}
						</p>
						<h1
							className={[
								"mt-3 font-semibold tracking-normal",
								isPanel ? "text-3xl" : "text-5xl",
							].join(" ")}
						>
							{company.name}
						</h1>
						<p className="mt-5 max-w-3xl text-muted-foreground leading-7">
							{company.description ??
								"A Utah ecosystem company profile ready for richer imported data."}
						</p>
						<div className="mt-6 flex flex-wrap gap-3">
							{showClaimButton ? (
								<Button asChild>
									<Link href={`/companies/${company.id}/claim`}>
										Claim this listing
									</Link>
								</Button>
							) : null}
							{company.websiteUrl && (
								<Button asChild variant="outline">
									<a href={company.websiteUrl} rel="noreferrer" target="_blank">
										Website <ArrowUpRight className="size-4" />
									</a>
								</Button>
							)}
						</div>
					</div>
					<div
						className={
							isPanel
								? "relative min-h-56 bg-slate-100"
								: "relative min-h-80 bg-slate-100"
						}
					>
						{photos[0]?.url ? (
							<Image
								alt={photos[0].altText ?? company.name}
								className="object-contain p-4"
								fill
								src={photos[0].url}
								unoptimized
							/>
						) : (
							<div className="flex h-full min-h-56 items-center justify-center bg-[linear-gradient(135deg,#0f172a,#0f766e)] text-white">
								<span className="font-semibold text-5xl">
									{company.name.slice(0, 2).toUpperCase()}
								</span>
							</div>
						)}
					</div>
				</div>
			</section>
			<section
				className={[
					"grid gap-5",
					isPanel ? "grid-cols-2" : "mt-8 md:grid-cols-2 lg:grid-cols-4",
				].join(" ")}
				id="company-facts"
			>
				<Fact
					icon={Users}
					label="Employees"
					value={
						company.employeeRange ?? company.employees?.toString() ?? "Unknown"
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
						[company.city, company.county].filter(Boolean).join(", ") || "Utah"
					}
				/>
				<Fact
					icon={BriefcaseBusiness}
					label="Hiring"
					value={company.hiringStatus.replace(/_/g, " ").toLowerCase()}
				/>
			</section>
			<section
				className={
					isPanel ? "grid gap-5" : "mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]"
				}
			>
				<div
					className="rounded-lg border bg-white p-6 shadow-sm"
					id="company-details"
				>
					<h2 className="font-semibold text-2xl">Company details</h2>
					<dl
						className={
							isPanel
								? "mt-5 grid gap-4 text-sm"
								: "mt-5 grid gap-4 text-sm md:grid-cols-2"
						}
					>
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
				{!isPanel && (
					<div
						className="rounded-lg border bg-white p-6 shadow-sm"
						id="company-map"
					>
						<h2 className="font-semibold text-2xl">Map preview</h2>
						<CompanyMapPreview company={company} mapToken={mapToken} />
					</div>
				)}
			</section>
			{company.related?.length ? (
				<section
					className={isPanel ? "space-y-4" : "mt-10"}
					id="company-related"
				>
					<h2 className="font-semibold text-2xl">Related companies</h2>
					<div className={isPanel ? "grid gap-5" : "grid gap-5 md:grid-cols-3"}>
						{company.related.map((item) => (
							<CompanyCard company={item} key={item.id} />
						))}
					</div>
				</section>
			) : null}
		</div>
	);
}

function CompanyMapPreview({
	company,
	mapToken,
}: {
	company: Company;
	mapToken?: string;
}) {
	const latitude = company.latitude;
	const longitude = company.longitude;
	const hasCoordinates =
		typeof latitude === "number" && typeof longitude === "number";

	if (!hasCoordinates) {
		return (
			<div className="mt-4 flex aspect-square items-center justify-center rounded-lg bg-slate-100 px-4 text-center text-muted-foreground text-sm">
				Map location not available yet
			</div>
		);
	}

	if (!mapToken) {
		return (
			<div className="mt-4 flex aspect-square items-center justify-center rounded-lg bg-slate-100 px-4 text-center text-muted-foreground text-sm">
				Map unavailable
			</div>
		);
	}

	const marker = `pin-s+059669(${longitude},${latitude})`;
	const imageUrl = `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${marker}/${longitude},${latitude},12,0/640x640@2x?access_token=${encodeURIComponent(
		mapToken,
	)}`;
	const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

	return (
		<a
			aria-label={`Open ${company.name} in maps`}
			className="mt-4 block aspect-square overflow-hidden rounded-lg border bg-center bg-cover bg-slate-100 transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-emerald-700 focus-visible:outline-offset-2"
			href={directionsUrl}
			rel="noreferrer"
			style={{ backgroundImage: `url("${imageUrl}")` }}
			target="_blank"
		>
			<span className="sr-only">Map preview for {company.name}</span>
		</a>
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
