"use client";

import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

type InvestorDescriptionSectionProps = {
	description: string;
	onDescriptionChange: (value: string) => void;
};

export function InvestorDescriptionSection({
	description,
	onDescriptionChange,
}: InvestorDescriptionSectionProps) {
	return (
		<section className="space-y-4">
			<div className="space-y-1">
				<h2 className="font-semibold text-lg tracking-normal">More details</h2>
				<p className="text-muted-foreground text-sm">
					Add any extra context for the companies you want to find.
				</p>
			</div>
			<div className="space-y-2">
				<Label htmlFor="investorDescription">Details</Label>
				<Textarea
					className="min-h-36 resize-none"
					id="investorDescription"
					onChange={(event) => onDescriptionChange(event.target.value)}
					placeholder="Describe what you are looking for"
					value={description}
				/>
			</div>
		</section>
	);
}
