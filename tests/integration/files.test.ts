// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { startApp } from "../../src/app/start-app";
import { serializeState } from "../../src/features/files/diagram-file";
import { defaultState } from "../../src/model/graph";
import { STORAGE_KEY } from "../../src/platform/storage";
import {
	click,
	fireChange,
	fireInput,
	getStoredState,
	installMarkup,
	mountApp,
	requireElement,
	tick,
} from "../helpers/mount-app";

function removeAllNodes(): void {
	// Query fresh each time: deleting a node rebuilds the editor rows wholesale,
	// detaching any earlier button reference from the document.
	let deleteButton = document.querySelector<HTMLButtonElement>('[data-action="delete-node"]');
	while (deleteButton) {
		click(deleteButton);
		deleteButton = document.querySelector<HTMLButtonElement>('[data-action="delete-node"]');
	}
}

/**
 * A File whose text() resolves only when the returned resolver is called —
 * `File.text()` isn't natively cancellable/controllable, so this shadows the
 * instance method to drive destroy/reboot races against the pending read by
 * hand.
 */
function deferredFile(): { file: File; resolveText: (text: string) => void } {
	let resolveText: (text: string) => void = () => {};
	const textPromise = new Promise<string>((resolve) => {
		resolveText = resolve;
	});
	const file = new File([""], "sankey.json", { type: "application/json" });
	Object.defineProperty(file, "text", { value: () => textPromise });
	return { file, resolveText };
}

function selectFile(input: HTMLInputElement, file: File): void {
	Object.defineProperty(input, "files", { value: [file], configurable: true, writable: true });
}

describe("import & export", () => {
	it("imports a constructed file: replaces state, rebuilds editors and diagram, preserves theme", async () => {
		mountApp();

		// Set a distinct current theme so import-preserves-theme is unambiguous.
		click(document.getElementById("theme-button"));
		click(document.querySelector('[data-action="set-theme"][data-value="light"]'));

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
		fireChange(input);
		// Flush the async file.text() + parseImport chain.
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(document.querySelectorAll("#node-editor .node-row")).toHaveLength(3);
		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(2);
		expect(document.querySelectorAll("#diagram svg rect")).toHaveLength(3);
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(2);

		const stored = getStoredState();
		expect(stored.nodes.map((n: { id: string }) => n.id)).toEqual(["n1", "n2", "n3"]);
		expect(stored.settings.palette).toBe("set2");
		expect(stored.settings.linkColor).toBe("static");
		// Theme stays the pre-import "light", NOT the file's "dark".
		expect(stored.settings.theme).toBe("light");
		// DiagramPanel's carousel preview and links button follow the import too (both re-render from refresh()).
		expect(document.getElementById("palette-preview")?.getAttribute("aria-label")).toBe(
			"Palette: Set 2",
		);
		expect(document.getElementById("links-button")?.getAttribute("aria-label")).toBe(
			"Links: Neutral",
		);

		// Import without repairs isn't announced — the changed data is
		// sufficient feedback.
		expect(document.getElementById("io-notice")?.textContent).toBe("");
	});

	it("import notice: a repair warning is not cleared by an invalid or empty link-value draft, only by the next committed action", async () => {
		mountApp();

		const payload = {
			nodes: [
				{ id: "n1", name: "X" },
				{ id: "n2", name: "Y" },
			],
			// A dangling target is repaired to null, which installs the warning
			// this test needs — a plain, repair-free import (see the test above)
			// installs no notice at all to seed from.
			links: [{ source: "n1", target: "gone", value: 3 }],
			settings: {},
		};
		const file = new File([JSON.stringify(payload)], "sankey.json", { type: "application/json" });
		const input = document.getElementById("import-file") as HTMLInputElement;
		Object.defineProperty(input, "files", { value: [file], configurable: true, writable: true });
		fireChange(input);
		await new Promise((resolve) => setTimeout(resolve, 0));

		const notice = () => document.getElementById("io-notice")?.textContent;
		const repairMessage =
			"Imported 2 nodes, 1 links. Adjustments: link 1: unknown target — left unassigned.";
		expect(notice()).toBe(repairMessage);
		// A repair warning's tone is always "warning".
		expect(document.getElementById("io-notice")?.className).toBe("notice-warning");

		// An invalid or empty draft never reaches actions.updateLinkValue (see
		// link-row.tsx's commitDraft), so refresh() — and its unconditional
		// #io-notice clear — never runs; the import notice must stand.
		const valueInput = requireElement<HTMLInputElement>('.link-value[data-index="0"]');
		valueInput.value = "abc";
		fireInput(valueInput);
		expect(notice()).toBe(repairMessage);

		valueInput.value = "";
		fireInput(valueInput);
		expect(notice()).toBe(repairMessage);

		// The import notice is one-shot: the next committed action (here, a
		// rename) runs refresh(), which retires it.
		const nameInput = requireElement<HTMLInputElement>('.node-name[data-id="n1"]');
		nameInput.value = "Renamed";
		fireInput(nameInput);
		expect(notice()).toBe("");
	});

	it("import over a row holding an invalid draft shows the imported value with no error (rows remount because ids are fresh)", async () => {
		mountApp();

		const valueInput = requireElement<HTMLInputElement>('.link-value[data-index="0"]');
		valueInput.value = "abc";
		fireInput(valueInput);
		await tick();
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");

		const payload = {
			nodes: [
				{ id: "n1", name: "X" },
				{ id: "n2", name: "Y" },
			],
			links: [{ source: "n1", target: "n2", value: 7 }],
			settings: {},
		};
		const file = new File([JSON.stringify(payload)], "sankey.json", { type: "application/json" });
		const input = document.getElementById("import-file") as HTMLInputElement;
		Object.defineProperty(input, "files", { value: [file], configurable: true, writable: true });
		fireChange(input);
		await new Promise((resolve) => setTimeout(resolve, 0));

		const importedValueInput = requireElement<HTMLInputElement>('.link-value[data-index="0"]');
		expect(importedValueInput.hasAttribute("aria-invalid")).toBe(false);
		expect(importedValueInput.value).toBe("7");
	});

	it("rejects a non-diagram file, leaving state and storage untouched, and shows the error", async () => {
		mountApp();

		const storedBefore = localStorage.getItem(STORAGE_KEY);
		const rectsBefore = document.querySelectorAll("#diagram svg rect").length;

		const file = new File(['{"totally":"unrelated"}'], "notes.json", { type: "application/json" });
		const input = document.getElementById("import-file") as HTMLInputElement;
		Object.defineProperty(input, "files", { value: [file], configurable: true, writable: true });
		fireChange(input);
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(document.getElementById("io-notice")?.textContent).toContain("diagram export");
		// An import/export failure's tone is always "error".
		expect(document.getElementById("io-notice")?.className).toBe("notice-error");
		// Nothing changed: same storage payload, same diagram, same editor rows.
		expect(localStorage.getItem(STORAGE_KEY)).toBe(storedBefore);
		expect(document.querySelectorAll("#diagram svg rect")).toHaveLength(rectsBefore);
		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(3);
	});

	it("reports import repairs in the notice with the exact counts + adjustments format", async () => {
		mountApp();

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
		fireChange(input);
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(document.getElementById("io-notice")?.textContent).toBe(
			"Imported 2 nodes, 1 links. Adjustments: link 1: unknown target — left unassigned.",
		);
	});

	it("imports a topologically-invalid file (a cycle): state is replaced and saved, the graph notice shows the cycle message, the previous diagram stays rendered, and the io notice still reports the import", async () => {
		mountApp();

		const svgBefore = document.querySelector("#diagram svg");
		expect(svgBefore).not.toBeNull();

		const payload = {
			nodes: [
				{ id: "n1", name: "A" },
				{ id: "n2", name: "B" },
			],
			// n1 -> n2 -> n1 closes a 2-node cycle. link 1's negative value also
			// needs a repair, so the io notice has something to report alongside
			// the graph error.
			links: [
				{ source: "n1", target: "n2", value: -3 },
				{ source: "n2", target: "n1", value: 2 },
			],
			settings: {},
		};
		const file = new File([JSON.stringify(payload)], "sankey.json", { type: "application/json" });
		const input = document.getElementById("import-file") as HTMLInputElement;
		Object.defineProperty(input, "files", { value: [file], configurable: true, writable: true });
		fireChange(input);
		await new Promise((resolve) => setTimeout(resolve, 0));

		// State is replaced and saved regardless of validity — there is no
		// "last-good state" in storage, only the last-good diagram.
		const stored = getStoredState();
		expect(stored.nodes.map((n: { id: string }) => n.id)).toEqual(["n1", "n2"]);
		expect(
			stored.links.map((l: { source: string; target: string }) => [l.source, l.target]),
		).toEqual([
			["n1", "n2"],
			["n2", "n1"],
		]);

		expect(document.getElementById("error")?.textContent).toContain("cycle");

		// refresh() bails before renderDiagram on an invalid graph, so the
		// previously rendered diagram is untouched.
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);

		expect(document.getElementById("io-notice")?.textContent).toBe(
			"Imported 2 nodes, 2 links. Adjustments: link 1: invalid value — set to 1.",
		);
	});

	it("exports the current diagram as a pretty-printed JSON blob download", async () => {
		mountApp();

		const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
		const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		const createElement = vi.spyOn(document, "createElement");

		// Capture mock data before mockRestore() below, which clears mock.calls.
		let blob: Blob | undefined;
		let createUrlCalls = 0;
		let revokedUrl: string | undefined;
		let downloadName: string | undefined;
		try {
			click(document.getElementById("export-button"));
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

	it("shows no notice for a successful export — the download itself is sufficient feedback", async () => {
		mountApp();

		const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
		const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		try {
			click(document.getElementById("export-button"));
			await new Promise((resolve) => setTimeout(resolve, 0));
		} finally {
			createObjectURL.mockRestore();
			revokeObjectURL.mockRestore();
		}

		expect(document.getElementById("io-notice")?.textContent).toBe("");
	});

	it("starting a new export clears a prior io notice", async () => {
		mountApp();

		// Seed #io-notice with an import failure — a failed import reports
		// directly, without going through refresh(), so nothing else has
		// cleared it yet.
		const file = new File(['{"totally":"unrelated"}'], "notes.json", { type: "application/json" });
		const input = document.getElementById("import-file") as HTMLInputElement;
		Object.defineProperty(input, "files", { value: [file], configurable: true, writable: true });
		fireChange(input);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(document.getElementById("io-notice")?.textContent).toContain("diagram export");

		const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
		const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		try {
			click(document.getElementById("export-button"));
			await new Promise((resolve) => setTimeout(resolve, 0));
		} finally {
			createObjectURL.mockRestore();
			revokeObjectURL.mockRestore();
		}

		expect(document.getElementById("io-notice")?.textContent).toBe("");
	});

	it("a successful export retry after a failure leaves the io slot empty, not a success message", async () => {
		mountApp();

		removeAllNodes();
		const trigger = document.getElementById("diagram-export-button");
		const dialog = document.getElementById("diagram-export-dialog") as HTMLDialogElement;
		click(trigger);
		click(dialog.querySelector('[data-action="export-svg"]'));
		expect(document.getElementById("io-notice")?.textContent).toBe(
			"Nothing to export — the diagram is empty.",
		);

		// Restore a valid, exportable diagram via import (a complete link, so
		// renderDiagram draws an svg — a linkless graph draws none).
		const payload = {
			nodes: [
				{ id: "n1", name: "X" },
				{ id: "n2", name: "Y" },
			],
			links: [{ source: "n1", target: "n2", value: 1 }],
			settings: {},
		};
		const file = new File([JSON.stringify(payload)], "sankey.json", { type: "application/json" });
		const input = document.getElementById("import-file") as HTMLInputElement;
		Object.defineProperty(input, "files", { value: [file], configurable: true, writable: true });
		fireChange(input);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(document.querySelector("#diagram svg")).not.toBeNull();

		click(document.getElementById("diagram-export-button"));
		click(dialog.querySelector('[data-action="export-svg"]'));

		expect(document.getElementById("io-notice")?.textContent).toBe("");
	});

	it("opens the diagram export dialog and moves focus into its format choices", () => {
		mountApp();

		const trigger = document.getElementById("diagram-export-button");
		const dialog = document.getElementById("diagram-export-dialog") as HTMLDialogElement;
		expect(trigger).not.toBeNull();
		expect(dialog).toBeInstanceOf(HTMLDialogElement);
		expect(dialog.open).toBe(false);

		click(trigger);

		expect(dialog.open).toBe(true);
		expect(document.activeElement).toBe(dialog.querySelector('[data-action="export-svg"]'));
	});

	it("reports 'nothing to export' for SVG and closes the export dialog with focus restored", () => {
		mountApp();

		removeAllNodes();
		expect(document.querySelector("#diagram svg")).toBeNull();

		const trigger = document.getElementById("diagram-export-button");
		const dialog = document.getElementById("diagram-export-dialog") as HTMLDialogElement;
		click(trigger);
		click(dialog.querySelector('[data-action="export-svg"]'));

		expect(document.getElementById("io-notice")?.textContent).toBe(
			"Nothing to export — the diagram is empty.",
		);
		expect(dialog.open).toBe(false);
		expect(document.activeElement).toBe(trigger);
	});

	it("SVG-exports the visible last-valid diagram while the current graph is invalid", async () => {
		mountApp();

		const rectsBefore = document.querySelectorAll("#diagram svg rect").length;
		expect(rectsBefore).toBeGreaterThan(0);

		// Retargeting the third link to n1 closes a 2-node cycle.
		const cycleTarget = requireElement<HTMLSelectElement>('.link-target[data-index="2"]');
		cycleTarget.value = "n1";
		fireChange(cycleTarget);
		expect(document.getElementById("error")?.textContent).toContain("cycle");

		// A second committed edit while still invalid: state changes (n1's name),
		// but the graph stays invalid, so the on-screen svg — and therefore the
		// export below — must keep showing the OLD label. Node count doesn't
		// change (rectsBefore alone can't tell stale from fresh), so this label
		// swap is the real discriminator for "export what you see".
		const nameInput = requireElement<HTMLInputElement>('.node-name[data-id="n1"]');
		const oldName = nameInput.value;
		nameInput.value = "Renamed For Export Test";
		fireInput(nameInput);
		expect(document.getElementById("error")?.textContent).toContain("cycle");

		const createObjectURL = vi.spyOn(URL, "createObjectURL");
		const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		let blob: Blob | undefined;
		createObjectURL.mockImplementation((b) => {
			blob = b as Blob;
			return "blob:fake";
		});
		try {
			const trigger = document.getElementById("diagram-export-button");
			const dialog = document.getElementById("diagram-export-dialog") as HTMLDialogElement;
			click(trigger);
			click(dialog.querySelector('[data-action="export-svg"]'));
		} finally {
			createObjectURL.mockRestore();
			revokeObjectURL.mockRestore();
		}

		expect(blob).toBeDefined();
		const svgText = await (blob as Blob).text();
		// +1: serializeDiagramSvg adds one opaque background rect ahead of the
		// node rects, not itself a node.
		expect((svgText.match(/<rect/g) ?? []).length).toBe(rectsBefore + 1);
		expect(svgText).toContain(oldName);
		expect(svgText).not.toContain("Renamed For Export Test");
		// A successful export installs no visible notice — the download itself
		// is the feedback.
		expect(document.getElementById("io-notice")?.textContent).toBe("");
	});

	it("wires both wide and narrow export choices; empty PNG closes the Diagram dialog", () => {
		// Rasterization itself (Image/canvas) isn't exercisable under happy-dom —
		// this only proves the empty-diagram guard fires before any of that runs,
		// same as the SVG export's guard.
		mountApp();

		expect(document.querySelectorAll('[data-action="export-svg"]')).toHaveLength(2);
		expect(document.querySelectorAll('[data-action="export-png"]')).toHaveLength(2);

		removeAllNodes();
		expect(document.querySelector("#diagram svg")).toBeNull();

		const displayButton = document.getElementById("display-button");
		const displayDialog = document.getElementById("display-dialog") as HTMLDialogElement;
		click(displayButton);
		click(displayDialog.querySelector('[data-action="export-png"]'));

		expect(document.getElementById("io-notice")?.textContent).toBe(
			"Nothing to export — the diagram is empty.",
		);
		expect(displayDialog.open).toBe(false);
		expect(document.activeElement).toBe(displayButton);
	});

	it("destroy mid-file-read: the eventual completion publishes no notice and mutates nothing", async () => {
		const { app } = mountApp();
		const storedBefore = localStorage.getItem(STORAGE_KEY);

		const { file, resolveText } = deferredFile();
		const input = document.getElementById("import-file") as HTMLInputElement;
		selectFile(input, file);
		fireChange(input);

		app.destroy();
		// Unmounts the whole App tree, including the notice region — nothing
		// left to publish a stale notice into.
		expect(document.getElementById("io-notice")).toBeNull();
		resolveText(
			JSON.stringify({
				nodes: [{ id: "n1", name: "Stale" }],
				links: [],
				settings: {},
			}),
		);
		// Flush the guarded file.text()-then-parseImport chain (same wait files.test.ts's
		// other import tests use) before asserting on its absent effects.
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(document.getElementById("io-notice")).toBeNull();
		expect(localStorage.getItem(STORAGE_KEY)).toBe(storedBefore);
	});

	it("destroy then reboot: a file read pending at destroy cannot publish into the new instance", async () => {
		installMarkup();
		const first = startApp(document);

		const { file, resolveText } = deferredFile();
		const input = document.getElementById("import-file") as HTMLInputElement;
		selectFile(input, file);
		fireChange(input);

		first.destroy();
		const second = startApp(document);
		try {
			const rowsBefore = document.querySelectorAll("#node-editor .node-row").length;
			const storedBefore = localStorage.getItem(STORAGE_KEY);

			resolveText(
				JSON.stringify({
					nodes: [{ id: "n1", name: "Stale" }],
					links: [],
					settings: {},
				}),
			);
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(document.querySelectorAll("#node-editor .node-row")).toHaveLength(rowsBefore);
			expect(document.getElementById("io-notice")?.textContent).toBe("");
			expect(localStorage.getItem(STORAGE_KEY)).toBe(storedBefore);
		} finally {
			second.destroy();
		}
	});
});
