/**
 * Shared by every export path (JSON in DataPanel, SVG/PNG in DiagramPanel):
 * the browser's Blob + object-URL download mechanism, no dependencies.
 * `win`'s own URL/setTimeout, not the ambient global — doc/win may belong to
 * a window other than this module's own ambient one.
 */
export function download(doc: Document, win: Window, blob: Blob, filename: string): void {
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
