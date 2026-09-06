// @vitest-environment happy-dom

import { render } from "preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tick } from "../../../tests/helpers/tick";
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
	render(<PreviewResizer diagramRef={{ current: diagramEl }} win={window} />, container);
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

	it("supports keyboard adjustment and range endpoints", async () => {
		const { container } = mount();
		const splitter = container.querySelector("#preview-splitter");
		splitter?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
		await tick();
		expect(splitter?.getAttribute("aria-valuenow")).toBe("400");
		splitter?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
		await tick();
		expect(splitter?.getAttribute("aria-valuenow")).toBe("360");
		splitter?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
		await tick();
		expect(splitter?.getAttribute("aria-valuenow")).toBe(String(MAX_PREVIEW_HEIGHT));
		splitter?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
		await tick();
		expect(splitter?.getAttribute("aria-valuenow")).toBe(String(MIN_PREVIEW_HEIGHT));
	});

	it("tracks vertical pointer movement continuously", async () => {
		const { container } = mount();
		const splitter = container.querySelector("#preview-splitter");

		splitter?.dispatchEvent(pointerEvent("pointerdown", 500));
		window.dispatchEvent(pointerEvent("pointermove", 537));
		window.dispatchEvent(pointerEvent("pointerup", 537));
		await tick();

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
			const addedCancel = addedByType.get("pointercancel");
			expect(addedMove).toBeTypeOf("function");
			expect(addedUp).toBeTypeOf("function");
			expect(addedCancel).toBeTypeOf("function");

			render(null, container);

			// Identity, not just event type — a cleanup that removed the wrong
			// function reference would leave the real listener attached and
			// still pass a looser "was some listener removed for this type" check.
			const removedByType = new Map(
				removeSpy.mock.calls.map(([type, listener]) => [type, listener] as const),
			);
			expect(removedByType.get("pointermove")).toBe(addedMove);
			expect(removedByType.get("pointerup")).toBe(addedUp);
			expect(removedByType.get("pointercancel")).toBe(addedCancel);
		} finally {
			addSpy.mockRestore();
			removeSpy.mockRestore();
		}
	});

	it("unmount cancels an in-progress drag and releases pointer capture", async () => {
		const { container } = mount();
		const splitter = container.querySelector("#preview-splitter") as HTMLElement;
		const releaseSpy = vi.fn();
		splitter.releasePointerCapture = releaseSpy;

		splitter.dispatchEvent(pointerEvent("pointerdown", 500, 7));
		window.dispatchEvent(pointerEvent("pointermove", 540, 7));
		await tick();
		const heightDuringDrag = splitter.getAttribute("aria-valuenow");
		const storedDuringDrag = localStorage.getItem(PREVIEW_HEIGHT_STORAGE_KEY);

		render(null, container);

		expect(releaseSpy).toHaveBeenCalledWith(7);

		// A pointermove after unmount neither throws nor changes the last value
		// — the drag was reset, not just paused.
		expect(() => window.dispatchEvent(pointerEvent("pointermove", 600, 7))).not.toThrow();
		expect(splitter.getAttribute("aria-valuenow")).toBe(heightDuringDrag);
		expect(localStorage.getItem(PREVIEW_HEIGHT_STORAGE_KEY)).toBe(storedDuringDrag);
	});

	// A browser-canceled gesture (incoming call, edge swipe) fires pointercancel
	// instead of pointerup. Without handling it, the drag stays armed and a
	// later, unrelated pointermove (e.g. from the next gesture) would jump the
	// preview height using the stale startY/startHeight — this test fails
	// before the fix because the second pointermove below still changes
	// aria-valuenow instead of being a no-op.
	it("pointercancel ends an in-progress drag and releases pointer capture, leaving the height applied mid-drag in place", async () => {
		const { container } = mount();
		const splitter = container.querySelector("#preview-splitter") as HTMLElement;
		const releaseSpy = vi.fn();
		splitter.releasePointerCapture = releaseSpy;

		splitter.dispatchEvent(pointerEvent("pointerdown", 500, 9));
		window.dispatchEvent(pointerEvent("pointermove", 540, 9));
		await tick();
		const heightAtCancel = splitter.getAttribute("aria-valuenow");
		const storedAtCancel = localStorage.getItem(PREVIEW_HEIGHT_STORAGE_KEY);
		expect(heightAtCancel).not.toBe("360");

		window.dispatchEvent(pointerEvent("pointercancel", 540, 9));

		expect(releaseSpy).toHaveBeenCalledWith(9);
		// The height applied mid-drag stays applied — pointercancel disarms the
		// drag, it doesn't revert it.
		expect(splitter.getAttribute("aria-valuenow")).toBe(heightAtCancel);

		// A further pointermove is ignored — the drag was reset, not just
		// paused, so this must not resume tracking from the canceled gesture's
		// start position. Persistence is synchronous, so it's a tick-independent
		// observer of the same fact; aria-valuenow needs the tick below since
		// it only updates on the next render.
		window.dispatchEvent(pointerEvent("pointermove", 700, 9));
		expect(localStorage.getItem(PREVIEW_HEIGHT_STORAGE_KEY)).toBe(storedAtCancel);
		await tick();
		expect(splitter.getAttribute("aria-valuenow")).toBe(heightAtCancel);
	});
});
