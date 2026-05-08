"use client";

import { getOnboardingData } from "@app/client-ts";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function OnboardingRedirectGuard() {
	const router = useRouter();

	const onboardingQuery = useQuery({
		queryKey: ["onboarding", "getOnboardingData", "dashboardGuard"],
		queryFn: async () => {
			const response = await getOnboardingData();

			if (response.status !== 200 && response.status !== 304) {
				throw new Error("Failed to load onboarding status");
			}

			return response.data.data;
		},
		refetchOnWindowFocus: false,
		retry: false,
		staleTime: 5 * 60 * 1000,
	});

	useEffect(() => {
		if (!onboardingQuery.isFetched || !onboardingQuery.data) return;

		if (!onboardingQuery.data.hasCompletedInitialOnboarding) {
			router.replace("/onboarding");
		}
	}, [onboardingQuery.data, onboardingQuery.isFetched, router]);

	return null;
}
