// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rasterizeSvg, serializeDiagramSvg } from "./export";

const SVG_NS = "http://www.w3.org/2000/svg";

// Arbitrary fixture dimensions — serializeDiagramSvg only reads whatever
// viewBox the live svg happens to have, so these have no relationship to
// render.ts's own aspect-ratio-derived sizes.
const FIXTURE_WIDTH = 960;
const FIXTURE_HEIGHT = 480;

// Mirrors the shape renderDiagram produces: a viewBox-only root, a
// currentColor label, and a link path — enough to exercise every
// transformation without depending on d3-sankey layout.
function buildFixture(): SVGSVGElement {
	const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
	svg.setAttribute("viewBox", `0 0 ${FIXTURE_WIDTH} ${FIXTURE_HEIGHT}`);

	const path = document.createElementNS(SVG_NS, "path");
	path.setAttribute("d", "M0,0L10,10");
	svg.appendChild(path);

	const text = document.createElementNS(SVG_NS, "text");
	text.setAttribute("fill", "currentColor");
	text.textContent = "Node A";
	svg.appendChild(text);

	document.body.appendChild(svg);
	return svg;
}

beforeEach(() => {
	document.body.innerHTML = "";
});

describe("serializeDiagramSvg", () => {
	it("includes the xml declaration, xmlns, and explicit pixel dimensions", () => {
		const svg = buildFixture();

		const xml = serializeDiagramSvg(svg, { labelColor: "#123456", background: "#fff" });

		expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true);
		expect(xml).toContain(`xmlns="${SVG_NS}"`);
		expect(xml).toContain(`width="${FIXTURE_WIDTH}"`);
		expect(xml).toContain(`height="${FIXTURE_HEIGHT}"`);
	});

	it("takes export dimensions from the live svg viewBox", () => {
		const svg = buildFixture();
		svg.setAttribute("viewBox", "0 0 1440 480");

		const xml = serializeDiagramSvg(svg, { labelColor: "#123456", background: "#fff" });

		expect(xml).toContain('width="1440"');
		expect(xml).toContain('height="480"');
		const parsed = new DOMParser().parseFromString(xml, "image/svg+xml");
		expect(parsed.querySelector("rect")?.getAttribute("width")).toBe("1440");
	});

	it("prepends an opaque background rect as the first child", () => {
		const svg = buildFixture();

		const xml = serializeDiagramSvg(svg, { labelColor: "#123456", background: "rgb(10, 20, 30)" });

		const parsed = new DOMParser().parseFromString(xml, "image/svg+xml");
		const root = parsed.documentElement;
		const firstChild = root.firstElementChild;
		expect(firstChild?.tagName).toBe("rect");
		expect(firstChild?.getAttribute("width")).toBe(String(FIXTURE_WIDTH));
		expect(firstChild?.getAttribute("height")).toBe(String(FIXTURE_HEIGHT));
		expect(firstChild?.getAttribute("fill")).toBe("rgb(10, 20, 30)");
	});

	it("replaces currentColor fills with the resolved label color", () => {
		const svg = buildFixture();

		const xml = serializeDiagramSvg(svg, { labelColor: "#123456", background: "#fff" });

		expect(xml).not.toContain("currentColor");
		expect(xml).toContain('fill="#123456"');
	});

	it("declares xmlns exactly once", () => {
		// setAttribute("xmlns") plus XMLSerializer's own namespace handling is
		// engine-dependent; a duplicate attribute would make the file malformed XML.
		const svg = buildFixture();

		const xml = serializeDiagramSvg(svg, { labelColor: "#123456", background: "#fff" });

		expect(xml.match(new RegExp(`xmlns="${SVG_NS}"`, "g"))).toHaveLength(1);
	});

	it("keeps nested gradient defs and their url() references intact", () => {
		// The source-target link mode nests per-link <linearGradient> elements
		// inside the svg, referenced by stroke="url(#id)" — the PNG slice's
		// rasterization depends on both surviving serialization.
		const svg = buildFixture();
		const gradient = document.createElementNS(SVG_NS, "linearGradient");
		gradient.setAttribute("id", "link-grad-0");
		svg.appendChild(gradient);
		const link = document.createElementNS(SVG_NS, "path");
		link.setAttribute("stroke", "url(#link-grad-0)");
		svg.appendChild(link);

		const xml = serializeDiagramSvg(svg, { labelColor: "#123456", background: "#fff" });

		const parsed = new DOMParser().parseFromString(xml, "image/svg+xml");
		expect(parsed.querySelector("linearGradient")?.getAttribute("id")).toBe("link-grad-0");
		expect(parsed.querySelector('[stroke="url(#link-grad-0)"]')).not.toBeNull();
	});

	it("does not mutate the live input svg", () => {
		const svg = buildFixture();

		serializeDiagramSvg(svg, { labelColor: "#123456", background: "#fff" });

		expect(svg.hasAttribute("width")).toBe(false);
		expect(svg.hasAttribute("height")).toBe(false);
		expect(svg.querySelector("rect")).toBeNull();
		expect(svg.querySelector("text")?.getAttribute("fill")).toBe("currentColor");
	});
});

/** A settable-src, settable-onload/onerror stand-in — happy-dom's own `<img>` never fires a real load event. */
class FakeImg {
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	src = "";
}

class FakeCanvas {
	width = 0;
	height = 0;
	getContext() {
		return { drawImage: () => {} };
	}
	toBlob(callback: (blob: Blob | null) => void) {
		callback(new Blob(["fake-png-bytes"], { type: "image/png" }));
	}
}

/**
 * Stubs the ambient globals rasterizeSvg actually calls — real `<img>`/canvas
 * loading isn't exercisable under happy-dom (no network, no canvas adapter),
 * so this drives the img/canvas callbacks by hand instead. `imgs` collects
 * every `new Image()` rasterizeSvg constructs, in call order.
 */
function stubRasterizeGlobals() {
	const imgs: FakeImg[] = [];
	class TrackedFakeImg extends FakeImg {
		constructor() {
			super();
			imgs.push(this);
		}
	}
	vi.stubGlobal("Image", TrackedFakeImg);
	const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake-svg");
	const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
	const originalCreateElement = document.createElement.bind(document);
	vi.spyOn(document, "createElement").mockImplementation((tag: string, options?: unknown) => {
		if (tag === "canvas") return new FakeCanvas() as unknown as HTMLCanvasElement;
		return originalCreateElement(tag, options as ElementCreationOptions | undefined);
	});
	return { imgs, createObjectURL, revokeObjectURL };
}

describe("rasterizeSvg", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("resolves with the rasterized blob and revokes the object URL exactly once", async () => {
		const { imgs, createObjectURL, revokeObjectURL } = stubRasterizeGlobals();
		const controller = new AbortController();

		const promise = rasterizeSvg("<svg/>", 100, 50, 1, controller.signal);
		imgs[0].onload?.();

		const blob = await promise;
		expect(blob.type).toBe("image/png");
		expect(createObjectURL).toHaveBeenCalledTimes(1);
		expect(revokeObjectURL).toHaveBeenCalledTimes(1);
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-svg");
	});

	it("removes its abort listener once settled normally, so it can't leak on the long-lived app signal", async () => {
		const { imgs } = stubRasterizeGlobals();
		const controller = new AbortController();
		const removeEventListener = vi.spyOn(controller.signal, "removeEventListener");

		const promise = rasterizeSvg("<svg/>", 100, 50, 1, controller.signal);
		imgs[0].onload?.();
		await promise;

		expect(removeEventListener).toHaveBeenCalledWith("abort", expect.any(Function));
	});

	it("rejects without creating or revoking anything when the signal is already aborted", async () => {
		const { imgs, createObjectURL, revokeObjectURL } = stubRasterizeGlobals();
		const controller = new AbortController();
		controller.abort();

		await expect(rasterizeSvg("<svg/>", 100, 50, 1, controller.signal)).rejects.toMatchObject({
			name: "AbortError",
		});
		expect(imgs).toHaveLength(0);
		expect(createObjectURL).not.toHaveBeenCalled();
		expect(revokeObjectURL).not.toHaveBeenCalled();
	});

	it("aborting while pending detaches the img handlers, stops the load, and settles abnormally", async () => {
		const { imgs, revokeObjectURL } = stubRasterizeGlobals();
		const controller = new AbortController();

		const promise = rasterizeSvg("<svg/>", 100, 50, 1, controller.signal);
		controller.abort();

		await expect(promise).rejects.toMatchObject({ name: "AbortError" });
		expect(imgs[0].onload).toBeNull();
		expect(imgs[0].onerror).toBeNull();
		expect(imgs[0].src).toBe("");
		expect(revokeObjectURL).toHaveBeenCalledTimes(1);
	});

	it("a load that arrives after abort is inert: no second revoke, no change to the settled result", async () => {
		const { imgs, revokeObjectURL } = stubRasterizeGlobals();
		const controller = new AbortController();

		const promise = rasterizeSvg("<svg/>", 100, 50, 1, controller.signal);
		const onload = imgs[0].onload;
		controller.abort();
		await expect(promise).rejects.toMatchObject({ name: "AbortError" });

		// Detached, so the app can't actually re-invoke it through `img` anymore
		// — but a race where the browser's own load event was already about to
		// fire (already queued the moment abort ran) must still be harmless.
		onload?.call(imgs[0]);

		expect(revokeObjectURL).toHaveBeenCalledTimes(1);
	});

	it("failure (image load error) still revokes exactly once and removes the abort listener", async () => {
		const { imgs, revokeObjectURL } = stubRasterizeGlobals();
		const controller = new AbortController();
		const removeEventListener = vi.spyOn(controller.signal, "removeEventListener");

		const promise = rasterizeSvg("<svg/>", 100, 50, 1, controller.signal);
		imgs[0].onerror?.();

		await expect(promise).rejects.toThrow("Could not load the diagram svg for rasterization.");
		expect(revokeObjectURL).toHaveBeenCalledTimes(1);
		expect(removeEventListener).toHaveBeenCalledWith("abort", expect.any(Function));
	});

	it("clears the img's onerror before clearing src, so a browser that fires error-on-clear can't re-enter it", async () => {
		const { revokeObjectURL } = stubRasterizeGlobals();

		// Unlike FakeImg above, this fake's own `src` setter mimics a real
		// browser that synchronously fires `error` when a pending load's `src`
		// is cleared — pinning that onAbort detaches handlers *first*.
		class FakeImgFiresErrorOnSrcClear {
			onload: (() => void) | null = null;
			#onerror: (() => void) | null = null;
			errorHandlerCalls = 0;
			get onerror(): (() => void) | null {
				return this.#onerror;
			}
			set onerror(fn: (() => void) | null) {
				this.#onerror = fn;
			}
			#src = "";
			get src(): string {
				return this.#src;
			}
			set src(value: string) {
				this.#src = value;
				if (value === "" && this.#onerror) {
					this.errorHandlerCalls++;
					this.#onerror();
				}
			}
		}
		let img: FakeImgFiresErrorOnSrcClear | undefined;
		class TrackedFakeImgFiresErrorOnSrcClear extends FakeImgFiresErrorOnSrcClear {
			constructor() {
				super();
				img = this;
			}
		}
		vi.stubGlobal("Image", TrackedFakeImgFiresErrorOnSrcClear);
		const controller = new AbortController();

		const promise = rasterizeSvg("<svg/>", 100, 50, 1, controller.signal);
		controller.abort();

		await expect(promise).rejects.toMatchObject({ name: "AbortError" });
		expect(img?.errorHandlerCalls).toBe(0);
		expect(revokeObjectURL).toHaveBeenCalledTimes(1);
	});
});
