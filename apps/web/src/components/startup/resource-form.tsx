"use client";

import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RESOURCE_STAGE_OPTIONS } from "~/components/startup/company-form-options";
import { ResourceCard } from "~/components/startup/resource-card";
import { Button } from "~/components/ui/button";
import { DropdownAutocomplete } from "~/components/ui/dropdown-autocomplete";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
	apiClient,
	type Resource,
	type ResourceTaxonomy,
} from "~/lib/startup-api";

const arrayFields = [
	"stages",
	"communities",
	"sectors",
	"goals",
	"regions",
	"businessTypes",
	"eligibilityTags",
];

type ResourceFormValues = Record<string, string>;

export function ResourceForm({
	resource,
	taxonomy,
	showPreview = false,
}: {
	resource?: Resource;
	taxonomy?: ResourceTaxonomy;
	showPreview?: boolean;
}) {
	const router = useRouter();
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [previewValues, setPreviewValues] = useState<ResourceFormValues>(() =>
		initialResourceValues(resource),
	);

	function updatePreview(event: React.FormEvent<HTMLFormElement>) {
		const field = event.target;
		if (
			!(field instanceof HTMLInputElement) &&
			!(field instanceof HTMLTextAreaElement) &&
			!(field instanceof HTMLSelectElement)
		) {
			return;
		}
		if (!field.name) return;
		setPreviewValues((current) => ({ ...current, [field.name]: field.value }));
	}

	function updatePreviewValue(name: string, value: string) {
		setPreviewValues((current) => ({ ...current, [name]: value }));
	}

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
		<form
			action={submit}
			className={
				showPreview
					? "grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]"
					: "grid gap-5"
			}
			onChange={updatePreview}
		>
			<div
				className={
					showPreview
						? "grid gap-5 rounded-lg border bg-white p-6 shadow-sm"
						: "grid gap-5"
				}
			>
				<div className="grid gap-4 md:grid-cols-2">
					<Field
						defaultValue={previewValues.name}
						label="Name"
						name="name"
						required
					/>
					<Field
						defaultValue={previewValues.websiteUrl}
						label="Website"
						name="websiteUrl"
					/>
					<Field
						defaultValue={previewValues.category}
						label="Category"
						name="category"
					/>
					<Field
						defaultValue={previewValues.subcategory}
						label="Subcategory"
						name="subcategory"
					/>
					<Field
						defaultValue={previewValues.contactName}
						label="Contact name"
						name="contactName"
					/>
					<Field
						defaultValue={previewValues.contactEmail}
						label="Contact email"
						name="contactEmail"
					/>
					<Field
						defaultValue={previewValues.contactPhone}
						label="Contact phone"
						name="contactPhone"
					/>
					<Field defaultValue={previewValues.city} label="City" name="city" />
					<Field
						defaultValue={previewValues.county}
						label="County"
						name="county"
					/>
					<div className="space-y-2">
						<Label htmlFor="resource-status">Status</Label>
						<select
							className="h-9 w-full rounded-md border bg-white px-3 text-sm"
							defaultValue={previewValues.status}
							id="resource-status"
							name="status"
						>
							<option>PUBLISHED</option>
							<option>DRAFT</option>
							<option>ARCHIVED</option>
						</select>
					</div>
				</div>
				<div className="space-y-2">
					<Label htmlFor="resource-short-description">Short description</Label>
					<Input
						defaultValue={previewValues.shortDescription}
						id="resource-short-description"
						name="shortDescription"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="resource-description">
						Description <span aria-hidden="true">*</span>
					</Label>
					<Textarea
						defaultValue={previewValues.description}
						id="resource-description"
						name="description"
						required
						rows={6}
					/>
				</div>
				<div className="grid gap-4 md:grid-cols-2">
					<ResourceArrayField
						defaultValue={previewValues.stages}
						label="stages"
						name="stages"
						onValueChange={updatePreviewValue}
						options={RESOURCE_STAGE_OPTIONS}
					/>
					<ResourceArrayField
						defaultValue={previewValues.communities}
						emptyMessage="No communities found"
						label="communities"
						name="communities"
						onValueChange={updatePreviewValue}
						options={taxonomy?.communities ?? []}
					/>
					{arrayFields
						.filter((field) => field !== "stages" && field !== "communities")
						.map((field) => (
							<Field
								defaultValue={previewValues[field]}
								key={field}
								label={field.replace(/([A-Z])/g, " $1").toLowerCase()}
								name={field}
							/>
						))}
				</div>
				{error && (
					<p className="text-destructive text-sm" role="alert">
						{error}
					</p>
				)}
				<Button className="w-fit" disabled={saving} type="submit">
					{saving ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Save className="size-4" />
					)}{" "}
					Save resource
				</Button>
			</div>
			{showPreview && (
				<ResourcePreview resource={resource} values={previewValues} />
			)}
		</form>
	);
}

function initialResourceValues(resource?: Resource): ResourceFormValues {
	const values: ResourceFormValues = {
		name: resource?.name ?? "",
		websiteUrl: resource?.websiteUrl ?? "",
		category: resource?.category ?? "",
		subcategory: resource?.subcategory ?? "",
		contactName: resource?.contactName ?? "",
		contactEmail: resource?.contactEmail ?? "",
		contactPhone: resource?.contactPhone ?? "",
		city: resource?.city ?? "",
		county: resource?.county ?? "",
		status: resource?.status ?? "PUBLISHED",
		shortDescription: resource?.shortDescription ?? "",
		description: resource?.description ?? "",
	};
	for (const field of arrayFields) {
		values[field] =
			(resource?.[field as keyof Resource] as string[] | undefined)?.join(
				", ",
			) ?? "";
	}
	return values;
}

function listFromField(value: string | undefined) {
	return String(value ?? "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function ResourcePreview({
	resource,
	values,
}: {
	resource?: Resource;
	values: ResourceFormValues;
}) {
	const previewResource: Resource = {
		id: resource?.id ?? "preview-resource",
		slug: resource?.slug ?? "preview-resource",
		name: values.name || "Resource name",
		description:
			values.description ||
			"A short explanation of the resource will appear here as people browse the directory.",
		shortDescription: values.shortDescription || null,
		websiteUrl: values.websiteUrl || null,
		contactName: values.contactName || null,
		contactEmail: values.contactEmail || null,
		contactPhone: values.contactPhone || null,
		category: values.category || null,
		subcategory: values.subcategory || null,
		status: values.status || "PUBLISHED",
		stages: listFromField(values.stages),
		communities: listFromField(values.communities),
		sectors: listFromField(values.sectors),
		goals: listFromField(values.goals),
		regions: listFromField(values.regions),
		businessTypes: listFromField(values.businessTypes),
		eligibilityTags: listFromField(values.eligibilityTags),
		city: values.city || null,
		county: values.county || null,
		state: resource?.state ?? "UT",
		sourceId: resource?.sourceId ?? null,
		lastSyncedAt: resource?.lastSyncedAt ?? null,
		updatedAt: resource?.updatedAt ?? new Date().toISOString(),
	};

	return (
		<aside className="sticky top-6 rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm">
			<div className="mb-3 flex items-center justify-between gap-3">
				<div>
					<p className="font-semibold text-emerald-950 text-sm">
						Listing preview
					</p>
					<p className="text-emerald-800 text-xs">Read-only directory card</p>
				</div>
				<span className="rounded-md bg-emerald-700 px-2 py-1 font-medium text-white text-xs">
					Preview
				</span>
			</div>
			<div className="pointer-events-none select-none">
				<ResourceCard resource={previewResource} />
			</div>
		</aside>
	);
}

function ResourceArrayField({
	defaultValue,
	emptyMessage,
	label,
	name,
	onValueChange,
	options,
}: {
	defaultValue?: string;
	emptyMessage?: string;
	label: string;
	name: string;
	onValueChange: (name: string, value: string) => void;
	options: string[];
}) {
	const fieldId = `${name}-autocomplete`;
	const labelId = `${fieldId}-label`;

	return (
		<div className="space-y-2">
			<Label className="capitalize" htmlFor={fieldId} id={labelId}>
				{label}
			</Label>
			<DropdownAutocomplete
				aria-labelledby={labelId}
				defaultValue={defaultValue}
				emptyMessage={emptyMessage}
				id={fieldId}
				multiple
				name={name}
				onValueChange={(value) => onValueChange(name, value)}
				options={options}
				placeholder={`Select ${label}`}
			/>
		</div>
	);
}

function Field(
	props: React.ComponentProps<typeof Input> & { label: string; name: string },
) {
	const { label, ...inputProps } = props;
	const fieldId = inputProps.id ?? inputProps.name;
	return (
		<div className="space-y-2">
			<Label className="capitalize" htmlFor={fieldId}>
				{label}
				{inputProps.required ? <span aria-hidden="true"> *</span> : null}
			</Label>
			<Input id={fieldId} {...inputProps} />
		</div>
	);
}
