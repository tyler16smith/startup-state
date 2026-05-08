"use client";

import { type McpScope, mcpScopes } from "@app/mcp-contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound, LinkIcon, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import {
	type CreatedMcpPersonalAccessToken,
	createMcpPersonalAccessToken,
	listMcpOAuthConnections,
	listMcpPersonalAccessTokens,
	type McpOAuthConnection,
	type McpPersonalAccessToken,
	revokeMcpOAuthConnection,
	revokeMcpPersonalAccessToken,
} from "~/lib/api/mcp";
import { cn } from "~/lib/utils";
import { SettingsSection } from "./settings-section";

const defaultScopes: McpScope[] = ["mcp:read"];

const expirationOptions = [
	{ label: "30 days", value: "30" },
	{ label: "90 days", value: "90" },
	{ label: "1 year", value: "365" },
	{ label: "Never", value: "never" },
];

function formatDate(value: string | null | undefined) {
	if (!value) return "Never";
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(value));
}

function statusText(revokedAt: string | null, expiresAt: string | null) {
	if (revokedAt) return "Revoked";
	if (expiresAt && new Date(expiresAt) <= new Date()) return "Expired";
	return "Active";
}

function TokenRow({ token }: { token: McpPersonalAccessToken }) {
	const queryClient = useQueryClient();
	const revoke = useMutation({
		mutationFn: () => revokeMcpPersonalAccessToken({ tokenId: token.id }),
		onSuccess: () => {
			toast.success("Token revoked");
			void queryClient.invalidateQueries({ queryKey: ["mcp", "pats"] });
		},
		onError: () => toast.error("Failed to revoke token"),
	});
	const status = statusText(token.revokedAt, token.expiresAt);

	return (
		<div className="flex flex-col gap-3 border-t py-4 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
			<div className="min-w-0 space-y-1">
				<div className="flex flex-wrap items-center gap-2">
					<p className="font-medium text-sm">{token.name}</p>
					<span
						className={cn(
							"rounded-full px-2 py-0.5 text-xs",
							status === "Active"
								? "bg-green-500/10 text-green-700 dark:text-green-400"
								: "bg-muted text-muted-foreground",
						)}
					>
						{status}
					</span>
				</div>
				<p className="font-mono text-muted-foreground text-xs">
					{token.tokenPrefix}...
				</p>
				<p className="text-muted-foreground text-xs">
					{token.scopes.join(" ")}
				</p>
				<p className="text-muted-foreground text-xs">
					Created {formatDate(token.createdAt)} · Last used{" "}
					{formatDate(token.lastUsedAt)} · Expires {formatDate(token.expiresAt)}
				</p>
			</div>
			<Button
				disabled={status !== "Active" || revoke.isPending}
				onClick={() => revoke.mutate()}
				size="sm"
				variant="outline"
			>
				<Trash2 className="h-4 w-4" />
				Revoke
			</Button>
		</div>
	);
}

function OAuthConnectionRow({
	connection,
}: {
	connection: McpOAuthConnection;
}) {
	const queryClient = useQueryClient();
	const revoke = useMutation({
		mutationFn: () =>
			revokeMcpOAuthConnection({ accessTokenId: connection.id }),
		onSuccess: () => {
			toast.success("Connection revoked");
			void queryClient.invalidateQueries({ queryKey: ["mcp", "oauth"] });
		},
		onError: () => toast.error("Failed to revoke connection"),
	});
	const status = statusText(connection.revokedAt, connection.expiresAt);

	return (
		<div className="flex flex-col gap-3 border-t py-4 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
			<div className="min-w-0 space-y-1">
				<div className="flex flex-wrap items-center gap-2">
					<p className="font-medium text-sm">{connection.oauthClient.name}</p>
					<span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
						{connection.oauthClient.clientProfile}
					</span>
					<span
						className={cn(
							"rounded-full px-2 py-0.5 text-xs",
							status === "Active"
								? "bg-green-500/10 text-green-700 dark:text-green-400"
								: "bg-muted text-muted-foreground",
						)}
					>
						{status}
					</span>
				</div>
				<p className="font-mono text-muted-foreground text-xs">
					{connection.tokenPrefix}...
				</p>
				<p className="text-muted-foreground text-xs">
					{connection.scopes.join(" ")}
				</p>
				<p className="text-muted-foreground text-xs">
					Connected {formatDate(connection.createdAt)} · Refresh expires{" "}
					{formatDate(connection.refreshTokenExpiresAt)}
				</p>
			</div>
			<Button
				disabled={status !== "Active" || revoke.isPending}
				onClick={() => revoke.mutate()}
				size="sm"
				variant="outline"
			>
				<Trash2 className="h-4 w-4" />
				Revoke
			</Button>
		</div>
	);
}

function CreateTokenDialog({
	onOpenChange,
	open,
}: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const queryClient = useQueryClient();
	const [name, setName] = useState("Local MCP token");
	const [clientName, setClientName] = useState("");
	const [expiresInDays, setExpiresInDays] = useState("90");
	const [scopes, setScopes] = useState<McpScope[]>(defaultScopes);
	const [createdToken, setCreatedToken] =
		useState<CreatedMcpPersonalAccessToken | null>(null);
	const [copied, setCopied] = useState(false);

	const create = useMutation({
		mutationFn: () =>
			createMcpPersonalAccessToken({
				name: name.trim(),
				clientName: clientName.trim() || undefined,
				scopes,
				expiresInDays: expiresInDays === "never" ? null : Number(expiresInDays),
			}),
		onSuccess: (data) => {
			setCreatedToken(data.token);
			toast.success("Token created");
			void queryClient.invalidateQueries({ queryKey: ["mcp", "pats"] });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to create token",
			);
		},
	});

	function toggleScope(scope: McpScope) {
		setScopes((current) =>
			current.includes(scope)
				? current.filter((item) => item !== scope)
				: [...current, scope],
		);
	}

	async function copyToken() {
		if (!createdToken) return;
		await navigator.clipboard.writeText(createdToken.token);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	}

	function closeDialog(next: boolean) {
		if (!next) {
			setCreatedToken(null);
			setCopied(false);
		}
		onOpenChange(next);
	}

	return (
		<Dialog onOpenChange={closeDialog} open={open}>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Create MCP token</DialogTitle>
					<DialogDescription>
						Use this token with Cursor, local stdio, or other MCP clients.
					</DialogDescription>
				</DialogHeader>

				{createdToken ? (
					<div className="space-y-4">
						<div className="rounded-md border bg-muted/40 p-3">
							<p className="mb-2 text-muted-foreground text-xs">Token</p>
							<p className="break-all font-mono text-sm">
								{createdToken.token}
							</p>
						</div>
						<div className="flex justify-end gap-2">
							<Button onClick={copyToken} type="button" variant="outline">
								{copied ? (
									<Check className="h-4 w-4" />
								) : (
									<Copy className="h-4 w-4" />
								)}
								{copied ? "Copied" : "Copy"}
							</Button>
							<Button onClick={() => closeDialog(false)} type="button">
								Done
							</Button>
						</div>
					</div>
				) : (
					<form
						className="space-y-4"
						onSubmit={(event) => {
							event.preventDefault();
							create.mutate();
						}}
					>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="mcp-token-name">Name</Label>
								<Input
									id="mcp-token-name"
									onChange={(event) => setName(event.target.value)}
									required
									value={name}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="mcp-client-name">Client name</Label>
								<Input
									id="mcp-client-name"
									onChange={(event) => setClientName(event.target.value)}
									placeholder="Cursor"
									value={clientName}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="mcp-token-expiration">Expiration</Label>
								<Select onValueChange={setExpiresInDays} value={expiresInDays}>
									<SelectTrigger className="w-full" id="mcp-token-expiration">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{expirationOptions.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<fieldset className="space-y-2">
							<legend className="font-medium text-sm leading-none">
								Scopes
							</legend>
							<div className="grid gap-2 sm:grid-cols-2">
								{mcpScopes.map((scope) => {
									const scopeId = `mcp-scope-${scope.replace(/:/g, "-")}`;
									return (
										<div
											className="flex items-center gap-2 rounded-md border p-2 text-sm"
											key={scope}
										>
											<Checkbox
												checked={scopes.includes(scope)}
												id={scopeId}
												onCheckedChange={() => toggleScope(scope)}
											/>
											<Label className="font-mono text-xs" htmlFor={scopeId}>
												{scope}
											</Label>
										</div>
									);
								})}
							</div>
						</fieldset>

						<div className="flex justify-end gap-2">
							<Button
								onClick={() => closeDialog(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button
								disabled={
									create.isPending || scopes.length === 0 || !name.trim()
								}
								type="submit"
							>
								{create.isPending ? "Creating…" : "Create token"}
							</Button>
						</div>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}

export function McpSettingsSection() {
	const [createOpen, setCreateOpen] = useState(false);
	const pats = useQuery({
		queryKey: ["mcp", "pats"],
		queryFn: listMcpPersonalAccessTokens,
	});
	const oauth = useQuery({
		queryKey: ["mcp", "oauth"],
		queryFn: listMcpOAuthConnections,
	});

	return (
		<SettingsSection title="MCP access">
			<Card>
				<CardHeader>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="space-y-1">
							<CardTitle className="flex items-center gap-2 text-base">
								<KeyRound className="h-4 w-4" />
								Personal access tokens
							</CardTitle>
							<CardDescription>
								Scoped tokens for local MCP clients.
							</CardDescription>
						</div>
						<Button onClick={() => setCreateOpen(true)} size="sm">
							<Plus className="h-4 w-4" />
							Create token
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{pats.isLoading ? (
						<div className="h-20 animate-pulse rounded bg-muted" />
					) : pats.data?.tokens.length ? (
						pats.data.tokens.map((token) => (
							<TokenRow key={token.id} token={token} />
						))
					) : (
						<p className="text-muted-foreground text-sm">No tokens yet.</p>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<LinkIcon className="h-4 w-4" />
						OAuth connections
					</CardTitle>
					<CardDescription>Connected hosted MCP clients.</CardDescription>
				</CardHeader>
				<CardContent>
					{oauth.isLoading ? (
						<div className="h-20 animate-pulse rounded bg-muted" />
					) : oauth.data?.connections.length ? (
						oauth.data.connections.map((connection) => (
							<OAuthConnectionRow connection={connection} key={connection.id} />
						))
					) : (
						<p className="text-muted-foreground text-sm">No connections yet.</p>
					)}
				</CardContent>
			</Card>

			<CreateTokenDialog onOpenChange={setCreateOpen} open={createOpen} />
		</SettingsSection>
	);
}
