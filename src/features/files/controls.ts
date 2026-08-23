import type { State } from "../../model/graph";
import { isHTMLInputElement } from "../../shared/dom";
import { type ImportState, parseImport, serializeState } from "./diagram-file";
import { download } from "./download";

const EXPORT_JSON_FILENAME = "sankey.json";

export interface IoActions {
	importDiagram(imported: ImportState, repairs: string[]): void;
	reportImportError(message: string): void;
	reportExportSuccess(filename: string): void;
	// Unused by this module's own JSON export (which has no failure path) but
	// part of the shared #io-notice action object start-app.tsx also hands to
	// DiagramPanel for SVG/PNG export failures — see start-app.tsx's ioActions.
	reportExportError(message: string): void;
}

/**
 * DOM glue for the Data-panel's import/JSON-export controls, using the
 * browser's built-in download and file-picker mechanisms — no dependencies.
 * Parsing and state mutation live elsewhere (diagram-file.ts is pure,
 * app/start-app.ts owns the state reference and feedback); this only bridges
 * the DOM. SVG/PNG export belongs to DiagramPanel, which owns the concrete
 * diagram host and its own I/O notice reporting. `signal` is the owning app
 * instance's AbortSignal — AppHandle.destroy() aborting it tears every
 * listener below down.
 */
export function setupIo(
	doc: Document,
	win: Window,
	state: State,
	actions: IoActions,
	signal: AbortSignal,
): void {
	const exportButton = doc.getElementById("export-button");
	const importButton = doc.getElementById("import-button");
	const fileInput = doc.getElementById("import-file");
	if (!isHTMLInputElement(fileInput)) return;

	exportButton?.addEventListener(
		"click",
		() => {
			const blob = new Blob([serializeState(state)], { type: "application/json" });
			download(doc, win, blob, EXPORT_JSON_FILENAME);
			actions.reportExportSuccess(EXPORT_JSON_FILENAME);
		},
		{ signal },
	);
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
