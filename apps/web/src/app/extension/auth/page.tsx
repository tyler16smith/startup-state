import { ExtensionAuthClient } from "./extension-auth-client";

type SearchParams = Promise<{
	extensionId?: string;
}>;

function isChromeExtensionId(value: string): boolean {
	return /^[a-p]{32}$/.test(value);
}

export default async function ExtensionAuthPage({
	searchParams,
}: {
	searchParams: SearchParams;
}) {
	const params = await searchParams;
	const extensionId = params.extensionId;

	if (!extensionId || !isChromeExtensionId(extensionId)) {
		return (
			<main className="flex min-h-screen items-center justify-center bg-background p-6">
				<div className="max-w-md rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
					<h1 className="font-semibold text-xl">Extension auth unavailable</h1>
					<p className="mt-2 text-muted-foreground text-sm">
						Open this flow from the app extension.
					</p>
				</div>
			</main>
		);
	}

	return <ExtensionAuthClient extensionId={extensionId} />;
}
