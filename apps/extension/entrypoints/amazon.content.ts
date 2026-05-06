import { browser } from "wxt/browser";
import type { ExtensionMessage, HelloWorldResult } from "../lib/types";

export default defineContentScript({
	matches: ["http://*/*", "https://*/*"],
	main() {
		browser.runtime.onMessage.addListener((message: ExtensionMessage) => {
			if (message.type === "HELLO_WORLD") {
				return browser.runtime.sendMessage({
					type: "HELLO_WORLD",
				} satisfies ExtensionMessage);
			}

			return undefined;
		});

		window.addEventListener("app-extension-hello-world", () => {
			void browser.runtime
				.sendMessage({ type: "HELLO_WORLD" } satisfies ExtensionMessage)
				.then((result: HelloWorldResult) => {
					window.dispatchEvent(
						new CustomEvent("app-extension-hello-world-result", {
							detail: result,
						}),
					);
				});
		});
	},
});
