"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DEFAULT_COMPANY_MAP_FILTERS } from "~/components/startup/company-map/constants";
import { getActiveFilterCount } from "~/components/startup/company-map/filter-companies";
import { getCompanyMapFilterOptions } from "~/components/startup/company-map/filter-options";
import type {
	CompanyMapArrayFilterKey,
	CompanyMapFilters,
} from "~/components/startup/company-map/types";
import { useCompanies } from "~/components/startup/company-map/use-companies";
import { apiClient } from "~/lib/startup-api";
import { CompanyDetailsSection } from "./company-details-section";
import { FounderDescriptionSection } from "./founder-description-section";
import { OnboardingV2Shell } from "./onboarding-v2-shell";
import {
	mapFounderV2Profile,
	selectedDropdownValueCount,
} from "./profile-mappers";

const STORAGE_KEY = "startup-founder-intake";
const RESULT_KEY = "startup-founder-result";

type LandingPageSummary = {
	description: string;
	markdownLength: number;
	url: string;
};

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

export function FounderV2IntakeForm() {
	const router = useRouter();
	const { companies } = useCompanies();
	const [filters, setFilters] = useState<CompanyMapFilters>({
		...DEFAULT_COMPANY_MAP_FILTERS,
	});
	const [descriptionMode, setDescriptionMode] = useState<"import" | "manual">(
		"import",
	);
	const [landingPageUrl, setLandingPageUrl] = useState("");
	const [description, setDescription] = useState("");
	const [importLoading, setImportLoading] = useState(false);
	const [importError, setImportError] = useState<string | null>(null);

	const filterOptions = useMemo(
		() => getCompanyMapFilterOptions(companies),
		[companies],
	);
	const activeFilterCount = getActiveFilterCount(filters);
	const selectedValueCount = selectedDropdownValueCount(filters);
	const nextDisabled = selectedValueCount < 3 || !description.trim();

	async function importLandingPage() {
		setImportLoading(true);
		setImportError(null);
		try {
			const data = await apiClient<LandingPageSummary>(
				"/api/v1/landingPages/summarize",
				{
					method: "POST",
					body: JSON.stringify({ url: landingPageUrl }),
				},
			);
			setLandingPageUrl(data.url);
			setDescription(data.description);
			toast.success("Landing page imported");
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Could not import landing page";
			setImportError(message);
			toast.error(message);
		} finally {
			setImportLoading(false);
		}
	}

	function loadRecommendations() {
		const profile = mapFounderV2Profile(filters, description);
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
		sessionStorage.removeItem(RESULT_KEY);
		router.push("/founder/results");
	}

	return (
		<OnboardingV2Shell
			nextDisabled={nextDisabled}
			onBack={() => router.push("/?choosePath=1&v=2")}
			onNext={loadRecommendations}
			title="What are you building?"
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
				<FounderDescriptionSection
					description={description}
					error={importError}
					landingPageUrl={landingPageUrl}
					loading={importLoading}
					mode={descriptionMode}
					onDescriptionChange={setDescription}
					onImport={importLandingPage}
					onLandingPageUrlChange={setLandingPageUrl}
					onModeChange={setDescriptionMode}
				/>
			</div>
		</OnboardingV2Shell>
	);
}
