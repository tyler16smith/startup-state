"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	createHouseholdInvite,
	getHouseholdState,
	resendHouseholdInvite,
	revokeHouseholdInvite,
} from "~/lib/api/household";
import { SettingsSection } from "../settings-section";
import { HouseholdMemberCard } from "./household-member-card";
import { InviteMemberCard } from "./invite-member-card";
import { PendingInviteCard } from "./pending-invite-card";

const HOUSEHOLD_QUERY_KEY = ["household", "state"] as const;

export function HouseholdSection() {
	const queryClient = useQueryClient();
	const [showInviteForm, setShowInviteForm] = useState(false);

	const householdStateQuery = useQuery({
		queryKey: HOUSEHOLD_QUERY_KEY,
		queryFn: getHouseholdState,
	});

	const createInviteMutation = useMutation({
		mutationFn: createHouseholdInvite,
		onSuccess: async () => {
			setShowInviteForm(false);
			toast.success("Household invite sent");
			await queryClient.invalidateQueries({ queryKey: HOUSEHOLD_QUERY_KEY });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to send invite",
			);
		},
	});

	const resendInviteMutation = useMutation({
		mutationFn: resendHouseholdInvite,
		onSuccess: async () => {
			toast.success("Invite resent");
			await queryClient.invalidateQueries({ queryKey: HOUSEHOLD_QUERY_KEY });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to resend invite",
			);
		},
	});

	const revokeInviteMutation = useMutation({
		mutationFn: revokeHouseholdInvite,
		onSuccess: async () => {
			toast.success("Invite revoked");
			await queryClient.invalidateQueries({ queryKey: HOUSEHOLD_QUERY_KEY });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to revoke invite",
			);
		},
	});

	if (householdStateQuery.isLoading) {
		return (
			<SettingsSection title="Household">
				<Card>
					<CardHeader>
						<CardTitle>Household</CardTitle>
						<CardDescription>
							Share your financial dashboard with your household.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-muted-foreground text-sm">
							Loading household...
						</p>
					</CardContent>
				</Card>
			</SettingsSection>
		);
	}

	if (householdStateQuery.isError || !householdStateQuery.data) {
		return (
			<SettingsSection title="Household">
				<Card>
					<CardHeader>
						<CardTitle>Household</CardTitle>
						<CardDescription>
							Share your financial dashboard with your household.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Alert variant="destructive">
							<AlertDescription>
								{householdStateQuery.error instanceof Error
									? householdStateQuery.error.message
									: "Unable to load household right now."}
							</AlertDescription>
						</Alert>
					</CardContent>
				</Card>
			</SettingsSection>
		);
	}

	const { owner, membership, pendingInvite } = householdStateQuery.data;
	const canInvite = !membership && !pendingInvite;

	return (
		<SettingsSection title="Household">
			<Card>
				<CardContent className="space-y-5">
					<HouseholdMemberCard membership={membership} owner={owner} />

					{pendingInvite && (
						<PendingInviteCard
							invite={pendingInvite}
							isResending={resendInviteMutation.isPending}
							isRevoking={revokeInviteMutation.isPending}
							onResend={() => resendInviteMutation.mutate(pendingInvite.id)}
							onRevoke={() => revokeInviteMutation.mutate(pendingInvite.id)}
						/>
					)}

					{canInvite && (
						<div className="pt-5">
							{canInvite && !showInviteForm && (
								<Button
									onClick={() => setShowInviteForm(true)}
									size="sm"
									variant="outline"
								>
									<Plus className="m-2 h-4 w-4" />
									New Member
								</Button>
							)}

							{showInviteForm && canInvite && (
								<InviteMemberCard
									isSubmitting={createInviteMutation.isPending}
									onCancel={() => setShowInviteForm(false)}
									onSubmit={(input) => createInviteMutation.mutate(input)}
								/>
							)}
						</div>
					)}

					<p className="mt-2 -mb-4 flex w-full justify-center text-muted-foreground/60 text-xs">
						Only one household member can be invited at a time.
					</p>
				</CardContent>
			</Card>
		</SettingsSection>
	);
}
