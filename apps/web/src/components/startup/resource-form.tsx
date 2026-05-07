"use client";

import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { apiClient, type Resource } from "~/lib/startup-api";

const arrayFields = [
	"stages",
	"sectors",
	"goals",
	"regions",
	"businessTypes",
	"eligibilityTags",
];

export function ResourceForm({ resource }: { resource?: Resource }) {
	const router = useRouter();
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit(formData: FormData) {
		setSaving(true);
		setError(null);
		const body = Object.fromEntries(formData.entries());
		for (const field of arrayFields) {
			body[field] = String(body[field] ?? "")
				.split(",")
				.map((item) => item.trim())
				.filter(Boolean)
				.join(",");
		}
		try {
			await apiClient(
				resource ? "/api/v1/resources/update" : "/api/v1/resources/create",
				{
					method: "POST",
					body: JSON.stringify({
						...body,
						id: resource?.id,
						resourceId: resource?.id,
					}),
				},
			);
			router.push("/admin/resources");
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not save resource");
		} finally {
			setSaving(false);
		}
	}

	return (
		<form action={submit} className="grid gap-5">
			<div className="grid gap-4 md:grid-cols-2">
				<Field
					defaultValue={resource?.name}
					label="Name"
					name="name"
					required
				/>
				<Field
					defaultValue={resource?.websiteUrl ?? ""}
					label="Website"
					name="websiteUrl"
				/>
				<Field
					defaultValue={resource?.category ?? ""}
					label="Category"
					name="category"
				/>
				<Field
					defaultValue={resource?.subcategory ?? ""}
					label="Subcategory"
					name="subcategory"
				/>
				<Field
					defaultValue={resource?.contactName ?? ""}
					label="Contact name"
					name="contactName"
				/>
				<Field
					defaultValue={resource?.contactEmail ?? ""}
					label="Contact email"
					name="contactEmail"
				/>
				<Field
					defaultValue={resource?.contactPhone ?? ""}
					label="Contact phone"
					name="contactPhone"
				/>
				<Field defaultValue={resource?.city ?? ""} label="City" name="city" />
				<Field
					defaultValue={resource?.county ?? ""}
					label="County"
					name="county"
				/>
				<div className="space-y-2">
					<Label>Status</Label>
					<select
						className="h-9 w-full rounded-md border bg-white px-3 text-sm"
						defaultValue={resource?.status ?? "PUBLISHED"}
						name="status"
					>
						<option>PUBLISHED</option>
						<option>DRAFT</option>
						<option>ARCHIVED</option>
					</select>
				</div>
			</div>
			<div className="space-y-2">
				<Label>Short description</Label>
				<Input
					defaultValue={resource?.shortDescription ?? ""}
					name="shortDescription"
				/>
			</div>
			<div className="space-y-2">
				<Label>Description</Label>
				<Textarea
					defaultValue={resource?.description ?? ""}
					name="description"
					required
					rows={6}
				/>
			</div>
			<div className="grid gap-4 md:grid-cols-2">
				{arrayFields.map((field) => (
					<Field
						defaultValue={
							(
								resource?.[field as keyof Resource] as string[] | undefined
							)?.join(", ") ?? ""
						}
						key={field}
						label={field.replace(/([A-Z])/g, " $1").toLowerCase()}
						name={field}
					/>
				))}
			</div>
			{error && <p className="text-destructive text-sm">{error}</p>}
			<Button className="w-fit" disabled={saving} type="submit">
				{saving ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<Save className="size-4" />
				)}{" "}
				Save resource
			</Button>
		</form>
	);
}

function Field(
	props: React.ComponentProps<typeof Input> & { label: string; name: string },
) {
	const { label, ...inputProps } = props;
	return (
		<div className="space-y-2">
			<Label className="capitalize">{label}</Label>
			<Input {...inputProps} />
		</div>
	);
}
