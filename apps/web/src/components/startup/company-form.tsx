"use client";

import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
	CompanyAddressAutocomplete,
	type CompanyAddressSelection,
} from "~/components/startup/company-address-autocomplete";
import { CompanyCard } from "~/components/startup/company-card";
import {
	COMPANY_EMPLOYEE_RANGE_OPTIONS,
	COMPANY_SECTOR_OPTIONS,
	COMPANY_STAGE_OPTIONS,
} from "~/components/startup/company-form-options";
import { Button } from "~/components/ui/button";
import { DropdownAutocomplete } from "~/components/ui/dropdown-autocomplete";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { apiClient, type Company } from "~/lib/startup-api";

type CompanyFormMode = "full" | "submission";
type CompanyFormValues = Record<string, string>;

export function CompanyForm({
	company,
	admin = false,
	mode,
	showPreview = false,
}: {
	company?: Company;
	admin?: boolean;
	mode?: CompanyFormMode;
	showPreview?: boolean;
}) {
	const router = useRouter();
	const resolvedMode = mode ?? (!admin && !company ? "submission" : "full");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [previewValues, setPreviewValues] = useState<CompanyFormValues>(() =>
		initialCompanyValues(company, admin),
	);
	const [addressFields, setAddressFields] = useState<CompanyAddressSelection>(
		() => initialAddressFields(company),
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

	const handleAddressChange = useCallback(
		(selection: CompanyAddressSelection) => {
			setAddressFields((current) => ({ ...current, ...selection }));
			setPreviewValues((current) => ({ ...current, ...selection }));
		},
		[],
	);

	async function submit(formData: FormData) {
		setSaving(true);
		setError(null);
		setSuccess(null);
		const photos = String(formData.get("photos") ?? "")
			.split(",")
			.map((url) => url.trim())
			.filter(Boolean)
			.map((url, sortOrder) => ({ url, sortOrder }));
		const body = Object.fromEntries(formData.entries());
		try {
			const path = company
				? admin
					? "/api/v1/companies/adminUpdate"
					: "/api/v1/companies/update"
				: admin
					? "/api/v1/companies/adminCreate"
					: "/api/v1/companies/create";
			const saved = await apiClient<Company>(path, {
				method: "POST",
				body: JSON.stringify({
					...body,
					id: company?.id,
					companyId: company?.id,
					photos,
				}),
			});
			if (!admin && !company) {
				setSuccess(
					"Company submitted for review. An admin can publish it and approve ownership from the claims queue.",
				);
				return;
			}
			router.push(admin ? "/admin/companies" : `/companies/${saved.id}`);
			router.refresh();
		} catch (caughtError) {
			setError(
				caughtError instanceof Error
					? caughtError.message
					: "Could not save company",
			);
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
				{resolvedMode === "submission" ? (
					<SubmissionFields
						addressFields={addressFields}
						onAddressChange={handleAddressChange}
						onValueChange={updatePreviewValue}
						values={previewValues}
					/>
				) : (
					<FullFields
						addressFields={addressFields}
						admin={admin}
						onAddressChange={handleAddressChange}
						onValueChange={updatePreviewValue}
						values={previewValues}
					/>
				)}

				{success && (
					<p
						aria-live="polite"
						className="text-emerald-700 text-sm"
						role="status"
					>
						{success}
					</p>
				)}
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
					{resolvedMode === "submission" ? "Submit company" : "Save company"}
				</Button>
			</div>
			{showPreview && (
				<CompanyPreview company={company} values={previewValues} />
			)}
		</form>
	);
}

function SubmissionFields({
	addressFields,
	onAddressChange,
	onValueChange,
	values,
}: {
	addressFields: CompanyAddressSelection;
	onAddressChange: (selection: CompanyAddressSelection) => void;
	onValueChange: (name: string, value: string) => void;
	values: CompanyFormValues;
}) {
	return (
		<div className="grid gap-5">
			<div className="grid gap-4 md:grid-cols-2">
				<Field
					defaultValue={values.name}
					label="Company name"
					name="name"
					required
				/>
				<Field
					defaultValue={values.linkedinUrl}
					label="Company LinkedIn"
					name="linkedinUrl"
					placeholder="https://linkedin.com/company/..."
					type="url"
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="company-address">Address</Label>
				<CompanyAddressAutocomplete
					defaultValue={values.address}
					id="company-address"
					onAddressChange={onAddressChange}
				/>
			</div>
			<HiddenAddressFields fields={addressFields} />
			<div className="space-y-2">
				<Label htmlFor="company-description">
					Company description <span aria-hidden="true">*</span>
				</Label>
				<Textarea
					defaultValue={values.description}
					id="company-description"
					name="description"
					required
					rows={6}
				/>
			</div>
			<Field
				defaultValue={values.websiteUrl}
				label="Website link"
				name="websiteUrl"
				placeholder="https://example.com"
				type="url"
			/>
			<div className="grid gap-4 md:grid-cols-3">
				<AutocompleteField
					defaultValue={values.stage}
					label="What stage of funding is your company at?"
					name="stage"
					onValueChange={onValueChange}
					options={COMPANY_STAGE_OPTIONS}
					placeholder="Select stage"
					single
				/>
				<SelectField
					defaultValue={values.employeeRange}
					label="How many employees do you have?"
					name="employeeRange"
					options={COMPANY_EMPLOYEE_RANGE_OPTIONS}
					placeholder="Select size"
				/>
				<SelectField
					defaultValue={values.sector}
					label="What sector is your company in?"
					name="sector"
					options={COMPANY_SECTOR_OPTIONS}
					placeholder="Select sector"
				/>
			</div>
		</div>
	);
}

function FullFields({
	admin,
	addressFields,
	onAddressChange,
	onValueChange,
	values,
}: {
	admin: boolean;
	addressFields: CompanyAddressSelection;
	onAddressChange: (selection: CompanyAddressSelection) => void;
	onValueChange: (name: string, value: string) => void;
	values: CompanyFormValues;
}) {
	return (
		<>
			<div className="grid gap-4 md:grid-cols-2">
				<Field defaultValue={values.name} label="Name" name="name" required />
				<Field
					defaultValue={values.websiteUrl}
					label="Website"
					name="websiteUrl"
					placeholder="https://example.com"
				/>
				<AutocompleteField
					defaultValue={values.sector}
					label="Sector"
					name="sector"
					onValueChange={onValueChange}
					options={COMPANY_SECTOR_OPTIONS}
					placeholder="Select sector"
					single
				/>
				<AutocompleteField
					defaultValue={values.stage}
					label="Stage"
					name="stage"
					onValueChange={onValueChange}
					options={COMPANY_STAGE_OPTIONS}
					placeholder="Select stage"
					single
				/>
				<SelectField
					defaultValue={values.employeeRange}
					label="How many employees do you have?"
					name="employeeRange"
					options={COMPANY_EMPLOYEE_RANGE_OPTIONS}
					placeholder="Select size"
				/>
				<Field
					defaultValue={values.yearFounded}
					label="Year founded"
					name="yearFounded"
					type="number"
				/>
				<Field
					defaultValue={values.linkedinUrl}
					label="LinkedIn"
					name="linkedinUrl"
				/>
				<Field
					defaultValue={values.jobPostingsUrl}
					label="Job postings URL"
					name="jobPostingsUrl"
				/>
				<SelectField
					defaultValue={values.hiringStatus}
					label="Hiring status"
					name="hiringStatus"
					options={["UNKNOWN", "NOT_HIRING", "HIRING", "ACTIVELY_HIRING"]}
				/>
				{admin && (
					<SelectField
						defaultValue={values.status}
						label="Status"
						name="status"
						options={["PUBLISHED", "PENDING_REVIEW", "DRAFT", "ARCHIVED"]}
					/>
				)}
			</div>
			<div className="space-y-2">
				<Label htmlFor="company-address">Address</Label>
				<CompanyAddressAutocomplete
					defaultValue={values.address}
					id="company-address"
					onAddressChange={onAddressChange}
				/>
			</div>
			<HiddenAddressFields fields={addressFields} />
			<div className="space-y-2">
				<Label htmlFor="company-description">Description</Label>
				<Textarea
					defaultValue={values.description}
					id="company-description"
					name="description"
					rows={5}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="company-photos">Photo URLs</Label>
				<Input
					defaultValue={values.photos}
					id="company-photos"
					name="photos"
					placeholder="https://...jpg, https://...jpg"
				/>
			</div>
		</>
	);
}

function HiddenAddressFields({ fields }: { fields: CompanyAddressSelection }) {
	return (
		<>
			<input name="city" readOnly type="hidden" value={fields.city ?? ""} />
			<input name="county" readOnly type="hidden" value={fields.county ?? ""} />
			<input name="state" readOnly type="hidden" value={fields.state ?? "UT"} />
			<input
				name="postalCode"
				readOnly
				type="hidden"
				value={fields.postalCode ?? ""}
			/>
			<input
				name="latitude"
				readOnly
				type="hidden"
				value={fields.latitude ?? ""}
			/>
			<input
				name="longitude"
				readOnly
				type="hidden"
				value={fields.longitude ?? ""}
			/>
		</>
	);
}

function initialCompanyValues(
	company?: Company,
	admin = false,
): CompanyFormValues {
	return {
		name: company?.name ?? "",
		websiteUrl: company?.websiteUrl ?? "",
		linkedinUrl: company?.linkedinUrl ?? "",
		description: company?.description ?? "",
		sector: company?.sector ?? "",
		stage: company?.stage ?? "",
		employees: company?.employees?.toString() ?? "",
		employeeRange: company?.employeeRange ?? "",
		yearFounded: company?.yearFounded?.toString() ?? "",
		address: company?.address ?? "",
		city: company?.city ?? "",
		county: company?.county ?? "",
		state: company?.state ?? "UT",
		postalCode: company?.postalCode ?? "",
		latitude: company?.latitude?.toString() ?? "",
		longitude: company?.longitude?.toString() ?? "",
		hiringStatus: company?.hiringStatus ?? "UNKNOWN",
		jobPostingsUrl: company?.jobPostingsUrl ?? "",
		status: company?.status ?? (admin ? "PUBLISHED" : "PENDING_REVIEW"),
		photos: company?.photos.map((photo) => photo.url).join(", ") ?? "",
	};
}

function initialAddressFields(company?: Company): CompanyAddressSelection {
	return {
		address: company?.address ?? "",
		city: company?.city ?? "",
		county: company?.county ?? "",
		state: company?.state ?? "UT",
		postalCode: company?.postalCode ?? "",
		latitude: company?.latitude?.toString() ?? "",
		longitude: company?.longitude?.toString() ?? "",
	};
}

function photosFromValue(value: string | undefined) {
	return String(value ?? "")
		.split(",")
		.map((url) => url.trim())
		.filter(Boolean)
		.map((url, sortOrder) => ({ url, sortOrder }));
}

function CompanyPreview({
	company,
	values,
}: {
	company?: Company;
	values: CompanyFormValues;
}) {
	const previewCompany: Company = {
		id: company?.id ?? "preview-company",
		slug: company?.slug ?? "preview-company",
		name: values.name || "Company name",
		websiteUrl: values.websiteUrl || null,
		linkedinUrl: values.linkedinUrl || null,
		description:
			values.description ||
			"A concise company description will appear here for people browsing the directory.",
		sector: values.sector || null,
		stage: values.stage || null,
		employees: values.employees ? Number(values.employees) : null,
		employeeRange: values.employeeRange || null,
		yearFounded: values.yearFounded ? Number(values.yearFounded) : null,
		address: values.address || null,
		city: values.city || null,
		county: values.county || null,
		state: values.state || "UT",
		postalCode: values.postalCode || null,
		latitude: values.latitude ? Number(values.latitude) : null,
		longitude: values.longitude ? Number(values.longitude) : null,
		hiringStatus: values.hiringStatus || "UNKNOWN",
		jobPostingsUrl: values.jobPostingsUrl || null,
		status: values.status || "PENDING_REVIEW",
		photos: photosFromValue(values.photos),
		updatedAt: company?.updatedAt ?? new Date().toISOString(),
	};

	return (
		<aside className="sticky top-6 rounded-lg border border-sky-200 bg-sky-50/80 p-4 shadow-sm">
			<div className="mb-3 flex items-center justify-between gap-3">
				<div>
					<p className="font-semibold text-sky-950 text-sm">Listing preview</p>
					<p className="text-sky-800 text-xs">Read-only company card</p>
				</div>
				<span className="rounded-md bg-sky-700 px-2 py-1 font-medium text-white text-xs">
					Preview
				</span>
			</div>
			<div className="pointer-events-none select-none">
				<CompanyCard company={previewCompany} />
			</div>
		</aside>
	);
}

function AutocompleteField({
	defaultValue,
	label,
	name,
	onValueChange,
	options,
	placeholder,
	single,
}: {
	defaultValue?: string;
	label: string;
	name: string;
	onValueChange: (name: string, value: string) => void;
	options: string[];
	placeholder?: string;
	single?: boolean;
}) {
	const fieldId = `${name}-autocomplete`;
	const labelId = `${fieldId}-label`;

	return (
		<div className="space-y-2">
			<Label htmlFor={fieldId} id={labelId}>
				{label}
			</Label>
			<DropdownAutocomplete
				aria-labelledby={labelId}
				defaultValue={defaultValue}
				id={fieldId}
				name={name}
				onValueChange={(value) => onValueChange(name, value)}
				options={options}
				placeholder={placeholder}
				single={single}
			/>
		</div>
	);
}

function SelectField({
	defaultValue,
	label,
	name,
	options,
	placeholder,
	required,
}: {
	defaultValue?: string;
	label: string;
	name: string;
	options: string[];
	placeholder?: string;
	required?: boolean;
}) {
	const fieldId = name;

	return (
		<div className="space-y-2">
			<Label htmlFor={fieldId}>
				{label}
				{required ? <span aria-hidden="true"> *</span> : null}
			</Label>
			<select
				className="h-9 w-full rounded-md border bg-white px-3 text-sm"
				defaultValue={defaultValue}
				id={fieldId}
				name={name}
				required={required}
			>
				{placeholder && <option value="">{placeholder}</option>}
				{options.map((option) => (
					<option key={option} value={option}>
						{option}
					</option>
				))}
			</select>
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
			<Label htmlFor={fieldId}>
				{label}
				{inputProps.required ? <span aria-hidden="true"> *</span> : null}
			</Label>
			<Input id={fieldId} {...inputProps} />
		</div>
	);
}
