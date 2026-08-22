// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AppHandle } from "../src/app";
import { startApp } from "../src/app";
import { STORAGE_KEY } from "../src/persist";
import { PREVIEW_HEIGHT_STORAGE_KEY } from "../src/preview-resizer";
import { loadD3Global } from "./helpers/d3-global";
import { bodyMarkup } from "./helpers/fixture";
import { loadSortableGlobal } from "./helpers/sortable-global";

let app: AppHandle | undefined;

beforeAll(() => {
	loadD3Global();
	loadSortableGlobal();
});

beforeEach(() => {
	document.body.innerHTML = bodyMarkup();
	localStorage.clear();
});

afterEach(() => {
	app?.destroy();
	app = undefined;
});

function click(target: Element | null): void {
	target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

/**
 * A minimal Storage backed by its own Map, tracking every setItem key. Used
 * to count persisted saves precisely — swapping the whole `localStorage`
 * global rather than `vi.spyOn(Storage.prototype, ...)`, which happy-dom's
 * per-instance method binding makes unreliable once localStorage has already
 * been touched elsewhere (see tests/app.test.ts's storage-notice test).
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
		app = startApp(document);
		app.destroy();
		expect(() => app?.destroy()).not.toThrow();
	});

	it("stops reacting to events after destroy: no DOM or storage mutation", () => {
		app = startApp(document);
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
		const first = startApp(document);
		first.destroy();

		app = startApp(document);
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
	});
});
