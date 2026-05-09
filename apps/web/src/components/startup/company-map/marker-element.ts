import { getCompanyInitials } from "~/components/startup/company-map/company-display";
import type { Company } from "~/lib/startup-api";

const markerElementBaseClass = "size-11 transition-all duration-300 ease-out";
const markerButtonBaseClass =
	"flex size-full items-center justify-center overflow-hidden rounded-full bg-slate-950 font-semibold text-xs text-white transition-all duration-300 ease-out hover:scale-110";

export function setCompanyMarkerSelected(
	element: HTMLElement,
	selected: boolean,
) {
	const button = element.querySelector("button");
	element.className = [
		markerElementBaseClass,
		selected ? "scale-125" : "scale-100",
	].join(" ");
	element.style.zIndex = selected ? "10" : "";
	if (!button) return;
	button.className = [
		markerButtonBaseClass,
		selected
			? "border-2 border-emerald-500 shadow-2xl ring-4 ring-emerald-200"
			: "border-2 border-white shadow-lg",
	].join(" ");
}

export function createCompanyMarkerElement(company: Company, selected = false) {
	const element = document.createElement("div");
	element.className = markerElementBaseClass;

	const button = document.createElement("button");
	button.type = "button";
	button.ariaLabel = company.name;

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
	setCompanyMarkerSelected(element, selected);

	return element;
}
