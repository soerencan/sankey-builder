// @vitest-environment happy-dom

import { render } from "preact";
import { describe, expect, it, vi } from "vitest";
import { startApp } from "../../src/app/start-app";
import { serializeState } from "../../src/features/files/diagram-file";
import { defaultState } from "../../src/model/graph";
import { STORAGE_KEY } from "../../src/platform/storage";
import {
	accessibleName,
	allByRole,
	byRole,
	click,
	fireChange,
	fireInput,
	getStoredState,
	installMarkup,
	mountApp,
	requireElement,
	settle,
	tick,
} from "../helpers/mount-app";

// Wrapping rather than replacing render() lets a test count renders without
// changing what reaches the DOM.
vi.mock("preact", async (importOriginal) => {
	const actual = await importOriginal<typeof import("preact")>();
	return { ...actual, render: vi.fn(actual.render) };
});

/** Scoped to #node-editor so it can't match a link row's "Delete link N". */
function anyDeleteNodeButton(): HTMLButtonElement | undefined {
	const nodeEditor = document.getElementById("node-editor") as HTMLElement;
	return allByRole<HTMLButtonElement>(nodeEditor, "button").find((button) =>
		accessibleName(button).startsWith("Delete "),
	);
}

function removeAllNodes(): void {
	// Queried fresh each time: the deleted row's button is detached.
	let deleteButton = anyDeleteNodeButton();
	while (deleteButton) {
		click(deleteButton);
		deleteButton = anyDeleteNodeButton();
	}
}

/** A File whose text() resolves only on demand, to drive destroy/reboot races against the pending read. */
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

		// A non-default theme so "preserved" is unambiguous.
		click(document.getElementById("theme-button"));
		const themeDialog = document.getElementById("theme-dialog") as HTMLDialogElement;
		click(byRole(themeDialog, "button", "Light"));

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
		// clearIoNotice() has already rendered synchronously; only the import's
		// own commit() should count.
		vi.mocked(render).mockClear();
		await settle();

		// Diagram, notices, and theme land in one render.
		expect(render).toHaveBeenCalledTimes(1);

		expect(document.querySelectorAll("#node-editor .node-row")).toHaveLength(3);
		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(2);
		expect(document.querySelectorAll("#diagram svg rect")).toHaveLength(3);
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(2);

		const stored = getStoredState();
		expect(stored.nodes.map((n: { id: string }) => n.id)).toEqual(["n1", "n2", "n3"]);
		expect(stored.settings.palette).toBe("set2");
		expect(stored.settings.linkColor).toBe("static");
		expect(stored.settings.theme).toBe("light");
		expect(document.getElementById("palette-preview")?.getAttribute("aria-label")).toBe(
			"Palette: Set 2",
		);
		expect(byRole<HTMLSelectElement>(document, "combobox", "Link colors").value).toBe("static");

		// An import without repairs isn't announced; the changed data is the
		// feedback.
		expect(document.getElementById("io-notice")?.textContent).toBe("");
	});

	it("import notice: a repair warning is not cleared by an invalid or empty link-value draft, only by the next committed action", async () => {
		mountApp();

		const payload = {
			nodes: [
				{ id: "n1", name: "X" },
				{ id: "n2", name: "Y" },
			],
			// The dangling target's repair installs the warning this test needs.
			links: [{ source: "n1", target: "gone", value: 3 }],
			settings: {},
		};
		const file = new File([JSON.stringify(payload)], "sankey.json", { type: "application/json" });
		const input = document.getElementById("import-file") as HTMLInputElement;
		Object.defineProperty(input, "files", { value: [file], configurable: true, writable: true });
		fireChange(input);
		await settle();

		const notice = () => document.getElementById("io-notice")?.textContent;
		const repairMessage =
			"Imported 2 nodes, 1 links. Adjustments: link 1: unknown target — left unassigned.";
		expect(notice()).toBe(repairMessage);
		expect(document.getElementById("io-notice")?.className).toBe("notice-warning");

		// An invalid draft never commits, so it must not clear the notice.
		const valueInput = byRole<HTMLInputElement>(document, "textbox", "Value for link 1");
		valueInput.value = "abc";
		fireInput(valueInput);
		expect(notice()).toBe(repairMessage);

		valueInput.value = "";
		fireInput(valueInput);
		expect(notice()).toBe(repairMessage);

		// The notice is one-shot: the next committed action retires it.
		const nameInput = byRole<HTMLInputElement>(document, "textbox", "Name for X");
		nameInput.value = "Renamed";
		fireInput(nameInput);
		expect(notice()).toBe("");
	});

	it("import over a row holding an invalid draft shows the imported value with no error (rows remount because ids are fresh)", async () => {
		mountApp();

		const valueInput = byRole<HTMLInputElement>(document, "textbox", "Value for link 1");
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
		await settle();

		const importedValueInput = byRole<HTMLInputElement>(document, "textbox", "Value for link 1");
		expect(importedValueInput.hasAttribute("aria-invalid")).toBe(false);
		expect(importedValueInput.value).toBe("7");
	});

	it("rejects a non-diagram file, leaving state and storage untouched, and shows the error", async () => {
		mountApp();

		// State is unchanged either way, so a stray persist would write the
		// same bytes; only the call itself is evidence.
		const setItem = vi.spyOn(localStorage, "setItem");
		const rectsBefore = document.querySelectorAll("#diagram svg rect").length;

		const file = new File(['{"totally":"unrelated"}'], "notes.json", { type: "application/json" });
		const input = document.getElementById("import-file") as HTMLInputElement;
		Object.defineProperty(input, "files", { value: [file], configurable: true, writable: true });
		fireChange(input);
		await settle();

		expect(document.getElementById("io-notice")?.textContent).toContain("diagram export");
		expect(document.getElementById("io-notice")?.className).toBe("notice-error");
		expect(setItem).not.toHaveBeenCalled();
		setItem.mockRestore();
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
			links: [{ source: "n1", target: "gone", value: 1 }],
			settings: {},
		};
		const file = new File([JSON.stringify(payload)], "sankey.json", { type: "application/json" });
		const input = document.getElementById("import-file") as HTMLInputElement;
		Object.defineProperty(input, "files", { value: [file], configurable: true, writable: true });
		fireChange(input);
		// clearIoNotice() has already rendered synchronously; only the import's
		// own commit() should count.
		vi.mocked(render).mockClear();
		await settle();

		// Diagram and repair notice land in one render.
		expect(render).toHaveBeenCalledTimes(1);
		expect(document.getElementById("io-notice")?.textContent).toBe(
			"Imported 2 nodes, 1 links. Adjustments: link 1: unknown target — left unassigned.",
		);
	});

	it("imports a topologically-invalid file (a cycle): state is replaced and saved, the graph notice shows the cycle message, the previous diagram stays rendered, and the io notice still reports the import", async () => {
		mountApp();

		const svgBefore = document.querySelector("#diagram svg");
		expect(svgBefore).not.toBeNull();
		const svgHtmlBefore = svgBefore?.outerHTML;

		const payload = {
			nodes: [
				{ id: "n1", name: "A" },
				{ id: "n2", name: "B" },
			],
			// A cycle plus a repairable value, so both notices have content.
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
		await settle();

		// There is no "last-good state" in storage, only a last-good diagram.
		const stored = getStoredState();
		expect(stored.nodes.map((n: { id: string }) => n.id)).toEqual(["n1", "n2"]);
		expect(
			stored.links.map((l: { source: string; target: string }) => [l.source, l.target]),
		).toEqual([
			["n1", "n2"],
			["n2", "n1"],
		]);

		expect(document.getElementById("error")?.textContent).toContain("cycle");

		// Identity alone can't tell no redraw from an identical one; markup can.
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);
		expect(document.querySelector("#diagram svg")?.outerHTML).toBe(svgHtmlBefore);

		expect(document.getElementById("io-notice")?.textContent).toBe(
			"Imported 2 nodes, 2 links. Adjustments: link 1: invalid value — set to 1.",
		);
	});

	it("exports the current diagram as a pretty-printed JSON blob download", async () => {
		mountApp();

		const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
		const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		const createElement = vi.spyOn(document, "createElement");

		// mockRestore() clears mock.calls, so capture first.
		let blob: Blob | undefined;
		let createUrlCalls = 0;
		let revokedUrl: string | undefined;
		let downloadName: string | undefined;
		try {
			click(document.getElementById("export-button"));
			// download() defers the revoke to a macrotask.
			await settle();
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
			await settle();
		} finally {
			createObjectURL.mockRestore();
			revokeObjectURL.mockRestore();
		}

		expect(document.getElementById("io-notice")?.textContent).toBe("");
	});

	it("starting a new export clears a prior io notice", async () => {
		mountApp();

		// Seed #io-notice with an import failure.
		const file = new File(['{"totally":"unrelated"}'], "notes.json", { type: "application/json" });
		const input = document.getElementById("import-file") as HTMLInputElement;
		Object.defineProperty(input, "files", { value: [file], configurable: true, writable: true });
		fireChange(input);
		await settle();
		expect(document.getElementById("io-notice")?.textContent).toContain("diagram export");

		const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
		const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		try {
			click(document.getElementById("export-button"));
			await settle();
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
		click(byRole(dialog, "button", "SVG"));
		expect(document.getElementById("io-notice")?.textContent).toBe(
			"Nothing to export — the diagram is empty.",
		);

		// A complete link, so an svg renders again.
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
		await settle();
		expect(document.querySelector("#diagram svg")).not.toBeNull();

		click(document.getElementById("diagram-export-button"));
		click(byRole(dialog, "button", "SVG"));

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
		expect(document.activeElement).toBe(byRole(dialog, "button", "SVG"));
	});

	it("reports 'nothing to export' for SVG and closes the export dialog with focus restored", () => {
		mountApp();

		removeAllNodes();
		expect(document.querySelector("#diagram svg")).toBeNull();

		const trigger = document.getElementById("diagram-export-button");
		const dialog = document.getElementById("diagram-export-dialog") as HTMLDialogElement;
		click(trigger);
		click(byRole(dialog, "button", "SVG"));

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
		const cycleTarget = byRole<HTMLSelectElement>(document, "combobox", "Target for link 3");
		cycleTarget.value = "n1";
		fireChange(cycleTarget);
		expect(document.getElementById("error")?.textContent).toContain("cycle");

		// A rename while still invalid: the export must show the old label,
		// which discriminates stale from fresh where the rect count can't.
		const nameInput = byRole<HTMLInputElement>(document, "textbox", "Name for Coal");
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
			click(byRole(dialog, "button", "SVG"));
		} finally {
			createObjectURL.mockRestore();
			revokeObjectURL.mockRestore();
		}

		expect(blob).toBeDefined();
		const svgText = await (blob as Blob).text();
		// +1 for the background rect serializeDiagramSvg adds.
		expect((svgText.match(/<rect/g) ?? []).length).toBe(rectsBefore + 1);
		expect(svgText).toContain(oldName);
		expect(svgText).not.toContain("Renamed For Export Test");
		// The download itself is the feedback.
		expect(document.getElementById("io-notice")?.textContent).toBe("");
	});

	it("offers one export picker at every size; empty PNG closes it", () => {
		// Rasterization isn't exercisable under happy-dom; this only proves the
		// empty-diagram guard fires first.
		mountApp();

		expect(allByRole(document, "button", "SVG")).toHaveLength(1);
		expect(allByRole(document, "button", "PNG")).toHaveLength(1);

		removeAllNodes();
		expect(document.querySelector("#diagram svg")).toBeNull();

		const displayButton = document.getElementById("diagram-export-button");
		const displayDialog = document.getElementById("diagram-export-dialog") as HTMLDialogElement;
		click(displayButton);
		click(byRole(displayDialog, "button", "PNG"));

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
		// The notice region is unmounted: nothing left to publish into.
		expect(document.getElementById("io-notice")).toBeNull();
		resolveText(
			JSON.stringify({
				nodes: [{ id: "n1", name: "Stale" }],
				links: [],
				settings: {},
			}),
		);
		await settle();

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
			await settle();

			expect(document.querySelectorAll("#node-editor .node-row")).toHaveLength(rowsBefore);
			expect(document.getElementById("io-notice")?.textContent).toBe("");
			expect(localStorage.getItem(STORAGE_KEY)).toBe(storedBefore);
		} finally {
			second.destroy();
		}
	});
});
