import { serializeDiagramSvg } from "./export";
import { type ImportState, parseImport, serializeState } from "./io";
import type { State } from "./state";

const EXPORT_JSON_FILENAME = "sankey.json";
const EXPORT_SVG_FILENAME = "sankey.svg";

export interface IoActions {
	importDiagram(imported: ImportState, repairs: string[]): void;
	reportImportError(message: string): void;
	reportExportSuccess(filename: string): void;
	reportExportError(message: string): void;
}

/**
 * DOM glue for the Export/Import buttons in #controls, using the browser's
 * built-in download (Blob + object URL) and file-picker mechanisms — no
 * dependencies. Parsing and state mutation live elsewhere (io.ts is pure,
 * main.ts owns the state reference and feedback); this only bridges the DOM.
 */
export function setupIo(state: State, actions: IoActions): void {
	const exportButton = document.getElementById("export-button");
	const exportSvgButton = document.getElementById("export-svg-button");
	const importButton = document.getElementById("import-button");
	const fileInput = document.getElementById("import-file");
	if (!(fileInput instanceof HTMLInputElement)) return;

	exportButton?.addEventListener("click", () => {
		const blob = new Blob([serializeState(state)], { type: "application/json" });
		download(blob, EXPORT_JSON_FILENAME);
		actions.reportExportSuccess(EXPORT_JSON_FILENAME);
	});
	exportSvgButton?.addEventListener("click", () => {
		// Exports whatever is on screen. When state is topologically invalid,
		// refresh() keeps the last good diagram visible — exporting that stale
		// render is deliberate ("export what you see"), not an oversight.
		const svgEl = document.querySelector("#diagram svg");
		if (!(svgEl instanceof SVGSVGElement)) {
			actions.reportExportError("Nothing to export — the diagram is empty.");
			return;
		}
		// Read resolved colors from the live page (theme-aware): currentColor's
		// on-screen resolution for labels, and the diagram container's own
		// background — both would otherwise default to black/transparent once
		// the svg is detached from the page. svgEl.parentElement is #diagram
		// itself, since renderDiagram appends the svg directly into it.
		const labelColor = getComputedStyle(svgEl).color;
		const background = getComputedStyle(svgEl.parentElement as Element).backgroundColor;
		const svg = serializeDiagramSvg(svgEl, { labelColor, background });
		download(new Blob([svg], { type: "image/svg+xml" }), EXPORT_SVG_FILENAME);
		actions.reportExportSuccess(EXPORT_SVG_FILENAME);
	});
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
