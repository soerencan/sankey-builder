import { expect, test } from "./fixtures";

test.skip(
	!process.env.PLAYWRIGHT_VISUAL_TESTS,
	"Screenshot baselines use the pinned Linux container; see README.md.",
);

for (const width of [390, 768, 1280]) {
	for (const colorScheme of ["light", "dark"] as const) {
		test(`default layout at ${width}px in ${colorScheme}`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			await page.emulateMedia({ colorScheme });
			await page.goto("./");
			await expect(page.getByRole("img", { name: "Sankey diagram" })).toBeVisible();
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true,
			);
			await expect(page).toHaveScreenshot(`layout-${width}-${colorScheme}.png`, { fullPage: true });
		});
	}
}

for (const width of [390, 1280]) {
	test(`Appearance panel at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("./");
		await page.getByRole("button", { name: "Appearance", exact: true }).click();
		await expect(page.getByRole("dialog", { name: "Appearance", exact: true })).toBeVisible();
		await expect(page).toHaveScreenshot(`appearance-${width}.png`);
	});
}
