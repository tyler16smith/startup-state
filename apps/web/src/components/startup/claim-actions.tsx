"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { apiClient } from "~/lib/startup-api";

export function ClaimActions({
	claimId,
	disabled,
}: {
	claimId: string;
	disabled?: boolean;
}) {
	const router = useRouter();
	async function review(action: "approveClaim" | "rejectClaim") {
		await apiClient(`/api/v1/companies/${action}`, {
			method: "POST",
			body: JSON.stringify({ claimId }),
		});
		router.refresh();
	}
	return (
		<div className="flex justify-end gap-2">
			<Button
				disabled={disabled}
				onClick={() => review("approveClaim")}
				size="icon-sm"
				type="button"
			>
				<Check className="size-4" />
			</Button>
			<Button
				disabled={disabled}
				onClick={() => review("rejectClaim")}
				size="icon-sm"
				type="button"
				variant="outline"
			>
				<X className="size-4" />
			</Button>
		</div>
	);
}
