// @vitest-environment happy-dom

import { Window } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startApp } from "../../src/app/start-app";
import { STORAGE_KEY } from "../../src/platform/storage";
import { bodyMarkup } from "../helpers/fixture";

/**
 * A second, fully independent window/document — not the ambient
 * `document`/`window` this file's own `@vitest-environment happy-dom`
 * pragma installs as globals. Stands in for a real embedding where the app's
 * document isn't the same realm as whatever module-level globals a careless
 * implementation might reach for (e.g. a second `startApp()` instance
 * mounted into a same-origin iframe). happy-dom shares several DOM
 * constructors (Element, HTMLElement, HTMLInputElement, Node, MouseEvent,
 * InputEvent, Blob — confirmed empirically) across separate `Window`
 * instances in this version, so `instanceof` checks against those
 * specifically can't be proven red/green this way; `AbortController`,
 * `AbortSignal`, `URL`, and `setTimeout` are NOT shared and are the sites
 * this file can actually discriminate.
 */
function createOtherWindow(): Window {
	const otherWindow = new Window();
	otherWindow.document.body.innerHTML = bodyMarkup();
	return otherWindow;
}

// happy-dom's own Element/Event types (returned by otherWindow.document.*)
// don't structurally match lib.dom's — real, distinct classes, which is
// exactly the point of this file — so the boundary casts below bridge them.
function queryIn(otherWindow: Window, selector: string): Element | null {
	return otherWindow.document.querySelector(selector) as unknown as Element | null;
}

function elementByIdIn(otherWindow: Window, id: string): Element | null {
	return otherWindow.document.getElementById(id) as unknown as Element | null;
}

function clickIn(otherWindow: Window, target: Element | null | undefined): void {
	target?.dispatchEvent(new otherWindow.MouseEvent("click", { bubbles: true }) as unknown as Event);
}

describe("cross-realm DOM contract", () => {
	let otherWindow: Window | undefined;

	afterEach(async () => {
		await otherWindow?.happyDOM.close();
		otherWindow = undefined;
		localStorage.clear();
	});

	it("renders, mutates and persists state, and destroys cleanly against a document from another window", () => {
		otherWindow = createOtherWindow();
		localStorage.clear();

		const app = startApp(otherWindow.document as unknown as Document);

		expect(otherWindow.document.querySelector("#diagram svg")).not.toBeNull();

		const nodeRowsBefore = otherWindow.document.querySelectorAll("#node-editor .node-row").length;
		clickIn(otherWindow, queryIn(otherWindow, '[data-action="add-node"]'));
		expect(otherWindow.document.querySelectorAll("#node-editor .node-row")).toHaveLength(
			nodeRowsBefore + 1,
		);

		// Persisted into otherWindow's OWN localStorage, not this test file's
		// ambient one — happy-dom gives every Window instance its own isolated
		// Storage (confirmed empirically), so this is a real cross-realm proof,
		// not just a same-object coincidence.
		const stored = otherWindow.localStorage.getItem(STORAGE_KEY);
		expect(stored).not.toBeNull();
		expect(JSON.parse(stored ?? "{}").nodes).toHaveLength(nodeRowsBefore + 1);
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

		expect(() => app.destroy()).not.toThrow();
		const rowsAfterDestroy = otherWindow.document.querySelectorAll("#node-editor .node-row").length;
		clickIn(otherWindow, queryIn(otherWindow, '[data-action="add-node"]'));
		expect(otherWindow.document.querySelectorAll("#node-editor .node-row")).toHaveLength(
			rowsAfterDestroy,
		);
	});

	it("creates its AbortController from the document's own window, not the ambient global", () => {
		otherWindow = createOtherWindow();

		// Wraps otherWindow's own AbortController rather than swapping in an
		// unrelated stub, so `new AbortController()` (the ambient ctor this test
		// file's realm resolves) stays a legitimate, working AbortController
		// too — the only discriminator is which one start-app.ts actually calls.
		let constructedByOtherWindow = 0;
		class SpyAbortController extends otherWindow.AbortController {
			constructor() {
				super();
				constructedByOtherWindow++;
			}
		}
		// @ts-expect-error -- test-only stand-in for otherWindow's own constructor
		otherWindow.AbortController = SpyAbortController;

		const app = startApp(otherWindow.document as unknown as Document);
		try {
			expect(constructedByOtherWindow).toBe(1);
		} finally {
			app.destroy();
		}
	});

	it("downloads exports through the document's own window's URL and setTimeout, not the ambient global", () => {
		otherWindow = createOtherWindow();
		const app = startApp(otherWindow.document as unknown as Document);

		const ownCreateObjectURL = vi
			.spyOn(otherWindow.URL, "createObjectURL")
			.mockReturnValue("blob:other-window-fake");
		const ownRevokeObjectURL = vi
			.spyOn(otherWindow.URL, "revokeObjectURL")
			.mockImplementation(() => {});
		const ownSetTimeout = vi.spyOn(otherWindow, "setTimeout");
		const ambientCreateObjectURL = vi.spyOn(URL, "createObjectURL");
		const ambientSetTimeout = vi.spyOn(globalThis, "setTimeout");

		try {
			clickIn(otherWindow, elementByIdIn(otherWindow, "export-button"));

			expect(ownCreateObjectURL).toHaveBeenCalledTimes(1);
			expect(ownSetTimeout).toHaveBeenCalledTimes(1);
			expect(ambientCreateObjectURL).not.toHaveBeenCalled();
			expect(ambientSetTimeout).not.toHaveBeenCalled();
		} finally {
			ownCreateObjectURL.mockRestore();
			ownRevokeObjectURL.mockRestore();
			ownSetTimeout.mockRestore();
			ambientCreateObjectURL.mockRestore();
			ambientSetTimeout.mockRestore();
			app.destroy();
		}
	});
});
