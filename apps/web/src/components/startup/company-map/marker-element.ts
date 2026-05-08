import { getCompanyInitials } from "~/components/startup/company-map/company-display";
import type { Company } from "~/lib/startup-api";

export function createCompanyMarkerElement(company: Company) {
	const element = document.createElement("button");
	element.type = "button";
	element.ariaLabel = company.name;
	element.className =
		"flex size-11 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-950 font-semibold text-xs text-white shadow-lg transition-transform hover:scale-110";

	const photo = company.photos.at(0);
	if (photo) {
		const image = document.createElement("img");
		image.alt = photo.altText || company.name;
		image.className = "h-full w-full object-cover";
		image.src = photo.url;
		element.append(image);
	} else {
		element.textContent = getCompanyInitials(company.name);
	}

	return element;
}
