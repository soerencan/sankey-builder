// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { ASPECT_RATIO_OPTIONS, LINK_COLOR_OPTIONS } from "../../src/features/settings/toolbar";
import { defaultState } from "../../src/model/graph";
import { PALETTE_LABELS } from "../../src/model/palette";
import { click, getStoredState, mountApp } from "../helpers/mount-app";

describe("toolbar & settings", () => {
	it("palette-next advances the carousel: state, preview label, and rendered colors all follow", () => {
		mountApp();

		const fills = () =>
			Array.from(document.querySelectorAll("#diagram svg rect")).map((r) => r.getAttribute("fill"));
		const before = fills();

		click(document.querySelector('[data-action="palette-next"]'));

		const preview = document.getElementById("palette-preview");
		expect(preview?.getAttribute("aria-label")).toBe("Palette: Tableau 10");
		expect(fills()).not.toEqual(before);

		const stored = getStoredState();
		expect(stored.settings.palette).toBe("tableau10");
	});

	it("palette-prev wraps from the first palette (observable10) to the last (dark2)", () => {
		mountApp();

		click(document.querySelector('[data-action="palette-prev"]'));

		const preview = document.getElementById("palette-preview");
		expect(preview?.getAttribute("aria-label")).toBe("Palette: Dark 2");
		const stored = getStoredState();
		expect(stored.settings.palette).toBe("dark2");
	});

	it("clicking the palette preview opens the palette dialog", () => {
		mountApp();

		const dialog = document.getElementById("palette-dialog");
		expect(dialog).toBeInstanceOf(HTMLDialogElement);
		expect((dialog as HTMLDialogElement).open).toBe(false);

		click(document.getElementById("palette-preview"));

		expect((dialog as HTMLDialogElement).open).toBe(true);

		// Pin index.html's hardcoded option labels to PALETTE_LABELS (src/model/palette.ts)
		// so the two can't drift apart.
		for (const option of Array.from(
			dialog?.querySelectorAll<HTMLElement>(".palette-option") ?? [],
		)) {
			const value = option.getAttribute("data-value");
			expect(value).toBeTruthy();
			expect(option.querySelector(".palette-option-label")?.textContent).toBe(
				PALETTE_LABELS[value as keyof typeof PALETTE_LABELS],
			);
		}
	});

	it("choosing a palette in the dialog sets state, updates aria-pressed, and closes with focus back on the preview", () => {
		mountApp();

		const preview = document.getElementById("palette-preview");
		click(preview);

		const dialog = document.getElementById("palette-dialog") as HTMLDialogElement;
		const set2Option = dialog.querySelector<HTMLButtonElement>('[data-value="set2"]');
		click(set2Option);

		const stored = getStoredState();
		expect(stored.settings.palette).toBe("set2");
		expect(set2Option?.getAttribute("aria-pressed")).toBe("true");
		expect(dialog.querySelector('[data-value="observable10"]')?.getAttribute("aria-pressed")).toBe(
			"false",
		);
		expect(dialog.open).toBe(false);
		expect(document.activeElement).toBe(preview);
	});

	it("clicking the links button opens the links dialog", () => {
		mountApp();

		const dialog = document.getElementById("links-dialog");
		expect(dialog).toBeInstanceOf(HTMLDialogElement);
		expect((dialog as HTMLDialogElement).open).toBe(false);

		click(document.getElementById("links-button"));

		expect((dialog as HTMLDialogElement).open).toBe(true);

		// Pin index.html's hardcoded option labels to LINK_COLOR_OPTIONS
		// (src/features/settings/toolbar.ts) so the two can't drift apart.
		for (const option of Array.from(
			dialog?.querySelectorAll<HTMLElement>(".choice-option") ?? [],
		)) {
			const value = option.getAttribute("data-value");
			expect(value).toBeTruthy();
			expect(option.querySelector(".choice-option-label")?.textContent).toBe(
				LINK_COLOR_OPTIONS[value as keyof typeof LINK_COLOR_OPTIONS].label,
			);
		}
	});

	it("choosing Neutral in the links dialog sets state, re-renders static links, and closes with focus back on the links button", () => {
		mountApp();

		const linksButton = document.getElementById("links-button");
		click(linksButton);

		const dialog = document.getElementById("links-dialog") as HTMLDialogElement;
		const staticOption = dialog.querySelector<HTMLButtonElement>('[data-value="static"]');
		click(staticOption);

		const stored = getStoredState();
		expect(stored.settings.linkColor).toBe("static");

		// Only the chosen option is pressed.
		expect(staticOption?.getAttribute("aria-pressed")).toBe("true");
		for (const option of Array.from(
			dialog.querySelectorAll<HTMLButtonElement>('[data-action="set-link-color"]'),
		)) {
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
		const staticOption = dialog.querySelector<HTMLButtonElement>('[data-value="static"]');
		click(staticOption);

		const storedAfterStatic = getStoredState();
		expect(storedAfterStatic.settings.linkColor).toBe("static");
		for (const path of Array.from(document.querySelectorAll("#diagram svg path"))) {
			expect(path.getAttribute("stroke")).toBe("#aaa");
		}

		// Now transition to the gradient option and assert the change actually took.
		click(linksButton);
		const gradientOption = dialog.querySelector<HTMLButtonElement>('[data-value="source-target"]');
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
		// .align-group and the narrow Diagram dialog) — syncToolbar keeps both
		// in lockstep, so every pressed button must share the same value.
		const pressed = Array.from(
			document.querySelectorAll<HTMLButtonElement>('[data-action="set-alignment"]'),
		).filter((option) => option.getAttribute("aria-pressed") === "true");

		expect(pressed).toHaveLength(2);
		for (const option of pressed) {
			expect(option.dataset.value).toBe(defaultState().settings.alignment);
		}
	});

	it("clicking Left in the alignment group sets state, updates aria-pressed on both copies, and re-renders the diagram", () => {
		mountApp();

		const svgBefore = document.querySelector("#diagram svg");
		const options = Array.from(
			document.querySelectorAll<HTMLButtonElement>('[data-action="set-alignment"]'),
		);
		const leftOption = options.find(
			(option) => option.closest(".align-group") && option.dataset.value === "left",
		);
		click(leftOption);

		const stored = getStoredState();
		expect(stored.settings.alignment).toBe("left");

		// Only options with the chosen value are pressed, across both copies.
		for (const option of options) {
			expect(option.getAttribute("aria-pressed")).toBe(
				option.dataset.value === "left" ? "true" : "false",
			);
		}

		// A fresh <svg> replaces the old one — same re-render evidence the
		// value-edit and link-color tests above rely on.
		const svgAfter = document.querySelector("#diagram svg");
		expect(svgAfter).not.toBeNull();
		expect(svgAfter).not.toBe(svgBefore);
	});

	it("every alignment button has a non-empty accessible name", () => {
		mountApp();

		const options = document.querySelectorAll<HTMLButtonElement>(".align-group button");
		expect(options.length).toBeGreaterThan(0);
		for (const option of Array.from(options)) {
			expect(option.getAttribute("aria-label")?.trim()).toBeTruthy();
		}
	});

	it("changes the intrinsic diagram and both selectors when an aspect ratio is chosen", () => {
		mountApp();

		const trigger = document.getElementById("aspect-ratio-button");
		click(trigger);
		const dialog = document.getElementById("aspect-ratio-dialog") as HTMLDialogElement;
		expect(dialog.open).toBe(true);

		click(dialog.querySelector('[data-action="set-aspect-ratio"][data-value="3:1"]'));

		expect(document.querySelector("#diagram svg")?.getAttribute("viewBox")).toBe("0 0 1440 480");
		expect(trigger?.textContent).toContain("Aspect 3:1");
		const stored = getStoredState();
		expect(stored.settings.aspectRatio).toBe("3:1");
		for (const option of Array.from(
			document.querySelectorAll<HTMLButtonElement>('[data-action="set-aspect-ratio"]'),
		)) {
			expect(option.getAttribute("aria-pressed")).toBe(
				option.dataset.value === "3:1" ? "true" : "false",
			);
		}
		expect(dialog.open).toBe(false);
		expect(document.activeElement).toBe(trigger);
	});

	it("offers every labelled aspect-ratio preset in the wide picker and narrow Diagram sheet", () => {
		mountApp();

		for (const preset of ASPECT_RATIO_OPTIONS) {
			const copies = document.querySelectorAll<HTMLElement>(
				`[data-action="set-aspect-ratio"][data-value="${preset.value}"]`,
			);
			expect(copies).toHaveLength(2);
			for (const copy of Array.from(copies)) {
				expect(copy.textContent).toContain(preset.label);
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
		click(displayDialog.querySelector('[data-action="set-link-color"][data-value="static"]'));

		const storedAfterStatic = getStoredState();
		expect(storedAfterStatic.settings.linkColor).toBe("static");
		expect(displayDialog.open).toBe(true);

		const gradientOption = displayDialog.querySelector<HTMLButtonElement>(
			'[data-action="set-link-color"][data-value="source-target"]',
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
		expect(gradientOption?.getAttribute("aria-pressed")).toBe("true");
		const linksDialogGradientOption = linksDialog.querySelector<HTMLButtonElement>(
			'[data-action="set-link-color"][data-value="source-target"]',
		);
		expect(linksDialogGradientOption?.getAttribute("aria-pressed")).toBe("true");
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
		const leftOption = displayDialog.querySelector<HTMLButtonElement>(
			'[data-action="set-alignment"][data-value="left"]',
		);
		click(leftOption);

		const stored = getStoredState();
		expect(stored.settings.alignment).toBe("left");
		expect(leftOption?.getAttribute("aria-pressed")).toBe("true");

		// The wide toolbar's own alignment group follows the same state.
		const wideLeftOption = document.querySelector<HTMLButtonElement>(
			'.align-group [data-action="set-alignment"][data-value="left"]',
		);
		expect(wideLeftOption?.getAttribute("aria-pressed")).toBe("true");

		expect(displayDialog.open).toBe(true);
	});

	it("closing the diagram-options dialog via its Close button returns focus to the Diagram button", () => {
		mountApp();

		const displayButton = document.getElementById("display-button");
		click(displayButton);

		const displayDialog = document.getElementById("display-dialog") as HTMLDialogElement;
		expect(displayDialog.open).toBe(true);

		click(displayDialog.querySelector('[data-action="close-dialog"]'));

		expect(displayDialog.open).toBe(false);
		expect(document.activeElement).toBe(displayButton);
	});

	it("regression: choosing a link color via the links dialog (wide toolbar) still closes it", () => {
		mountApp();

		const linksButton = document.getElementById("links-button");
		click(linksButton);

		const linksDialog = document.getElementById("links-dialog") as HTMLDialogElement;
		expect(linksDialog.open).toBe(true);

		click(linksDialog.querySelector('[data-value="target"]'));

		const stored = getStoredState();
		expect(stored.settings.linkColor).toBe("target");
		expect(linksDialog.open).toBe(false);
		expect(document.activeElement).toBe(linksButton);
	});

	it("boots with exactly one theme option pressed, matching the default (System)", () => {
		mountApp();

		const pressed = Array.from(
			document.querySelectorAll<HTMLButtonElement>('[data-action="set-theme"]'),
		).filter((option) => option.getAttribute("aria-pressed") === "true");

		expect(pressed).toHaveLength(1);
		expect(pressed[0]?.dataset.value).toBe(defaultState().settings.theme);
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
		const lightOption = dialog.querySelector<HTMLButtonElement>('[data-value="light"]');
		click(lightOption);

		expect(document.documentElement.getAttribute("data-theme")).toBe("light");
		const stored = getStoredState();
		expect(stored.settings.theme).toBe("light");
		expect(themeButton?.getAttribute("aria-label")).toBe("Theme: Light");
		expect(lightOption?.getAttribute("aria-pressed")).toBe("true");
		expect(dialog.querySelector('[data-value="auto"]')?.getAttribute("aria-pressed")).toBe("false");
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
		click(dialog.querySelector('[data-value="light"]'));
		expect(document.documentElement.getAttribute("data-theme")).toBe("light");

		click(themeButton);
		click(dialog.querySelector('[data-value="auto"]'));

		expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
		const stored = getStoredState();
		expect(stored.settings.theme).toBe("auto");
		expect(themeButton?.getAttribute("aria-label")).toBe("Theme: System");
	});
});
