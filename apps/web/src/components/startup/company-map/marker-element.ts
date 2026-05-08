import { getCompanyInitials } from "~/components/startup/company-map/company-display";
import type { Company } from "~/lib/startup-api";

export function createCompanyMarkerElement(company: Company) {
	const element = document.createElement("div");
	element.className = "size-11";

	const button = document.createElement("button");
	button.type = "button";
	button.ariaLabel = company.name;
	button.className =
		"flex size-full items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-950 font-semibold text-xs text-white shadow-lg transition-transform hover:scale-110";

	const photo = company.photos.at(0);
	if (photo) {
		const image = document.createElement("img");
		image.alt = photo.altText || company.name;
		image.className = "h-full w-full object-cover";
		image.src = photo.url;
		button.append(image);
	} else {
		button.textContent = getCompanyInitials(company.name);
	}

	element.append(button);

	return element;
}
