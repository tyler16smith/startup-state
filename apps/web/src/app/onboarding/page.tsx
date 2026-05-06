import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { OnboardingFlow } from "./onboarding-flow";

export default async function OnboardingPage() {
	const session = await auth();
	if (!session?.user) redirect("/auth/signin");

	return <OnboardingFlow />;
}
