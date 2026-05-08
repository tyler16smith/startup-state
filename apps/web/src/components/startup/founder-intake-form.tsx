"use client";

import {
	BadgeDollarSign,
	BookOpen,
	BriefcaseBusiness,
	Building2,
	Factory,
	GraduationCap,
	Handshake,
	HeartPulse,
	Landmark,
	Lightbulb,
	MapPin,
	Network,
	Rocket,
	Scale,
	Search,
	ShieldCheck,
	ShoppingBag,
	Sparkles,
	TrendingUp,
	Users,
	Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NavigatorShell } from "~/components/startup/navigator-flow/navigator-shell";
import {
	type NavigatorOption,
	OptionGrid,
} from "~/components/startup/navigator-flow/option-grid";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { FounderProfileInput } from "~/lib/startup-api";

const STORAGE_KEY = "startup-founder-intake";

const sectorOptions: NavigatorOption[] = [
	{ id: "Software", label: "Software", icon: Sparkles },
	{ id: "Fintech", label: "Fintech", icon: BadgeDollarSign },
	{ id: "Health", label: "Health", icon: HeartPulse },
	{ id: "Aerospace", label: "Aerospace", icon: Rocket },
	{
		id: "Advanced manufacturing",
		label: "Advanced manufacturing",
		icon: Factory,
	},
	{ id: "Consumer", label: "Consumer", icon: ShoppingBag },
	{ id: "Energy", label: "Energy", icon: Wrench },
	{ id: "Education", label: "Education", icon: GraduationCap },
];

const goalOptions: NavigatorOption[] = [
	{ id: "Capital", label: "Capital", icon: BadgeDollarSign },
	{ id: "Mentorship", label: "Mentorship", icon: Handshake },
	{ id: "Grants", label: "Grants", icon: Landmark },
	{ id: "Education", label: "Education", icon: BookOpen },
	{ id: "Networking", label: "Networking", icon: Network },
	{ id: "Exporting", label: "Exporting", icon: Rocket },
	{ id: "Legal help", label: "Legal help", icon: Scale },
	{ id: "Hiring", label: "Hiring", icon: Users },
];

const fundingOptions: NavigatorOption[] = [
	{ id: "Grants", label: "Grants", icon: Landmark },
	{ id: "Angel investment", label: "Angel investment", icon: Sparkles },
	{ id: "Venture capital", label: "Venture capital", icon: TrendingUp },
	{ id: "Loans", label: "Loans", icon: Building2 },
	{
		id: "Revenue-based financing",
		label: "Revenue-based financing",
		icon: BadgeDollarSign,
	},
];

const businessTypeOptions: NavigatorOption[] = [
	{ id: "B2B", label: "B2B", icon: BriefcaseBusiness },
	{ id: "B2C", label: "B2C", icon: ShoppingBag },
	{ id: "Marketplace", label: "Marketplace", icon: Network },
	{ id: "Deep tech", label: "Deep tech", icon: Rocket },
	{ id: "Main street", label: "Main street", icon: Building2 },
	{ id: "Nonprofit", label: "Nonprofit", icon: ShieldCheck },
];

const stageOptions: NavigatorOption[] = [
	{ id: "IDEA", label: "Idea", icon: Lightbulb },
	{ id: "PRE_REVENUE", label: "Pre revenue", icon: Rocket },
	{ id: "EARLY_REVENUE", label: "Early revenue", icon: TrendingUp },
	{ id: "GROWTH", label: "Growth", icon: Sparkles },
	{ id: "SCALING", label: "Scaling", icon: Building2 },
];

const regionOptions: NavigatorOption[] = [
	{ id: "Northern Utah", label: "Northern Utah", icon: MapPin },
	{ id: "Wasatch Front", label: "Wasatch Front", icon: MapPin },
	{ id: "Central Utah", label: "Central Utah", icon: MapPin },
	{ id: "Southern Utah", label: "Southern Utah", icon: MapPin },
	{ id: "Statewide", label: "Statewide", icon: Search },
];

const hiringOptions: NavigatorOption[] = [
	{ id: "UNKNOWN", label: "Not sure yet", icon: Search },
	{ id: "NOT_HIRING", label: "Not hiring", icon: ShieldCheck },
	{ id: "HIRING", label: "Hiring", icon: Users },
	{ id: "ACTIVELY_HIRING", label: "Actively hiring", icon: Rocket },
];

const defaultValues: FounderProfileInput = {
	sectors: [],
	goals: [],
	businessTypes: [],
	fundingNeeds: [],
};

function toggleValue(values: string[], value: string) {
	return values.includes(value)
		? values.filter((item) => item !== value)
		: [...values, value];
}

function StepHeader({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<div className="mx-auto mb-6 max-w-xl space-y-2 text-center">
			<h1 className="font-semibold text-2xl tracking-normal sm:text-3xl">
				{title}
			</h1>
			<p className="text-muted-foreground">{description}</p>
		</div>
	);
}

export function FounderIntakeForm() {
	const router = useRouter();
	const [step, setStep] = useState(0);
	const [direction, setDirection] = useState(1);
	const [values, setValues] = useState<FounderProfileInput>(defaultValues);

	useEffect(() => {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return;
		try {
			setValues({
				...defaultValues,
				...(JSON.parse(raw) as FounderProfileInput),
			});
		} catch {
			setValues(defaultValues);
		}
	}, []);

	useEffect(() => {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(values));
	}, [values]);

	function update(next: Partial<FounderProfileInput>) {
		setValues((current) => ({ ...current, ...next }));
	}

	function goNext() {
		if (step === 3) {
			sessionStorage.setItem(STORAGE_KEY, JSON.stringify(values));
			router.push("/founder/results");
			return;
		}
		setDirection(1);
		setStep((current) => current + 1);
	}

	function goBack() {
		setDirection(-1);
		setStep((current) => Math.max(0, current - 1));
	}

	const nextDisabled =
		(step === 0 && values.sectors.length === 0) ||
		(step === 1 && values.goals.length === 0) ||
		(step === 2 &&
			values.fundingNeeds.length === 0 &&
			values.businessTypes.length === 0);

	return (
		<NavigatorShell
			direction={direction}
			nextDisabled={nextDisabled}
			nextLabel={step === 3 ? "Show my action plan" : "Continue"}
			onBack={step > 0 ? goBack : undefined}
			onNext={goNext}
			step={step}
			totalSteps={4}
		>
			{step === 0 && (
				<div className="mx-auto w-full max-w-3xl">
					<StepHeader
						description="Choose every sector that describes your company."
						title="What are you building?"
					/>
					<OptionGrid
						columns="four"
						onToggle={(id) =>
							update({ sectors: toggleValue(values.sectors, id) })
						}
						options={sectorOptions}
						selected={values.sectors}
					/>
				</div>
			)}

			{step === 1 && (
				<div className="mx-auto w-full max-w-3xl">
					<StepHeader
						description="Select the outcomes that would make the next few months easier."
						title="What do you need most?"
					/>
					<OptionGrid
						columns="four"
						onToggle={(id) => update({ goals: toggleValue(values.goals, id) })}
						options={goalOptions}
						selected={values.goals}
					/>
				</div>
			)}

			{step === 2 && (
				<div className="mx-auto w-full max-w-4xl space-y-8">
					<StepHeader
						description="Add the capital path and business model signals that matter."
						title="What kind of support fits?"
					/>
					<fieldset className="space-y-4">
						<legend className="font-medium text-sm leading-none">
							Funding needs
						</legend>
						<OptionGrid
							onToggle={(id) =>
								update({ fundingNeeds: toggleValue(values.fundingNeeds, id) })
							}
							options={fundingOptions}
							selected={values.fundingNeeds}
						/>
					</fieldset>
					<fieldset className="space-y-4">
						<legend className="font-medium text-sm leading-none">
							Business type
						</legend>
						<OptionGrid
							columns="four"
							onToggle={(id) =>
								update({ businessTypes: toggleValue(values.businessTypes, id) })
							}
							options={businessTypeOptions}
							selected={values.businessTypes}
						/>
					</fieldset>
				</div>
			)}

			{step === 3 && (
				<div className="mx-auto w-full max-w-4xl space-y-8">
					<StepHeader
						description="A little context helps the recommendations get sharper."
						title="Where are you right now?"
					/>
					<div className="grid gap-8 lg:grid-cols-2">
						<fieldset className="space-y-4">
							<legend className="font-medium text-sm leading-none">
								Company stage
							</legend>
							<OptionGrid
								onToggle={(id) => update({ stage: id })}
								options={stageOptions}
								selected={values.stage ? [values.stage] : []}
							/>
						</fieldset>
						<fieldset className="space-y-4">
							<legend className="font-medium text-sm leading-none">
								Utah region
							</legend>
							<OptionGrid
								onToggle={(id) => update({ region: id })}
								options={regionOptions}
								selected={values.region ? [values.region] : []}
							/>
						</fieldset>
					</div>
					<div className="grid gap-4 md:grid-cols-3">
						<div className="space-y-2">
							<Label htmlFor="city">City</Label>
							<Input
								id="city"
								onChange={(event) => update({ city: event.target.value })}
								placeholder="Salt Lake City"
								value={values.city ?? ""}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="county">County</Label>
							<Input
								id="county"
								onChange={(event) => update({ county: event.target.value })}
								placeholder="Salt Lake"
								value={values.county ?? ""}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="keywords">Specific focus</Label>
							<Input
								id="keywords"
								onChange={(event) => update({ keywords: event.target.value })}
								placeholder="Clean energy grants"
								value={values.keywords ?? ""}
							/>
						</div>
					</div>
					<fieldset className="space-y-4">
						<legend className="font-medium text-sm leading-none">
							Hiring status
						</legend>
						<OptionGrid
							columns="four"
							onToggle={(id) => update({ hiringStatus: id })}
							options={hiringOptions}
							selected={values.hiringStatus ? [values.hiringStatus] : []}
						/>
					</fieldset>
				</div>
			)}
		</NavigatorShell>
	);
}
