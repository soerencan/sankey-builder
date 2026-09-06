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
 * A minimal Storage backed by its own Map, tracking every setItem key. Used
 * to count persisted saves precisely — swapping the whole `localStorage`
 * global rather than `vi.spyOn(Storage.prototype, ...)`, which happy-dom's
 * per-instance method binding makes unreliable once localStorage has already
 * been touched elsewhere (see the storage-notice test below).
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
 * Wraps document.createElement (for the `<a>` download.ts creates) and the
 * ambient `Image` constructor (for the `<img>` rasterizeSvg constructs) to
 * capture every instance while still delegating to the real implementation —
 * happy-dom has no network stack (an `<img>` never fires a real load event)
 * and no canvas adapter (`getContext("2d")` always returns null), so PNG
 * rasterization's pending state has to be driven and inspected by hand
 * through this.
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
	click(document.getElementById("display-button"));
	click(byRole(document.getElementById("display-dialog") as HTMLElement, "button", "PNG"));
}

describe("application lifecycle", () => {
	it("destroy mid-PNG-rasterization: revokes the object URL exactly once and downloads/reports nothing", async () => {
		const { app } = mountApp();
		const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL");
		const { anchors, restore } = interceptExportElements();
		try {
			clickPngExport();
			// Destroy lands before any load/error event — this app instance's
			// AbortController aborts synchronously, which is what rasterizeSvg's
			// own abort handling relies on to settle without a browser event.
			app.destroy();
			// Unmounts the whole App tree, including the notice region — nothing
			// left to publish a stale notice into.
			expect(document.getElementById("io-notice")).toBeNull();
			// exportPng's .catch runs as a microtask, after this synchronous test
			// body would otherwise return — flush it before asserting on its
			// (absent) effects, or a removed signal.aborted guard would go unnoticed.
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
			// Captured before destroy() detaches it, so this reference still lets
			// the test simulate a browser completion racing destroy — exactly the
			// case rasterizeSvg's exactly-once revoke/settle guards against.
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

		// Unmounting SankeyCanvas runs its own layout-effect cleanup
		// (host.replaceChildren()), the only thing that can remove the svg here.
		expect(document.querySelector("#diagram svg")).toBeNull();
	});

	it("stops reacting to events after destroy: no DOM or storage mutation", () => {
		const { app } = mountApp();
		app.destroy();

		const nodeRowsBefore = document.querySelectorAll("#node-editor .node-row").length;
		const storedBefore = localStorage.getItem(STORAGE_KEY);

		// destroy() unmounts the whole App tree, so neither control exists to
		// click any more — asserted directly, rather than clicking a query that
		// may or may not have found anything.
		expect(allByRole(document, "button", "Add node")).toHaveLength(0);
		expect(allByRole(document, "button", "Next palette")).toHaveLength(0);

		expect(document.querySelectorAll("#node-editor .node-row")).toHaveLength(nodeRowsBefore);
		expect(localStorage.getItem(STORAGE_KEY)).toBe(storedBefore);
		// destroy() unmounts the whole App tree, so the splitter itself is gone —
		// there's no element left to dispatch a keydown at. Its own listener
		// teardown (window pointermove/pointerup/pointercancel removal,
		// in-flight drag cancellation, released pointer capture) is unit-pinned
		// in preview-resizer.test.tsx, not re-proven here.
		expect(document.getElementById("preview-splitter")).toBeNull();
	});

	it("a second boot on the same document replaces the first without duplicating its callbacks", () => {
		// Boots more than once against the same DOM — installMarkup()/startApp()
		// by hand rather than mountApp(), which would reinstall the markup (and
		// so trivially avoid any leaked-listener bug) between boots.
		installMarkup();
		const first = startApp(document);
		first.destroy();

		const app = startApp(document);
		try {
			expect(document.querySelectorAll("#node-editor .node-row")).toHaveLength(4);

			// One click should mutate state exactly once — both an intact instance
			// and a leaked listener from `first` converge on 5 rows, so the real
			// detectors are the setItem call count and the resizer step value below.
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

			// Same proof for the preview resizer's own listeners: one click applies
			// its step exactly once (360 default + 40 step = 400, not 440).
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

		// Simulate destroy() landing mid-drag on the link box. Sortable's own
		// destroy() calls its internal drop handler with no event, which skips
		// the branch that would otherwise remove the floating fallback clone
		// from <body> — this pins that destroySortable's own explicit
		// ghost/clone removal still runs for the app's own destroy() path, not
		// just in isolation.
		const ghost = document.createElement("div");
		const clone = document.createElement("div");
		document.body.append(ghost, clone);
		Sortable.active = linkSortable;
		Sortable.ghost = ghost;
		Sortable.clone = clone;

		app.destroy();

		expect(document.body.contains(ghost)).toBe(false);
		expect(document.body.contains(clone)).toBe(false);
		// Both instances are gone, not just the one mid-drag.
		expect(Sortable.get(nodeRows)).toBeNull();
		expect(Sortable.get(linkRows)).toBeNull();
	});

	it("surfaces a storage notice on save failure and clears it once saves recover", () => {
		mountApp();

		const notice = () => document.getElementById("storage-notice")?.textContent;
		expect(notice()).toBe("");

		const addNodeButton = byRole<HTMLButtonElement>(document, "button", "Add node");

		// happy-dom's Storage binds each method onto an internal target the
		// first time it's accessed (see happy-dom's ClassMethodBinder), and by
		// this point the earlier tests in this file have already forced that —
		// so `vi.spyOn(Storage.prototype, "setItem")` silently stops taking
		// effect. Swapping the whole `localStorage` global for a throwing stub
		// sidesteps that caching rather than fighting it.
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

		// The failed save above still rebuilt the node editor (editors rebuild
		// regardless of validity), which tore down and recreated the button —
		// re-query rather than reuse the now-detached reference.
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

		// ThemeControl's onClick closes the dialog after every set-theme click
		// regardless of the save outcome, so re-open it for the recovery click.
		click(themeButton);
		const dialogAfterRecovery = document.getElementById("theme-dialog") as HTMLDialogElement;
		click(byRole<HTMLButtonElement>(dialogAfterRecovery, "button", "Dark"));
		expect(notice()).toBe("");
	});
});
