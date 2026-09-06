// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import {
	ALIGNMENT_CHOICES,
	ASPECT_RATIO_CHOICES,
	LINK_COLOR_CHOICES,
	LINK_COLOR_SHORT_LABELS,
	PALETTE_CHOICES,
	SETTING_LABELS,
	THEME_CHOICES,
} from "../../src/features/settings/options";
import { paletteColors } from "../../src/features/settings/palettes";
import { defaultState } from "../../src/model/graph";
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

/** The wide and narrow copies share the accessible name "Alignment"; the wide one is the copy not nested in a <dialog>. */
function wideAlignmentGroup(): HTMLElement {
	const group = allByRole(document, "group", "Alignment").find(
		(candidate) => !candidate.closest("dialog"),
	);
	if (!group) throw new Error("expected the wide toolbar's Alignment group");
	return group;
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
	it("palette-next advances the carousel: state, preview label, and rendered colors all follow", () => {
		mountApp();

		const fills = () =>
			Array.from(document.querySelectorAll("#diagram svg rect")).map((r) => r.getAttribute("fill"));
		const before = fills();

		click(byRole(document, "button", "Next palette"));

		const preview = document.getElementById("palette-preview");
		expect(preview?.getAttribute("aria-label")).toBe("Palette: Tableau 10");
		expect(fills()).not.toEqual(before);

		const stored = getStoredState();
		expect(stored.settings.palette).toBe("tableau10");
	});

	it("palette-prev wraps from the first palette (observable10) to the last (dark2)", () => {
		mountApp();

		click(byRole(document, "button", "Previous palette"));

		const preview = document.getElementById("palette-preview");
		expect(preview?.getAttribute("aria-label")).toBe("Palette: Dark 2");
		const stored = getStoredState();
		expect(stored.settings.palette).toBe("dark2");
	});

	it("clicking the palette preview opens the palette dialog", () => {
		mountApp();

		const dialog = document.getElementById("palette-dialog") as HTMLDialogElement;
		expect(dialog).toBeInstanceOf(HTMLDialogElement);
		expect(dialog.open).toBe(false);

		click(document.getElementById("palette-preview"));

		expect(dialog.open).toBe(true);

		// Pinned against PALETTE_CHOICES so the two can't drift apart.
		const options = allByRole<HTMLButtonElement>(byRole(dialog, "group"), "button");
		expect(options.map((option) => accessibleName(option))).toEqual(
			PALETTE_CHOICES.map((option) => option.label),
		);
	});

	it("choosing a palette in the dialog sets state, updates aria-pressed, and closes with focus back on the preview", () => {
		mountApp();

		const preview = document.getElementById("palette-preview");
		click(preview);

		const dialog = document.getElementById("palette-dialog") as HTMLDialogElement;
		const set2Option = byRole<HTMLButtonElement>(dialog, "button", SETTING_LABELS.palette.set2);
		click(set2Option);

		const stored = getStoredState();
		expect(stored.settings.palette).toBe("set2");
		expect(set2Option.getAttribute("aria-pressed")).toBe("true");
		expect(
			byRole<HTMLButtonElement>(dialog, "button", SETTING_LABELS.palette.observable10).getAttribute(
				"aria-pressed",
			),
		).toBe("false");
		expect(dialog.open).toBe(false);
		expect(document.activeElement).toBe(preview);
	});

	it("clicking the links button opens the links dialog", () => {
		mountApp();

		const dialog = document.getElementById("links-dialog") as HTMLDialogElement;
		expect(dialog).toBeInstanceOf(HTMLDialogElement);
		expect(dialog.open).toBe(false);

		click(document.getElementById("links-button"));

		expect(dialog.open).toBe(true);

		// Pinned against LINK_COLOR_CHOICES so the two can't drift apart.
		for (const option of LINK_COLOR_CHOICES) {
			byRole(dialog, "button", option.label);
		}
	});

	it("choosing Neutral in the links dialog sets state, re-renders static links, and closes with focus back on the links button", () => {
		mountApp();

		const linksButton = document.getElementById("links-button");
		click(linksButton);

		const dialog = document.getElementById("links-dialog") as HTMLDialogElement;
		const staticOption = byRole<HTMLButtonElement>(
			dialog,
			"button",
			SETTING_LABELS.linkColor.static,
		);
		click(staticOption);

		const stored = getStoredState();
		expect(stored.settings.linkColor).toBe("static");

		expect(staticOption.getAttribute("aria-pressed")).toBe("true");
		const group = byRole(dialog, "group");
		for (const option of allByRole<HTMLButtonElement>(group, "button")) {
			if (option !== staticOption) expect(option.getAttribute("aria-pressed")).toBe("false");
		}

		const paths = document.querySelectorAll("#diagram svg path");
		expect(paths.length).toBeGreaterThan(0);
		for (const path of Array.from(paths)) {
			expect(path.getAttribute("stroke")).toBe("#aaa");
		}

		expect(linksButton?.getAttribute("aria-label")).toBe("Links: Neutral");
		expect(dialog.open).toBe(false);
		expect(document.activeElement).toBe(linksButton);
	});

	it("choosing the gradient option in the links dialog re-renders links with per-link gradient strokes", () => {
		mountApp();

		const linksButton = document.getElementById("links-button");
		const dialog = document.getElementById("links-dialog") as HTMLDialogElement;
		const diagram = document.getElementById("diagram");

		// The default is already "source-target", so start from "static" to
		// prove the click handler ran.
		click(linksButton);
		const staticOption = byRole<HTMLButtonElement>(
			dialog,
			"button",
			SETTING_LABELS.linkColor.static,
		);
		click(staticOption);

		const storedAfterStatic = getStoredState();
		expect(storedAfterStatic.settings.linkColor).toBe("static");
		for (const path of Array.from(document.querySelectorAll("#diagram svg path"))) {
			expect(path.getAttribute("stroke")).toBe("#aaa");
		}

		click(linksButton);
		const gradientOption = byRole<HTMLButtonElement>(
			dialog,
			"button",
			SETTING_LABELS.linkColor["source-target"],
		);
		click(gradientOption);

		const stored = getStoredState();
		expect(stored.settings.linkColor).toBe("source-target");

		const gradients = diagram?.querySelectorAll("linearGradient");
		expect(gradients?.length).toBeGreaterThan(0);
		expect(diagram?.querySelector('path[stroke="url(#link-grad-0)"]')).not.toBeNull();
	});

	it("boots with exactly one alignment value pressed, matching the default alignment, on both the wide and narrow copies", () => {
		mountApp();

		// The wide toolbar's group and the narrow dialog's copy render from the
		// same settings, so every pressed button must share one value.
		const alignmentGroups = allByRole(document, "group", "Alignment");
		expect(alignmentGroups).toHaveLength(2);
		const defaultLabel = ALIGNMENT_CHOICES.find(
			(option) => option.value === defaultState().settings.alignment,
		)?.label;
		for (const group of alignmentGroups) {
			const pressed = allByRole<HTMLButtonElement>(group, "button").filter(
				(option) => option.getAttribute("aria-pressed") === "true",
			);
			expect(pressed).toHaveLength(1);
			expect(accessibleName(pressed[0])).toBe(defaultLabel);
		}
	});

	it("clicking Left in the alignment group sets state, updates aria-pressed on both copies, and re-renders the diagram", () => {
		mountApp();
		addIsolatedNode();

		const svgBefore = document.querySelector("#diagram svg");
		const svgHtmlBefore = svgBefore?.outerHTML;
		const leftOption = byRole<HTMLButtonElement>(wideAlignmentGroup(), "button", "Left");
		click(leftOption);

		const stored = getStoredState();
		expect(stored.settings.alignment).toBe("left");

		for (const group of allByRole(document, "group", "Alignment")) {
			for (const option of allByRole<HTMLButtonElement>(group, "button")) {
				expect(option.getAttribute("aria-pressed")).toBe(
					accessibleName(option) === "Left" ? "true" : "false",
				);
			}
		}

		// Changed markup is the redraw evidence.
		const svgAfter = document.querySelector("#diagram svg");
		expect(svgAfter).not.toBeNull();
		expect(svgAfter?.outerHTML).not.toBe(svgHtmlBefore);
	});

	it("every alignment button has a non-empty accessible name", () => {
		mountApp();

		const options = allByRole<HTMLButtonElement>(wideAlignmentGroup(), "button");
		expect(options.length).toBeGreaterThan(0);
		for (const option of options) {
			expect(option.getAttribute("aria-label")?.trim()).toBeTruthy();
		}
	});

	it("changes the intrinsic diagram and both selectors when an aspect ratio is chosen", () => {
		mountApp();

		const trigger = document.getElementById("aspect-ratio-button");
		click(trigger);
		const dialog = document.getElementById("aspect-ratio-dialog") as HTMLDialogElement;
		expect(dialog.open).toBe(true);

		click(byRole(dialog, "button", SETTING_LABELS.aspectRatio["3:1"]));

		expect(document.querySelector("#diagram svg")?.getAttribute("viewBox")).toBe("0 0 1440 480");
		const diagram = document.getElementById("diagram");
		expect(diagram?.style.getPropertyValue("--diagram-aspect-ratio")).toBe("1440 / 480");
		expect(diagram?.style.getPropertyValue("--diagram-aspect-number")).toBe("3");
		expect(trigger?.textContent).toContain("Aspect 3:1");
		const stored = getStoredState();
		expect(stored.settings.aspectRatio).toBe("3:1");
		for (const group of allByRole(document, "group", "Aspect ratio")) {
			for (const option of allByRole<HTMLButtonElement>(group, "button")) {
				expect(option.getAttribute("aria-pressed")).toBe(
					accessibleName(option) === SETTING_LABELS.aspectRatio["3:1"] ? "true" : "false",
				);
			}
		}
		expect(dialog.open).toBe(false);
		expect(document.activeElement).toBe(trigger);
	});

	// App's style-prop diff must not clobber the height PreviewResizer writes
	// to the same element outside Preact.
	it("changing aspect ratio after resizing the preview leaves --diagram-preview-height untouched", async () => {
		mountApp();

		const diagram = document.getElementById("diagram");
		click(byRole(document, "button", "Make diagram preview larger"));
		// The custom-property write lands in a layout effect on the next render.
		await tick();
		expect(diagram?.style.getPropertyValue("--diagram-preview-height")).toBe("400px");

		click(document.getElementById("aspect-ratio-button"));
		const dialog = document.getElementById("aspect-ratio-dialog") as HTMLDialogElement;
		click(byRole(dialog, "button", SETTING_LABELS.aspectRatio["3:1"]));

		expect(diagram?.style.getPropertyValue("--diagram-preview-height")).toBe("400px");
		expect(diagram?.style.getPropertyValue("--diagram-aspect-ratio")).toBe("1440 / 480");
		expect(diagram?.style.getPropertyValue("--diagram-aspect-number")).toBe("3");
	});

	it("offers every labelled aspect-ratio preset in the wide picker and narrow Diagram sheet", () => {
		mountApp();

		for (const preset of ASPECT_RATIO_CHOICES) {
			const copies = allByRole<HTMLElement>(document, "button", preset.label);
			expect(copies).toHaveLength(2);
			for (const copy of copies) {
				expect(copy.querySelector(".ratio-preview")).not.toBeNull();
			}
		}
	});

	it("clicking the Diagram button opens the diagram-options dialog", () => {
		mountApp();

		const dialog = document.getElementById("display-dialog");
		expect(dialog).toBeInstanceOf(HTMLDialogElement);
		expect((dialog as HTMLDialogElement).open).toBe(false);

		click(document.getElementById("display-button"));

		expect((dialog as HTMLDialogElement).open).toBe(true);
	});

	it("choosing Gradient in the display dialog re-renders links, syncs both link-color copies, and stays open", () => {
		mountApp();

		const displayButton = document.getElementById("display-button");
		click(displayButton);

		const displayDialog = document.getElementById("display-dialog") as HTMLDialogElement;
		const linksDialog = document.getElementById("links-dialog") as HTMLDialogElement;

		// The default is already "source-target", so start from "static" to
		// prove the click handler ran.
		click(byRole(displayDialog, "button", LINK_COLOR_SHORT_LABELS.static));

		const storedAfterStatic = getStoredState();
		expect(storedAfterStatic.settings.linkColor).toBe("static");
		expect(displayDialog.open).toBe(true);

		const gradientOption = byRole<HTMLButtonElement>(
			displayDialog,
			"button",
			LINK_COLOR_SHORT_LABELS["source-target"],
		);
		click(gradientOption);

		const stored = getStoredState();
		expect(stored.settings.linkColor).toBe("source-target");

		const gradients = document.getElementById("diagram")?.querySelectorAll("linearGradient");
		expect(gradients?.length).toBeGreaterThan(0);
		expect(
			document.getElementById("diagram")?.querySelector('path[stroke="url(#link-grad-0)"]'),
		).not.toBeNull();

		// Both copies must reflect the new value.
		expect(gradientOption.getAttribute("aria-pressed")).toBe("true");
		const linksDialogGradientOption = byRole<HTMLButtonElement>(
			linksDialog,
			"button",
			SETTING_LABELS.linkColor["source-target"],
		);
		expect(linksDialogGradientOption.getAttribute("aria-pressed")).toBe("true");
		expect(document.getElementById("links-button")?.getAttribute("aria-label")).toBe(
			"Links: Source to target (gradient)",
		);

		// Unlike the links dialog, choosing inside Diagram does not close it.
		expect(displayDialog.open).toBe(true);
		expect(document.activeElement).not.toBe(displayButton);
	});

	it("choosing Left in the display dialog's alignment group persists and stays open", () => {
		mountApp();

		click(document.getElementById("display-button"));

		const displayDialog = document.getElementById("display-dialog") as HTMLDialogElement;
		const leftOption = byRole<HTMLButtonElement>(displayDialog, "button", "Left");
		click(leftOption);

		const stored = getStoredState();
		expect(stored.settings.alignment).toBe("left");
		expect(leftOption.getAttribute("aria-pressed")).toBe("true");

		// The wide toolbar's own alignment group follows the same state.
		const wideLeftOption = byRole<HTMLButtonElement>(wideAlignmentGroup(), "button", "Left");
		expect(wideLeftOption.getAttribute("aria-pressed")).toBe("true");

		expect(displayDialog.open).toBe(true);
	});

	it("closing the diagram-options dialog via its Close button returns focus to the Diagram button", () => {
		mountApp();

		const displayButton = document.getElementById("display-button");
		click(displayButton);

		const displayDialog = document.getElementById("display-dialog") as HTMLDialogElement;
		expect(displayDialog.open).toBe(true);

		click(byRole(displayDialog, "button", "Close"));

		expect(displayDialog.open).toBe(false);
		expect(document.activeElement).toBe(displayButton);
	});

	it("regression: choosing a link color via the links dialog (wide toolbar) still closes it", () => {
		mountApp();

		const linksButton = document.getElementById("links-button");
		click(linksButton);

		const linksDialog = document.getElementById("links-dialog") as HTMLDialogElement;
		expect(linksDialog.open).toBe(true);

		click(byRole(linksDialog, "button", SETTING_LABELS.linkColor.target));

		const stored = getStoredState();
		expect(stored.settings.linkColor).toBe("target");
		expect(linksDialog.open).toBe(false);
		expect(document.activeElement).toBe(linksButton);
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

		click(document.getElementById("links-button"));
		const dialog = document.getElementById("links-dialog") as HTMLDialogElement;
		click(byRole(dialog, "button", SETTING_LABELS.linkColor.static));

		expect(document.querySelector("#diagram svg")?.outerHTML).not.toBe(svgHtmlBefore);
		expect(getStoredState().settings.linkColor).toBe("static");
	});

	it("changing alignment redraws the diagram and persists", () => {
		mountApp();
		addIsolatedNode();

		const svgHtmlBefore = document.querySelector("#diagram svg")?.outerHTML;

		click(byRole(wideAlignmentGroup(), "button", "Left"));

		expect(document.querySelector("#diagram svg")?.outerHTML).not.toBe(svgHtmlBefore);
		expect(getStoredState().settings.alignment).toBe("left");
	});

	it("changing aspect ratio redraws the diagram and persists", () => {
		mountApp();

		const svgHtmlBefore = document.querySelector("#diagram svg")?.outerHTML;

		click(document.getElementById("aspect-ratio-button"));
		const dialog = document.getElementById("aspect-ratio-dialog") as HTMLDialogElement;
		click(byRole(dialog, "button", SETTING_LABELS.aspectRatio["3:1"]));

		expect(document.querySelector("#diagram svg")?.outerHTML).not.toBe(svgHtmlBefore);
		expect(getStoredState().settings.aspectRatio).toBe("3:1");
	});
});

// The last-valid diagram is only replaced when the graph validates.
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

		const leftOption = byRole<HTMLButtonElement>(wideAlignmentGroup(), "button", "Left");
		click(leftOption);

		expect(getStoredState().settings.alignment).toBe("left");
		expect(leftOption.getAttribute("aria-pressed")).toBe("true");
		expect(document.getElementById("error")?.textContent).toContain("cycle");

		// Markup equality is the evidence that nothing was redrawn; identity
		// only adds that the svg was never unmounted. The diagram reference is
		// unchanged while the graph is invalid.
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);
		expect(document.querySelector("#diagram svg")?.outerHTML).toBe(svgHtmlBefore);
	});
});

// Unlike the diagram-only settings, a palette change reaches the node
// editor's swatches, but as a style patch, not a rebuild.
describe("palette changes patch node-editor swatches", () => {
	it("choosing a palette from the dialog updates swatch colors, redraws the SVG, and persists", () => {
		mountApp();

		const svgHtmlBefore = document.querySelector("#diagram svg")?.outerHTML;

		click(document.getElementById("palette-preview"));
		const dialog = document.getElementById("palette-dialog") as HTMLDialogElement;
		click(byRole(dialog, "button", SETTING_LABELS.palette.tableau10));

		const swatches = Array.from(
			document.querySelectorAll<HTMLElement>("#node-editor .node-swatch"),
		);
		const expectedColors = paletteColors("tableau10").slice(0, swatches.length);
		expect(swatches.map((s) => s.style.backgroundColor)).toEqual(expectedColors);

		expect(document.querySelector("#diagram svg")?.outerHTML).not.toBe(svgHtmlBefore);
		expect(getStoredState().settings.palette).toBe("tableau10");
	});
});

// Theme is not diagram data: a change applies, persists, and clears the
// one-shot I/O notice, but leaves the graph notice and the rendered SVG
// unchanged.
describe("theme changes leave the diagram and its notice unchanged", () => {
	it("on a valid graph: persists, clears a seeded I/O notice, applies data-theme, and leaves the rendered SVG untouched", async () => {
		mountApp();

		// Seed #io-notice via a repaired import so "cleared" below is a real
		// assertion, not two empty strings.
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
		expect(document.getElementById("io-notice")?.textContent).toBe("");
		// The rendered diagram — element and markup alike — is untouched by
		// the theme change.
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

		// Same error verbatim, and the rendered diagram — element and markup
		// alike — is untouched.
		expect(document.getElementById("error")?.textContent).toBe(errorBefore);
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);
		expect(document.querySelector("#diagram svg")?.outerHTML).toBe(svgHtmlBefore);

		expect(document.documentElement.getAttribute("data-theme")).toBe("light");
		expect(getStoredState().settings.theme).toBe("light");
	});
});

// The dialogs render from the options.ts choice arrays, so these pin that
// every table entry is wired into the DOM.
describe("dialog markup vs settings metadata contract", () => {
	it("palette dialog: rendered option order and labels match PALETTE_CHOICES", () => {
		mountApp();

		const dialog = document.getElementById("palette-dialog") as HTMLDialogElement;
		const options = allByRole<HTMLButtonElement>(byRole(dialog, "group"), "button");
		expect(options.map((option) => accessibleName(option))).toEqual(
			PALETTE_CHOICES.map((option) => option.label),
		);
	});

	it("links dialog: rendered option set, labels, and icons match LINK_COLOR_CHOICES", () => {
		mountApp();

		const dialog = document.getElementById("links-dialog") as HTMLDialogElement;
		const options = allByRole<HTMLButtonElement>(byRole(dialog, "group"), "button");
		expect(options).toHaveLength(LINK_COLOR_CHOICES.length);
		expect(new Set(options.map((option) => accessibleName(option)))).toEqual(
			new Set(LINK_COLOR_CHOICES.map((option) => option.label)),
		);
		for (const meta of LINK_COLOR_CHOICES) {
			const option = byRole<HTMLButtonElement>(dialog, "button", meta.label);
			expect(option.querySelector("use")?.getAttribute("href")).toBe(`#${meta.iconId}`);
		}
	});

	it("display dialog's narrow link-color copy: rendered option set matches LINK_COLOR_CHOICES", () => {
		mountApp();

		// The narrow copy uses shortLabels; the links-dialog test pins the full
		// labels and icons.
		const displayDialog = document.getElementById("display-dialog") as HTMLDialogElement;
		const group = byRole(displayDialog, "group", "Link colors");
		const options = allByRole<HTMLButtonElement>(group, "button");
		expect(new Set(options.map((option) => accessibleName(option)))).toEqual(
			new Set(LINK_COLOR_CHOICES.map((option) => option.shortLabel)),
		);
	});

	it("alignment buttons: each DOM copy's rendered option order and labels match ALIGNMENT_CHOICES", () => {
		mountApp();

		// Each copy is checked separately so a missing button in one can't
		// hide behind the other's count in a merged set.
		const expectedLabels = ALIGNMENT_CHOICES.map((option) => option.label);

		const wideLabels = allByRole<HTMLButtonElement>(wideAlignmentGroup(), "button").map((option) =>
			accessibleName(option),
		);
		expect(wideLabels).toEqual(expectedLabels);

		const narrowGroup = byRole(
			document.getElementById("display-dialog") as HTMLDialogElement,
			"group",
			"Alignment",
		);
		const narrowLabels = allByRole<HTMLButtonElement>(narrowGroup, "button").map((option) =>
			accessibleName(option),
		);
		expect(narrowLabels).toEqual(expectedLabels);
	});

	it("aspect-ratio dialog: rendered option order and labels match ASPECT_RATIO_CHOICES", () => {
		mountApp();

		const dialog = document.getElementById("aspect-ratio-dialog") as HTMLDialogElement;
		const options = allByRole<HTMLButtonElement>(byRole(dialog, "group"), "button");
		expect(options.map((option) => accessibleName(option))).toEqual(
			ASPECT_RATIO_CHOICES.map((preset) => preset.label),
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
			expect(option.querySelector("use")?.getAttribute("href")).toBe(`#${meta.iconId}`);
		}
	});
});
