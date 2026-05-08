import { redirect } from "next/navigation";
import { HouseholdSection } from "~/app/(startup)/settings/household-section";
import { auth } from "~/server/auth";
import { AccountDeletionSettings } from "./account-deletion-settings";
import { BillingSection } from "./billing-section";
import { McpSettingsSection } from "./mcp-settings-section";
import { ProfileSection } from "./profile-section";
import { SecuritySettings } from "./security-settings";

export default async function SecurityPage() {
	const session = await auth();
	if (!session?.user) redirect("/auth/signin");

	return (
		<div className="mx-auto max-w-2xl space-y-10 py-8">
			<div>
				<h1 className="font-semibold text-2xl">Account settings</h1>
				<p className="text-muted-foreground text-sm">
					Manage your account security settings.
				</p>
			</div>
			<ProfileSection />
			<HouseholdSection />
			<SecuritySettings />
			<McpSettingsSection />
			<AccountDeletionSettings />
		</div>
	);
}
