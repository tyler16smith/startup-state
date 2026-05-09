import { redirect } from "next/navigation";
import { AudienceSelector } from "~/components/startup/audience-selector";
import { getLatestNavigatorPlan } from "~/lib/startup-server-api";
import { auth } from "~/server/auth";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function hasChoosePathParam(
	params: Record<string, string | string[] | undefined>,
) {
	return params.choosePath !== undefined;
}

export default async function Home({
	searchParams,
}: {
	searchParams: SearchParams;
}) {
	const params = await searchParams;
	if (hasChoosePathParam(params)) return <AudienceSelector />;

	const session = await auth();
	if (session?.user) {
		const plan = await getLatestNavigatorPlan();
		if (plan) redirect("/plan");
	}
	return <AudienceSelector />;
}
