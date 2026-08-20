import { type ImportState, parseImport, serializeState } from "./io";
import type { State } from "./state";

const EXPORT_FILENAME = "sankey.json";

export interface IoActions {
	importDiagram(imported: ImportState, repairs: string[]): void;
	reportImportError(message: string): void;
	reportExportSuccess(filename: string): void;
}

/**
 * DOM glue for the Export/Import buttons in #controls, using the browser's
 * built-in download (Blob + object URL) and file-picker mechanisms — no
 * dependencies. Parsing and state mutation live elsewhere (io.ts is pure,
 * main.ts owns the state reference and feedback); this only bridges the DOM.
 */
export function setupIo(state: State, actions: IoActions): void {
	const exportButton = document.getElementById("export-button");
	const importButton = document.getElementById("import-button");
	const fileInput = document.getElementById("import-file");
	if (!(fileInput instanceof HTMLInputElement)) return;

	exportButton?.addEventListener("click", () => {
		downloadJson(serializeState(state));
		actions.reportExportSuccess(EXPORT_FILENAME);
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

function downloadJson(json: string): void {
	const blob = new Blob([json], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = EXPORT_FILENAME;
	anchor.click();
	// Defer the revoke: some engines resolve the blob: URL only after click()
	// returns, and Safari historically failed the download on a synchronous
	// revoke. A macrotask later is safe for every engine.
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
