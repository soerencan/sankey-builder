const SVG_NS = "http://www.w3.org/2000/svg";

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
 * Makes the on-screen svg standalone: explicit dimensions (a viewBox alone
 * opens at an arbitrary size in a bare viewer), currentColor resolved (it
 * falls back to black outside the page), and an opaque background (the live
 * svg relies on the page's surface color showing through).
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

function rasterizeAbortError(): DOMException {
	return new DOMException("PNG rasterization was aborted.", "AbortError");
}

/**
 * An abort while the image is loading detaches the img's handlers, stops
 * the pending load, and revokes the object URL, so a browser completion that
 * arrives after destroy can neither settle this promise nor double-revoke.
 */
export function rasterizeSvg(
	xml: string,
	width: number,
	height: number,
	scale: number,
	signal: AbortSignal,
): Promise<Blob> {
	if (signal.aborted) return Promise.reject(rasterizeAbortError());
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
		// An abort can land in the async gap between onload and toBlob, so
		// both paths may reach revoke.
		let revoked = false;
		const revoke = () => {
			if (revoked) return;
			revoked = true;
			URL.revokeObjectURL(url);
		};

		const img = new Image();

		// Also detaches the abort listener so it never outlives this call on
		// the long-lived app signal.
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
			// drawImage and toBlob can throw synchronously (e.g. SecurityError on
			// a tainted canvas); uncaught, the URL leaks and the promise never
			// settles.
			try {
				const canvas = document.createElement("canvas");
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
