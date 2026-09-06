/**
 * Shared by every export path (JSON in DataPanel, SVG/PNG in DiagramPanel):
 * the browser's Blob + object-URL download mechanism, no dependencies.
 */
export function download(doc: Document, blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const anchor = doc.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	// Defer the revoke: some engines resolve the blob: URL only after click()
	// returns, and Safari historically failed the download on a synchronous
	// revoke. A macrotask later is safe for every engine.
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
