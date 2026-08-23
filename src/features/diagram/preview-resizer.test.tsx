// @vitest-environment happy-dom

import { render } from "preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	DEFAULT_PREVIEW_HEIGHT,
	MAX_PREVIEW_HEIGHT,
	MIN_PREVIEW_HEIGHT,
	PREVIEW_HEIGHT_STORAGE_KEY,
	PreviewResizer,
	clampPreviewHeight,
	loadPreviewHeight,
} from "./preview-resizer";

function mount(): { diagramEl: HTMLElement; container: HTMLElement } {
	const diagramEl = document.createElement("div");
	const container = document.createElement("div");
	document.body.append(diagramEl, container);
	render(<PreviewResizer diagramEl={diagramEl} win={window} />, container);
	return { diagramEl, container };
}

function pointerEvent(type: string, clientY: number, pointerId = 1): Event {
	const event = new Event(type, { bubbles: true });
	Object.defineProperties(event, {
		clientY: { value: clientY },
		pointerId: { value: pointerId },
	});
	return event;
}

beforeEach(() => {
	document.body.innerHTML = "";
	localStorage.clear();
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

describe("PreviewResizer", () => {
	it("applies the stored height and exposes range semantics", () => {
		localStorage.setItem(PREVIEW_HEIGHT_STORAGE_KEY, "425");
		const { diagramEl, container } = mount();

		expect(diagramEl.style.getPropertyValue("--diagram-preview-height")).toBe("425px");
		const splitter = container.querySelector("#preview-splitter");
		expect(splitter?.getAttribute("aria-valuemin")).toBe(String(MIN_PREVIEW_HEIGHT));
		expect(splitter?.getAttribute("aria-valuemax")).toBe(String(MAX_PREVIEW_HEIGHT));
		expect(splitter?.getAttribute("aria-valuenow")).toBe("425");
	});

	it("supports click-only smaller, larger, and reset actions", () => {
		const { container } = mount();
		const click = (action: string) =>
			container
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
		const { container } = mount();
		const splitter = container.querySelector("#preview-splitter");
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
		const { container } = mount();
		const splitter = container.querySelector("#preview-splitter");

		splitter?.dispatchEvent(pointerEvent("pointerdown", 500));
		window.dispatchEvent(pointerEvent("pointermove", 537));
		window.dispatchEvent(pointerEvent("pointerup", 537));

		expect(splitter?.getAttribute("aria-valuenow")).toBe("397");
		expect(localStorage.getItem(PREVIEW_HEIGHT_STORAGE_KEY)).toBe("397");
	});

	it("keeps working when storage is unavailable", () => {
		const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("unavailable");
		});
		try {
			let container: HTMLElement | undefined;
			expect(() => {
				container = mount().container;
			}).not.toThrow();
			expect(() =>
				container
					?.querySelector<HTMLElement>('[data-action="preview-larger"]')
					?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
			).not.toThrow();
		} finally {
			setItemSpy.mockRestore();
		}
	});

	// Unlike the splitter/buttons themselves — removed from the document on
	// unmount, so a real pointer event could never reach them again — the
	// pointermove/pointerup listeners below live on `window`, which never
	// goes away. Only explicit removal in the effect's cleanup keeps a stray
	// move/up after unmount from resurrecting drag state, so this asserts the
	// removal directly rather than through a drag that a null dragRef alone
	// would already make inert.
	it("removes its window-level drag listeners on unmount", () => {
		const addSpy = vi.spyOn(window, "addEventListener");
		const removeSpy = vi.spyOn(window, "removeEventListener");
		try {
			const { container } = mount();
			const addedByType = new Map(
				addSpy.mock.calls
					.filter(([, listener]) => typeof listener === "function")
					.map(([type, listener]) => [type, listener] as const),
			);
			const addedMove = addedByType.get("pointermove");
			const addedUp = addedByType.get("pointerup");
			expect(addedMove).toBeTypeOf("function");
			expect(addedUp).toBeTypeOf("function");

			render(null, container);

			// Identity, not just event type — a cleanup that removed the wrong
			// function reference would leave the real listener attached and
			// still pass a looser "was some listener removed for this type" check.
			const removedByType = new Map(
				removeSpy.mock.calls.map(([type, listener]) => [type, listener] as const),
			);
			expect(removedByType.get("pointermove")).toBe(addedMove);
			expect(removedByType.get("pointerup")).toBe(addedUp);
		} finally {
			addSpy.mockRestore();
			removeSpy.mockRestore();
		}
	});

	it("unmount cancels an in-progress drag and releases pointer capture", () => {
		const { container } = mount();
		const splitter = container.querySelector("#preview-splitter") as HTMLElement;
		const releaseSpy = vi.fn();
		splitter.releasePointerCapture = releaseSpy;

		splitter.dispatchEvent(pointerEvent("pointerdown", 500, 7));
		window.dispatchEvent(pointerEvent("pointermove", 540, 7));
		const heightDuringDrag = splitter.getAttribute("aria-valuenow");

		render(null, container);

		expect(releaseSpy).toHaveBeenCalledWith(7);

		// A pointermove after unmount neither throws nor changes the last value
		// — the drag was reset, not just paused.
		expect(() => window.dispatchEvent(pointerEvent("pointermove", 600, 7))).not.toThrow();
		expect(splitter.getAttribute("aria-valuenow")).toBe(heightDuringDrag);
	});
});
