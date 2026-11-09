import { expect, test } from "./fixtures";

test("loads the built app and restores edits after a reload", async ({ page }) => {
	await page.goto("./");
	await expect(page.getByRole("img", { name: "Sankey diagram" })).toBeVisible();
	await page.getByRole("textbox", { name: "Name for Salary", exact: true }).fill("Wages");
	await page.reload();
	await expect(page.getByRole("textbox", { name: "Name for Wages", exact: true })).toHaveValue(
		"Wages",
	);
	await page.getByRole("link", { name: "Third-party licenses" }).click();
	await expect(page.getByRole("heading", { name: "Third-Party Licenses" })).toBeVisible();
	await page.getByRole("link", { name: "Back to the app" }).click();
	await expect(page).toHaveURL(/\/sankey-builder\/$/);
});

test("native Tab navigation leaves the background inert and Escape restores each trigger", async ({
	page,
	browserName,
}) => {
	// macOS WebKit uses Option+Tab to include buttons without changing system preferences.
	const tab = process.platform === "darwin" && browserName === "webkit" ? "Alt+Tab" : "Tab";
	await page.goto("./");
	for (const name of ["Theme: System", "Appearance", "Export diagram"]) {
		const trigger = page.getByRole("button", { name, exact: true });
		await trigger.focus();
		await page.keyboard.press("Enter");
		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();
		const close = dialog.getByRole("button", { name: "Close", exact: true });
		const controls = dialog.locator("button:visible, select:visible");
		await close.focus();
		await page.keyboard.press(tab);
		await expect(controls.nth(1)).toBeFocused();
		await page.keyboard.press(`Shift+${tab}`);
		await expect(close).toBeFocused();
		for (const key of [tab, `Shift+${tab}`]) {
			for (let index = 0; index < (await controls.count()) + 2; index++) {
				await page.keyboard.press(key);
				// Native dialogs may yield focus to browser chrome, but never to the background page.
				expect(
					await dialog.evaluate(
						(element) =>
							document.activeElement === document.body || element.contains(document.activeElement),
					),
				).toBe(true);
			}
		}
		await close.focus();
		await page.keyboard.press("Escape");
		await expect(dialog).toBeHidden();
		await expect(trigger).toBeFocused();
	}
});

test("palette Tab commits and advances focus in both directions", async ({ page, browserName }) => {
	const tab = process.platform === "darwin" && browserName === "webkit" ? "Alt+Tab" : "Tab";
	await page.goto("./");
	await page.getByRole("button", { name: "Appearance", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Appearance", exact: true });
	const palette = dialog.getByRole("combobox", { name: "Color saturation" });
	await palette.press("End");
	await palette.press(tab);
	await expect(dialog.getByRole("combobox", { name: "Link colors" })).toBeFocused();
	await expect(palette).toHaveAttribute("aria-expanded", "false");
	await expect(palette).toContainText("Intense");
	await palette.focus();
	await palette.press("Home");
	await palette.press(`Shift+${tab}`);
	await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
	await expect(palette).toContainText("Grayscale");
});

for (const kind of ["node", "link"]) {
	test(`mouse-drags a ${kind} row using Sortable's fallback clone`, async ({ page }) => {
		await page.goto("./");
		const rows = page.locator(`#${kind}-editor .${kind}-row:not(.row-fallback)`);
		const handles = rows.locator(".drag-handle");
		const originalNames = await handles.evaluateAll((elements) =>
			elements.map((element) => element.getAttribute("aria-label")),
		);
		const first = await handles.nth(0).boundingBox();
		const second = await handles.nth(1).boundingBox();
		if (!first || !second) throw new Error("Reorder handles have no layout");
		await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
		await page.mouse.down();
		await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2 + 8, { steps: 3 });
		const clone = page.locator(`.${kind}-row.row-fallback`);
		await expect(clone).toBeVisible();
		if (kind === "node") await expect(clone.locator("input")).toHaveValue("Salary");
		else {
			await expect(clone.locator(".link-source")).toHaveValue("n1");
			await expect(clone.locator(".link-target")).toHaveValue("n3");
			await expect(clone.locator(".link-value")).toHaveValue("1600");
		}
		await page.mouse.move(second.x + second.width / 2, second.y + second.height - 2, { steps: 12 });
		await expect(rows.nth(1).locator(".drag-handle")).toHaveAttribute(
			"aria-label",
			originalNames[0] ?? "",
		);
		await page.mouse.up();
		await expect(page.locator(".row-fallback, .row-ghost")).toHaveCount(0);
		if (kind === "node") {
			await expect(handles.nth(0)).toHaveAttribute("aria-label", originalNames[1] ?? "");
		} else {
			await expect(rows.nth(1).locator(".link-source")).toHaveValue("n1");
			await expect(rows.nth(0).locator(".link-source")).toHaveValue("n2");
		}
		await page.reload();
		await expect(rows.nth(0).locator(kind === "node" ? ".node-name" : ".link-source")).toHaveValue(
			kind === "node" ? "Freelance" : "n2",
		);
	});
}

test("the preview responds to real pointer capture and keyboard resizing", async ({ page }) => {
	await page.goto("./");
	const handle = page.getByRole("separator", { name: "Resize diagram preview" });
	const svg = page.getByRole("img", { name: "Sankey diagram" });
	const viewBox = await svg.getAttribute("viewBox");
	const heightBefore = (await svg.boundingBox())?.height ?? 0;
	const bounds = await handle.boundingBox();
	if (!bounds) throw new Error("Preview handle has no layout");
	await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
	await page.mouse.down();
	await page.mouse.move(bounds.x + bounds.width / 2 + 100, bounds.y + bounds.height / 2 + 40, {
		steps: 10,
	});
	await page.mouse.up();
	await expect(handle).toHaveAttribute("aria-valuenow", "400");
	expect((await svg.boundingBox())?.height).toBeGreaterThan(heightBefore);
	await handle.press("ArrowUp");
	await expect(handle).toHaveAttribute("aria-valuenow", "360");
	await handle.press("End");
	await expect(handle).toHaveAttribute(
		"aria-valuenow",
		(await handle.getAttribute("aria-valuemax")) ?? "",
	);
	await handle.press("Home");
	await expect(handle).toHaveAttribute(
		"aria-valuenow",
		(await handle.getAttribute("aria-valuemin")) ?? "",
	);
	await expect(svg).toHaveAttribute("viewBox", viewBox ?? "");
});
