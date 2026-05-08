import { InvestorResults } from "~/components/startup/investor-results";

export default function InvestorResultsPage() {
	return <InvestorResults mapToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} />;
}
