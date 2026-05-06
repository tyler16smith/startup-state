import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "wxt";

function toHostPermissionPattern(value: string, fallback: string): string {
	const baseUrl = value || fallback;
	const url = new URL(baseUrl);
	return `${url.protocol}//${url.hostname}/*`;
}

const apiHostPermission = toHostPermissionPattern(
	process.env.WXT_APP_API_URL ?? "",
	"http://localhost:3001",
);
const webHostPermission = toHostPermissionPattern(
	process.env.WXT_APP_WEB_URL ?? "",
	"http://localhost:3000",
);
const chromiumProfile = fileURLToPath(
	new URL(".wxt/chromium-profile", import.meta.url),
);

mkdirSync(chromiumProfile, { recursive: true });

export default defineConfig({
	modules: ["@wxt-dev/module-react"],
	dev: {
		server: {
			port: 5000,
			origin: "http://localhost:5000",
			strictPort: true,
		},
	},
	webExt: {
		chromiumProfile,
		keepProfileChanges: true,
		startUrls: ["https://www.google.com/"],
	},
	hooks: {
		"build:manifestGenerated": (_wxt, manifest) => {
			if (manifest.action) {
				delete manifest.action.default_popup;
			}
		},
	},
	manifest: {
		name: "App Extension",
		description:
			"Skeleton browser extension for app authentication and API calls.",
		version: "0.1.0",
		permissions: ["storage", "tabs", "scripting", "cookies"],
		host_permissions: [apiHostPermission],
		action: {
			default_title: "App Extension",
		},
		side_panel: {
			default_path: "sidepanel.html",
		},
		web_accessible_resources: [
			{
				resources: ["popup.html"],
				matches: [webHostPermission],
			},
		],
	},
});
