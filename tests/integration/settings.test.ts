// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import {
	PALETTE_CHOICES,
	SETTING_LABELS,
	THEME_CHOICES,
} from "../../src/features/settings/options";
import { paletteColors } from "../../src/features/settings/palettes";
import { defaultState } from "../../src/model/graph";
import { SETTING_DOMAINS } from "../../src/model/settings";
import {
	accessibleName,
	allByRole,
	byRole,
	click,
	fireChange,
	getStoredState,
	mountApp,
	settle,
	tick,
} from "../helpers/mount-app";

function chooseSetting(label: string, value: string): HTMLSelectElement {
	const select = byRole<HTMLSelectElement>(document, "combobox", label);
	select.value = value;
	fireChange(select);
	return select;
}

/**
 * In the default graph, every node either has outgoing links or already sits
 * in the last column, so every alignment agrees on where it goes: the align
 * functions only differ on a node with neither. Adding one gives alignment
 * something to disagree on (justify pushes it to the last column; left keeps
 * it at column 0), so a redraw is visible in markup.
 */
function addIsolatedNode(): void {
	click(byRole<HTMLButtonElement>(document, "button", "Add node"));
}

describe("toolbar & settings", () => {
	it("Appearance focuses the palette dropdown and exposes all palette options", async () => {
		mountApp();

		click(byRole(document, "button", "Appearance"));

		const dialog = document.getElementById("display-dialog") as HTMLDialogElement;
		expect(dialog.open).toBe(true);
		const dropdown = byRole(dialog, "combobox", "Color saturation");
		expect(document.activeElement).toBe(dropdown);
		click(dropdown);
		await tick();
		expect(dropdown.getAttribute("aria-expanded")).toBe("true");
		const options = allByRole<HTMLButtonElement>(byRole(dialog, "listbox"), "option");
		expect(options.map((option) => accessibleName(option))).toEqual(
			PALETTE_CHOICES.map((option) => option.label),
		);
		expect(options.find((option) => option.getAttribute("aria-selected") === "true")).toBe(
			byRole(dialog, "option", SETTING_LABELS.palette.balanced),
		);
	});

	it("choosing a palette closes its dropdown and leaves Appearance open for further edits", async () => {
		mountApp();

		const trigger = byRole(document, "button", "Appearance");
		click(trigger);

		const dialog = document.getElementById("display-dialog") as HTMLDialogElement;
		const dropdown = byRole(dialog, "combobox", "Color saturation");
		click(dropdown);
		await tick();
		const mutedOption = byRole<HTMLButtonElement>(dialog, "option", SETTING_LABELS.palette.muted);
		click(mutedOption);
		await tick();

		const stored = getStoredState();
		expect(stored.settings.palette).toBe("muted");
		expect(mutedOption.getAttribute("aria-selected")).toBe("true");
		expect(
			byRole<HTMLButtonElement>(dialog, "option", SETTING_LABELS.palette.balanced).getAttribute(
				"aria-selected",
			),
		).toBe("false");
		expect(dialog.open).toBe(true);
		expect(dropdown.getAttribute("aria-expanded")).toBe("false");
		expect(document.activeElement).toBe(dropdown);
		click(byRole(dialog, "button", "Close"));
		expect(dialog.open).toBe(false);
		expect(document.activeElement).toBe(trigger);
	});

	it("palette keyboard navigation can cancel without changing colors or commit a selection", async () => {
		mountApp();
		click(byRole(document, "button", "Appearance"));
		const dialog = document.getElementById("display-dialog") as HTMLDialogElement;
		const dropdown = byRole(dialog, "combobox", "Color saturation");
		async function press(key: string): Promise<void> {
			dropdown.dispatchEvent(
				new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
			);
			await tick();
		}

		await press("ArrowDown");
		await press("ArrowDown");
		expect(dropdown.getAttribute("aria-activedescendant")).toBe("setting-palette-vivid");
		await press("Escape");
		expect(dropdown.getAttribute("aria-expanded")).toBe("false");
		expect(dialog.open).toBe(true);
		expect(getStoredState().settings?.palette ?? defaultState().settings.palette).toBe("balanced");

		await press("End");
		await press("Enter");
		expect(getStoredState().settings.palette).toBe("intense");
		expect(dropdown.getAttribute("aria-expanded")).toBe("false");
		expect(document.activeElement).toBe(dropdown);
	});

	it("Appearance opens labelled native settings, stays open during edits, and restores focus on close", () => {
		mountApp();
		const trigger = byRole(document, "button", "Appearance");
		click(trigger);
		const dialog = document.getElementById("display-dialog") as HTMLDialogElement;
		expect(dialog.open).toBe(true);
		chooseSetting("Node alignment", "justify");
		chooseSetting("Aspect ratio", "3:1");
		chooseSetting("Link colors", "neutral");
		expect(dialog.open).toBe(true);
		expect(getStoredState().settings).toMatchObject({
			alignment: "justify",
			aspectRatio: "3:1",
			linkColor: "neutral",
		});
		for (const path of Array.from(document.querySelectorAll("#diagram svg path"))) {
			expect(path.getAttribute("stroke")).toBe("#aaa");
		}
		expect(document.querySelector("#diagram svg")?.getAttribute("viewBox")).toBe("0 0 1440 480");
		expect(dialog.querySelector(".export-options")).toBeNull();
		click(byRole(dialog, "button", "Close"));
		expect(dialog.open).toBe(false);
		expect(document.activeElement).toBe(trigger);
	});

	it("switching back to gradient re-renders per-link gradients", () => {
		mountApp();
		chooseSetting("Link colors", "neutral");
		chooseSetting("Link colors", "gradient");
		expect(getStoredState().settings.linkColor).toBe("gradient");
		expect(document.querySelectorAll("#diagram linearGradient").length).toBeGreaterThan(0);
		expect(document.querySelector('#diagram path[stroke="url(#link-grad-0)"]')).not.toBeNull();
	});

	it("changing aspect ratio preserves the resized preview height", async () => {
		mountApp();
		click(byRole(document, "button", "Make diagram preview larger"));
		await tick();
		chooseSetting("Aspect ratio", "3:1");
		const diagram = document.getElementById("diagram");
		expect(diagram?.style.getPropertyValue("--diagram-preview-height")).toBe("400px");
		expect(diagram?.style.getPropertyValue("--diagram-aspect-ratio")).toBe("1440 / 480");
		expect(diagram?.style.getPropertyValue("--diagram-aspect-number")).toBe("3");
	});

	it("uses the current aspect ratio for the preview while an invalid graph retains the last valid SVG", () => {
		mountApp();
		const diagram = document.getElementById("diagram");
		const svg = diagram?.querySelector("svg");
		const svgBefore = svg?.outerHTML;
		expect(svg).not.toBeNull();

		const target = byRole<HTMLSelectElement>(document, "combobox", "Target for link 3");
		target.value = "n1";
		fireChange(target);
		chooseSetting("Aspect ratio", "3:1");

		expect(document.getElementById("error")?.textContent).toContain("cycle");
		expect(document.getElementById("diagram")).toBe(diagram);
		expect(diagram?.style.getPropertyValue("--diagram-aspect-ratio")).toBe("1440 / 480");
		expect(diagram?.style.getPropertyValue("--diagram-aspect-number")).toBe("3");
		expect(diagram?.querySelector("svg")).toBe(svg);
		expect(svg?.outerHTML).toBe(svgBefore);
	});

	it("boots with exactly one theme option pressed, matching the default (System)", () => {
		mountApp();

		const themeDialog = document.getElementById("theme-dialog") as HTMLDialogElement;
		const pressed = allByRole<HTMLButtonElement>(byRole(themeDialog, "group"), "button").filter(
			(option) => option.getAttribute("aria-pressed") === "true",
		);

		expect(pressed).toHaveLength(1);
		expect(accessibleName(pressed[0])).toBe(SETTING_LABELS.theme[defaultState().settings.theme]);
		expect(document.getElementById("theme-button")?.getAttribute("aria-label")).toBe(
			"Theme: System",
		);
	});

	it("choosing Light in the theme dialog sets data-theme, persists it, updates the button, and closes with focus back on it", () => {
		mountApp();

		const themeButton = document.getElementById("theme-button");
		click(themeButton);

		const dialog = document.getElementById("theme-dialog") as HTMLDialogElement;
		expect(dialog.open).toBe(true);
		const lightOption = byRole<HTMLButtonElement>(dialog, "button", SETTING_LABELS.theme.light);
		click(lightOption);

		expect(document.documentElement.getAttribute("data-theme")).toBe("light");
		const stored = getStoredState();
		expect(stored.settings.theme).toBe("light");
		expect(themeButton?.getAttribute("aria-label")).toBe("Theme: Light");
		expect(lightOption.getAttribute("aria-pressed")).toBe("true");
		expect(
			byRole<HTMLButtonElement>(dialog, "button", SETTING_LABELS.theme.auto).getAttribute(
				"aria-pressed",
			),
		).toBe("false");
		expect(dialog.open).toBe(false);
		expect(document.activeElement).toBe(themeButton);
	});

	it("choosing System in the theme dialog removes data-theme entirely", () => {
		mountApp();

		const themeButton = document.getElementById("theme-button");
		const dialog = document.getElementById("theme-dialog") as HTMLDialogElement;

		// Start from Light so the System transition actually removes the attribute
		// rather than it never having been set.
		click(themeButton);
		click(byRole(dialog, "button", SETTING_LABELS.theme.light));
		expect(document.documentElement.getAttribute("data-theme")).toBe("light");

		click(themeButton);
		click(byRole(dialog, "button", SETTING_LABELS.theme.auto));

		expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
		const stored = getStoredState();
		expect(stored.settings.theme).toBe("auto");
		expect(themeButton?.getAttribute("aria-label")).toBe("Theme: System");
	});
});

// Diagram-only settings redraw and persist without touching either editor.
describe("diagram-only settings redraw and persist", () => {
	it("changing link color redraws the diagram and persists", () => {
		mountApp();

		const svgHtmlBefore = document.querySelector("#diagram svg")?.outerHTML;

		chooseSetting("Link colors", "neutral");

		expect(document.querySelector("#diagram svg")?.outerHTML).not.toBe(svgHtmlBefore);
		expect(getStoredState().settings.linkColor).toBe("neutral");
	});

	it("changing alignment redraws the diagram and persists", () => {
		mountApp();
		addIsolatedNode();

		const svgHtmlBefore = document.querySelector("#diagram svg")?.outerHTML;

		chooseSetting("Node alignment", "justify");

		expect(document.querySelector("#diagram svg")?.outerHTML).not.toBe(svgHtmlBefore);
		expect(getStoredState().settings.alignment).toBe("justify");
	});

	it("changing aspect ratio redraws the diagram and persists", () => {
		mountApp();

		const svgHtmlBefore = document.querySelector("#diagram svg")?.outerHTML;

		chooseSetting("Aspect ratio", "3:1");

		expect(document.querySelector("#diagram svg")?.outerHTML).not.toBe(svgHtmlBefore);
		expect(getStoredState().settings.aspectRatio).toBe("3:1");
	});
});

describe("a diagram-setting change made while the graph is invalid", () => {
	it("persists and updates controls but leaves the last-valid SVG element and markup untouched", () => {
		mountApp();
		addIsolatedNode();

		// Retargeting the third link to n1 closes a 2-node cycle.
		const target = byRole<HTMLSelectElement>(document, "combobox", "Target for link 3");
		target.value = "n1";
		fireChange(target);
		expect(document.getElementById("error")?.textContent).toContain("cycle");

		const svgBefore = document.querySelector("#diagram svg");
		const svgHtmlBefore = svgBefore?.outerHTML;

		const alignment = chooseSetting("Node alignment", "justify");

		expect(getStoredState().settings.alignment).toBe("justify");
		expect(alignment.value).toBe("justify");
		expect(document.getElementById("error")?.textContent).toContain("cycle");

		// Identity alone can't tell no redraw from an identical one; markup can.
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);
		expect(document.querySelector("#diagram svg")?.outerHTML).toBe(svgHtmlBefore);
	});
});

// Unlike the diagram-only settings, a palette change reaches the node
// editor's swatches, but as a style patch, not a rebuild.
describe("palette changes patch node-editor swatches", () => {
	it("choosing a palette from the dialog updates swatch colors, redraws the SVG, and persists", async () => {
		mountApp();

		const svgHtmlBefore = document.querySelector("#diagram svg")?.outerHTML;

		click(byRole(document, "button", "Appearance"));
		const dialog = document.getElementById("display-dialog") as HTMLDialogElement;
		click(byRole(dialog, "combobox", "Color saturation"));
		await tick();
		click(byRole(dialog, "option", SETTING_LABELS.palette.muted));
		await tick();

		const swatches = Array.from(
			document.querySelectorAll<HTMLElement>("#node-editor .node-swatch"),
		);
		const expectedColors = paletteColors("muted").slice(0, swatches.length);
		expect(swatches.map((s) => s.style.backgroundColor)).toEqual(expectedColors);

		expect(document.querySelector("#diagram svg")?.outerHTML).not.toBe(svgHtmlBefore);
		expect(getStoredState().settings.palette).toBe("muted");
	});
});

describe("theme changes leave the diagram and its notices unchanged", () => {
	it("on a valid graph: persists, applies data-theme, and leaves a seeded I/O notice and the rendered SVG untouched", async () => {
		mountApp();

		// Seed #io-notice via a repaired import so "still there" below is a
		// real assertion, not two empty strings.
		const payload = {
			nodes: [
				{ id: "n1", name: "X" },
				{ id: "n2", name: "Y" },
			],
			links: [{ source: "n1", target: "n2", value: 3 }],
			// Repaired to the default, which installs the warning. The link stays
			// complete so an svg still renders.
			settings: { palette: "not-a-real-palette" },
		};
		const file = new File([JSON.stringify(payload)], "sankey.json", { type: "application/json" });
		const input = document.getElementById("import-file") as HTMLInputElement;
		Object.defineProperty(input, "files", { value: [file], configurable: true, writable: true });
		fireChange(input);
		await settle();

		expect(document.getElementById("io-notice")?.textContent).toBe(
			"Imported 2 nodes, 1 links. Adjustments: settings: unknown palette — using default.",
		);

		const svgBefore = document.querySelector("#diagram svg");
		expect(svgBefore).not.toBeNull();
		const svgHtmlBefore = svgBefore?.outerHTML;

		const themeButton = document.getElementById("theme-button");
		click(themeButton);
		const dialog = document.getElementById("theme-dialog") as HTMLDialogElement;
		click(byRole(dialog, "button", SETTING_LABELS.theme.light));

		expect(document.documentElement.getAttribute("data-theme")).toBe("light");
		expect(getStoredState().settings.theme).toBe("light");
		expect(document.getElementById("io-notice")?.textContent).toBe(
			"Imported 2 nodes, 1 links. Adjustments: settings: unknown palette — using default.",
		);
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);
		expect(document.querySelector("#diagram svg")?.outerHTML).toBe(svgHtmlBefore);
	});

	it("on an invalid graph (cycle): leaves the error banner and the last valid diagram untouched", () => {
		mountApp();

		// Retargeting the third link to n1 closes a 2-node cycle.
		const target = byRole<HTMLSelectElement>(document, "combobox", "Target for link 3");
		target.value = "n1";
		fireChange(target);

		const errorBefore = document.getElementById("error")?.textContent;
		expect(errorBefore).toContain("cycle");
		const svgBefore = document.querySelector("#diagram svg");
		const svgHtmlBefore = svgBefore?.outerHTML;

		const themeButton = document.getElementById("theme-button");
		click(themeButton);
		const dialog = document.getElementById("theme-dialog") as HTMLDialogElement;
		click(byRole(dialog, "button", SETTING_LABELS.theme.light));

		expect(document.getElementById("error")?.textContent).toBe(errorBefore);
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);
		expect(document.querySelector("#diagram svg")?.outerHTML).toBe(svgHtmlBefore);

		expect(document.documentElement.getAttribute("data-theme")).toBe("light");
		expect(getStoredState().settings.theme).toBe("light");
	});
});

describe("dialog markup vs settings metadata contract", () => {
	it("Appearance palette options: order and labels match PALETTE_CHOICES", () => {
		mountApp();

		const dialog = document.getElementById("display-dialog") as HTMLDialogElement;
		const options = allByRole<HTMLButtonElement>(byRole(dialog, "listbox"), "option");
		expect(options.map((option) => accessibleName(option))).toEqual(
			PALETTE_CHOICES.map((option) => option.label),
		);
	});

	it.each([
		["alignment", "Node alignment"],
		["aspectRatio", "Aspect ratio"],
		["linkColor", "Link colors"],
	] as const)("%s exposes every preset with its saved value", (key, label) => {
		mountApp();
		const select = byRole<HTMLSelectElement>(document, "combobox", label);
		expect(select.value).toBe(defaultState().settings[key]);
		expect(Array.from(select.options).map((option) => option.value)).toEqual(SETTING_DOMAINS[key]);
		expect(Array.from(select.options).map((option) => option.textContent)).toEqual(
			SETTING_DOMAINS[key].map((value) => (SETTING_LABELS[key] as Record<string, string>)[value]),
		);
	});

	it("theme dialog: rendered option order, labels, and icons match THEME_CHOICES", () => {
		mountApp();

		const dialog = document.getElementById("theme-dialog") as HTMLDialogElement;
		const options = allByRole<HTMLButtonElement>(byRole(dialog, "group"), "button");
		expect(options.map((option) => accessibleName(option))).toEqual(
			THEME_CHOICES.map((option) => option.label),
		);
		for (const meta of THEME_CHOICES) {
			const option = byRole<HTMLButtonElement>(dialog, "button", meta.label);
			expect(option.querySelector(`svg.${meta.iconId}`)?.getAttribute("aria-hidden")).toBe("true");
		}
	});
});
