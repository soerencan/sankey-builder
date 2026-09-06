export function download(doc: Document, blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const anchor = doc.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	// Some engines resolve the blob: URL only after click() returns, and Safari
	// historically failed the download on a synchronous revoke.
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
