import { redirect } from "next/navigation";
import { AudienceSelector } from "~/components/startup/audience-selector";
import { getLatestNavigatorPlan } from "~/lib/startup-server-api";
import { auth } from "~/server/auth";

export default async function Home() {
	const session = await auth();
	if (session?.user) {
		const plan = await getLatestNavigatorPlan();
		if (plan) redirect("/plan");
	}
	return <AudienceSelector />;
}
