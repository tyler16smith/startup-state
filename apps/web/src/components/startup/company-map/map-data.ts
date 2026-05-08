import type { CompanyFeatureCollection } from "~/components/startup/company-map/types";
import type { Company } from "~/lib/startup-api";

export function getCompanyCoordinates(
	company: Company,
): [number, number] | null {
	const { latitude, longitude } = company;
	if (typeof latitude !== "number" || typeof longitude !== "number") {
		return null;
	}

	return [longitude, latitude];
}

export function createCompanyFeatureCollection(
	companies: Company[],
): CompanyFeatureCollection {
	return {
		features: companies.flatMap((company) => {
			const coordinates = getCompanyCoordinates(company);
			if (!coordinates) return [];

			return [
				{
					geometry: {
						coordinates,
						type: "Point" as const,
					},
					properties: {
						companyId: company.id,
						name: company.name,
					},
					type: "Feature" as const,
				},
			];
		}),
		type: "FeatureCollection",
	};
}
