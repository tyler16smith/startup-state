"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import type { FounderProfileInput } from "~/lib/startup-api";

const options = {
	stages: ["IDEA", "PRE_REVENUE", "EARLY_REVENUE", "GROWTH", "SCALING"],
	regions: [
		"Northern Utah",
		"Wasatch Front",
		"Central Utah",
		"Southern Utah",
		"Statewide",
	],
	sectors: [
		"Software",
		"Fintech",
		"Health",
		"Aerospace",
		"Advanced manufacturing",
		"Consumer",
		"Energy",
		"Education",
	],
	goals: [
		"Capital",
		"Mentorship",
		"Grants",
		"Education",
		"Networking",
		"Exporting",
		"Legal help",
		"Hiring",
	],
	businessTypes: [
		"B2B",
		"B2C",
		"Marketplace",
		"Deep tech",
		"Main street",
		"Nonprofit",
	],
	fundingNeeds: [
		"Grants",
		"Angel investment",
		"Venture capital",
		"Loans",
		"Revenue-based financing",
	],
};

const schema = z.object({
	stage: z.string().min(1),
	region: z.string().min(1),
	city: z.string().optional(),
	county: z.string().optional(),
	sectors: z.array(z.string()).min(1),
	goals: z.array(z.string()).min(1),
	businessTypes: z.array(z.string()),
	fundingNeeds: z.array(z.string()),
	hiringStatus: z.string().optional(),
	keywords: z.string().optional(),
});

type IntakeFormValues = z.infer<typeof schema>;

function ToggleGroup({
	label,
	values,
	selected,
	onChange,
}: {
	label: string;
	values: string[];
	selected: string[];
	onChange: (values: string[]) => void;
}) {
	return (
		<div className="space-y-3">
			<Label>{label}</Label>
			<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
				{values.map((value) => {
					const checked = selected.includes(value);
					const id = `${label}-${value}`.replace(/[^a-z0-9]+/gi, "-");
					return (
						<div
							className="flex items-center gap-2 rounded-lg border bg-white p-3 text-sm shadow-sm transition has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50"
							key={value}
						>
							<input
								checked={checked}
								className="size-4 accent-emerald-700"
								id={id}
								onChange={(event) => {
									onChange(
										event.target.checked
											? [...selected, value]
											: selected.filter((item) => item !== value),
									);
								}}
								type="checkbox"
							/>
							<label className="flex-1 cursor-pointer" htmlFor={id}>
								{value.replace(/_/g, " ").toLowerCase()}
							</label>
							{checked && <Check className="size-4 text-emerald-700" />}
						</div>
					);
				})}
			</div>
		</div>
	);
}

export function FounderIntakeForm() {
	const router = useRouter();
	const form = useForm<IntakeFormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			stage: "PRE_REVENUE",
			region: "Wasatch Front",
			sectors: [],
			goals: [],
			businessTypes: [],
			fundingNeeds: [],
		},
	});

	const onSubmit = form.handleSubmit((values) => {
		const input: FounderProfileInput = values;
		sessionStorage.setItem("startup-founder-intake", JSON.stringify(input));
		router.push("/founder/results");
	});

	return (
		<form className="space-y-8" onSubmit={onSubmit}>
			<div className="grid gap-4 md:grid-cols-3">
				<div className="space-y-2">
					<Label>Company stage</Label>
					<Select
						onValueChange={(value) => form.setValue("stage", value)}
						value={form.watch("stage")}
					>
						<SelectTrigger className="w-full bg-white">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{options.stages.map((stage) => (
								<SelectItem key={stage} value={stage}>
									{stage.replace(/_/g, " ").toLowerCase()}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label>Utah region</Label>
					<Select
						onValueChange={(value) => form.setValue("region", value)}
						value={form.watch("region")}
					>
						<SelectTrigger className="w-full bg-white">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{options.regions.map((region) => (
								<SelectItem key={region} value={region}>
									{region}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label>Hiring status</Label>
					<Select
						onValueChange={(value) => form.setValue("hiringStatus", value)}
						value={form.watch("hiringStatus") ?? "UNKNOWN"}
					>
						<SelectTrigger className="w-full bg-white">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{["UNKNOWN", "NOT_HIRING", "HIRING", "ACTIVELY_HIRING"].map(
								(value) => (
									<SelectItem key={value} value={value}>
										{value.replace(/_/g, " ").toLowerCase()}
									</SelectItem>
								),
							)}
						</SelectContent>
					</Select>
				</div>
			</div>
			<div className="grid gap-4 md:grid-cols-2">
				<div className="space-y-2">
					<Label>City</Label>
					<Input
						className="bg-white"
						{...form.register("city")}
						placeholder="Salt Lake City"
					/>
				</div>
				<div className="space-y-2">
					<Label>County</Label>
					<Input
						className="bg-white"
						{...form.register("county")}
						placeholder="Salt Lake"
					/>
				</div>
			</div>
			<ToggleGroup
				label="Sectors"
				onChange={(values) => form.setValue("sectors", values)}
				selected={form.watch("sectors")}
				values={options.sectors}
			/>
			<ToggleGroup
				label="Primary goals"
				onChange={(values) => form.setValue("goals", values)}
				selected={form.watch("goals")}
				values={options.goals}
			/>
			<ToggleGroup
				label="Business type"
				onChange={(values) => form.setValue("businessTypes", values)}
				selected={form.watch("businessTypes")}
				values={options.businessTypes}
			/>
			<ToggleGroup
				label="Funding needs"
				onChange={(values) => form.setValue("fundingNeeds", values)}
				selected={form.watch("fundingNeeds")}
				values={options.fundingNeeds}
			/>
			<div className="space-y-2">
				<Label>Anything specific?</Label>
				<Input
					className="bg-white"
					{...form.register("keywords")}
					placeholder="Clean energy grants, prototype testing, export help..."
				/>
			</div>
			{Object.keys(form.formState.errors).length > 0 && (
				<p className="text-destructive text-sm">
					Choose at least one sector and one goal to get targeted
					recommendations.
				</p>
			)}
			<Button className="w-full sm:w-auto" size="lg" type="submit">
				Show my action plan <ArrowRight className="size-4" />
			</Button>
		</form>
	);
}
