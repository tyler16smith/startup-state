import { FounderIntakeForm } from "~/components/startup/founder-intake-form";
import { FounderV2IntakeForm } from "~/components/startup/onboarding-v2/founder-v2-intake-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FounderPage({
	searchParams,
}: {
	searchParams: SearchParams;
}) {
	const params = await searchParams;
	if (params.v === "2") return <FounderV2IntakeForm />;
	return <FounderIntakeForm />;
}
