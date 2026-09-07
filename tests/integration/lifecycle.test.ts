// @vitest-environment happy-dom

import Sortable from "sortablejs";
import { describe, expect, it, vi } from "vitest";
import { startApp } from "../../src/app/start-app";
import { PREVIEW_HEIGHT_STORAGE_KEY } from "../../src/features/diagram/preview-resizer";
import { STORAGE_KEY } from "../../src/platform/storage";
import {
	allByRole,
	byRole,
	click,
	installMarkup,
	mountApp,
	requireElement,
	tick,
} from "../helpers/mount-app";

// app/start-app.ts doesn't export STORAGE_NOTICE, so this hardcodes (and
// thereby pins) the user-visible copy.
const STORAGE_NOTICE =
	"Changes can't be saved in this browser right now (storage may be full or unavailable). " +
	"The diagram keeps working, but edits won't survive closing or reloading this tab — " +
	"try freeing up space or leaving private/incognito mode.";

/**
 * Swapped in for the whole `localStorage` global: happy-dom binds Storage
 * methods per instance on first access, which makes
 * `vi.spyOn(Storage.prototype, ...)` unreliable once localStorage has been
 * touched.
 */
function makeCountingStorage(): { storage: Storage; setItemCalls: string[] } {
	const store = new Map<string, string>();
	const setItemCalls: string[] = [];
	const storage: Storage = {
		getItem: (key) => store.get(key) ?? null,
		setItem: (key, value) => {
			setItemCalls.push(key);
			store.set(key, value);
		},
		removeItem: (key) => store.delete(key),
		clear: () => store.clear(),
		key: (index) => Array.from(store.keys())[index] ?? null,
		get length() {
			return store.size;
		},
	};
	return { storage, setItemCalls };
}

/**
 * happy-dom never fires a real `<img>` load event and has no canvas
 * adapter, so PNG rasterization's pending state is driven by hand through
 * the captured elements.
 */
function interceptExportElements(): {
	images: HTMLImageElement[];
	anchors: HTMLAnchorElement[];
	restore: () => void;
} {
	const original = document.createElement.bind(document);
	const images: HTMLImageElement[] = [];
	const anchors: HTMLAnchorElement[] = [];
	const spy = vi
		.spyOn(document, "createElement")
		.mockImplementation((tagName: string, options?: ElementCreationOptions) => {
			const el = original(tagName, options);
			if (tagName === "a") anchors.push(el as HTMLAnchorElement);
			return el;
		});
	const OriginalImage = globalThis.Image;
	class TrackedImage extends OriginalImage {
		constructor(...args: ConstructorParameters<typeof OriginalImage>) {
			super(...args);
			images.push(this);
		}
	}
	vi.stubGlobal("Image", TrackedImage);
	return {
		images,
		anchors,
		restore: () => {
			spy.mockRestore();
			vi.unstubAllGlobals();
		},
	};
}

function clickPngExport(): void {
	click(document.getElementById("diagram-export-button"));
	click(byRole(document.getElementById("diagram-export-dialog") as HTMLElement, "button", "PNG"));
}

describe("application lifecycle", () => {
	it("destroy mid-PNG-rasterization: revokes the object URL exactly once and downloads/reports nothing", async () => {
		const { app } = mountApp();
		const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL");
		const { anchors, restore } = interceptExportElements();
		try {
			clickPngExport();
			// Lands before any load/error event; the abort settles rasterizeSvg.
			app.destroy();
			// The notice region is unmounted: nothing left to publish into.
			expect(document.getElementById("io-notice")).toBeNull();
			// exportPng's .catch runs as a microtask; without the flush a removed
			// signal.aborted guard would go unnoticed.
			await tick();

			expect(anchors).toHaveLength(0);
			expect(revokeObjectURL).toHaveBeenCalledTimes(1);
			expect(document.getElementById("io-notice")).toBeNull();
		} finally {
			restore();
			revokeObjectURL.mockRestore();
		}
	});

	it("destroy then reboot: a PNG rasterization pending at destroy cannot publish into the new instance", async () => {
		installMarkup();
		const first = startApp(document);
		const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL");
		const { images, anchors, restore } = interceptExportElements();
		try {
			clickPngExport();
			expect(images).toHaveLength(1);
			// Captured before destroy() detaches it, to simulate a browser
			// completion racing destroy.
			const pendingOnload = images[0].onload;
			expect(pendingOnload).not.toBeNull();

			first.destroy();
			await tick();
			expect(revokeObjectURL).toHaveBeenCalledTimes(1);

			const second = startApp(document);
			try {
				pendingOnload?.call(images[0], new Event("load"));
				// The guarded .then/.catch only runs after this microtask flush.
				await tick();

				expect(anchors).toHaveLength(0);
				expect(document.getElementById("io-notice")?.textContent).toBe("");
				expect(revokeObjectURL).toHaveBeenCalledTimes(1);
			} finally {
				second.destroy();
			}
		} finally {
			restore();
			revokeObjectURL.mockRestore();
		}
	});

	it("destroy() is idempotent — a second call does not throw", () => {
		const { app } = mountApp();
		app.destroy();
		expect(() => app.destroy()).not.toThrow();
	});

	it("clears the diagram SVG from the DOM on destroy", () => {
		const { app } = mountApp();
		expect(document.querySelector("#diagram svg")).not.toBeNull();

		app.destroy();

		expect(document.querySelector("#diagram svg")).toBeNull();
	});

	it("stops reacting to events after destroy: no DOM or storage mutation", () => {
		const { app } = mountApp();
		app.destroy();

		const nodeRowsBefore = document.querySelectorAll("#node-editor .node-row").length;
		const storedBefore = localStorage.getItem(STORAGE_KEY);

		// Asserted directly rather than clicking a query that may have found
		// nothing.
		expect(allByRole(document, "button", "Add node")).toHaveLength(0);
		expect(allByRole(document, "button", "Next palette")).toHaveLength(0);

		expect(document.querySelectorAll("#node-editor .node-row")).toHaveLength(nodeRowsBefore);
		expect(localStorage.getItem(STORAGE_KEY)).toBe(storedBefore);
		// The splitter's own listener teardown is pinned in
		// preview-resizer.test.tsx.
		expect(document.getElementById("preview-splitter")).toBeNull();
	});

	it("a second boot on the same document replaces the first without duplicating its callbacks", () => {
		// Not mountApp(): reinstalling the markup between boots would trivially
		// avoid any leaked-listener bug.
		installMarkup();
		const first = startApp(document);
		first.destroy();

		const app = startApp(document);
		try {
			expect(document.querySelectorAll("#node-editor .node-row")).toHaveLength(4);

			// An intact instance and a leaked listener both end at 5 rows, so
			// the real detectors are the setItem count and the resizer step.
			const realLocalStorage = localStorage;
			const { storage: countingStorage, setItemCalls } = makeCountingStorage();
			Object.defineProperty(globalThis, "localStorage", {
				value: countingStorage,
				configurable: true,
				writable: true,
			});
			try {
				click(byRole(document, "button", "Add node"));
			} finally {
				Object.defineProperty(globalThis, "localStorage", {
					value: realLocalStorage,
					configurable: true,
					writable: true,
				});
			}

			expect(document.querySelectorAll("#node-editor .node-row")).toHaveLength(5);
			expect(setItemCalls.filter((key) => key === STORAGE_KEY)).toHaveLength(1);

			// One click applies the step once (360 + 40 = 400, not 440).
			click(byRole(document, "button", "Make diagram preview larger"));
			expect(localStorage.getItem(PREVIEW_HEIGHT_STORAGE_KEY)).toBe("400");
		} finally {
			app.destroy();
		}
	});

	it("destroy() tears down both current row Sortable instances, including an active-drag clone", () => {
		const { app } = mountApp();

		const nodeRows = requireElement<HTMLElement>("#node-editor .node-rows");
		const linkRows = requireElement<HTMLElement>("#link-editor .link-rows");
		const nodeSortable = Sortable.get(nodeRows);
		const linkSortable = Sortable.get(linkRows);
		expect(nodeSortable).toBeTruthy();
		expect(linkSortable).toBeTruthy();
		if (!linkSortable) throw new Error("unreachable");

		// destroy() landing mid-drag on the link box; pins that the clone
		// cleanup runs on the app's own destroy path, not just in isolation.
		const ghost = document.createElement("div");
		const clone = document.createElement("div");
		document.body.append(ghost, clone);
		Sortable.active = linkSortable;
		Sortable.ghost = ghost;
		Sortable.clone = clone;

		app.destroy();

		expect(document.body.contains(ghost)).toBe(false);
		expect(document.body.contains(clone)).toBe(false);
		expect(Sortable.get(nodeRows)).toBeNull();
		expect(Sortable.get(linkRows)).toBeNull();
	});

	it("surfaces a storage notice on save failure and clears it once saves recover", () => {
		mountApp();

		const notice = () => document.getElementById("storage-notice")?.textContent;
		expect(notice()).toBe("");

		const addNodeButton = byRole<HTMLButtonElement>(document, "button", "Add node");

		// Swapped rather than spied: see makeCountingStorage.
		const originalLocalStorage = localStorage;
		const throwingStorage: Partial<Storage> = {
			setItem: () => {
				throw new Error("QuotaExceededError");
			},
		};
		Object.defineProperty(globalThis, "localStorage", {
			value: throwingStorage,
			configurable: true,
			writable: true,
		});
		try {
			click(addNodeButton);
			expect(notice()).toBe(STORAGE_NOTICE);
		} finally {
			Object.defineProperty(globalThis, "localStorage", {
				value: originalLocalStorage,
				configurable: true,
				writable: true,
			});
		}

		const addNodeButtonAfterFailure = byRole<HTMLButtonElement>(document, "button", "Add node");
		click(addNodeButtonAfterFailure);
		expect(notice()).toBe("");
	});

	it("surfaces a storage notice on a theme-change save failure and clears it once the next theme change recovers", () => {
		mountApp();

		const notice = () => document.getElementById("storage-notice")?.textContent;
		expect(notice()).toBe("");

		const themeButton = document.getElementById("theme-button");

		const originalLocalStorage = localStorage;
		const throwingStorage: Partial<Storage> = {
			setItem: () => {
				throw new Error("QuotaExceededError");
			},
		};
		Object.defineProperty(globalThis, "localStorage", {
			value: throwingStorage,
			configurable: true,
			writable: true,
		});
		try {
			click(themeButton);
			const dialog = document.getElementById("theme-dialog") as HTMLDialogElement;
			click(byRole<HTMLButtonElement>(dialog, "button", "Light"));
			expect(notice()).toBe(STORAGE_NOTICE);
		} finally {
			Object.defineProperty(globalThis, "localStorage", {
				value: originalLocalStorage,
				configurable: true,
				writable: true,
			});
		}

		// The dialog closes after every choice, save outcome regardless.
		click(themeButton);
		const dialogAfterRecovery = document.getElementById("theme-dialog") as HTMLDialogElement;
		click(byRole<HTMLButtonElement>(dialogAfterRecovery, "button", "Dark"));
		expect(notice()).toBe("");
	});
});
