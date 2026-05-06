import { useQuery } from "@tanstack/react-query";
import { getBillingStatus } from "~/lib/api/billing";

export function useBillingStatus() {
	return useQuery({
		queryKey: ["billing", "status"],
		queryFn: getBillingStatus,
		staleTime: 30_000,
	});
}
