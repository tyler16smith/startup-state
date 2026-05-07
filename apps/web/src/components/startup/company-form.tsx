"use client";

import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { apiClient, type Company } from "~/lib/startup-api";

export function CompanyForm({
	company,
	admin = false,
}: {
	company?: Company;
	admin?: boolean;
}) {
	const router = useRouter();
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

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
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not save company");
		} finally {
			setSaving(false);
		}
	}

	return (
		<form action={submit} className="grid gap-5">
			<div className="grid gap-4 md:grid-cols-2">
				<Field defaultValue={company?.name} label="Name" name="name" required />
				{!admin && !company && (
					<Field
						label="Work email"
						name="workEmail"
						placeholder="you@company.com"
						required
						type="email"
					/>
				)}
				<Field
					defaultValue={company?.websiteUrl ?? ""}
					label="Website"
					name="websiteUrl"
					placeholder="https://example.com"
				/>
				<Field
					defaultValue={company?.sector ?? ""}
					label="Sector"
					name="sector"
				/>
				<Field defaultValue={company?.stage ?? ""} label="Stage" name="stage" />
				<Field
					defaultValue={company?.employees ?? ""}
					label="Employees"
					name="employees"
					type="number"
				/>
				<Field
					defaultValue={company?.employeeRange ?? ""}
					label="Employee range"
					name="employeeRange"
					placeholder="11-50"
				/>
				<Field
					defaultValue={company?.yearFounded ?? ""}
					label="Year founded"
					name="yearFounded"
					type="number"
				/>
				<Field
					defaultValue={company?.linkedinUrl ?? ""}
					label="LinkedIn"
					name="linkedinUrl"
				/>
				<Field
					defaultValue={company?.address ?? ""}
					label="Address"
					name="address"
				/>
				<Field defaultValue={company?.city ?? ""} label="City" name="city" />
				<Field
					defaultValue={company?.county ?? ""}
					label="County"
					name="county"
				/>
				<Field
					defaultValue={company?.postalCode ?? ""}
					label="Postal code"
					name="postalCode"
				/>
				<Field
					defaultValue={company?.latitude ?? ""}
					label="Latitude"
					name="latitude"
					type="number"
				/>
				<Field
					defaultValue={company?.longitude ?? ""}
					label="Longitude"
					name="longitude"
					type="number"
				/>
				<Field
					defaultValue={company?.jobPostingsUrl ?? ""}
					label="Job postings URL"
					name="jobPostingsUrl"
				/>
				<div className="space-y-2">
					<Label>Hiring status</Label>
					<select
						className="h-9 w-full rounded-md border bg-white px-3 text-sm"
						defaultValue={company?.hiringStatus ?? "UNKNOWN"}
						name="hiringStatus"
					>
						<option>UNKNOWN</option>
						<option>NOT_HIRING</option>
						<option>HIRING</option>
						<option>ACTIVELY_HIRING</option>
					</select>
				</div>
				{admin && (
					<div className="space-y-2">
						<Label>Status</Label>
						<select
							className="h-9 w-full rounded-md border bg-white px-3 text-sm"
							defaultValue={company?.status ?? "PUBLISHED"}
							name="status"
						>
							<option>PUBLISHED</option>
							<option>PENDING_REVIEW</option>
							<option>DRAFT</option>
							<option>ARCHIVED</option>
						</select>
					</div>
				)}
			</div>
			<div className="space-y-2">
				<Label>Description</Label>
				<Textarea
					defaultValue={company?.description ?? ""}
					name="description"
					rows={5}
				/>
			</div>
			<div className="space-y-2">
				<Label>Photo URLs</Label>
				<Input
					defaultValue={
						company?.photos.map((photo) => photo.url).join(", ") ?? ""
					}
					name="photos"
					placeholder="https://...jpg, https://...jpg"
				/>
			</div>
			{success && <p className="text-emerald-700 text-sm">{success}</p>}
			{error && <p className="text-destructive text-sm">{error}</p>}
			<Button className="w-fit" disabled={saving} type="submit">
				{saving ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<Save className="size-4" />
				)}{" "}
				Save company
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
			<Label>{label}</Label>
			<Input {...inputProps} />
		</div>
	);
}
