// @vitest-environment happy-dom

import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PALETTE_LABELS } from "../src/colors";
import { serializeState } from "../src/io";
import { STORAGE_KEY } from "../src/persist";
import { defaultState } from "../src/state";
import { LINK_COLOR_OPTIONS } from "../src/toolbar";
import { loadD3Global } from "./helpers/d3-global";
import { loadSortableGlobal } from "./helpers/sortable-global";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Pinned verbatim from src/main.ts's STORAGE_NOTICE — main.ts doesn't export
// it, so this hardcodes (and thereby pins) the user-visible copy.
const STORAGE_NOTICE =
	"Changes can't be saved in this browser right now (storage may be full or unavailable). " +
	"The diagram keeps working, but edits won't survive closing or reloading this tab — " +
	"try freeing up space or leaving private/incognito mode.";

let bundle: string;
let bodyMarkup: string;
let tempDir: string;

beforeAll(async () => {
	loadD3Global();
	loadSortableGlobal();

	// A fresh scratch build, never the committed app.js — the whole point of
	// this test is to catch a stale/missing bundle that `make check`'s cmp
	// guard hasn't run yet. Built via the same "bundle" script the build,
	// watch, and freshness Makefile targets use, so the esbuild option set
	// can't drift from what actually produced the committed artifact.
	tempDir = await mkdtemp(join(tmpdir(), "sankey-builder-smoke-"));
	const outfile = join(tempDir, "app.js");
	execFileSync("bun", ["run", "bundle", `--outfile=${outfile}`], { cwd: REPO_ROOT });
	bundle = readFileSync(outfile, "utf8");

	// Real markup, not a hand-rolled fixture, so the smoke test exercises the
	// actual element ids/structure — but strip the <script> tags, since
	// evaluating this bundle directly is the whole point.
	const html = readFileSync(join(REPO_ROOT, "index.html"), "utf8");
	const bodyMatch = /<body>([\s\S]*)<\/body>/.exec(html);
	if (!bodyMatch) throw new Error("index.html has no <body> to extract");
	bodyMarkup = bodyMatch[1].replace(/<script[\s\S]*?<\/script>\s*/g, "");
}, 30_000);

afterAll(() => {
	rmSync(tempDir, { recursive: true, force: true });
});

beforeEach(() => {
	document.body.innerHTML = bodyMarkup;
	localStorage.clear();
});

function removeAllNodes(): void {
	// Query fresh each time: deleting a node rebuilds the editor rows wholesale,
	// detaching any earlier button reference from the document.
	let deleteButton = document.querySelector<HTMLButtonElement>('[data-action="delete-node"]');
	while (deleteButton) {
		deleteButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		deleteButton = document.querySelector<HTMLButtonElement>('[data-action="delete-node"]');
	}
}

describe("artifact smoke test", () => {
	it("places the diagram before the data editor and has no obsolete resize control", () => {
		const diagramPanel = document.querySelector(".diagram-panel");
		const dataCard = document.querySelector(".data-card");
		expect(diagramPanel).not.toBeNull();
		expect(dataCard).not.toBeNull();
		expect(
			diagramPanel && dataCard
				? diagramPanel.compareDocumentPosition(dataCard) & Node.DOCUMENT_POSITION_FOLLOWING
				: 0,
		).toBeTruthy();
		expect(document.getElementById("resizer")).toBeNull();
	});

	it("boots without throwing and renders the default diagram", () => {
		// Indirect eval, same pattern as the d3-global helper: runs as global
		// code so the IIFE's own top-level `init()` call executes against the
		// real `document`/`localStorage` rather than this module's scope.
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		expect(() => globalEval(bundle)).not.toThrow();

		const diagram = document.getElementById("diagram");
		expect(diagram?.querySelector("svg")).not.toBeNull();

		// defaultState (src/state.ts) has 4 nodes / 3 links.
		expect(diagram?.querySelectorAll("svg rect")).toHaveLength(4);
		expect(diagram?.querySelectorAll("svg path")).toHaveLength(3);
		expect(document.querySelectorAll("#node-editor .node-row")).toHaveLength(4);
		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(3);
	});

	it("palette-next advances the carousel: state, preview label, and rendered colors all follow", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const fills = () =>
			Array.from(document.querySelectorAll("#diagram svg rect")).map((r) => r.getAttribute("fill"));
		const before = fills();

		document
			.querySelector<HTMLButtonElement>('[data-action="palette-next"]')
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const preview = document.getElementById("palette-preview");
		expect(preview?.getAttribute("aria-label")).toBe("Palette: Tableau 10");
		expect(fills()).not.toEqual(before);

		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
		expect(stored.settings.palette).toBe("tableau10");
	});

	it("palette-prev wraps from the first palette (observable10) to the last (dark2)", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		document
			.querySelector<HTMLButtonElement>('[data-action="palette-prev"]')
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const preview = document.getElementById("palette-preview");
		expect(preview?.getAttribute("aria-label")).toBe("Palette: Dark 2");
		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
		expect(stored.settings.palette).toBe("dark2");
	});

	it("clicking the palette preview opens the palette dialog", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const dialog = document.getElementById("palette-dialog");
		expect(dialog).toBeInstanceOf(HTMLDialogElement);
		expect((dialog as HTMLDialogElement).open).toBe(false);

		document
			.getElementById("palette-preview")
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect((dialog as HTMLDialogElement).open).toBe(true);

		// Pin index.html's hardcoded option labels to PALETTE_LABELS (src/colors.ts)
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
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const preview = document.getElementById("palette-preview");
		preview?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const dialog = document.getElementById("palette-dialog") as HTMLDialogElement;
		const set2Option = dialog.querySelector<HTMLButtonElement>('[data-value="set2"]');
		set2Option?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
		expect(stored.settings.palette).toBe("set2");
		expect(set2Option?.getAttribute("aria-pressed")).toBe("true");
		expect(dialog.querySelector('[data-value="observable10"]')?.getAttribute("aria-pressed")).toBe(
			"false",
		);
		expect(dialog.open).toBe(false);
		expect(document.activeElement).toBe(preview);
	});

	it("clicking the links button opens the links dialog", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const dialog = document.getElementById("links-dialog");
		expect(dialog).toBeInstanceOf(HTMLDialogElement);
		expect((dialog as HTMLDialogElement).open).toBe(false);

		document
			.getElementById("links-button")
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect((dialog as HTMLDialogElement).open).toBe(true);

		// Pin index.html's hardcoded option labels to LINK_COLOR_OPTIONS
		// (src/toolbar.ts) so the two can't drift apart.
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
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const linksButton = document.getElementById("links-button");
		linksButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const dialog = document.getElementById("links-dialog") as HTMLDialogElement;
		const staticOption = dialog.querySelector<HTMLButtonElement>('[data-value="static"]');
		staticOption?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
		expect(stored.settings.linkColor).toBe("static");

		// Only the chosen option is pressed.
		expect(staticOption?.getAttribute("aria-pressed")).toBe("true");
		for (const option of Array.from(
			dialog.querySelectorAll<HTMLButtonElement>('[data-action="set-link-color"]'),
		)) {
			if (option !== staticOption) expect(option.getAttribute("aria-pressed")).toBe("false");
		}

		// Re-renders link paths with the static stroke (src/render.ts's linkStroke "static" case).
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
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const linksButton = document.getElementById("links-button");
		const dialog = document.getElementById("links-dialog") as HTMLDialogElement;
		const diagram = document.getElementById("diagram");

		// Start from "static" (defaultState().linkColor is already
		// "source-target", so asserting the post-click state alone wouldn't
		// prove the click handler ran) — this leg proves the click landed.
		linksButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		const staticOption = dialog.querySelector<HTMLButtonElement>('[data-value="static"]');
		staticOption?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const storedAfterStatic = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
		expect(storedAfterStatic.settings.linkColor).toBe("static");
		for (const path of Array.from(document.querySelectorAll("#diagram svg path"))) {
			expect(path.getAttribute("stroke")).toBe("#aaa");
		}

		// Now transition to the gradient option and assert the change actually took.
		linksButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		const gradientOption = dialog.querySelector<HTMLButtonElement>('[data-value="source-target"]');
		gradientOption?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
		expect(stored.settings.linkColor).toBe("source-target");

		const gradients = diagram?.querySelectorAll("linearGradient");
		expect(gradients?.length).toBeGreaterThan(0);
		expect(diagram?.querySelector('path[stroke="url(#link-grad-0)"]')).not.toBeNull();
	});

	it("boots with exactly one alignment value pressed, matching the default alignment, on both the wide and narrow copies", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

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
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const svgBefore = document.querySelector("#diagram svg");
		const options = Array.from(
			document.querySelectorAll<HTMLButtonElement>('[data-action="set-alignment"]'),
		);
		const leftOption = options.find(
			(option) => option.closest(".align-group") && option.dataset.value === "left",
		);
		leftOption?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
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
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const options = document.querySelectorAll<HTMLButtonElement>(".align-group button");
		expect(options.length).toBeGreaterThan(0);
		for (const option of Array.from(options)) {
			expect(option.getAttribute("aria-label")?.trim()).toBeTruthy();
		}
	});

	it("clicking the Diagram button opens the diagram-options dialog", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const dialog = document.getElementById("display-dialog");
		expect(dialog).toBeInstanceOf(HTMLDialogElement);
		expect((dialog as HTMLDialogElement).open).toBe(false);

		document
			.getElementById("display-button")
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect((dialog as HTMLDialogElement).open).toBe(true);
	});

	it("choosing Gradient in the display dialog re-renders links, syncs both link-color copies, and stays open", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const displayButton = document.getElementById("display-button");
		displayButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const displayDialog = document.getElementById("display-dialog") as HTMLDialogElement;
		const linksDialog = document.getElementById("links-dialog") as HTMLDialogElement;

		// Start from "static" (defaultState().linkColor is already
		// "source-target") so the later transition back to source-target
		// actually proves the click handler ran, same rationale as the wide
		// links-dialog gradient test above.
		displayDialog
			.querySelector<HTMLButtonElement>('[data-action="set-link-color"][data-value="static"]')
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const storedAfterStatic = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
		expect(storedAfterStatic.settings.linkColor).toBe("static");
		expect(displayDialog.open).toBe(true);

		const gradientOption = displayDialog.querySelector<HTMLButtonElement>(
			'[data-action="set-link-color"][data-value="source-target"]',
		);
		gradientOption?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
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
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		document
			.getElementById("display-button")
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const displayDialog = document.getElementById("display-dialog") as HTMLDialogElement;
		const leftOption = displayDialog.querySelector<HTMLButtonElement>(
			'[data-action="set-alignment"][data-value="left"]',
		);
		leftOption?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
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
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const displayButton = document.getElementById("display-button");
		displayButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const displayDialog = document.getElementById("display-dialog") as HTMLDialogElement;
		expect(displayDialog.open).toBe(true);

		displayDialog
			.querySelector<HTMLButtonElement>('[data-action="close-dialog"]')
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(displayDialog.open).toBe(false);
		expect(document.activeElement).toBe(displayButton);
	});

	it("regression: choosing a link color via the links dialog (wide toolbar) still closes it", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const linksButton = document.getElementById("links-button");
		linksButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const linksDialog = document.getElementById("links-dialog") as HTMLDialogElement;
		expect(linksDialog.open).toBe(true);

		linksDialog
			.querySelector<HTMLButtonElement>('[data-value="target"]')
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
		expect(stored.settings.linkColor).toBe("target");
		expect(linksDialog.open).toBe(false);
		expect(document.activeElement).toBe(linksButton);
	});

	it("boots with exactly one theme option pressed, matching the default (System)", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

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
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const themeButton = document.getElementById("theme-button");
		themeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const dialog = document.getElementById("theme-dialog") as HTMLDialogElement;
		expect(dialog.open).toBe(true);
		const lightOption = dialog.querySelector<HTMLButtonElement>('[data-value="light"]');
		lightOption?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(document.documentElement.getAttribute("data-theme")).toBe("light");
		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
		expect(stored.settings.theme).toBe("light");
		expect(themeButton?.getAttribute("aria-label")).toBe("Theme: Light");
		expect(lightOption?.getAttribute("aria-pressed")).toBe("true");
		expect(dialog.querySelector('[data-value="auto"]')?.getAttribute("aria-pressed")).toBe("false");
		expect(dialog.open).toBe(false);
		expect(document.activeElement).toBe(themeButton);
	});

	it("choosing System in the theme dialog removes data-theme entirely", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const themeButton = document.getElementById("theme-button");
		const dialog = document.getElementById("theme-dialog") as HTMLDialogElement;

		// Start from Light so the System transition actually removes the attribute
		// rather than it never having been set.
		themeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		dialog
			.querySelector<HTMLButtonElement>('[data-value="light"]')
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(document.documentElement.getAttribute("data-theme")).toBe("light");

		themeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		dialog
			.querySelector<HTMLButtonElement>('[data-value="auto"]')
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
		expect(stored.settings.theme).toBe("auto");
		expect(themeButton?.getAttribute("aria-label")).toBe("Theme: System");
	});

	it("round-trips a basic mutation: add node updates editor, diagram, and storage", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const addNodeButton = document.querySelector<HTMLButtonElement>('[data-action="add-node"]');
		expect(addNodeButton).not.toBeNull();
		addNodeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(document.querySelectorAll("#node-editor .node-row")).toHaveLength(5);
		expect(document.querySelectorAll("#diagram svg rect")).toHaveLength(5);

		const stored = localStorage.getItem(STORAGE_KEY);
		expect(stored).not.toBeNull();
		const parsed = JSON.parse(stored ?? "{}");
		expect(parsed.nodes.some((n: { id: string }) => n.id === "n5")).toBe(true);
	});

	it("leaves state untouched on empty/invalid value edits and restores the text on blur", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const svgBefore = document.querySelector("#diagram svg");
		expect(svgBefore).not.toBeNull();

		// First link (n1 "Coal" -> n3 "Electricity", value 10 in defaultState).
		const valueInput = document.querySelector<HTMLInputElement>('.link-value[data-index="0"]');
		expect(valueInput).not.toBeNull();
		if (!valueInput) throw new Error("unreachable");

		// Emptying the field never reaches state: no error, no re-render, and
		// the stored value stays at defaultState's 10.
		valueInput.value = "";
		valueInput.dispatchEvent(new Event("input", { bubbles: true }));

		expect(document.getElementById("error")?.textContent).toBe("");
		expect(valueInput.hasAttribute("aria-invalid")).toBe(false);
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);
		expect(document.contains(valueInput)).toBe(true);
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").links[0].value).toBe(10);

		// An invalid string marks the field but still leaves state/storage alone.
		valueInput.value = "abc";
		valueInput.dispatchEvent(new Event("input", { bubbles: true }));

		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(document.getElementById("error")?.textContent).toBe("");
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").links[0].value).toBe(10);

		// Blur restores the last committed value and clears the marker.
		valueInput.dispatchEvent(new Event("change", { bubbles: true }));
		expect(valueInput.value).toBe("10");
		expect(valueInput.hasAttribute("aria-invalid")).toBe(false);

		// After a *valid* edit, blur must not rewrite the text — "5." parses to
		// 5 but the trailing dot is preserved so the user can keep typing.
		valueInput.value = "5.";
		valueInput.dispatchEvent(new Event("input", { bubbles: true }));
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").links[0].value).toBe(5);
		valueInput.dispatchEvent(new Event("change", { bubbles: true }));
		expect(valueInput.value).toBe("5.");
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").links[0].value).toBe(5);

		// A valid edit flows through to state, storage, and a fresh diagram.
		valueInput.value = "20";
		valueInput.dispatchEvent(new Event("input", { bubbles: true }));

		expect(document.getElementById("error")?.textContent).toBe("");
		const svgAfter = document.querySelector("#diagram svg");
		expect(svgAfter).not.toBeNull();
		expect(svgAfter).not.toBe(svgBefore);
		expect(document.querySelectorAll("#diagram svg rect")).toHaveLength(4);
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").links[0].value).toBe(20);
	});

	it("shows an inline, accessible error message for an invalid link value and clears it once valid", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const valueInput = document.querySelector<HTMLInputElement>('.link-value[data-index="0"]');
		if (!valueInput) throw new Error("unreachable");

		const describedbyId = valueInput.getAttribute("aria-describedby");
		expect(describedbyId).toBeTruthy();
		const errorEl = describedbyId ? document.getElementById(describedbyId) : null;
		expect(errorEl).not.toBeNull();
		if (!errorEl) throw new Error("unreachable");

		// aria-describedby is wired up before any error occurs, and the paired
		// element starts empty.
		expect(errorEl.textContent).toBe("");

		valueInput.value = "abc";
		valueInput.dispatchEvent(new Event("input", { bubbles: true }));

		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(errorEl.textContent).toBe("Enter a plain number greater than 0.");

		// Further invalid keystrokes keep the message (not cleared on every
		// keypress, only when the value actually becomes valid or blank).
		valueInput.value = "abcd";
		valueInput.dispatchEvent(new Event("input", { bubbles: true }));

		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(errorEl.textContent).toBe("Enter a plain number greater than 0.");

		// Becoming valid clears both the marker and the message.
		valueInput.value = "20";
		valueInput.dispatchEvent(new Event("input", { bubbles: true }));

		expect(valueInput.hasAttribute("aria-invalid")).toBe(false);
		expect(errorEl.textContent).toBe("");

		// Above the 1e15 cap gets its own message.
		valueInput.value = "9999999999999999";
		valueInput.dispatchEvent(new Event("input", { bubbles: true }));
		expect(errorEl.textContent).toBe("Enter a number no greater than 1000000000000000.");

		// Over 4 fractional digits, set directly (bypassing beforeinput's
		// keystroke/paste interception), still reaches the message branch.
		valueInput.value = "0.00001";
		valueInput.dispatchEvent(new Event("input", { bubbles: true }));
		expect(errorEl.textContent).toBe("Enter a number with up to 4 decimal places.");

		// Blur on an invalid value reverts the text to the last committed
		// value and clears both the marker and the message.
		valueInput.dispatchEvent(new Event("change", { bubbles: true }));
		expect(valueInput.value).toBe("20");
		expect(valueInput.hasAttribute("aria-invalid")).toBe(false);
		expect(errorEl.textContent).toBe("");
	});

	it("intercepts the 4-decimal cap at beforeinput (block keystroke, truncate paste)", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const valueInput = document.querySelector<HTMLInputElement>('.link-value[data-index="0"]');
		if (!valueInput) throw new Error("unreachable");

		// happy-dom does not run the native editing pipeline for beforeinput, so
		// these assert defaultPrevented (+ programmatic effects the handler
		// applies itself), never a value the browser would have inserted.
		const beforeinput = (init: InputEventInit) => {
			const ev = new InputEvent("beforeinput", { bubbles: true, cancelable: true, ...init });
			valueInput.dispatchEvent(ev);
			return ev;
		};

		// Typing a 5th fractional digit onto an at-cap value is blocked.
		valueInput.value = "1.2345";
		valueInput.setSelectionRange(6, 6);
		expect(beforeinput({ inputType: "insertText", data: "6" }).defaultPrevented).toBe(true);
		expect(valueInput.value).toBe("1.2345");

		// Typing the 4th fractional digit stays under the cap and is allowed.
		valueInput.value = "1.234";
		valueInput.setSelectionRange(5, 5);
		expect(beforeinput({ inputType: "insertText", data: "5" }).defaultPrevented).toBe(false);

		// Deletions carry no data and are never intercepted, even from an
		// over-precise legacy value.
		valueInput.value = "1.23456";
		valueInput.setSelectionRange(7, 7);
		expect(beforeinput({ inputType: "deleteContentBackward", data: null }).defaultPrevented).toBe(
			false,
		);

		// An over-precise paste is truncated (not rounded) to 4 fractional digits
		// and committed straight to state/storage.
		valueInput.value = "";
		valueInput.setSelectionRange(0, 0);
		expect(beforeinput({ inputType: "insertFromPaste", data: "1.23456789" }).defaultPrevented).toBe(
			true,
		);
		expect(valueInput.value).toBe("1.2345");
		// Caret lands at the end of the inserted region, clamped to the clip point.
		expect(valueInput.selectionStart).toBe(6);
		expect(valueInput.hasAttribute("aria-invalid")).toBe(false);
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").links[0].value).toBe(1.2345);

		// A paste replacing a mid-string selection exercises the
		// slice+data+slice splice non-degenerately, then truncates the
		// over-precise spliced result.
		valueInput.value = "12.3400";
		valueInput.setSelectionRange(5, 7);
		expect(beforeinput({ inputType: "insertFromPaste", data: "56789" }).defaultPrevented).toBe(
			true,
		);
		expect(valueInput.value).toBe("12.3456");
		expect(valueInput.selectionStart).toBe(7);
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").links[0].value).toBe(12.3456);

		// A truncated paste that still lands invalid is highlighted, not silently
		// dropped: the field shows the truncated text but state/storage stay put.
		valueInput.value = "";
		valueInput.setSelectionRange(0, 0);
		expect(beforeinput({ inputType: "insertFromPaste", data: "0.00001" }).defaultPrevented).toBe(
			true,
		);
		expect(valueInput.value).toBe("0.0000");
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").links[0].value).toBe(12.3456);

		// A garbage paste is not intercepted — it falls through to the input
		// handler's highlight path.
		valueInput.value = "";
		valueInput.setSelectionRange(0, 0);
		expect(beforeinput({ inputType: "insertFromPaste", data: "abc" }).defaultPrevented).toBe(false);
		valueInput.value = "abc";
		valueInput.dispatchEvent(new Event("input", { bubbles: true }));
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
	});

	it("Add link appends an unassigned row that stays inert until both endpoints are chosen", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(3);
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(3);

		const addLinkButton = document.querySelector<HTMLButtonElement>('[data-action="add-link"]');
		expect(addLinkButton).not.toBeNull();
		addLinkButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		// New row appended with both endpoints on the placeholder; the diagram is
		// unchanged because the row is incomplete.
		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(4);
		const source = () => document.querySelector<HTMLSelectElement>('.link-source[data-index="3"]');
		const target = () => document.querySelector<HTMLSelectElement>('.link-target[data-index="3"]');
		expect(source()?.value).toBe("");
		expect(target()?.value).toBe("");
		expect(source()?.querySelector('option[value=""]')?.textContent).toBe("— select —");
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(3);

		// The incomplete row is persisted end-to-end straight after the click.
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").links[3]).toEqual({
			source: null,
			target: null,
			value: 1,
		});

		// Choosing a source alone leaves the link incomplete — still no new flow.
		const chosenSource = source();
		if (!chosenSource) throw new Error("unreachable");
		chosenSource.value = "n1";
		chosenSource.dispatchEvent(new Event("change", { bubbles: true }));
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(3);

		// Choosing the target completes the link — the flow appears and persists.
		const chosenTarget = target();
		if (!chosenTarget) throw new Error("unreachable");
		chosenTarget.value = "n2";
		chosenTarget.dispatchEvent(new Event("change", { bubbles: true }));
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(4);

		const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
		expect(parsed.links[3]).toEqual({ source: "n1", target: "n2", value: 1 });

		// Un-assigning the source ("" → null) makes the row incomplete again —
		// the flow disappears and the null endpoint round-trips to storage.
		const clearedSource = source();
		if (!clearedSource) throw new Error("unreachable");
		clearedSource.value = "";
		clearedSource.dispatchEvent(new Event("change", { bubbles: true }));
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(3);
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").links[3].source).toBeNull();
	});

	it("imports a constructed file: replaces state, rebuilds editors and diagram, preserves theme", async () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		// Set a distinct current theme so import-preserves-theme is unambiguous.
		document
			.getElementById("theme-button")
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		document
			.querySelector('[data-action="set-theme"][data-value="light"]')
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const payload = {
			nodes: [
				{ id: "n1", name: "X" },
				{ id: "n2", name: "Y" },
				{ id: "n3", name: "Z" },
			],
			links: [
				{ source: "n1", target: "n2", value: 3 },
				{ source: "n2", target: "n3", value: 4 },
			],
			settings: {
				palette: "set2",
				linkColor: "static",
				alignment: "left",
				// A theme in the file must be ignored, not applied.
				theme: "dark",
			},
		};
		const file = new File([JSON.stringify(payload)], "sankey.json", { type: "application/json" });
		const input = document.getElementById("import-file") as HTMLInputElement;
		Object.defineProperty(input, "files", { value: [file], configurable: true, writable: true });
		input.dispatchEvent(new Event("change", { bubbles: true }));
		// Flush the async file.text() + parseImport chain.
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(document.querySelectorAll("#node-editor .node-row")).toHaveLength(3);
		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(2);
		expect(document.querySelectorAll("#diagram svg rect")).toHaveLength(3);
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(2);

		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
		expect(stored.nodes.map((n: { id: string }) => n.id)).toEqual(["n1", "n2", "n3"]);
		expect(stored.settings.palette).toBe("set2");
		expect(stored.settings.linkColor).toBe("static");
		// Theme stays the pre-import "light", NOT the file's "dark".
		expect(stored.settings.theme).toBe("light");
		// The toolbar's carousel preview and links button follow the import too (syncToolbar).
		expect(document.getElementById("palette-preview")?.getAttribute("aria-label")).toBe(
			"Palette: Set 2",
		);
		expect(document.getElementById("links-button")?.getAttribute("aria-label")).toBe(
			"Links: Neutral",
		);

		expect(document.getElementById("io-notice")?.textContent).toBe("Imported 3 nodes, 2 links.");

		// The import notice is one-shot: the next user action (here, a rename)
		// runs refresh(), which retires it.
		const nameInput = document.querySelector<HTMLInputElement>('.node-name[data-id="n1"]');
		if (!nameInput) throw new Error("unreachable");
		nameInput.value = "Renamed";
		nameInput.dispatchEvent(new Event("input", { bubbles: true }));
		expect(document.getElementById("io-notice")?.textContent).toBe("");
	});

	it("rejects a non-diagram file, leaving state and storage untouched, and shows the error", async () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const storedBefore = localStorage.getItem(STORAGE_KEY);
		const rectsBefore = document.querySelectorAll("#diagram svg rect").length;

		const file = new File(['{"totally":"unrelated"}'], "notes.json", { type: "application/json" });
		const input = document.getElementById("import-file") as HTMLInputElement;
		Object.defineProperty(input, "files", { value: [file], configurable: true, writable: true });
		input.dispatchEvent(new Event("change", { bubbles: true }));
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(document.getElementById("io-notice")?.textContent).toContain("diagram export");
		// Nothing changed: same storage payload, same diagram, same editor rows.
		expect(localStorage.getItem(STORAGE_KEY)).toBe(storedBefore);
		expect(document.querySelectorAll("#diagram svg rect")).toHaveLength(rectsBefore);
		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(3);
	});

	it("reports import repairs in the notice with the exact counts + adjustments format", async () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const payload = {
			nodes: [
				{ id: "n1", name: "A" },
				{ id: "n2", name: "B" },
			],
			// A dangling target is repaired to null (kept as an incomplete row).
			links: [{ source: "n1", target: "gone", value: 1 }],
			settings: {},
		};
		const file = new File([JSON.stringify(payload)], "sankey.json", { type: "application/json" });
		const input = document.getElementById("import-file") as HTMLInputElement;
		Object.defineProperty(input, "files", { value: [file], configurable: true, writable: true });
		input.dispatchEvent(new Event("change", { bubbles: true }));
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(document.getElementById("io-notice")?.textContent).toBe(
			"Imported 2 nodes, 1 links. Adjustments: link 1: unknown target — left unassigned.",
		);
	});

	it("exports the current diagram as a pretty-printed JSON blob download", async () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
		const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		const createElement = vi.spyOn(document, "createElement");

		// Capture mock data before mockRestore() below, which clears mock.calls.
		let blob: Blob | undefined;
		let createUrlCalls = 0;
		let revokedUrl: string | undefined;
		let downloadName: string | undefined;
		try {
			document
				.getElementById("export-button")
				?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
			// revoke is deferred via setTimeout(0) — let it fire before capturing.
			await new Promise((resolve) => setTimeout(resolve, 0));
		} finally {
			createUrlCalls = createObjectURL.mock.calls.length;
			blob = createObjectURL.mock.calls[0]?.[0] as Blob | undefined;
			revokedUrl = revokeObjectURL.mock.calls[0]?.[0] as string | undefined;
			downloadName = (
				createElement.mock.results
					.map((r) => r.value as HTMLElement)
					.find((el) => el.tagName === "A") as HTMLAnchorElement | undefined
			)?.download;
			createElement.mockRestore();
			createObjectURL.mockRestore();
			revokeObjectURL.mockRestore();
		}

		expect(createUrlCalls).toBe(1);
		expect(blob?.type).toBe("application/json");
		expect(JSON.parse(await (blob as Blob).text())).toEqual(
			JSON.parse(serializeState(defaultState())),
		);
		expect(downloadName).toBe("sankey.json");
		expect(revokedUrl).toBe("blob:fake");
	});

	it("announces a successful export via #io-notice", async () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
		const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		try {
			document
				.getElementById("export-button")
				?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
			await new Promise((resolve) => setTimeout(resolve, 0));
		} finally {
			createObjectURL.mockRestore();
			revokeObjectURL.mockRestore();
		}

		expect(document.getElementById("io-notice")?.textContent).toBe("Exported sankey.json.");
	});

	it("opens the diagram export dialog and moves focus into its format choices", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const trigger = document.getElementById("diagram-export-button");
		const dialog = document.getElementById("diagram-export-dialog") as HTMLDialogElement;
		expect(trigger).not.toBeNull();
		expect(dialog).toBeInstanceOf(HTMLDialogElement);
		expect(dialog.open).toBe(false);

		trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(dialog.open).toBe(true);
		expect(document.activeElement).toBe(dialog.querySelector('[data-action="export-svg"]'));
	});

	it("reports 'nothing to export' for SVG and closes the export dialog with focus restored", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		removeAllNodes();
		expect(document.querySelector("#diagram svg")).toBeNull();

		const trigger = document.getElementById("diagram-export-button");
		const dialog = document.getElementById("diagram-export-dialog") as HTMLDialogElement;
		trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		dialog
			.querySelector<HTMLElement>('[data-action="export-svg"]')
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(document.getElementById("io-notice")?.textContent).toBe(
			"Nothing to export — the diagram is empty.",
		);
		expect(dialog.open).toBe(false);
		expect(document.activeElement).toBe(trigger);
	});

	it("wires both wide and narrow export choices; empty PNG closes the Diagram dialog", () => {
		// Rasterization itself (Image/canvas) isn't exercisable under happy-dom —
		// this only proves the empty-diagram guard fires before any of that runs,
		// same as the SVG export's guard.
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		expect(document.querySelectorAll('[data-action="export-svg"]')).toHaveLength(2);
		expect(document.querySelectorAll('[data-action="export-png"]')).toHaveLength(2);

		removeAllNodes();
		expect(document.querySelector("#diagram svg")).toBeNull();

		const displayButton = document.getElementById("display-button");
		const displayDialog = document.getElementById("display-dialog") as HTMLDialogElement;
		displayButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		displayDialog
			.querySelector<HTMLElement>('[data-action="export-png"]')
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(document.getElementById("io-notice")?.textContent).toBe(
			"Nothing to export — the diagram is empty.",
		);
		expect(displayDialog.open).toBe(false);
		expect(document.activeElement).toBe(displayButton);
	});

	it("keyboard-reorders a node row: order, dropdowns, storage, and focus all follow", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const nodeNames = () =>
			Array.from(document.querySelectorAll<HTMLInputElement>("#node-editor .node-name")).map(
				(i) => i.value,
			);
		expect(nodeNames()).toEqual(["Coal", "Gas", "Electricity", "Homes"]);

		const handle = document.querySelector<HTMLButtonElement>(
			'#node-editor .drag-handle[data-id="n1"]',
		);
		if (!handle) throw new Error("unreachable");
		handle.focus();
		handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

		// Coal (n1) moved down one position.
		expect(nodeNames()).toEqual(["Gas", "Coal", "Electricity", "Homes"]);

		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
		expect(stored.nodes.map((n: { id: string }) => n.id)).toEqual(["n2", "n1", "n3", "n4"]);

		// Link dropdown option order follows the new node order.
		const firstSource = document.querySelector<HTMLSelectElement>("#link-editor .link-source");
		const options = Array.from(firstSource?.querySelectorAll("option.node-option") ?? []).map(
			(o) => o.textContent,
		);
		expect(options).toEqual(["Gas", "Coal", "Electricity", "Homes"]);

		// Focus is back on the moved row's handle, now at index 1.
		const moved = document.querySelector<HTMLButtonElement>(
			'#node-editor .drag-handle[data-id="n1"]',
		);
		expect(document.activeElement).toBe(moved);
		expect(moved?.getAttribute("data-index")).toBe("1");
	});

	it("keyboard-reorders a link row: order, storage, and focus all follow", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const linkValues = () =>
			Array.from(document.querySelectorAll<HTMLInputElement>("#link-editor .link-value")).map(
				(i) => i.value,
			);
		// Default links: n1->n3 (10), n2->n3 (6), n3->n4 (14).
		expect(linkValues()).toEqual(["10", "6", "14"]);

		const handle = document.querySelector<HTMLButtonElement>(
			'#link-editor .drag-handle[data-index="0"]',
		);
		if (!handle) throw new Error("unreachable");
		handle.focus();
		handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

		expect(linkValues()).toEqual(["6", "10", "14"]);

		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
		expect(stored.links.map((l: { value: number }) => l.value)).toEqual([6, 10, 14]);

		// Focus lands on the moved link's handle, now at index 1.
		const moved = document.querySelector<HTMLButtonElement>(
			'#link-editor .drag-handle[data-index="1"]',
		);
		expect(document.activeElement).toBe(moved);
	});

	// Pointer/touch dragging is now delegated to SortableJS (src/row-reorder.ts),
	// which happy-dom can construct but can't be driven through a realistic
	// pointer/touch gesture (no real layout, no native drag/touch pipeline) —
	// see VERIFICATION.md for what still needs a real browser. These tests
	// instead cover the wiring: a real Sortable instance is attached to each
	// rows container with the intended options, the two boxes can never share
	// a drop target, and invoking the registered onEnd (as Sortable itself
	// would once a real drag completes) commits the same state/DOM/storage
	// change the old pointer-drag tests asserted.
	it("wires a SortableJS instance onto each rows container with the shared drag options", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const nodeRows = document.querySelector<HTMLElement>("#node-editor .node-rows");
		const linkRows = document.querySelector<HTMLElement>("#link-editor .link-rows");
		if (!nodeRows || !linkRows) throw new Error("unreachable");

		const nodeSortable = Sortable.get(nodeRows);
		const linkSortable = Sortable.get(linkRows);
		if (!nodeSortable || !linkSortable) throw new Error("unreachable");

		for (const instance of [nodeSortable, linkSortable]) {
			expect(instance.options.handle).toBe(".drag-handle");
			expect(instance.options.animation).toBe(150);
			expect(instance.options.forceFallback).toBe(true);
			// touchStartThreshold only does anything alongside a delay (it cancels
			// a *delayed* drag start once the finger wanders too far) — delay is
			// touch-only so mouse dragging still starts immediately.
			expect(instance.options.delay).toBe(150);
			expect(instance.options.delayOnTouchOnly).toBe(true);
			expect(instance.options.touchStartThreshold).toBe(4);
			expect(instance.options.ghostClass).toBe("row-ghost");
			expect(instance.options.chosenClass).toBe("row-chosen");
			expect(instance.options.fallbackClass).toBe("row-fallback");
		}

		// Cross-box inertness: each box's Sortable group is named after its own
		// row class, so the two instances never share a group and a drag can
		// never be dropped from one box into the other. Sortable normalizes the
		// string `group` option it was given into a `{name, ...}` object on the
		// instance — cast to read that runtime shape back out (see global.d.ts).
		const groupName = (instance: Sortable) =>
			(instance.options.group as unknown as { name: string }).name;
		expect(groupName(nodeSortable)).toBe("node-row");
		expect(groupName(linkSortable)).toBe("link-row");
		expect(groupName(nodeSortable)).not.toBe(groupName(linkSortable));
	});

	it("committing a node row's Sortable onEnd reorders it: order, dropdowns, and storage all follow", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const nodeNames = () =>
			Array.from(document.querySelectorAll<HTMLInputElement>("#node-editor .node-name")).map(
				(i) => i.value,
			);
		expect(nodeNames()).toEqual(["Coal", "Gas", "Electricity", "Homes"]);

		const nodeRows = document.querySelector<HTMLElement>("#node-editor .node-rows");
		if (!nodeRows) throw new Error("unreachable");
		const onEnd = Sortable.get(nodeRows)?.options.onEnd;
		if (!onEnd) throw new Error("unreachable");

		// Sortable has already reordered the DOM by the time onEnd fires for a
		// real drag; the handler itself only needs the before/after indices, so
		// a synthetic event is enough to exercise the commit path in isolation.
		onEnd({ oldIndex: 0, newIndex: 2 });

		expect(nodeNames()).toEqual(["Gas", "Electricity", "Coal", "Homes"]);
		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
		expect(stored.nodes.map((n: { id: string }) => n.id)).toEqual(["n2", "n3", "n1", "n4"]);

		// The rebuild the move triggers replaces .node-rows wholesale, so the
		// old container's Sortable instance must not still be registered — the
		// no-leak guarantee attachRowSortable's destroy(previous) provides.
		expect(Sortable.get(nodeRows)).toBeNull();
	});

	it("committing a link row's Sortable onEnd reorders it: order and storage follow", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const linkValues = () =>
			Array.from(document.querySelectorAll<HTMLInputElement>("#link-editor .link-value")).map(
				(i) => i.value,
			);
		expect(linkValues()).toEqual(["10", "6", "14"]);

		const linkRows = document.querySelector<HTMLElement>("#link-editor .link-rows");
		if (!linkRows) throw new Error("unreachable");
		const onEnd = Sortable.get(linkRows)?.options.onEnd;
		if (!onEnd) throw new Error("unreachable");

		onEnd({ oldIndex: 0, newIndex: 1 });

		expect(linkValues()).toEqual(["6", "10", "14"]);
		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
		expect(stored.links.map((l: { value: number }) => l.value)).toEqual([6, 10, 14]);
	});

	it("a cloned row keeps its select/input values (Sortable's drag ghost is a cloneNode)", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		// Sortable builds the floating drag ghost via cloneNode, which copies
		// attributes but not live properties — selection/value state must
		// therefore live in attributes or the ghost degrades to placeholders.
		const linkRow = document.querySelector<HTMLElement>("#link-editor .link-row");
		const nodeRow = document.querySelector<HTMLElement>("#node-editor .node-row");
		if (!linkRow || !nodeRow) throw new Error("unreachable");
		const source = linkRow.querySelector<HTMLSelectElement>(".link-source");
		const target = linkRow.querySelector<HTMLSelectElement>(".link-target");
		const value = linkRow.querySelector<HTMLInputElement>(".link-value");
		if (!source || !target || !value) throw new Error("unreachable");
		expect(source.value).not.toBe("");

		const linkClone = linkRow.cloneNode(true) as HTMLElement;
		expect(linkClone.querySelector<HTMLSelectElement>(".link-source")?.value).toBe(source.value);
		expect(linkClone.querySelector<HTMLSelectElement>(".link-target")?.value).toBe(target.value);
		expect(linkClone.querySelector<HTMLInputElement>(".link-value")?.value).toBe(value.value);

		const nodeClone = nodeRow.cloneNode(true) as HTMLElement;
		expect(nodeClone.querySelector<HTMLInputElement>(".node-name")?.value).toBe(
			nodeRow.querySelector<HTMLInputElement>(".node-name")?.value,
		);

		// Value edits skip the row rebuild (focus preservation), so the attribute
		// mirror in commitLinkValue must keep later clones truthful too.
		value.value = "42";
		value.dispatchEvent(new Event("input", { bubbles: true }));
		const cloneAfterEdit = linkRow.cloneNode(true) as HTMLElement;
		expect(cloneAfterEdit.querySelector<HTMLInputElement>(".link-value")?.value).toBe("42");
	});

	it("the onEnd no-op guard: a same-index or indexless event moves nothing", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const nodeNames = () =>
			Array.from(document.querySelectorAll<HTMLInputElement>("#node-editor .node-name")).map(
				(i) => i.value,
			);
		const nodeRows = document.querySelector<HTMLElement>("#node-editor .node-rows");
		if (!nodeRows) throw new Error("unreachable");
		const instance = Sortable.get(nodeRows);
		const onEnd = instance?.options.onEnd;
		if (!onEnd) throw new Error("unreachable");

		onEnd({ oldIndex: 1, newIndex: 1 });
		onEnd({});
		onEnd({ oldIndex: 1 });
		onEnd({ newIndex: 1 });

		expect(nodeNames()).toEqual(["Coal", "Gas", "Electricity", "Homes"]);
		// Still the same instance on the same container — none of the no-op
		// calls triggered config.move (and therefore no rebuild).
		expect(Sortable.get(nodeRows)).toBe(instance);
	});

	it("rebuilding the node editor destroys the previous Sortable instance rather than leaking it", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const before = document.querySelector<HTMLElement>("#node-editor .node-rows");
		if (!before) throw new Error("unreachable");
		expect(Sortable.get(before)).toBeTruthy();

		// add-node rebuilds the node editor (renderNodeEditor replaces
		// .node-rows wholesale), which is the case attachRowSortable's
		// destroy(previous) exists to handle.
		document
			.querySelector<HTMLButtonElement>('[data-action="add-node"]')
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(Sortable.get(before)).toBeNull();
		const after = document.querySelector<HTMLElement>("#node-editor .node-rows");
		if (!after) throw new Error("unreachable");
		expect(after).not.toBe(before);
		expect(Sortable.get(after)).toBeTruthy();
	});

	it("boundary keyboard move is a no-op (ArrowUp on the first node row)", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const nodeNames = () =>
			Array.from(document.querySelectorAll<HTMLInputElement>("#node-editor .node-name")).map(
				(i) => i.value,
			);
		expect(nodeNames()).toEqual(["Coal", "Gas", "Electricity", "Homes"]);

		const handle = document.querySelector<HTMLButtonElement>(
			'#node-editor .drag-handle[data-id="n1"]',
		);
		if (!handle) throw new Error("unreachable");
		handle.focus();
		handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));

		// Already at the top: order unchanged and focus stays put.
		expect(nodeNames()).toEqual(["Coal", "Gas", "Electricity", "Homes"]);
		expect(document.activeElement).toBe(handle);
	});

	it("surfaces a storage notice on save failure and clears it once saves recover", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const notice = () => document.getElementById("storage-notice")?.textContent;
		expect(notice()).toBe("");

		const addNodeButton = document.querySelector<HTMLButtonElement>('[data-action="add-node"]');
		expect(addNodeButton).not.toBeNull();

		// happy-dom's Storage binds each method onto an internal target the
		// first time it's accessed (see happy-dom's ClassMethodBinder), and by
		// this point the earlier tests in this file have already forced that —
		// so `vi.spyOn(Storage.prototype, "setItem")` silently stops taking
		// effect. Swapping the whole `localStorage` global for a throwing stub
		// sidesteps that caching rather than fighting it.
		const originalLocalStorage = localStorage;
		const throwingStorage: Partial<Storage> = {
			setItem: () => {
				throw new Error("QuotaExceededError");
			},
		};
		Object.defineProperty(globalThis, "localStorage", {
			value: throwingStorage,
			configurable: true,
			writable: true,
		});
		try {
			addNodeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
			expect(notice()).toBe(STORAGE_NOTICE);
		} finally {
			Object.defineProperty(globalThis, "localStorage", {
				value: originalLocalStorage,
				configurable: true,
				writable: true,
			});
		}

		// The failed save above still rebuilt the node editor (editors rebuild
		// regardless of validity), which tore down and recreated the button —
		// re-query rather than reuse the now-detached reference.
		const addNodeButtonAfterFailure = document.querySelector<HTMLButtonElement>(
			'[data-action="add-node"]',
		);
		addNodeButtonAfterFailure?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(notice()).toBe("");
	});
});
