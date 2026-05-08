import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

interface InviteMemberCardProps {
	onCancel: () => void;
	onSubmit: (input: { name: string; email: string }) => void;
	isSubmitting: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteMemberCard({
	onCancel,
	onSubmit,
	isSubmitting,
}: InviteMemberCardProps) {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [error, setError] = useState<string | null>(null);

	function handleCancel() {
		setName("");
		setEmail("");
		setError(null);
		onCancel();
	}

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const trimmedName = name.trim();
		const trimmedEmail = email.trim();

		if (!trimmedName) {
			setError("Name is required.");
			return;
		}

		if (!trimmedEmail) {
			setError("Email is required.");
			return;
		}

		if (!EMAIL_REGEX.test(trimmedEmail)) {
			setError("Enter a valid email address.");
			return;
		}

		setError(null);
		onSubmit({
			name: trimmedName,
			email: trimmedEmail,
		});
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Invite household member</CardTitle>
				<CardDescription>
					Invite one household member to access the dashboard.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form className="space-y-4" onSubmit={handleSubmit}>
					<div className="space-y-2">
						<Label htmlFor="household-member-name">Name</Label>
						<Input
							autoComplete="name"
							id="household-member-name"
							onChange={(event) => setName(event.target.value)}
							placeholder="Household member name"
							value={name}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="household-member-email">Email</Label>
						<Input
							autoComplete="email"
							id="household-member-email"
							onChange={(event) => setEmail(event.target.value)}
							placeholder="name@example.com"
							type="email"
							value={email}
						/>
					</div>
					{error && <p className="text-destructive text-sm">{error}</p>}
					<div className="flex justify-end gap-2">
						<Button
							disabled={isSubmitting}
							onClick={handleCancel}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button disabled={isSubmitting} type="submit">
							{isSubmitting ? "Sending..." : "Send Invite"}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
