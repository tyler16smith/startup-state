"use client";

import { ImageIcon, Loader2, Save, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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

const COMPANY_DRAFT_KEY = "add-company-draft";
const acceptedLogoTypes = new Set(["image/png", "image/jpeg"]);

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
	const isDraftable = !company;
	const formRef = useRef<HTMLFormElement>(null);
	const draftPersistenceDisabled = useRef(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [formVersion, setFormVersion] = useState(0);
	const [previewValues, setPreviewValues] = useState<CompanyFormValues>(() =>
		initialCompanyValues(company, admin),
	);
	const [addressFields, setAddressFields] = useState<CompanyAddressSelection>(
		() => initialAddressFields(company),
	);

	useEffect(() => {
		if (!isDraftable) return;
		const draft = readFormDraft(COMPANY_DRAFT_KEY);
		if (!draft) return;
		setPreviewValues((current) => ({ ...current, ...draft }));
		setAddressFields((current) => ({ ...current, ...draft }));
		setFormVersion((current) => current + 1);
	}, [isDraftable]);

	const canPersistDraft = useCallback(
		() => isDraftable && !draftPersistenceDisabled.current,
		[isDraftable],
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

	function clearCompanyDraft() {
		if (!isDraftable) return;
		draftPersistenceDisabled.current = true;
		localStorage.removeItem(COMPANY_DRAFT_KEY);
	}

	function updatePreviewValue(name: string, value: string) {
		setPreviewValues((current) => {
			const next = { ...current, [name]: value };
			if (canPersistDraft()) writeFormDraft(COMPANY_DRAFT_KEY, next);
			return next;
		});
	}

	function persistDraftFromForm(form: HTMLFormElement) {
		if (!canPersistDraft()) return;
		writeFormDraft(COMPANY_DRAFT_KEY, {
			...previewValues,
			...formValues(form),
		});
	}

	function updateLogo(value: string) {
		setPreviewValues((current) => {
			const formValuesSnapshot = formRef.current
				? formValues(formRef.current)
				: {};
			const next = {
				...current,
				...formValuesSnapshot,
				photos: logoPhotoValue(
					formValuesSnapshot.photos ?? current.photos,
					value,
				),
			};
			if (canPersistDraft()) writeFormDraft(COMPANY_DRAFT_KEY, next);
			return next;
		});
		setFormVersion((current) => current + 1);
	}

	const handleAddressChange = useCallback(
		(selection: CompanyAddressSelection) => {
			setAddressFields((current) => ({ ...current, ...selection }));
			setPreviewValues((current) => {
				const next = { ...current, ...selection };
				if (canPersistDraft()) writeFormDraft(COMPANY_DRAFT_KEY, next);
				return next;
			});
		},
		[canPersistDraft],
	);

	async function submit(formData: FormData) {
		setSaving(true);
		setError(null);
		setSuccess(null);
		const photos = photosFromValue(String(formData.get("photos") ?? ""));
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
			clearCompanyDraft();
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
			key={formVersion}
			onBlur={(event) => persistDraftFromForm(event.currentTarget)}
			onChange={updatePreview}
			ref={formRef}
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
						onLogoChange={updateLogo}
						onValueChange={updatePreviewValue}
						values={previewValues}
					/>
				) : (
					<FullFields
						addressFields={addressFields}
						admin={admin}
						onAddressChange={handleAddressChange}
						onLogoChange={updateLogo}
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
	onLogoChange,
	onValueChange,
	values,
}: {
	addressFields: CompanyAddressSelection;
	onAddressChange: (selection: CompanyAddressSelection) => void;
	onLogoChange: (value: string) => void;
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
			<CompanyLogoDropZone onLogoChange={onLogoChange} value={values.photos} />
			<input name="photos" readOnly type="hidden" value={values.photos ?? ""} />
		</div>
	);
}

function FullFields({
	admin,
	addressFields,
	onAddressChange,
	onLogoChange,
	onValueChange,
	values,
}: {
	admin: boolean;
	addressFields: CompanyAddressSelection;
	onAddressChange: (selection: CompanyAddressSelection) => void;
	onLogoChange: (value: string) => void;
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
			<CompanyLogoDropZone onLogoChange={onLogoChange} value={values.photos} />
		</>
	);
}

function CompanyLogoDropZone({
	onLogoChange,
	value,
}: {
	onLogoChange: (value: string) => void;
	value?: string;
}) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const dragCounterRef = useRef(0);
	const [isPageDragOver, setIsPageDragOver] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const hasLogo = photosFromValue(value).length > 0;

	const processFile = useCallback(
		async (file: File) => {
			if (!acceptedLogoTypes.has(file.type)) {
				setMessage("Logo must be a PNG or JPEG image.");
				return;
			}

			const dataUrl = await readFileAsDataUrl(file);
			onLogoChange(dataUrl);
			setMessage(`${file.name} added as the company logo.`);
		},
		[onLogoChange],
	);

	const processFileRef = useRef(processFile);
	useEffect(() => {
		processFileRef.current = processFile;
	}, [processFile]);

	useEffect(() => {
		const handleDragEnter = (event: DragEvent) => {
			if (!hasDraggedFiles(event)) return;
			event.preventDefault();
			dragCounterRef.current += 1;
			if (dragCounterRef.current === 1) setIsPageDragOver(true);
		};

		const handleDragLeave = (event: DragEvent) => {
			if (!hasDraggedFiles(event)) return;
			event.preventDefault();
			dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
			if (dragCounterRef.current === 0) setIsPageDragOver(false);
		};

		const handleDragOver = (event: DragEvent) => {
			if (!hasDraggedFiles(event)) return;
			event.preventDefault();
		};

		const handleDrop = (event: DragEvent) => {
			if (!hasDraggedFiles(event)) return;
			event.preventDefault();
			dragCounterRef.current = 0;
			setIsPageDragOver(false);
			const file = event.dataTransfer?.files?.[0];
			if (file) void processFileRef.current(file);
		};

		document.addEventListener("dragenter", handleDragEnter);
		document.addEventListener("dragleave", handleDragLeave);
		document.addEventListener("dragover", handleDragOver);
		document.addEventListener("drop", handleDrop);

		return () => {
			document.removeEventListener("dragenter", handleDragEnter);
			document.removeEventListener("dragleave", handleDragLeave);
			document.removeEventListener("dragover", handleDragOver);
			document.removeEventListener("drop", handleDrop);
		};
	}, []);

	return (
		<div className="space-y-2">
			{isPageDragOver && <LogoPageDropOverlay />}
			<input
				accept="image/png,image/jpeg"
				className="hidden"
				onChange={(event) => {
					const file = event.target.files?.[0];
					if (file) void processFile(file);
					event.target.value = "";
				}}
				ref={fileInputRef}
				type="file"
			/>
			<button
				className="flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border border-emerald-300 border-dashed bg-emerald-50 px-4 py-5 font-medium text-emerald-800 text-sm transition-colors hover:border-emerald-500 hover:bg-emerald-100"
				onClick={() => fileInputRef.current?.click()}
				type="button"
			>
				{hasLogo ? (
					<ImageIcon aria-hidden="true" className="size-5" />
				) : (
					<UploadCloud aria-hidden="true" className="size-5" />
				)}
				<span>{hasLogo ? "Replace company logo" : "Upload company logo"}</span>
				<span className="font-normal text-emerald-700 text-xs">
					PNG or JPEG. Drag and drop anywhere on this page.
				</span>
			</button>
			{message && (
				<p
					className={
						message.includes("must")
							? "text-destructive text-sm"
							: "text-muted-foreground text-sm"
					}
					role={message.includes("must") ? "alert" : "status"}
				>
					{message}
				</p>
			)}
		</div>
	);
}

function LogoPageDropOverlay() {
	return (
		<div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-emerald-50/95 p-8">
			<div className="flex h-full w-full flex-col items-center justify-center gap-6 rounded-2xl border-4 border-emerald-400 border-dashed">
				<UploadCloud aria-hidden="true" className="size-24 text-emerald-500" />
				<p className="font-semibold text-3xl text-emerald-700">
					Drop your image here
				</p>
				<p className="text-emerald-600 text-lg">PNG or JPEG only</p>
			</div>
		</div>
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
	const rawValue = String(value ?? "").trim();
	if (!rawValue) return [];
	const values = rawValue.includes("\n")
		? rawValue.split(/\n+/)
		: rawValue.startsWith("data:image/")
			? [rawValue]
			: rawValue.split(",");
	return values
		.map((url) => url.trim())
		.filter(Boolean)
		.map((url, sortOrder) => ({ url, sortOrder }));
}

function logoPhotoValue(currentValue: string | undefined, nextValue: string) {
	return [
		nextValue,
		...photosFromValue(currentValue)
			.map((photo) => photo.url)
			.filter((url) => url !== nextValue),
	]
		.filter(Boolean)
		.join("\n");
}

function hasDraggedFiles(event: DragEvent) {
	return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

function readFileAsDataUrl(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === "string") {
				resolve(reader.result);
				return;
			}
			reject(new Error("Could not read image file"));
		};
		reader.onerror = () =>
			reject(reader.error ?? new Error("Could not read image file"));
		reader.readAsDataURL(file);
	});
}

function formValues(form: HTMLFormElement): CompanyFormValues {
	return Object.fromEntries(
		Array.from(new FormData(form).entries()).map(([key, value]) => [
			key,
			String(value),
		]),
	);
}

function readFormDraft(key: string): CompanyFormValues | null {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== "object") return null;
		return Object.fromEntries(
			Object.entries(parsed).flatMap(([draftKey, value]) =>
				typeof value === "string" ? [[draftKey, value]] : [],
			),
		);
	} catch {
		localStorage.removeItem(key);
		return null;
	}
}

function writeFormDraft(key: string, values: CompanyFormValues) {
	localStorage.setItem(key, JSON.stringify(values));
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
