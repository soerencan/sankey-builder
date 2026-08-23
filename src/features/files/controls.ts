import type { State } from "../../model/graph";
import { setupDialog } from "../../shared/dialog";
import { isHTMLDialogElement, isHTMLElement, isHTMLInputElement } from "../../shared/dom";
import { rasterizeSvg, serializeDiagramSvg, svgViewBoxSize } from "../diagram/export";
import { type ImportState, parseImport, serializeState } from "./diagram-file";

const EXPORT_JSON_FILENAME = "sankey.json";
const EXPORT_SVG_FILENAME = "sankey.svg";
const EXPORT_PNG_FILENAME = "sankey.png";
// Hidpi-crisp output (1920x960 at the diagram's 960x480 base size) without
// making the caller reason about canvas pixel math.
const PNG_EXPORT_SCALE = 2;

/**
 * A realm-safe stand-in for `instanceof SVGSVGElement`. Only the root `<svg>`
 * element has this exact tag name; nothing downstream needs an SVG-specific
 * API (serializeDiagramSvg/svgViewBoxSize only call generic Element/Node
 * methods), so tagName alone is enough to duck-type it.
 */
function isSvgSvgElement(target: Element | null): target is SVGSVGElement {
	return !!target && target.tagName === "svg";
}

export interface IoActions {
	importDiagram(imported: ImportState, repairs: string[]): void;
	reportImportError(message: string): void;
	reportExportSuccess(filename: string): void;
	reportExportError(message: string): void;
}

/**
 * DOM glue for the contextual Export/Import controls, using the browser's
 * built-in download (Blob + object URL) and file-picker mechanisms — no
 * dependencies. Parsing and state mutation live elsewhere (diagram-file.ts is pure,
 * app/start-app.ts owns the state reference and feedback); this only bridges the DOM.
 * `signal` is the owning app instance's AbortSignal — AppHandle.destroy()
 * aborting it tears every listener below (and every setupDialog listener)
 * down.
 */
export function setupIo(
	doc: Document,
	win: Window,
	state: State,
	actions: IoActions,
	signal: AbortSignal,
): void {
	const exportButton = doc.getElementById("export-button");
	const diagramExportButton = doc.getElementById("diagram-export-button");
	const diagramExportDialogEl = doc.getElementById("diagram-export-dialog");
	const importButton = doc.getElementById("import-button");
	const fileInput = doc.getElementById("import-file");
	if (!isHTMLInputElement(fileInput)) return;
	const diagramExportDialog = isHTMLDialogElement(diagramExportDialogEl)
		? setupDialog(diagramExportDialogEl, signal)
		: undefined;

	exportButton?.addEventListener(
		"click",
		() => {
			const blob = new Blob([serializeState(state)], { type: "application/json" });
			download(doc, win, blob, EXPORT_JSON_FILENAME);
			actions.reportExportSuccess(EXPORT_JSON_FILENAME);
		},
		{ signal },
	);
	diagramExportButton?.addEventListener(
		"click",
		() => {
			if (isHTMLElement(diagramExportButton)) {
				diagramExportDialog?.open(diagramExportButton);
			}
		},
		{ signal },
	);

	for (const exportSvgButton of Array.from(
		doc.querySelectorAll<HTMLElement>('[data-action="export-svg"]'),
	)) {
		exportSvgButton.addEventListener(
			"click",
			() => {
				const svg = serializeVisibleDiagram(doc, win, actions);
				if (svg) {
					download(doc, win, new Blob([svg], { type: "image/svg+xml" }), EXPORT_SVG_FILENAME);
					actions.reportExportSuccess(EXPORT_SVG_FILENAME);
				}
				closeContainingDialog(exportSvgButton);
			},
			{ signal },
		);
	}
	for (const exportPngButton of Array.from(
		doc.querySelectorAll<HTMLElement>('[data-action="export-png"]'),
	)) {
		exportPngButton.addEventListener(
			"click",
			() => {
				const svg = serializeVisibleDiagram(doc, win, actions);
				if (svg) {
					const svgElement = doc.querySelector("#diagram svg") as SVGSVGElement;
					const { width, height } = svgViewBoxSize(svgElement);
					rasterizeSvg(doc, win, svg, width, height, PNG_EXPORT_SCALE)
						.then((blob) => {
							download(doc, win, blob, EXPORT_PNG_FILENAME);
							actions.reportExportSuccess(EXPORT_PNG_FILENAME);
						})
						.catch((err) => {
							// The notice stays generic; log the specific cause so a field report
							// ("PNG export failed") is diagnosable from the console.
							console.error(err);
							actions.reportExportError("PNG export failed. Try the SVG export instead.");
						});
				}
				closeContainingDialog(exportPngButton);
			},
			{ signal },
		);
	}
	importButton?.addEventListener("click", () => fileInput.click(), { signal });

	fileInput.addEventListener(
		"change",
		async () => {
			const file = fileInput.files?.[0];
			// Reset now so re-picking the same file still re-fires 'change'.
			fileInput.value = "";
			if (!file) return;
			let text: string;
			try {
				text = await file.text();
			} catch {
				// A disk/read error (permissions, the file vanished mid-pick) rejects
				// here — surface it rather than leaving an unhandled rejection.
				actions.reportImportError("Could not read the selected file. Please try again.");
				return;
			}
			const result = parseImport(text);
			if (result.ok) actions.importDiagram(result.state, result.repairs);
			else actions.reportImportError(result.error);
		},
		{ signal },
	);
}

/**
 * Format actions appear in both the wide export dialog and the narrow
 * Diagram sheet. Close whichever surface owns the activated copy; its
 * setupDialog close listener restores focus to the corresponding trigger.
 */
function closeContainingDialog(control: HTMLElement): void {
	const dialog = control.closest("dialog");
	if (isHTMLDialogElement(dialog) && dialog.open) dialog.close();
}

/**
 * Grabs the on-screen diagram svg and serializes it (see serializeDiagramSvg
 * for why: explicit dimensions, resolved colors, opaque background), shared
 * by both the SVG and PNG export handlers. Exports whatever is on screen:
 * when state is topologically invalid, refresh() keeps the last good diagram
 * visible — exporting that stale render is deliberate ("export what you
 * see"), not an oversight. Returns undefined (after reporting the error) when
 * there's nothing to export.
 */
function serializeVisibleDiagram(
	doc: Document,
	win: Window,
	actions: IoActions,
): string | undefined {
	const svgEl = doc.querySelector("#diagram svg");
	if (!isSvgSvgElement(svgEl)) {
		actions.reportExportError("Nothing to export — the diagram is empty.");
		return undefined;
	}
	// Read resolved colors from the live page (theme-aware): currentColor's
	// on-screen resolution for labels, and the diagram container's own
	// background — both would otherwise default to black/transparent once
	// the svg is detached from the page. svgEl.parentElement is #diagram
	// itself, since renderDiagram appends the svg directly into it.
	const labelColor = win.getComputedStyle(svgEl).color;
	const background = win.getComputedStyle(svgEl.parentElement as Element).backgroundColor;
	return serializeDiagramSvg(svgEl, { labelColor, background });
}

// win's own URL/setTimeout, not the ambient global — doc/win may belong to a
// window other than this module's own ambient one.
function download(doc: Document, win: Window, blob: Blob, filename: string): void {
	const url = win.URL.createObjectURL(blob);
	const anchor = doc.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	// Defer the revoke: some engines resolve the blob: URL only after click()
	// returns, and Safari historically failed the download on a synchronous
	// revoke. A macrotask later is safe for every engine.
	win.setTimeout(() => win.URL.revokeObjectURL(url), 0);
}
