import { InvestorIntakeForm } from "~/components/startup/investor-intake-form";
import { InvestorV2IntakeForm } from "~/components/startup/onboarding-v2/investor-v2-intake-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function InvestorPage({
	searchParams,
}: {
	searchParams: SearchParams;
}) {
	const params = await searchParams;
	if (params.v === "2") return <InvestorV2IntakeForm />;
	return <InvestorIntakeForm />;
}
