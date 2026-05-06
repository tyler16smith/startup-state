import { browser } from "wxt/browser";
import { requestHelloWorld } from "../lib/app-api";
import type { ExtensionMessage } from "../lib/types";

export default defineBackground(() => {
	browser.runtime.onInstalled.addListener(() => {
		void browser.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true });
	});

	browser.runtime.onMessage.addListener((message: ExtensionMessage) => {
		if (message.type === "HELLO_WORLD") {
			return requestHelloWorld();
		}

		return undefined;
	});
});
