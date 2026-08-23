// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	DEFAULT_PREVIEW_HEIGHT,
	MAX_PREVIEW_HEIGHT,
	MIN_PREVIEW_HEIGHT,
	PREVIEW_HEIGHT_STORAGE_KEY,
	clampPreviewHeight,
	loadPreviewHeight,
	setupPreviewResizer,
} from "./preview-resizer";

let controller: AbortController;

beforeEach(() => {
	document.body.innerHTML = `
		<section class="diagram-panel">
			<div id="diagram"></div>
			<div class="preview-resizer">
				<button data-action="preview-smaller">Smaller</button>
				<div id="preview-splitter" role="separator" tabindex="0"></div>
				<button data-action="preview-larger">Larger</button>
				<button data-action="preview-reset">Reset</button>
			</div>
		</section>`;
	localStorage.clear();
	controller = new AbortController();
});

describe("preview height preference", () => {
	it("clamps and rounds heights to the supported range", () => {
		expect(clampPreviewHeight(100)).toBe(MIN_PREVIEW_HEIGHT);
		expect(clampPreviewHeight(421.7)).toBe(422);
		expect(clampPreviewHeight(900)).toBe(MAX_PREVIEW_HEIGHT);
	});

	it("loads a valid stored height and ignores invalid values", () => {
		localStorage.setItem(PREVIEW_HEIGHT_STORAGE_KEY, "425");
		expect(loadPreviewHeight(localStorage)).toBe(425);
		localStorage.setItem(PREVIEW_HEIGHT_STORAGE_KEY, "not-a-number");
		expect(loadPreviewHeight(localStorage)).toBe(DEFAULT_PREVIEW_HEIGHT);
	});
});

describe("setupPreviewResizer", () => {
	it("applies the stored height and exposes range semantics", () => {
		localStorage.setItem(PREVIEW_HEIGHT_STORAGE_KEY, "425");
		setupPreviewResizer(document, window, controller.signal);

		expect(
			document.getElementById("diagram")?.style.getPropertyValue("--diagram-preview-height"),
		).toBe("425px");
		const splitter = document.getElementById("preview-splitter");
		expect(splitter?.getAttribute("aria-valuemin")).toBe(String(MIN_PREVIEW_HEIGHT));
		expect(splitter?.getAttribute("aria-valuemax")).toBe(String(MAX_PREVIEW_HEIGHT));
		expect(splitter?.getAttribute("aria-valuenow")).toBe("425");
	});

	it("supports click-only smaller, larger, and reset actions", () => {
		setupPreviewResizer(document, window, controller.signal);
		const click = (action: string) =>
			document
				.querySelector<HTMLElement>(`[data-action="${action}"]`)
				?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		click("preview-larger");
		expect(localStorage.getItem(PREVIEW_HEIGHT_STORAGE_KEY)).toBe("400");
		click("preview-smaller");
		expect(localStorage.getItem(PREVIEW_HEIGHT_STORAGE_KEY)).toBe("360");
		click("preview-larger");
		click("preview-reset");
		expect(localStorage.getItem(PREVIEW_HEIGHT_STORAGE_KEY)).toBe("360");
	});

	it("supports keyboard adjustment and range endpoints", () => {
		setupPreviewResizer(document, window, controller.signal);
		const splitter = document.getElementById("preview-splitter");
		splitter?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
		expect(splitter?.getAttribute("aria-valuenow")).toBe("400");
		splitter?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
		expect(splitter?.getAttribute("aria-valuenow")).toBe("360");
		splitter?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
		expect(splitter?.getAttribute("aria-valuenow")).toBe(String(MAX_PREVIEW_HEIGHT));
		splitter?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
		expect(splitter?.getAttribute("aria-valuenow")).toBe(String(MIN_PREVIEW_HEIGHT));
	});

	it("tracks vertical pointer movement continuously", () => {
		setupPreviewResizer(document, window, controller.signal);
		const splitter = document.getElementById("preview-splitter");
		const pointerEvent = (type: string, clientY: number) => {
			const event = new Event(type, { bubbles: true });
			Object.defineProperties(event, {
				clientY: { value: clientY },
				pointerId: { value: 1 },
			});
			return event;
		};

		splitter?.dispatchEvent(pointerEvent("pointerdown", 500));
		window.dispatchEvent(pointerEvent("pointermove", 537));
		window.dispatchEvent(pointerEvent("pointerup", 537));

		expect(splitter?.getAttribute("aria-valuenow")).toBe("397");
		expect(localStorage.getItem(PREVIEW_HEIGHT_STORAGE_KEY)).toBe("397");
	});

	it("keeps working when storage is unavailable", () => {
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("unavailable");
		});
		expect(() => setupPreviewResizer(document, window, controller.signal)).not.toThrow();
		expect(() =>
			document
				.querySelector<HTMLElement>('[data-action="preview-larger"]')
				?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
		).not.toThrow();
	});

	it("stops reacting to clicks once the signal aborts", () => {
		setupPreviewResizer(document, window, controller.signal);
		controller.abort();

		document
			.querySelector<HTMLElement>('[data-action="preview-larger"]')
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(localStorage.getItem(PREVIEW_HEIGHT_STORAGE_KEY)).toBeNull();
	});

	it("returns a disposer that cancels an in-progress drag and releases pointer capture", () => {
		const cancelDrag = setupPreviewResizer(document, window, controller.signal);
		const splitter = document.getElementById("preview-splitter") as HTMLElement;
		const releaseSpy = vi.fn();
		splitter.releasePointerCapture = releaseSpy;

		const pointerEvent = (type: string, clientY: number) => {
			const event = new Event(type, { bubbles: true });
			Object.defineProperties(event, {
				clientY: { value: clientY },
				pointerId: { value: 7 },
			});
			return event;
		};
		splitter.dispatchEvent(pointerEvent("pointerdown", 500));
		window.dispatchEvent(pointerEvent("pointermove", 540));

		expect(() => cancelDrag()).not.toThrow();
		expect(releaseSpy).toHaveBeenCalledWith(7);

		// A further pointermove is ignored — the drag was reset, not just
		// paused.
		const heightAfterCancel = splitter.getAttribute("aria-valuenow");
		window.dispatchEvent(pointerEvent("pointermove", 600));
		expect(splitter.getAttribute("aria-valuenow")).toBe(heightAfterCancel);

		// A second call is a no-op (nothing left to cancel).
		expect(() => cancelDrag()).not.toThrow();
		expect(releaseSpy).toHaveBeenCalledTimes(1);
	});
});
