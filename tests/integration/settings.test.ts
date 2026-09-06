// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { paletteColors } from "../../src/features/diagram/colors";
import {
	ALIGNMENT_OPTIONS,
	ASPECT_RATIO_LABELS,
	LINK_COLOR_OPTIONS,
	PALETTE_LABELS,
	THEME_OPTIONS,
} from "../../src/features/settings/options";
import { defaultState } from "../../src/model/graph";
import { ALIGNMENTS, ASPECT_RATIO_OPTIONS, PALETTE_ORDER } from "../../src/model/settings";
import {
	accessibleName,
	allByRole,
	byRole,
	click,
	fireChange,
	getStoredState,
	mountApp,
	tick,
} from "../helpers/mount-app";

/**
 * The wide toolbar's alignment ChoiceGroup — both it and the narrow Diagram
 * dialog's own copy share the accessible name "Alignment" (one via `label`,
 * the other via `labelledBy` a heading with the same text), so the wide copy
 * is the one NOT nested in a <dialog>.
 */
function wideAlignmentGroup(): HTMLElement {
	const group = allByRole(document, "group", "Alignment").find(
		(candidate) => !candidate.closest("dialog"),
	);
	if (!group) throw new Error("expected the wide toolbar's Alignment group");
	return group;
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

		// Pin the dialog's rendered option labels against PALETTE_LABELS
		// (src/features/settings/options.ts) so the two can't drift apart.
		const options = allByRole<HTMLButtonElement>(byRole(dialog, "group"), "button");
		expect(options.map((option) => accessibleName(option))).toEqual(
			PALETTE_ORDER.map((value) => PALETTE_LABELS[value]),
		);
	});

	it("choosing a palette in the dialog sets state, updates aria-pressed, and closes with focus back on the preview", () => {
		mountApp();

		const preview = document.getElementById("palette-preview");
		click(preview);

		const dialog = document.getElementById("palette-dialog") as HTMLDialogElement;
		const set2Option = byRole<HTMLButtonElement>(dialog, "button", PALETTE_LABELS.set2);
		click(set2Option);

		const stored = getStoredState();
		expect(stored.settings.palette).toBe("set2");
		expect(set2Option.getAttribute("aria-pressed")).toBe("true");
		expect(
			byRole<HTMLButtonElement>(dialog, "button", PALETTE_LABELS.observable10).getAttribute(
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

		// Pin the dialog's rendered option labels against LINK_COLOR_OPTIONS
		// (src/features/settings/options.ts) so the two can't drift apart —
		// byRole throws if a labelled option is missing.
		for (const option of Object.values(LINK_COLOR_OPTIONS)) {
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
			LINK_COLOR_OPTIONS.static.label,
		);
		click(staticOption);

		const stored = getStoredState();
		expect(stored.settings.linkColor).toBe("static");

		// Only the chosen option is pressed.
		expect(staticOption.getAttribute("aria-pressed")).toBe("true");
		const group = byRole(dialog, "group");
		for (const option of allByRole<HTMLButtonElement>(group, "button")) {
			if (option !== staticOption) expect(option.getAttribute("aria-pressed")).toBe("false");
		}

		// Re-renders link paths with the static stroke (src/features/diagram/render.ts's linkStroke "static" case).
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

		// Start from "static" (defaultState().linkColor is already
		// "source-target", so asserting the post-click state alone wouldn't
		// prove the click handler ran) — this leg proves the click landed.
		click(linksButton);
		const staticOption = byRole<HTMLButtonElement>(
			dialog,
			"button",
			LINK_COLOR_OPTIONS.static.label,
		);
		click(staticOption);

		const storedAfterStatic = getStoredState();
		expect(storedAfterStatic.settings.linkColor).toBe("static");
		for (const path of Array.from(document.querySelectorAll("#diagram svg path"))) {
			expect(path.getAttribute("stroke")).toBe("#aaa");
		}

		// Now transition to the gradient option and assert the change actually took.
		click(linksButton);
		const gradientOption = byRole<HTMLButtonElement>(
			dialog,
			"button",
			LINK_COLOR_OPTIONS["source-target"].label,
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

		// Two DOM copies of each alignment button exist (the wide toolbar's
		// group and the narrow Diagram dialog's own copy) — DiagramPanel renders
		// both from the same settings, so every pressed button must share the
		// same value.
		const alignmentGroups = allByRole(document, "group", "Alignment");
		expect(alignmentGroups).toHaveLength(2);
		const defaultLabel = ALIGNMENT_OPTIONS.find(
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

		const svgBefore = document.querySelector("#diagram svg");
		const leftOption = byRole<HTMLButtonElement>(wideAlignmentGroup(), "button", "Left");
		click(leftOption);

		const stored = getStoredState();
		expect(stored.settings.alignment).toBe("left");

		// Only options with the chosen value are pressed, across both copies.
		for (const group of allByRole(document, "group", "Alignment")) {
			for (const option of allByRole<HTMLButtonElement>(group, "button")) {
				expect(option.getAttribute("aria-pressed")).toBe(
					accessibleName(option) === "Left" ? "true" : "false",
				);
			}
		}

		// A fresh <svg> replaces the old one — same re-render evidence the
		// value-edit and link-color tests above rely on.
		const svgAfter = document.querySelector("#diagram svg");
		expect(svgAfter).not.toBeNull();
		expect(svgAfter).not.toBe(svgBefore);
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

		click(byRole(dialog, "button", ASPECT_RATIO_LABELS["3:1"]));

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
					accessibleName(option) === ASPECT_RATIO_LABELS["3:1"] ? "true" : "false",
				);
			}
		}
		expect(dialog.open).toBe(false);
		expect(document.activeElement).toBe(trigger);
	});

	// Pins App's own style-prop write against PreviewResizer's imperative one:
	// Preact's per-render style diff only ever touches the keys present in the
	// vnode's style object, so a later aspect-ratio-driven rerender must not
	// clobber the height PreviewResizer wrote straight to the DOM outside that
	// diff.
	it("changing aspect ratio after resizing the preview leaves --diagram-preview-height untouched", async () => {
		mountApp();

		const diagram = document.getElementById("diagram");
		click(byRole(document, "button", "Make diagram preview larger"));
		// PreviewResizer's CSS custom-property write happens in a layout effect,
		// on the next render.
		await tick();
		expect(diagram?.style.getPropertyValue("--diagram-preview-height")).toBe("400px");

		click(document.getElementById("aspect-ratio-button"));
		const dialog = document.getElementById("aspect-ratio-dialog") as HTMLDialogElement;
		click(byRole(dialog, "button", ASPECT_RATIO_LABELS["3:1"]));

		expect(diagram?.style.getPropertyValue("--diagram-preview-height")).toBe("400px");
		expect(diagram?.style.getPropertyValue("--diagram-aspect-ratio")).toBe("1440 / 480");
		expect(diagram?.style.getPropertyValue("--diagram-aspect-number")).toBe("3");
	});

	it("offers every labelled aspect-ratio preset in the wide picker and narrow Diagram sheet", () => {
		mountApp();

		for (const preset of ASPECT_RATIO_OPTIONS) {
			const copies = allByRole<HTMLElement>(document, "button", ASPECT_RATIO_LABELS[preset.value]);
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

		// Start from "static" (defaultState().linkColor is already
		// "source-target") so the later transition back to source-target
		// actually proves the click handler ran, same rationale as the wide
		// links-dialog gradient test above.
		click(byRole(displayDialog, "button", LINK_COLOR_OPTIONS.static.shortLabel));

		const storedAfterStatic = getStoredState();
		expect(storedAfterStatic.settings.linkColor).toBe("static");
		expect(displayDialog.open).toBe(true);

		// The narrow display dialog's copy uses the abbreviated shortLabel
		// ("Gradient") while the wide links dialog keeps the full label.
		const gradientOption = byRole<HTMLButtonElement>(
			displayDialog,
			"button",
			LINK_COLOR_OPTIONS["source-target"].shortLabel,
		);
		click(gradientOption);

		const stored = getStoredState();
		expect(stored.settings.linkColor).toBe("source-target");

		const gradients = document.getElementById("diagram")?.querySelectorAll("linearGradient");
		expect(gradients?.length).toBeGreaterThan(0);
		expect(
			document.getElementById("diagram")?.querySelector('path[stroke="url(#link-grad-0)"]'),
		).not.toBeNull();

		// Both copies of the choice — the Diagram dialog's own and the wide
		// toolbar's #links-dialog — must reflect the new value.
		expect(gradientOption.getAttribute("aria-pressed")).toBe("true");
		const linksDialogGradientOption = byRole<HTMLButtonElement>(
			linksDialog,
			"button",
			LINK_COLOR_OPTIONS["source-target"].label,
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

		click(byRole(linksDialog, "button", LINK_COLOR_OPTIONS.target.label));

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
		expect(accessibleName(pressed[0])).toBe(THEME_OPTIONS[defaultState().settings.theme].label);
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
		const lightOption = byRole<HTMLButtonElement>(dialog, "button", THEME_OPTIONS.light.label);
		click(lightOption);

		expect(document.documentElement.getAttribute("data-theme")).toBe("light");
		const stored = getStoredState();
		expect(stored.settings.theme).toBe("light");
		expect(themeButton?.getAttribute("aria-label")).toBe("Theme: Light");
		expect(lightOption.getAttribute("aria-pressed")).toBe("true");
		expect(
			byRole<HTMLButtonElement>(dialog, "button", THEME_OPTIONS.auto.label).getAttribute(
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
		click(byRole(dialog, "button", THEME_OPTIONS.light.label));
		expect(document.documentElement.getAttribute("data-theme")).toBe("light");

		click(themeButton);
		click(byRole(dialog, "button", THEME_OPTIONS.auto.label));

		expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
		const stored = getStoredState();
		expect(stored.settings.theme).toBe("auto");
		expect(themeButton?.getAttribute("aria-label")).toBe("Theme: System");
	});
});

// Link color, alignment, and aspect ratio are diagram-only settings — they
// redraw the diagram and persist without touching either editor. (The rows
// container/Sortable-instance survival invariant itself is asserted once, in
// reorder.test.ts.)
describe("diagram-only settings redraw and persist", () => {
	it("changing link color redraws the diagram and persists", () => {
		mountApp();

		const svgBefore = document.querySelector("#diagram svg");

		click(document.getElementById("links-button"));
		const dialog = document.getElementById("links-dialog") as HTMLDialogElement;
		click(byRole(dialog, "button", LINK_COLOR_OPTIONS.static.label));

		expect(document.querySelector("#diagram svg")).not.toBe(svgBefore);
		expect(getStoredState().settings.linkColor).toBe("static");
	});

	it("changing alignment redraws the diagram and persists", () => {
		mountApp();

		const svgBefore = document.querySelector("#diagram svg");

		click(byRole(wideAlignmentGroup(), "button", "Left"));

		expect(document.querySelector("#diagram svg")).not.toBe(svgBefore);
		expect(getStoredState().settings.alignment).toBe("left");
	});

	it("changing aspect ratio redraws the diagram and persists", () => {
		mountApp();

		const svgBefore = document.querySelector("#diagram svg");

		click(document.getElementById("aspect-ratio-button"));
		const dialog = document.getElementById("aspect-ratio-dialog") as HTMLDialogElement;
		click(byRole(dialog, "button", ASPECT_RATIO_LABELS["3:1"]));

		expect(document.querySelector("#diagram svg")).not.toBe(svgBefore);
		expect(getStoredState().settings.aspectRatio).toBe("3:1");
	});
});

// The last-valid render request is only replaced when the graph validates
// (see start-app.tsx's commit()) — a diagram-setting change made while
// invalid must still persist and update controls, but leaves the request
// (and therefore the on-screen SVG) exactly as it was.
describe("a diagram-setting change made while the graph is invalid", () => {
	it("persists and updates controls but leaves the last-valid SVG element and markup untouched", () => {
		mountApp();

		// Retargeting the third link to n1 closes a 2-node cycle, same setup as
		// the theme-while-invalid test above.
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

		// Identity, not just markup equality: commit() passed SankeyCanvas the
		// same `lastValidRequest` reference, so its layout effect never reran.
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);
		expect(document.querySelector("#diagram svg")?.outerHTML).toBe(svgHtmlBefore);
	});
});

// Unlike the diagram-only settings above, palette changes DO affect the node
// editor — its swatches must show the new colors — but that's a style patch
// on the existing `.node-swatch` elements, not a rebuild.
describe("palette changes patch node-editor swatches", () => {
	it("choosing a palette from the dialog updates swatch colors, replaces the SVG, and persists", () => {
		mountApp();

		const svgBefore = document.querySelector("#diagram svg");

		click(document.getElementById("palette-preview"));
		const dialog = document.getElementById("palette-dialog") as HTMLDialogElement;
		click(byRole(dialog, "button", PALETTE_LABELS.tableau10));

		const swatches = Array.from(
			document.querySelectorAll<HTMLElement>("#node-editor .node-swatch"),
		);
		const expectedColors = paletteColors("tableau10").slice(0, swatches.length);
		expect(swatches.map((s) => s.style.backgroundColor)).toEqual(expectedColors);

		expect(document.querySelector("#diagram svg")).not.toBe(svgBefore);
		expect(getStoredState().settings.palette).toBe("tableau10");
	});
});

// Unlike the diagram-only settings above, theme is not diagram data —
// changing it must skip validation and the redraw entirely (only
// palette/link-color/alignment/aspect-ratio redraw), just apply the theme,
// persist, and clear the one-shot I/O notice.
describe("theme changes skip validation and the redraw", () => {
	it("on a valid graph: persists, clears a seeded I/O notice, applies data-theme, and leaves the rendered SVG untouched", async () => {
		mountApp();

		// Seed #io-notice the same way files.test.ts's repair-warning import test
		// does — a repaired import installs a notice via its own commit() (an
		// import without repairs installs none under the current policy) — so
		// "cleared by the theme change" below is a real assertion, not two empty
		// strings.
		const payload = {
			nodes: [
				{ id: "n1", name: "X" },
				{ id: "n2", name: "Y" },
			],
			links: [{ source: "n1", target: "n2", value: 3 }],
			// An unrecognized palette is repaired to the default, which installs
			// the warning — the link itself must stay complete so the diagram
			// below still renders an svg (a linkless graph draws none).
			settings: { palette: "not-a-real-palette" },
		};
		const file = new File([JSON.stringify(payload)], "sankey.json", { type: "application/json" });
		const input = document.getElementById("import-file") as HTMLInputElement;
		Object.defineProperty(input, "files", { value: [file], configurable: true, writable: true });
		fireChange(input);
		// Flush the async file.text() + parseImport chain.
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(document.getElementById("io-notice")?.textContent).toBe(
			"Imported 2 nodes, 1 links. Adjustments: settings: unknown palette — using default.",
		);

		const svgBefore = document.querySelector("#diagram svg");
		expect(svgBefore).not.toBeNull();

		const themeButton = document.getElementById("theme-button");
		click(themeButton);
		const dialog = document.getElementById("theme-dialog") as HTMLDialogElement;
		click(byRole(dialog, "button", THEME_OPTIONS.light.label));

		expect(document.documentElement.getAttribute("data-theme")).toBe("light");
		expect(getStoredState().settings.theme).toBe("light");
		expect(document.getElementById("io-notice")?.textContent).toBe("");
		// No re-render: same <svg> element, not just equivalent markup.
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);
	});

	it("on an invalid graph (cycle): leaves the error banner and the last valid diagram untouched", () => {
		mountApp();

		// Retargeting the third link to n1 closes a 2-node cycle, same setup as
		// editor.test.ts's cycle test.
		const target = byRole<HTMLSelectElement>(document, "combobox", "Target for link 3");
		target.value = "n1";
		fireChange(target);

		const errorBefore = document.getElementById("error")?.textContent;
		expect(errorBefore).toContain("cycle");
		const svgBefore = document.querySelector("#diagram svg");

		const themeButton = document.getElementById("theme-button");
		click(themeButton);
		const dialog = document.getElementById("theme-dialog") as HTMLDialogElement;
		click(byRole(dialog, "button", THEME_OPTIONS.light.label));

		// The theme change didn't re-run validation: the same cycle error is
		// still showing, verbatim, and the diagram (SVG identity, the main
		// proxy for "no render happened") is untouched.
		expect(document.getElementById("error")?.textContent).toBe(errorBefore);
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);

		expect(document.documentElement.getAttribute("data-theme")).toBe("light");
		expect(getStoredState().settings.theme).toBe("light");
	});
});

// DiagramPanel and ThemeControl render their dialogs directly from
// src/features/settings/options.ts's (and model/settings.ts's) metadata, so
// most cases below pin option wiring/completeness — every entry in the
// source table is actually present in the rendered DOM with the right
// accessible name/label/icon — rather than checking two independent sources
// against each other. The alignment value-set check is the exception: it
// still compares the rendered DOM against model/settings.ts's ALIGNMENTS
// directly, since options.ts's own ALIGNMENT_OPTIONS deliberately reorders
// that set for the dialog's display order and could still drift from it.
// The tests above already exercise behavior around a handful of these rows
// in passing; this block is the exhaustive, dedicated contract.
describe("dialog markup vs settings metadata contract", () => {
	it("palette dialog: rendered option order and labels match PALETTE_ORDER / PALETTE_LABELS", () => {
		mountApp();

		const dialog = document.getElementById("palette-dialog") as HTMLDialogElement;
		const options = allByRole<HTMLButtonElement>(byRole(dialog, "group"), "button");
		expect(options.map((option) => accessibleName(option))).toEqual(
			PALETTE_ORDER.map((value) => PALETTE_LABELS[value]),
		);
	});

	it("links dialog: rendered option set, labels, and icons match LINK_COLOR_OPTIONS", () => {
		mountApp();

		const dialog = document.getElementById("links-dialog") as HTMLDialogElement;
		const options = allByRole<HTMLButtonElement>(byRole(dialog, "group"), "button");
		expect(options).toHaveLength(Object.keys(LINK_COLOR_OPTIONS).length);
		expect(new Set(options.map((option) => accessibleName(option)))).toEqual(
			new Set(Object.values(LINK_COLOR_OPTIONS).map((option) => option.label)),
		);
		for (const meta of Object.values(LINK_COLOR_OPTIONS)) {
			const option = byRole<HTMLButtonElement>(dialog, "button", meta.label);
			expect(option.querySelector("use")?.getAttribute("href")).toBe(`#${meta.iconId}`);
		}
	});

	it("display dialog's narrow link-color copy: rendered option set matches LINK_COLOR_OPTIONS", () => {
		mountApp();

		// The narrow Diagram-dialog copy uses deliberately abbreviated labels
		// (e.g. "Gradient" instead of "Source to target (gradient)"), so only
		// shortLabels are pinned here — the links-dialog test above already pins
		// the full labels/icons for the one copy that owns the canonical text.
		const displayDialog = document.getElementById("display-dialog") as HTMLDialogElement;
		const group = byRole(displayDialog, "group", "Link colors");
		const options = allByRole<HTMLButtonElement>(group, "button");
		expect(new Set(options.map((option) => accessibleName(option)))).toEqual(
			new Set(Object.values(LINK_COLOR_OPTIONS).map((option) => option.shortLabel)),
		);
	});

	it("alignment buttons: each DOM copy's rendered option set matches the model's ALIGNMENTS", () => {
		mountApp();

		// Two DOM copies of the alignment group — the wide toolbar's own copy
		// and the narrow Diagram dialog's own copy — checked separately so a
		// missing/extra button in just one copy can't hide behind the other's
		// count in a merged set.
		const alignmentLabelByValue = new Map(
			ALIGNMENT_OPTIONS.map((option) => [option.value, option.label]),
		);
		const expectedLabels = new Set(ALIGNMENTS.map((value) => alignmentLabelByValue.get(value)));

		const wideLabels = allByRole<HTMLButtonElement>(wideAlignmentGroup(), "button").map((option) =>
			accessibleName(option),
		);
		expect(new Set(wideLabels)).toEqual(expectedLabels);
		expect(wideLabels).toHaveLength(ALIGNMENTS.length);

		const narrowGroup = byRole(
			document.getElementById("display-dialog") as HTMLDialogElement,
			"group",
			"Alignment",
		);
		const narrowLabels = allByRole<HTMLButtonElement>(narrowGroup, "button").map((option) =>
			accessibleName(option),
		);
		expect(new Set(narrowLabels)).toEqual(expectedLabels);
		expect(narrowLabels).toHaveLength(ALIGNMENTS.length);
	});

	it("aspect-ratio dialog: rendered option order and labels match ASPECT_RATIO_OPTIONS / ASPECT_RATIO_LABELS", () => {
		mountApp();

		const dialog = document.getElementById("aspect-ratio-dialog") as HTMLDialogElement;
		const options = allByRole<HTMLButtonElement>(byRole(dialog, "group"), "button");
		expect(options.map((option) => accessibleName(option))).toEqual(
			ASPECT_RATIO_OPTIONS.map((preset) => ASPECT_RATIO_LABELS[preset.value]),
		);
	});

	it("theme dialog: rendered option order, labels, and icons match THEME_OPTIONS", () => {
		mountApp();

		const dialog = document.getElementById("theme-dialog") as HTMLDialogElement;
		const options = allByRole<HTMLButtonElement>(byRole(dialog, "group"), "button");
		expect(options.map((option) => accessibleName(option))).toEqual(
			Object.values(THEME_OPTIONS).map((option) => option.label),
		);
		for (const meta of Object.values(THEME_OPTIONS)) {
			const option = byRole<HTMLButtonElement>(dialog, "button", meta.label);
			expect(option.querySelector("use")?.getAttribute("href")).toBe(`#${meta.iconId}`);
		}
	});
});
