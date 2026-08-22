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
 * Rasterizes a standalone svg document (as produced by serializeDiagramSvg)
 * into a PNG blob via an offscreen canvas, drawn at width*scale by
 * height*scale.
 */
export function rasterizeSvg(
	xml: string,
	width: number,
	height: number,
	scale: number,
): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
		const img = new Image();
		img.onload = () => {
			// drawImage and toBlob can throw synchronously (e.g. SecurityError on a
			// tainted canvas); without the catch, that escapes as an uncaught error
			// event — the URL leaks and the promise never settles, so the caller's
			// error notice never shows. Double-revoke can't happen: the toBlob
			// callback only runs when the call didn't throw.
			try {
				const canvas = document.createElement("canvas");
				canvas.width = width * scale;
				canvas.height = height * scale;
				const ctx = canvas.getContext("2d");
				if (!ctx) {
					URL.revokeObjectURL(url);
					reject(new Error("Could not get a 2d canvas context to rasterize the diagram."));
					return;
				}
				ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
				canvas.toBlob((blob) => {
					URL.revokeObjectURL(url);
					if (blob) resolve(blob);
					else reject(new Error("Rasterizing the diagram to PNG failed."));
				}, "image/png");
			} catch (err) {
				URL.revokeObjectURL(url);
				reject(err);
			}
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error("Could not load the diagram svg for rasterization."));
		};
		img.src = url;
	});
}
