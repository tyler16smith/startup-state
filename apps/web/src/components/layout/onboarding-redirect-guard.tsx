"use client";

import { getOnboardingData } from "@app/client-ts";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useDemoMode } from "~/context/demo-mode-context";

export function OnboardingRedirectGuard() {
	const router = useRouter();
	const { isDemoMode } = useDemoMode();

	const onboardingQuery = useQuery({
		queryKey: ["onboarding", "getOnboardingData", "dashboardGuard"],
		queryFn: async () => {
			const response = await getOnboardingData();

			if (response.status !== 200 && response.status !== 304) {
				throw new Error("Failed to load onboarding status");
			}

			return response.data.data;
		},
		enabled: !isDemoMode,
		refetchOnWindowFocus: false,
		retry: false,
		staleTime: 5 * 60 * 1000,
	});

	useEffect(() => {
		if (isDemoMode || !onboardingQuery.isFetched || !onboardingQuery.data)
			return;

		if (!onboardingQuery.data.hasCompletedInitialOnboarding) {
			router.replace("/onboarding");
		}
	}, [isDemoMode, onboardingQuery.data, onboardingQuery.isFetched, router]);

	return null;
}
