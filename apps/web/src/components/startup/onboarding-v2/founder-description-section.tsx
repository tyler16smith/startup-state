"use client";

import { Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

type DescriptionMode = "import" | "manual";

type FounderDescriptionSectionProps = {
	description: string;
	error: string | null;
	landingPageUrl: string;
	loading: boolean;
	mode: DescriptionMode;
	onDescriptionChange: (value: string) => void;
	onImport: () => void;
	onLandingPageUrlChange: (value: string) => void;
	onModeChange: (mode: DescriptionMode) => void;
};

export function FounderDescriptionSection({
	description,
	error,
	landingPageUrl,
	loading,
	mode,
	onDescriptionChange,
	onImport,
	onLandingPageUrlChange,
	onModeChange,
}: FounderDescriptionSectionProps) {
	return (
		<section className="space-y-4">
			<div className="space-y-1">
				<h2 className="font-semibold text-lg tracking-normal">
					Company description
				</h2>
				<p className="text-muted-foreground text-sm">
					Add the company context recommendations should use. Paste your company homepage and we'll draft a company description. You can edit it below.
				</p>
			</div>

			<div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="landingPageUrl">Import from landing page (optional)</Label>
          <Input
            disabled={loading}
            id="landingPageUrl"
            onChange={(event) => onLandingPageUrlChange(event.target.value)}
            placeholder="https://company.com"
            type="url"
            value={landingPageUrl}
          />
        </div>
        <Button
          disabled={!landingPageUrl.trim() || loading}
          onClick={onImport}
          type="button"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          Import
        </Button>
      </div>

			<div className="space-y-2">
				<Label htmlFor="companyDescription">Description</Label>
				<Textarea
					className="min-h-36 resize-none"
					id="companyDescription"
					onChange={(event) => onDescriptionChange(event.target.value)}
					placeholder="Describe your company"
					value={description}
				/>
				{error && <p className="text-destructive text-sm">{error}</p>}
			</div>
		</section>
	);
}
