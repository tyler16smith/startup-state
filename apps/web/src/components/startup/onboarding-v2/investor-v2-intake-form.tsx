"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DEFAULT_COMPANY_MAP_FILTERS } from "~/components/startup/company-map/constants";
import { getActiveFilterCount } from "~/components/startup/company-map/filter-companies";
import { getCompanyMapFilterOptions } from "~/components/startup/company-map/filter-options";
import type {
	CompanyMapArrayFilterKey,
	CompanyMapFilters,
} from "~/components/startup/company-map/types";
import { useCompanies } from "~/components/startup/company-map/use-companies";
import { CompanyDetailsSection } from "./company-details-section";
import { InvestorDescriptionSection } from "./investor-description-section";
import { OnboardingV2Shell } from "./onboarding-v2-shell";
import {
	mapInvestorV2Profile,
	selectedDropdownValueCount,
} from "./profile-mappers";

const STORAGE_KEY = "startup-investor-intake";
const RESULT_KEY = "startup-investor-result";

function toggleFilterValue(
	filters: CompanyMapFilters,
	key: CompanyMapArrayFilterKey,
	value: string,
) {
	const values = filters[key];
	return {
		...filters,
		[key]: values.includes(value)
			? values.filter((item) => item !== value)
			: [...values, value],
	};
}

export function InvestorV2IntakeForm() {
	const router = useRouter();
	const { companies } = useCompanies();
	const [filters, setFilters] = useState<CompanyMapFilters>({
		...DEFAULT_COMPANY_MAP_FILTERS,
	});
	const [description, setDescription] = useState("");

	const filterOptions = useMemo(
		() => getCompanyMapFilterOptions(companies),
		[companies],
	);
	const activeFilterCount = getActiveFilterCount(filters);
	const selectedValueCount = selectedDropdownValueCount(filters);
	const nextDisabled = selectedValueCount < 3 || !description.trim();

	function loadRecommendations() {
		const profile = mapInvestorV2Profile(filters, description);
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
		sessionStorage.removeItem(RESULT_KEY);
		router.push("/investor/results");
	}

	return (
		<OnboardingV2Shell
			nextDisabled={nextDisabled}
			onBack={() => router.push("/?choosePath=1&v=2")}
			onNext={loadRecommendations}
			title="What are you looking for?"
		>
			<div className="space-y-9">
				<CompanyDetailsSection
					activeFilterCount={activeFilterCount}
					filterOptions={filterOptions}
					filters={filters}
					onClearFilter={(key) =>
						setFilters((current) => ({ ...current, [key]: [] }))
					}
					onClearFilters={() => setFilters({ ...DEFAULT_COMPANY_MAP_FILTERS })}
					onToggleFilter={(key, value) =>
						setFilters((current) => toggleFilterValue(current, key, value))
					}
				/>
				<InvestorDescriptionSection
					description={description}
					onDescriptionChange={setDescription}
				/>
			</div>
		</OnboardingV2Shell>
	);
}
