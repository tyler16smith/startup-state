import { browser } from "wxt/browser";
import type { AuthState, ExtensionState, HelloWorldResult } from "./types";

const STATE_KEY = "appExtensionState";

const defaultState: ExtensionState = {
	auth: null,
	lastHelloWorld: null,
};

function mergeState(
	state: Partial<ExtensionState> | undefined,
): ExtensionState {
	return {
		...defaultState,
		...state,
		auth: state?.auth ?? null,
		lastHelloWorld: state?.lastHelloWorld ?? null,
	};
}

export async function getExtensionState(): Promise<ExtensionState> {
	const result = await browser.storage.local.get(STATE_KEY);
	return mergeState(result[STATE_KEY] as Partial<ExtensionState> | undefined);
}

export async function setExtensionState(state: ExtensionState): Promise<void> {
	await browser.storage.local.set({ [STATE_KEY]: state });
	void browser.runtime.sendMessage({ type: "STATE_UPDATED" });
}

export async function updateExtensionState(
	updater: (state: ExtensionState) => ExtensionState,
): Promise<ExtensionState> {
	const current = await getExtensionState();
	const next = updater(current);
	await setExtensionState(next);
	return next;
}

export async function setAuthState(auth: AuthState): Promise<void> {
	await updateExtensionState((state) => ({ ...state, auth }));
}

export async function setHelloWorldResult(
	lastHelloWorld: HelloWorldResult,
): Promise<void> {
	await updateExtensionState((state) => ({ ...state, lastHelloWorld }));
}
