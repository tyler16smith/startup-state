"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";

export type OnboardingVersion = "v1" | "v2";

type VersionSelectProps = {
	value: OnboardingVersion;
	v1Href?: string;
	v2Href?: string;
};

function versionHref(
	pathname: string,
	search: URLSearchParams,
	version: string,
) {
	const params = new URLSearchParams(search);
	if (version === "v1") params.delete("v");
	else params.set("v", "2");
	const query = params.toString();
	return query ? `${pathname}?${query}` : pathname;
}

export function VersionSelect({ value, v1Href, v2Href }: VersionSelectProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	return (
		<Select
			onValueChange={(nextValue) => {
				if (nextValue === "v1") {
					router.push(v1Href ?? versionHref(pathname, searchParams, "v1"));
					return;
				}
				router.push(v2Href ?? versionHref(pathname, searchParams, "v2"));
			}}
			value={value}
		>
			<SelectTrigger
				aria-label="Onboarding version"
				className="w-24 bg-white"
				size="sm"
			>
				<SelectValue />
			</SelectTrigger>
			<SelectContent align="start">
				<SelectItem value="v1">V1</SelectItem>
				<SelectItem value="v2">V2</SelectItem>
			</SelectContent>
		</Select>
	);
}
