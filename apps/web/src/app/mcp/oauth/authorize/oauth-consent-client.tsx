"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, ShieldCheck, X } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	approveMcpOAuthConsent,
	getMcpOAuthConsentRequest,
	type OAuthConsentInput,
} from "~/lib/api/mcp";

type OAuthConsentClientProps = {
	request: OAuthConsentInput;
};

function denyRedirect(request: OAuthConsentInput): string {
	const redirectUrl = new URL(request.redirect_uri);
	redirectUrl.searchParams.set("error", "access_denied");
	if (request.state) redirectUrl.searchParams.set("state", request.state);
	return redirectUrl.toString();
}

export function OAuthConsentClient({ request }: OAuthConsentClientProps) {
	const consent = useQuery({
		queryKey: ["mcp", "oauth-consent", request],
		queryFn: () => getMcpOAuthConsentRequest(request),
		retry: false,
	});

	const denyUrl = useMemo(() => denyRedirect(request), [request]);
	const approve = useMutation({
		mutationFn: () => approveMcpOAuthConsent(request),
		onSuccess: (data) => {
			window.location.href = data.redirectUrl;
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Authorization failed",
			);
		},
	});

	if (consent.isLoading) {
		return (
			<Card className="w-full max-w-lg">
				<CardContent className="p-6">
					<div className="h-36 animate-pulse rounded bg-muted" />
				</CardContent>
			</Card>
		);
	}

	if (consent.isError || !consent.data) {
		return (
			<Card className="w-full max-w-lg">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<AlertTriangle className="h-4 w-4 text-destructive" />
						Authorization failed
					</CardTitle>
					<CardDescription>
						This MCP client request could not be validated.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button asChild variant="outline">
						<a href={denyUrl}>Return to client</a>
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="w-full max-w-lg">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<ShieldCheck className="h-4 w-4 text-green-600" />
					Connect {consent.data.client.name}
				</CardTitle>
				<CardDescription>
					{consent.data.client.clientProfile} · {consent.data.redirectUri}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-5">
				<div className="space-y-2">
					<p className="font-medium text-sm">Requested scopes</p>
					<div className="grid gap-2">
						{consent.data.scopes.map((scope) => (
							<div
								className="flex items-center gap-2 rounded-md border p-2"
								key={scope}
							>
								<Check className="h-4 w-4 text-green-600" />
								<span className="font-mono text-xs">{scope}</span>
							</div>
						))}
					</div>
				</div>

				<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					<Button asChild variant="outline">
						<a href={denyUrl}>
							<X className="h-4 w-4" />
							Deny
						</a>
					</Button>
					<Button disabled={approve.isPending} onClick={() => approve.mutate()}>
						<Check className="h-4 w-4" />
						{approve.isPending ? "Connecting…" : "Allow"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
