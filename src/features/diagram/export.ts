const SVG_NS = "http://www.w3.org/2000/svg";

export interface SerializeSvgOptions {
	labelColor: string;
	background: string;
}

export function svgViewBoxSize(svg: SVGSVGElement): { width: number; height: number } {
	const values = (svg.getAttribute("viewBox") ?? "")
		.trim()
		.split(/[\s,]+/)
		.map(Number);
	if (values.length !== 4 || !values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0) {
		throw new Error("The diagram SVG has no valid viewBox.");
	}
	return { width: values[2], height: values[3] };
}

/**
 * Turns the live, on-screen diagram svg into a standalone document: explicit
 * pixel dimensions (the live svg only has a viewBox, which opens at an
 * arbitrary size in a bare viewer), currentColor labels resolved to a
 * concrete color (currentColor falls back to black outside the page), and an
 * opaque background rect (the live svg is transparent, relying on the page's
 * surface color showing through). Operates on a clone — never mutates the
 * svg passed in.
 */
export function serializeDiagramSvg(
	svg: SVGSVGElement,
	opts: { labelColor: string; background: string },
): string {
	const { width, height } = svgViewBoxSize(svg);
	const clone = svg.cloneNode(true) as SVGSVGElement;
	clone.setAttribute("xmlns", SVG_NS);
	clone.setAttribute("width", String(width));
	clone.setAttribute("height", String(height));

	for (const el of Array.from(clone.querySelectorAll('[fill="currentColor"]'))) {
		el.setAttribute("fill", opts.labelColor);
	}

	const background = clone.ownerDocument.createElementNS(SVG_NS, "rect");
	background.setAttribute("x", "0");
	background.setAttribute("y", "0");
	background.setAttribute("width", String(width));
	background.setAttribute("height", String(height));
	background.setAttribute("fill", opts.background);
	clone.insertBefore(background, clone.firstChild);

	const xml = new XMLSerializer().serializeToString(clone);
	return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
}

/**
 * Rejected by rasterizeSvg on every abort path. A caller that needs to tell
 * this apart from a real rasterization failure can check `.name ===
 * "AbortError"`; DiagramPanel's exportPng instead checks its own
 * `signal.aborted` after the promise settles, which is true for the same
 * cases and also covers a stale success racing destroy.
 */
function rasterizeAbortError(): DOMException {
	return new DOMException("PNG rasterization was aborted.", "AbortError");
}

/**
 * Rasterizes a standalone svg document (as produced by serializeDiagramSvg)
 * into a PNG blob via an offscreen canvas, drawn at width*scale by
 * height*scale. `win`'s own `URL` creates/revokes the intermediate object
 * URL — not the ambient global — since `doc`/`win` may belong to a window
 * other than this module's own ambient one.
 *
 * `signal` is the owning application instance's AbortSignal (see
 * PLAN.md's "Async operation ownership"). Already aborted, it settles
 * without creating anything; aborted while the image is loading, it detaches
 * the img's handlers, clears its `src` to stop the pending load, and revokes
 * the object URL — so a browser completion that arrives after destroy can
 * neither call back into this promise nor double-revoke its URL.
 */
export function rasterizeSvg(
	doc: Document,
	win: Window,
	xml: string,
	width: number,
	height: number,
	scale: number,
	signal: AbortSignal,
): Promise<Blob> {
	if (signal.aborted) return Promise.reject(rasterizeAbortError());
	return new Promise((resolve, reject) => {
		const url = win.URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
		// Tracked explicitly because the abort path and the img's own
		// load/error path can both reach a revoke call once the async gap
		// between onload firing and its canvas/toBlob work finishing lets an
		// abort land in between — revoke must still only run once.
		let revoked = false;
		const revoke = () => {
			if (revoked) return;
			revoked = true;
			win.URL.revokeObjectURL(url);
		};

		const img = doc.createElement("img");

		// Shared by every settle path so a completion racing an abort (or vice
		// versa) can't call back into this already-settled promise, and so the
		// abort listener never outlives this call on the long-lived app signal.
		const settle = () => {
			signal.removeEventListener("abort", onAbort);
			img.onload = null;
			img.onerror = null;
		};

		function onAbort(): void {
			settle();
			img.src = ""; // standard technique to stop a pending image load
			revoke();
			reject(rasterizeAbortError());
		}
		signal.addEventListener("abort", onAbort);

		img.onload = () => {
			// drawImage and toBlob can throw synchronously (e.g. SecurityError on a
			// tainted canvas); without the catch, that escapes as an uncaught error
			// event — the URL leaks and the promise never settles, so the caller's
			// error notice never shows.
			try {
				const canvas = doc.createElement("canvas");
				canvas.width = width * scale;
				canvas.height = height * scale;
				const ctx = canvas.getContext("2d");
				if (!ctx) {
					settle();
					revoke();
					reject(new Error("Could not get a 2d canvas context to rasterize the diagram."));
					return;
				}
				ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
				canvas.toBlob((blob) => {
					settle();
					revoke();
					if (blob) resolve(blob);
					else reject(new Error("Rasterizing the diagram to PNG failed."));
				}, "image/png");
			} catch (err) {
				settle();
				revoke();
				reject(err);
			}
		};
		img.onerror = () => {
			settle();
			revoke();
			reject(new Error("Could not load the diagram svg for rasterization."));
		};
		img.src = url;
	});
}
