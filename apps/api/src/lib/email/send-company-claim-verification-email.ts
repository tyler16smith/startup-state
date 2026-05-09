import { sendTransactionalEmail } from "./resend";

interface SendCompanyClaimVerificationEmailInput {
	to: string;
	companyName: string;
	verificationUrl: string;
	expiresAt: Date;
}

const COMPANY_CLAIM_VERIFICATION_SUBJECT = "Verify your work email";

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

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

export async function sendCompanyClaimVerificationEmail(
	input: SendCompanyClaimVerificationEmailInput,
): Promise<void> {
	const companyName = escapeHtml(input.companyName);
	const verificationUrl = escapeHtml(input.verificationUrl);
	const expiresText = escapeHtml(formatExpiry(input.expiresAt));

	const html = `
		<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #0f172a;">
			<h2 style="margin-bottom: 8px;">Verify your work email</h2>
			<p style="margin-top: 0;">Confirm this email address to continue your claim for ${companyName}.</p>
			<p>
				<a href="${verificationUrl}" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: 600;">
					Verify email
				</a>
			</p>
			<p style="font-size: 14px; color: #475569;">This link expires on ${expiresText}.</p>
			<p style="font-size: 14px; color: #475569; margin-bottom: 6px;">If the button does not work, use this link:</p>
			<p style="font-size: 14px;"><a href="${verificationUrl}">${verificationUrl}</a></p>
			<p style="font-size: 13px; color: #64748b; margin-top: 24px;">If you did not request this claim, you can safely ignore this email.</p>
		</div>
	`;

	const text = [
		"Verify your work email",
		"",
		`Confirm this email address to continue your claim for ${input.companyName}.`,
		"",
		`Verify email: ${input.verificationUrl}`,
		`This link expires on ${formatExpiry(input.expiresAt)}.`,
		"",
		"If you did not request this claim, you can safely ignore this email.",
	].join("\n");

	await sendTransactionalEmail({
		to: input.to,
		subject: COMPANY_CLAIM_VERIFICATION_SUBJECT,
		html,
		text,
	});
}
