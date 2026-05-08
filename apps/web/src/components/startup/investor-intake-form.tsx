"use client";

import {
	BadgeDollarSign,
	Building2,
	Factory,
	GraduationCap,
	HeartPulse,
	Lightbulb,
	MapPin,
	Rocket,
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
import type { InvestorProfileInput } from "~/lib/startup-api";

const STORAGE_KEY = "startup-investor-intake";

const stageOptions: NavigatorOption[] = [
	{ id: "IDEA", label: "Idea", icon: Lightbulb },
	{ id: "PRE_REVENUE", label: "Pre revenue", icon: Rocket },
	{ id: "EARLY_REVENUE", label: "Early revenue", icon: TrendingUp },
	{ id: "GROWTH", label: "Growth", icon: Sparkles },
	{ id: "SCALING", label: "Scaling", icon: Building2 },
];

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

const regionOptions: NavigatorOption[] = [
	{ id: "Northern Utah", label: "Northern Utah", icon: MapPin },
	{ id: "Wasatch Front", label: "Wasatch Front", icon: MapPin },
	{ id: "Central Utah", label: "Central Utah", icon: MapPin },
	{ id: "Southern Utah", label: "Southern Utah", icon: MapPin },
	{ id: "UT", label: "Statewide", icon: Search },
];

const hiringOptions: NavigatorOption[] = [
	{ id: "HIRING", label: "Hiring", icon: Users },
	{ id: "ACTIVELY_HIRING", label: "Actively hiring", icon: Rocket },
	{ id: "NOT_HIRING", label: "Not hiring", icon: ShieldCheck },
	{ id: "UNKNOWN", label: "Unknown", icon: Search },
];

const researchGoalOptions: NavigatorOption[] = [
	{ id: "Deal sourcing", label: "Deal sourcing", icon: Search },
	{ id: "Market mapping", label: "Market mapping", icon: MapPin },
	{ id: "Hiring signal", label: "Hiring signal", icon: Users },
	{ id: "Growth companies", label: "Growth companies", icon: TrendingUp },
];

const defaultValues: InvestorProfileInput = {
	stages: [],
	sectors: [],
	regions: [],
	hiringStatuses: [],
	researchGoals: [],
};

function toggleValue(values: string[], value: string) {
	return values.includes(value)
		? values.filter((item) => item !== value)
		: [...values, value];
}

function toNumber(value: string) {
	if (!value.trim()) return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
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

export function InvestorIntakeForm() {
	const router = useRouter();
	const [step, setStep] = useState(0);
	const [direction, setDirection] = useState(1);
	const [values, setValues] = useState<InvestorProfileInput>(defaultValues);

	useEffect(() => {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return;
		try {
			setValues({
				...defaultValues,
				...(JSON.parse(raw) as InvestorProfileInput),
			});
		} catch {
			setValues(defaultValues);
		}
	}, []);

	useEffect(() => {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(values));
	}, [values]);

	function update(next: Partial<InvestorProfileInput>) {
		setValues((current) => ({ ...current, ...next }));
	}

	function goNext() {
		if (step === 2) {
			sessionStorage.setItem(STORAGE_KEY, JSON.stringify(values));
			router.push("/investor/results");
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
		(step === 0 && values.stages.length === 0) ||
		(step === 1 && values.sectors.length === 0);

	return (
		<NavigatorShell
			direction={direction}
			nextDisabled={nextDisabled}
			nextLabel={step === 2 ? "Load recommendations" : "Continue"}
			onBack={step > 0 ? goBack : undefined}
			onNext={goNext}
			step={step}
			totalSteps={3}
		>
			{step === 0 && (
				<div className="mx-auto w-full max-w-3xl">
					<StepHeader
						description="Select the company stages you want to research."
						title="What stage are you looking for?"
					/>
					<OptionGrid
						onToggle={(id) =>
							update({ stages: toggleValue(values.stages, id) })
						}
						options={stageOptions}
						selected={values.stages}
					/>
				</div>
			)}

			{step === 1 && (
				<div className="mx-auto w-full max-w-3xl">
					<StepHeader
						description="Choose the markets that fit your thesis or research question."
						title="Which sectors matter?"
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

			{step === 2 && (
				<div className="mx-auto w-full max-w-4xl space-y-8">
					<StepHeader
						description="Optional filters help narrow the shortlist before ranking."
						title="Add advanced filters"
					/>
					<fieldset className="space-y-4">
						<legend className="font-medium text-sm leading-none">Region</legend>
						<OptionGrid
							onToggle={(id) =>
								update({ regions: toggleValue(values.regions, id) })
							}
							options={regionOptions}
							selected={values.regions}
						/>
					</fieldset>
					<div className="grid gap-8 lg:grid-cols-2">
						<fieldset className="space-y-4">
							<legend className="font-medium text-sm leading-none">
								Hiring signal
							</legend>
							<OptionGrid
								onToggle={(id) =>
									update({
										hiringStatuses: toggleValue(values.hiringStatuses, id),
									})
								}
								options={hiringOptions}
								selected={values.hiringStatuses}
							/>
						</fieldset>
						<fieldset className="space-y-4">
							<legend className="font-medium text-sm leading-none">
								Research intent
							</legend>
							<OptionGrid
								onToggle={(id) =>
									update({
										researchGoals: toggleValue(values.researchGoals, id),
									})
								}
								options={researchGoalOptions}
								selected={values.researchGoals}
							/>
						</fieldset>
					</div>
					<div className="grid gap-4 md:grid-cols-3">
						<div className="space-y-2">
							<Label htmlFor="employeeMin">Minimum employees</Label>
							<Input
								id="employeeMin"
								onChange={(event) =>
									update({ employeeMin: toNumber(event.target.value) })
								}
								placeholder="10"
								type="number"
								value={values.employeeMin ?? ""}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="employeeMax">Maximum employees</Label>
							<Input
								id="employeeMax"
								onChange={(event) =>
									update({ employeeMax: toNumber(event.target.value) })
								}
								placeholder="250"
								type="number"
								value={values.employeeMax ?? ""}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="keywords">Keywords</Label>
							<Input
								id="keywords"
								onChange={(event) => update({ keywords: event.target.value })}
								placeholder="AI, defense, climate"
								value={values.keywords ?? ""}
							/>
						</div>
					</div>
				</div>
			)}
		</NavigatorShell>
	);
}
