import { setupDialog } from "./dialog";
import { rasterizeSvg, serializeDiagramSvg } from "./export";
import { type ImportState, parseImport, serializeState } from "./io";
import { DIAGRAM_HEIGHT, DIAGRAM_WIDTH } from "./render";
import type { State } from "./state";

const EXPORT_JSON_FILENAME = "sankey.json";
const EXPORT_SVG_FILENAME = "sankey.svg";
const EXPORT_PNG_FILENAME = "sankey.png";
// Hidpi-crisp output (1920x960 at the diagram's 960x480 base size) without
// making the caller reason about canvas pixel math.
const PNG_EXPORT_SCALE = 2;

export interface IoActions {
	importDiagram(imported: ImportState, repairs: string[]): void;
	reportImportError(message: string): void;
	reportExportSuccess(filename: string): void;
	reportExportError(message: string): void;
}

/**
 * DOM glue for the contextual Export/Import controls, using the browser's
 * built-in download (Blob + object URL) and file-picker mechanisms — no
 * dependencies. Parsing and state mutation live elsewhere (io.ts is pure,
 * main.ts owns the state reference and feedback); this only bridges the DOM.
 */
export function setupIo(state: State, actions: IoActions): void {
	const exportButton = document.getElementById("export-button");
	const diagramExportButton = document.getElementById("diagram-export-button");
	const diagramExportDialogEl = document.getElementById("diagram-export-dialog");
	const importButton = document.getElementById("import-button");
	const fileInput = document.getElementById("import-file");
	if (!(fileInput instanceof HTMLInputElement)) return;
	const diagramExportDialog =
		diagramExportDialogEl instanceof HTMLDialogElement
			? setupDialog(diagramExportDialogEl)
			: undefined;

	exportButton?.addEventListener("click", () => {
		const blob = new Blob([serializeState(state)], { type: "application/json" });
		download(blob, EXPORT_JSON_FILENAME);
		actions.reportExportSuccess(EXPORT_JSON_FILENAME);
	});
	diagramExportButton?.addEventListener("click", () => {
		if (diagramExportButton instanceof HTMLElement) {
			diagramExportDialog?.open(diagramExportButton);
		}
	});

	for (const exportSvgButton of Array.from(
		document.querySelectorAll<HTMLElement>('[data-action="export-svg"]'),
	)) {
		exportSvgButton.addEventListener("click", () => {
			const svg = serializeVisibleDiagram(actions);
			if (svg) {
				download(new Blob([svg], { type: "image/svg+xml" }), EXPORT_SVG_FILENAME);
				actions.reportExportSuccess(EXPORT_SVG_FILENAME);
			}
			closeContainingDialog(exportSvgButton);
		});
	}
	for (const exportPngButton of Array.from(
		document.querySelectorAll<HTMLElement>('[data-action="export-png"]'),
	)) {
		exportPngButton.addEventListener("click", () => {
			const svg = serializeVisibleDiagram(actions);
			if (svg) {
				rasterizeSvg(svg, DIAGRAM_WIDTH, DIAGRAM_HEIGHT, PNG_EXPORT_SCALE)
					.then((blob) => {
						download(blob, EXPORT_PNG_FILENAME);
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
		});
	}
	importButton?.addEventListener("click", () => fileInput.click());

	fileInput.addEventListener("change", async () => {
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
	});
}

/**
 * Format actions appear in both the wide export dialog and the narrow
 * Diagram sheet. Close whichever surface owns the activated copy; its
 * setupDialog close listener restores focus to the corresponding trigger.
 */
function closeContainingDialog(control: HTMLElement): void {
	const dialog = control.closest("dialog");
	if (dialog instanceof HTMLDialogElement && dialog.open) dialog.close();
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
function serializeVisibleDiagram(actions: IoActions): string | undefined {
	const svgEl = document.querySelector("#diagram svg");
	if (!(svgEl instanceof SVGSVGElement)) {
		actions.reportExportError("Nothing to export — the diagram is empty.");
		return undefined;
	}
	// Read resolved colors from the live page (theme-aware): currentColor's
	// on-screen resolution for labels, and the diagram container's own
	// background — both would otherwise default to black/transparent once
	// the svg is detached from the page. svgEl.parentElement is #diagram
	// itself, since renderDiagram appends the svg directly into it.
	const labelColor = getComputedStyle(svgEl).color;
	const background = getComputedStyle(svgEl.parentElement as Element).backgroundColor;
	return serializeDiagramSvg(svgEl, { labelColor, background });
}

function download(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	// Defer the revoke: some engines resolve the blob: URL only after click()
	// returns, and Safari historically failed the download on a synchronous
	// revoke. A macrotask later is safe for every engine.
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
