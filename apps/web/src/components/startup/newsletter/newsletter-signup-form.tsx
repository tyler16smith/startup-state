"use client";

import { CheckCircle2, Loader2, MailCheck, Send, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
	type NewsletterAudience,
	subscribeToNewsletter,
} from "~/lib/startup-api";
import { cn } from "~/lib/utils";
import {
	audienceOptions,
	intentOptions,
	interestOptions,
	type NewsletterAudienceOption,
	stageOptions,
} from "./newsletter-options";

type AudienceSelection = NewsletterAudienceOption["id"];

const defaultAudience: AudienceSelection = "founder";

function getAudienceOption(selection: AudienceSelection) {
	const option = audienceOptions.find((item) => item.id === selection);
	if (option) return option;

	const defaultOption = audienceOptions.find(
		(item) => item.id === defaultAudience,
	);
	if (!defaultOption) {
		throw new Error("Newsletter audience options are unavailable");
	}
	return defaultOption;
}

function hasAudienceMatch(
	optionAudiences: NewsletterAudience[],
	selectedAudiences: NewsletterAudience[],
) {
	return optionAudiences.some((audience) =>
		selectedAudiences.includes(audience),
	);
}

export function NewsletterSignupForm() {
	const [audienceSelection, setAudienceSelection] =
		useState<AudienceSelection>(defaultAudience);
	const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const selectedAudienceOption = getAudienceOption(audienceSelection);
	const selectedAudiences = selectedAudienceOption.audiences;
	const availableInterests = useMemo(
		() =>
			interestOptions.filter((option) =>
				hasAudienceMatch(option.audiences, selectedAudiences),
			),
		[selectedAudiences],
	);

	function selectAudience(nextSelection: AudienceSelection) {
		const nextAudiences = getAudienceOption(nextSelection).audiences;
		setAudienceSelection(nextSelection);
		setSelectedInterests((current) =>
			current.filter((interestId) => {
				const interest = interestOptions.find((item) => item.id === interestId);
				return interest
					? hasAudienceMatch(interest.audiences, nextAudiences)
					: false;
			}),
		);
	}

	function toggleInterest(interestId: string) {
		setSelectedInterests((current) =>
			current.includes(interestId)
				? current.filter((item) => item !== interestId)
				: [...current, interestId],
		);
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		setSaving(true);
		setError(null);
		setSuccess(false);

		const formData = new FormData(form);
		try {
			await subscribeToNewsletter({
				email: String(formData.get("email") ?? ""),
				name: String(formData.get("name") ?? ""),
				audiences: selectedAudiences,
				interests: selectedInterests,
				stage: String(formData.get("stage") ?? ""),
				intent: String(formData.get("intent") ?? ""),
				details: String(formData.get("details") ?? ""),
			});
			setSuccess(true);
			toast.success("Success! You are now subscribed", {
				position: "bottom-right",
			});
			form.reset();
			setSelectedInterests([]);
			setAudienceSelection(defaultAudience);
		} catch (caughtError) {
			setError(
				caughtError instanceof Error
					? caughtError.message
					: "Could not save newsletter preferences",
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<form className="space-y-8" onSubmit={handleSubmit}>
			<section aria-labelledby="newsletter-audience" className="space-y-4">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<p className="font-medium text-emerald-700 text-sm">Step 1</p>
						<h2
							className="font-semibold text-2xl tracking-normal"
							id="newsletter-audience"
						>
							Choose your newsletter
						</h2>
					</div>
					<Badge className="w-fit" variant="secondary">
						Personalized signal feed
					</Badge>
				</div>
				<div className="grid gap-4 lg:grid-cols-3">
					{audienceOptions.map((option) => {
						const selected = audienceSelection === option.id;
						return (
							<button
								aria-pressed={selected}
								className={cn(
									"flex h-full min-h-[26rem] flex-col rounded-lg border bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md",
									selected && option.accent,
								)}
								key={option.id}
								onClick={() => selectAudience(option.id)}
								type="button"
							>
								<div className="flex items-start justify-between gap-3">
									<div>
										<h3 className="font-semibold text-lg tracking-normal">
											{option.label}
										</h3>
										<p className="mt-1 text-muted-foreground text-sm">
											{option.description}
										</p>
									</div>
									<span
										className={cn(
											"flex size-8 items-center justify-center rounded-full border text-muted-foreground",
											selected && "border-slate-950 bg-slate-950 text-white",
										)}
									>
										{selected ? (
											<CheckCircle2 className="size-4" />
										) : (
											<Sparkles className="size-4" />
										)}
									</span>
								</div>
								<p className="mt-4 text-slate-700 text-sm leading-6">
									{option.body}
								</p>
								<div className="mt-5 space-y-2">
									<p className="font-medium text-sm">Includes:</p>
									<ul className="space-y-2 text-muted-foreground text-sm">
										{option.includes.map((item) => (
											<li className="flex gap-2" key={item}>
												<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
												<span>{item}</span>
											</li>
										))}
									</ul>
								</div>
								<span className="mt-auto pt-5 font-medium text-sm">
									{option.cta}
								</span>
							</button>
						);
					})}
				</div>
			</section>

			<section aria-labelledby="newsletter-interests" className="space-y-4">
				<div>
					<p className="font-medium text-emerald-700 text-sm">Step 2</p>
					<h2
						className="font-semibold text-2xl tracking-normal"
						id="newsletter-interests"
					>
						What are you interested in?
					</h2>
					<p className="mt-2 text-muted-foreground">
						Tell us what you care about so we only send updates that are
						relevant to you.
					</p>
				</div>
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{availableInterests.map(({ id, label, icon: Icon }) => {
						const checked = selectedInterests.includes(id);
						const checkboxId = `newsletter-interest-${id}`;
						return (
							<div
								className={cn(
									"flex min-h-20 items-center gap-3 rounded-lg border bg-white p-4 shadow-sm transition-colors hover:border-slate-400",
									checked && "border-slate-950 bg-slate-50",
								)}
								key={id}
							>
								<Checkbox
									checked={checked}
									id={checkboxId}
									onCheckedChange={() => toggleInterest(id)}
								/>
								<Icon className="size-4 shrink-0 text-emerald-700" />
								<Label className="cursor-pointer" htmlFor={checkboxId}>
									{label}
								</Label>
							</div>
						);
					})}
				</div>
			</section>

			<section
				aria-labelledby="newsletter-details"
				className="rounded-lg border bg-white p-5 shadow-sm sm:p-6"
			>
				<div className="mb-5">
					<p className="font-medium text-emerald-700 text-sm">Step 3</p>
					<h2
						className="font-semibold text-2xl tracking-normal"
						id="newsletter-details"
					>
						Add details
					</h2>
					<p className="mt-2 text-muted-foreground">
						Share details like stage, industry, location, funding activity,
						events, or resources you want to hear about.
					</p>
				</div>
				<div className="grid gap-4 md:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="newsletter-email">Email address</Label>
						<Input
							autoComplete="email"
							id="newsletter-email"
							name="email"
							placeholder="you@example.com"
							required
							type="email"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="newsletter-name">Name</Label>
						<Input
							autoComplete="name"
							id="newsletter-name"
							name="name"
							placeholder="Optional"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="newsletter-intent">Current focus</Label>
						<select
							className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
							id="newsletter-intent"
							name="intent"
						>
							<option value="">Select focus</option>
							{intentOptions.map((intent) => (
								<option key={intent} value={intent}>
									{intent}
								</option>
							))}
						</select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="newsletter-stage">Stage focus</Label>
						<select
							className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
							id="newsletter-stage"
							name="stage"
						>
							<option value="">Select stage</option>
							{stageOptions.map((stage) => (
								<option key={stage} value={stage}>
									{stage}
								</option>
							))}
						</select>
					</div>
				</div>
				<div className="mt-4 space-y-2">
					<Label htmlFor="newsletter-details-input">
						Anything specific you are looking for?
					</Label>
					<Textarea
						id="newsletter-details-input"
						name="details"
						placeholder="Example: B2B SaaS startups raising seed rounds, fintech companies with traction, founder events in Austin, grant opportunities, etc."
						rows={5}
					/>
				</div>
				<div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="font-medium">Get relevant updates</p>
						<p className="text-muted-foreground text-sm">
							No spam. Just curated startup updates based on your interests.
						</p>
					</div>
					<Button disabled={saving} type="submit">
						{saving ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Send className="size-4" />
						)}
						Get relevant updates
					</Button>
				</div>
				{success && (
					<p
						aria-live="polite"
						className="mt-4 flex items-center gap-2 text-emerald-700 text-sm"
						role="status"
					>
						<MailCheck className="size-4" />
						Your Startup State signal preferences are saved.
					</p>
				)}
				{error && (
					<p className="mt-4 text-destructive text-sm" role="alert">
						{error}
					</p>
				)}
			</section>
		</form>
	);
}
