import { sendTransactionalEmail } from "./resend";

interface SendHouseholdInviteEmailInput {
	to: string;
	inviteeName: string;
	ownerName: string;
	inviteUrl: string;
	expiresAt: Date;
}

const HOUSEHOLD_INVITE_SUBJECT = "You've been invited to join a household";

function formatExpiry(expiresAt: Date): string {
	return expiresAt.toLocaleString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZoneName: "short",
	});
}

export async function sendHouseholdInviteEmail(
	input: SendHouseholdInviteEmailInput,
): Promise<void> {
	const expiresText = formatExpiry(input.expiresAt);

	const html = `
		<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #0f172a;">
			<h2 style="margin-bottom: 8px;">You're invited to a household</h2>
			<p style="margin-top: 0;">Hi ${input.inviteeName},</p>
			<p>
				${input.ownerName} invited you to join their household dashboard.
				Household members have full dashboard access.
			</p>
			<p>
				<a href="${input.inviteUrl}" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: 600;">
					Accept household invite
				</a>
			</p>
			<p style="font-size: 14px; color: #475569;">This invite expires on ${expiresText}.</p>
			<p style="font-size: 14px; color: #475569; margin-bottom: 6px;">If the button does not work, use this link:</p>
			<p style="font-size: 14px;"><a href="${input.inviteUrl}">${input.inviteUrl}</a></p>
			<p style="font-size: 13px; color: #64748b; margin-top: 24px;">If you did not expect this invite, you can safely ignore this email.</p>
		</div>
	`;

	const text = [
		`Hi ${input.inviteeName},`,
		"",
		`${input.ownerName} invited you to join their household dashboard.`,
		"Household members have full dashboard access.",
		"",
		`Accept invite: ${input.inviteUrl}`,
		`This invite expires on ${expiresText}.`,
		"",
		"If you did not expect this invite, you can safely ignore this email.",
	].join("\n");

	await sendTransactionalEmail({
		to: input.to,
		subject: HOUSEHOLD_INVITE_SUBJECT,
		html,
		text,
	});
}
