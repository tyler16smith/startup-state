import { LogIn, LogOut, RefreshCw, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { browser } from "wxt/browser";
import {
	requestHelloWorld,
	revokeAppAuth,
	startAppAuth,
	syncExtensionAccount,
} from "./app-api";
import { getExtensionState } from "./chrome-storage";
import type { ExtensionState, HelloWorldResult } from "./types";

type Surface = "popup" | "sidepanel";

type Status = "idle" | "loading" | "error";

export function HelloWorldHome({ surface }: { surface: Surface }) {
	const [state, setState] = useState<ExtensionState | null>(null);
	const [status, setStatus] = useState<Status>("idle");
	const [error, setError] = useState<string | null>(null);
	const [contentResult, setContentResult] = useState<HelloWorldResult | null>(
		null,
	);

	const refreshState = useCallback(async () => {
		const nextState = await getExtensionState();
		setState(nextState);
		return nextState;
	}, []);

	useEffect(() => {
		void refreshState();
		const listener = () => void refreshState();
		browser.runtime.onMessage.addListener(listener);
		return () => browser.runtime.onMessage.removeListener(listener);
	}, [refreshState]);

	async function runHelloWorld() {
		setStatus("loading");
		setError(null);
		try {
			await requestHelloWorld();
			await refreshState();
			setStatus("idle");
		} catch (err) {
			setStatus("error");
			setError(err instanceof Error ? err.message : "Hello world failed");
		}
	}

	async function runContentRoundTrip() {
		setStatus("loading");
		setError(null);
		try {
			const [tab] = await browser.tabs.query({
				active: true,
				currentWindow: true,
			});
			const tabId = tab?.id;
			if (!tabId) throw new Error("No active tab available");
			const result = await browser.tabs.sendMessage(tabId, {
				type: "HELLO_WORLD",
			});
			setContentResult(result as HelloWorldResult);
			await refreshState();
			setStatus("idle");
		} catch (err) {
			setStatus("error");
			setError(
				err instanceof Error ? err.message : "Content script round trip failed",
			);
		}
	}

	async function syncAccount() {
		setStatus("loading");
		setError(null);
		try {
			await syncExtensionAccount();
			await refreshState();
			setStatus("idle");
		} catch (err) {
			setStatus("error");
			setError(
				err instanceof Error ? err.message : "Unable to refresh account",
			);
		}
	}

	async function signOut() {
		setStatus("loading");
		setError(null);
		try {
			await revokeAppAuth();
			await refreshState();
			setStatus("idle");
		} catch (err) {
			setStatus("error");
			setError(err instanceof Error ? err.message : "Unable to sign out");
		}
	}

	const isLoading = status === "loading";
	const lastResult = contentResult ?? state?.lastHelloWorld ?? null;

	return (
		<main className="app-shell">
			<header className="stack">
				<p className="eyebrow">{surface}</p>
				<h1>Hello world</h1>
				<p className="muted">
					Authenticated extension shell with a background-to-API round trip.
				</p>
			</header>

			<section className="panel">
				<p className="label">Account</p>
				{state?.auth ? (
					<div className="stack-sm">
						<p>{state.auth.email ?? state.auth.appUserId}</p>
						<div className="row">
							<button disabled={isLoading} onClick={syncAccount} type="button">
								<RefreshCw size={14} />
								Refresh
							</button>
							<button disabled={isLoading} onClick={signOut} type="button">
								<LogOut size={14} />
								Sign out
							</button>
						</div>
					</div>
				) : (
					<button
						disabled={isLoading}
						onClick={() => void startAppAuth()}
						type="button"
					>
						<LogIn size={14} />
						Sign in
					</button>
				)}
			</section>

			<section className="panel stack-sm">
				<p className="label">Round trip</p>
				<div className="row">
					<button
						disabled={isLoading || !state?.auth}
						onClick={runHelloWorld}
						type="button"
					>
						<Send size={14} />
						Background
					</button>
					<button
						disabled={isLoading || !state?.auth}
						onClick={runContentRoundTrip}
						type="button"
					>
						<Send size={14} />
						Content
					</button>
				</div>
				{lastResult ? (
					<pre>{JSON.stringify(lastResult, null, 2)}</pre>
				) : (
					<p className="muted">No result yet.</p>
				)}
			</section>

			{error ? <p className="error">{error}</p> : null}
		</main>
	);
}
