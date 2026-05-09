import { ClaimActions } from "~/components/startup/claim-actions";
import { PageBreadcrumb } from "~/components/startup/page-breadcrumb";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { apiServer } from "~/lib/startup-server-api";

type Claim = {
	id: string;
	workEmail: string;
	explanation?: string | null;
	domainMatches: boolean;
	status:
		| "email_pending"
		| "pending_review"
		| "on_hold"
		| "approved"
		| "rejected";
	company: { name: string };
	user: { email?: string | null; name?: string | null };
};

const claimStatusLabel: Record<Claim["status"], string> = {
	email_pending: "email pending",
	pending_review: "pending review",
	on_hold: "on hold",
	approved: "approved",
	rejected: "rejected",
};

export default async function AdminClaimsPage() {
	const claims = await apiServer<Claim[]>("/api/v1/companies/claims");
	return (
		<main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
			<PageBreadcrumb
				items={[
					{ label: "Admin", href: "/admin" },
					{ label: "Company claims" },
				]}
			/>
			<div className="mb-8">
				<p className="font-medium text-emerald-700 text-sm">Admin</p>
				<h1 className="mt-2 font-semibold text-4xl tracking-normal">
					Company claims
				</h1>
				<p className="mt-3 text-muted-foreground">
					Approve, hold, or reject verified company ownership claims.
				</p>
			</div>
			<div className="rounded-lg border bg-white p-4 shadow-sm">
				<Table>
					<TableCaption>Company ownership claims awaiting review</TableCaption>
					<TableHeader>
						<TableRow>
							<TableHead>Company</TableHead>
							<TableHead>User</TableHead>
							<TableHead>Work email</TableHead>
							<TableHead>Domain</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{claims.map((claim) => (
							<TableRow key={claim.id}>
								<TableCell className="max-w-[14rem] font-medium">
									<span className="block truncate" title={claim.company.name}>
										{claim.company.name}
									</span>
								</TableCell>
								<TableCell>
									{claim.user.name ?? claim.user.email ?? "-"}
								</TableCell>
								<TableCell>{claim.workEmail}</TableCell>
								<TableCell>
									{claim.domainMatches ? "matches" : "review"}
								</TableCell>
								<TableCell>{claimStatusLabel[claim.status]}</TableCell>
								<TableCell className="text-right">
									<ClaimActions claimId={claim.id} status={claim.status} />
								</TableCell>
							</TableRow>
						))}
						{claims.length === 0 ? (
							<TableRow>
								<TableCell
									className="h-24 text-center text-muted-foreground"
									colSpan={6}
								>
									No company claims to review.
								</TableCell>
							</TableRow>
						) : null}
					</TableBody>
				</Table>
			</div>
		</main>
	);
}
