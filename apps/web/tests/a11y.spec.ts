import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicRoutes = [
	{ name: "sign in", path: "/auth/signin" },
	{ name: "register", path: "/auth/register" },
	{ name: "navigator landing", path: "/" },
	{ name: "company submission", path: "/companies/new" },
	{ name: "resource directory", path: "/resources" },
	{ name: "company map", path: "/map" },
];

for (const route of publicRoutes) {
	test(`${route.name} has no automatically detectable WCAG AA violations`, async ({
		page,
	}) => {
		const response = await page.goto(route.path, {
			waitUntil: "domcontentloaded",
		});

		expect(response?.status(), `${route.path} should render`).toBeLessThan(500);

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();

		expect(results.violations).toEqual([]);
	});
}
