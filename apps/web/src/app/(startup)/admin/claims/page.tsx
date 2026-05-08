import { ClaimActions } from "~/components/startup/claim-actions";
import {
	Table,
	TableBody,
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
	status: string;
	company: { name: string };
	user: { email?: string | null; name?: string | null };
};

export default async function AdminClaimsPage() {
	const claims = await apiServer<Claim[]>("/api/v1/companies/claims");
	return (
		<main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
			<div className="mb-8">
				<p className="font-medium text-emerald-700 text-sm">Admin</p>
				<h1 className="mt-2 font-semibold text-4xl tracking-normal">
					Company claims
				</h1>
			</div>
			<div className="rounded-lg border bg-white p-4 shadow-sm">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Company</TableHead>
							<TableHead>User</TableHead>
							<TableHead>Work email</TableHead>
							<TableHead>Domain</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right">Review</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{claims.map((claim) => (
							<TableRow key={claim.id}>
								<TableCell className="font-medium">
									{claim.company.name}
								</TableCell>
								<TableCell>
									{claim.user.name ?? claim.user.email ?? "-"}
								</TableCell>
								<TableCell>{claim.workEmail}</TableCell>
								<TableCell>
									{claim.domainMatches ? "matches" : "review"}
								</TableCell>
								<TableCell>{claim.status}</TableCell>
								<TableCell className="text-right">
									<ClaimActions
										claimId={claim.id}
										disabled={claim.status !== "PENDING"}
									/>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</main>
	);
}
