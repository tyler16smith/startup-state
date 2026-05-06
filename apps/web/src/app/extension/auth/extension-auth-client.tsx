"use client";

import { getCsrfToken } from "@app/client-ts";
import { useEffect, useRef, useState } from "react";
import { toApiUrl } from "~/lib/api-url";

type ExtensionExchangeResponse = {
	data?: {
		accessToken: string;
		refreshToken: string;
		expiresAt: string;
		user: {
			id: string;
			email: string;
		};
	};
	error?: {
		message: string;
	};
};

type ExtensionAuthClientProps = {
	extensionId: string;
};

async function readExchangeResponse(
	response: Response,
): Promise<ExtensionExchangeResponse> {
	try {
		return (await response.json()) as ExtensionExchangeResponse;
	} catch {
		return { error: { message: "The API returned an invalid response" } };
	}
}

function ExtensionAuthMessage({
	title,
	message,
}: {
	title: string;
	message: string;
}) {
	return (
		<main className="flex min-h-screen items-center justify-center bg-background p-6">
			<div className="max-w-md rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
				<h1 className="font-semibold text-xl">{title}</h1>
				<p className="mt-2 text-muted-foreground text-sm">{message}</p>
			</div>
		</main>
	);
}

export function ExtensionAuthClient({ extensionId }: ExtensionAuthClientProps) {
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const hasStarted = useRef(false);

	useEffect(() => {
		if (hasStarted.current) return;
		hasStarted.current = true;

		async function exchangeToken() {
			const callbackUrl = `/extension/auth?extensionId=${encodeURIComponent(extensionId)}`;
			const csrfToken = await getCsrfToken();
			const response = await fetch(toApiUrl("/api/v1/extensionAuth/exchange"), {
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
					...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
				},
				body: JSON.stringify({
					deviceInfo: "App Chrome Extension",
				}),
				cache: "no-store",
			});

			if (response.status === 401) {
				window.location.assign(
					`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`,
				);
				return;
			}

			const payload = await readExchangeResponse(response);
			if (!response.ok || !payload.data) {
				setErrorMessage(
					payload.error?.message ??
						"Please try connecting from the extension again.",
				);
				return;
			}

			const redirectUrl = new URL(
				`chrome-extension://${extensionId}/popup.html`,
			);
			redirectUrl.searchParams.set("appAccessToken", payload.data.accessToken);
			redirectUrl.searchParams.set("refreshToken", payload.data.refreshToken);
			redirectUrl.searchParams.set("expiresAt", payload.data.expiresAt);
			redirectUrl.searchParams.set("appUserId", payload.data.user.id);
			redirectUrl.searchParams.set("email", payload.data.user.email);

			window.location.assign(redirectUrl.toString());
		}

		exchangeToken().catch(() => {
			setErrorMessage("Please try connecting from the extension again.");
		});
	}, [extensionId]);

	if (errorMessage) {
		return (
			<ExtensionAuthMessage
				message={errorMessage}
				title="Could not connect extension"
			/>
		);
	}

	return (
		<ExtensionAuthMessage
			message="The app is opening your extension."
			title="Connecting extension"
		/>
	);
}
