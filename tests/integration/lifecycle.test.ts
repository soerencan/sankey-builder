// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { startApp } from "../../src/app/start-app";
import { PREVIEW_HEIGHT_STORAGE_KEY } from "../../src/features/diagram/preview-resizer";
import { STORAGE_KEY } from "../../src/platform/storage";
import { click, installMarkup, mountApp } from "../helpers/mount-app";

// Pinned verbatim from src/app/start-app.ts's STORAGE_NOTICE — app/start-app.ts doesn't export
// it, so this hardcodes (and thereby pins) the user-visible copy.
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

describe("application lifecycle", () => {
	it("destroy() is idempotent — a second call does not throw", () => {
		const { app } = mountApp();
		app.destroy();
		expect(() => app.destroy()).not.toThrow();
	});

	it("stops reacting to events after destroy: no DOM or storage mutation", () => {
		const { app } = mountApp();
		app.destroy();

		const nodeRowsBefore = document.querySelectorAll("#node-editor .node-row").length;
		const storedBefore = localStorage.getItem(STORAGE_KEY);

		click(document.querySelector('[data-action="add-node"]'));
		click(document.querySelector('[data-action="palette-next"]'));
		document
			.getElementById("preview-splitter")
			?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

		expect(document.querySelectorAll("#node-editor .node-row")).toHaveLength(nodeRowsBefore);
		expect(localStorage.getItem(STORAGE_KEY)).toBe(storedBefore);
		expect(localStorage.getItem(PREVIEW_HEIGHT_STORAGE_KEY)).toBeNull();
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
				click(document.querySelector('[data-action="add-node"]'));
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
			click(document.querySelector('[data-action="preview-larger"]'));
			expect(localStorage.getItem(PREVIEW_HEIGHT_STORAGE_KEY)).toBe("400");
		} finally {
			app.destroy();
		}
	});

	it("surfaces a storage notice on save failure and clears it once saves recover", () => {
		mountApp();

		const notice = () => document.getElementById("storage-notice")?.textContent;
		expect(notice()).toBe("");

		const addNodeButton = document.querySelector<HTMLButtonElement>('[data-action="add-node"]');
		expect(addNodeButton).not.toBeNull();

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
		const addNodeButtonAfterFailure = document.querySelector<HTMLButtonElement>(
			'[data-action="add-node"]',
		);
		click(addNodeButtonAfterFailure);
		expect(notice()).toBe("");
	});
});
