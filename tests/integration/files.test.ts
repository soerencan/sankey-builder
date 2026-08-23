// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { serializeState } from "../../src/features/files/diagram-file";
import { defaultState } from "../../src/model/graph";
import { STORAGE_KEY } from "../../src/platform/storage";
import {
	click,
	fireChange,
	fireInput,
	getStoredState,
	mountApp,
	requireElement,
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
		const nameInput = requireElement<HTMLInputElement>('.node-name[data-id="n1"]');
		nameInput.value = "Renamed";
		fireInput(nameInput);
		expect(document.getElementById("io-notice")?.textContent).toBe("");
	});

	it("import notice: not cleared by an invalid or empty link-value draft, only by the next committed action", async () => {
		mountApp();

		const payload = {
			nodes: [
				{ id: "n1", name: "X" },
				{ id: "n2", name: "Y" },
			],
			links: [{ source: "n1", target: "n2", value: 3 }],
			settings: {},
		};
		const file = new File([JSON.stringify(payload)], "sankey.json", { type: "application/json" });
		const input = document.getElementById("import-file") as HTMLInputElement;
		Object.defineProperty(input, "files", { value: [file], configurable: true, writable: true });
		fireChange(input);
		await new Promise((resolve) => setTimeout(resolve, 0));

		const notice = () => document.getElementById("io-notice")?.textContent;
		expect(notice()).toBe("Imported 2 nodes, 1 links.");

		// An invalid or empty draft never reaches actions.updateLinkValue (see
		// commitLinkValue in link-editor.ts), so refresh() — and its
		// unconditional #io-notice clear — never runs; the import notice must
		// stand, unlike the committed rename in the test above.
		const valueInput = requireElement<HTMLInputElement>('.link-value[data-index="0"]');
		valueInput.value = "abc";
		fireInput(valueInput);
		expect(notice()).toBe("Imported 2 nodes, 1 links.");

		valueInput.value = "";
		fireInput(valueInput);
		expect(notice()).toBe("Imported 2 nodes, 1 links.");
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

	it("announces a successful export via #io-notice", async () => {
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

		expect(document.getElementById("io-notice")?.textContent).toBe("Exported sankey.json.");
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
});
