import type { Company } from "~/lib/startup-api";

export function getCompanyInitials(name: string) {
	return name
		.split(" ")
		.map((part) => part.at(0))
		.filter(Boolean)
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

export function getCompanyResultSummary(company: Company) {
	return [company.sector, company.city, company.employeeRange]
		.filter(Boolean)
		.join(" - ");
}
