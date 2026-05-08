export type HouseholdMembershipSummary = {
	id: string;
	status: "ACTIVE" | "REMOVED";
	createdAt: string;
	updatedAt: string;
	member: {
		id: string;
		name: string | null;
		email: string | null;
		access: "FULL_ACCESS";
	};
};

export type HouseholdInviteSummary = {
	id: string;
	inviteeName: string;
	inviteeEmail: string;
	status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
	createdAt: string;
	expiresAt: string;
	sentAt: string | null;
};

export type HouseholdState = {
	owner: {
		id: string;
		name: string | null;
		email: string | null;
	};
	membership: HouseholdMembershipSummary | null;
	pendingInvite: HouseholdInviteSummary | null;
};

export type CreateHouseholdInviteInput = {
	name: string;
	email: string;
};
