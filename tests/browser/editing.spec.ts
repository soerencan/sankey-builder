import { expect, test } from "./fixtures";

test.use({ viewport: { width: 390, height: 900 }, hasTouch: true });

test("adds a node and link, updates the diagram, and restores compact-screen edits", async ({
	page,
}) => {
	await page.goto("./");
	const diagram = page.getByRole("img", { name: "Sankey diagram" });
	await expect(diagram.locator("path")).toHaveCount(5);
	await page.getByRole("button", { name: "Add node", exact: true }).tap();
	const nodeName = page.getByRole("textbox", { name: "Name for Node 7", exact: true });
	await expect(nodeName).toBeFocused();
	await nodeName.fill("Emergency reserve");
	await expect(diagram.locator("text").filter({ hasText: /^Emergency reserve$/ })).toHaveCount(1);

	await page.getByRole("button", { name: "Add link", exact: true }).tap();
	const source = page.getByRole("combobox", { name: "Source for link 6", exact: true });
	const target = page.getByRole("combobox", { name: "Target for link 6", exact: true });
	const value = page.getByRole("textbox", { name: "Value for link 6", exact: true });
	await expect(source).toBeFocused();
	await source.selectOption({ label: "Budget" });
	await expect(diagram.locator("path")).toHaveCount(5);
	await target.selectOption({ label: "Emergency reserve" });
	await expect(diagram.locator("path")).toHaveCount(6);
	const link = diagram.locator("path").last();
	const widthBefore = Number(await link.getAttribute("stroke-width"));
	expect(widthBefore).toBeGreaterThan(0);
	await value.fill("400");
	await expect
		.poll(async () => Number(await link.getAttribute("stroke-width")))
		.toBeGreaterThan(widthBefore);
	const widthAfter = Number(await link.getAttribute("stroke-width"));

	await page.reload();
	await expect(
		page.getByRole("textbox", { name: "Name for Emergency reserve", exact: true }),
	).toHaveValue("Emergency reserve");
	await expect(source.locator("option:checked")).toHaveText("Budget");
	await expect(target.locator("option:checked")).toHaveText("Emergency reserve");
	await expect(value).toHaveValue("400");
	await expect(diagram.locator("path")).toHaveCount(6);
	await expect.poll(async () => Number(await link.getAttribute("stroke-width"))).toBe(widthAfter);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
