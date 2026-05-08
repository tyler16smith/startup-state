import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type { HouseholdState } from "./types";

interface HouseholdMemberCardProps {
	owner: HouseholdState["owner"];
	membership: HouseholdState["membership"];
}

function displayName(name: string | null, fallback: string) {
	const trimmed = name?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export function HouseholdMemberCard({
	owner,
	membership,
}: HouseholdMemberCardProps) {
	return (
		<div>
			<div className="flex items-center justify-between">
				<p className="font-medium text-sm">{displayName(owner.name, "You")}</p>
				<Badge variant="secondary">Owner</Badge>
			</div>
			<p className="text-muted-foreground text-xs">
				{owner.email ?? "No email"}
			</p>

			{membership && (
				<div>
					<div className="flex items-center justify-between gap-3">
						<div>
							<p className="font-medium text-sm">
								{displayName(
									membership.member.name,
									membership.member.email ?? "Household Member",
								)}
							</p>
							<p className="text-muted-foreground text-sm">
								{membership.member.email ?? "No email"}
							</p>
						</div>
						<Badge variant="outline">Full Access</Badge>
					</div>
					<div className="flex justify-end">
						<Button disabled size="sm" variant="outline">
							Remove member (coming soon)
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
