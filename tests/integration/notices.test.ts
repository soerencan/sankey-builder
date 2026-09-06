// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import {
	byRole,
	click,
	fireChange,
	fireInput,
	mountApp,
	requireElement,
	tick,
} from "../helpers/mount-app";

/** Retargets the third link to n1, closing a 2-node cycle (n1 -> n3 -> n1). */
function makeCycle(): void {
	const target = byRole<HTMLSelectElement>(document, "combobox", "Target for link 3");
	target.value = "n1";
	fireChange(target);
}

// app/start-app.ts doesn't export STORAGE_NOTICE, so this hardcodes (and
// thereby pins) the user-visible copy.
const STORAGE_NOTICE =
	"Changes can't be saved in this browser right now (storage may be full or unavailable). " +
	"The diagram keeps working, but edits won't survive closing or reloading this tab — " +
	"try freeing up space or leaving private/incognito mode.";

describe("NoticeRegion: consolidated notice slots", () => {
	it("shows a graph error and a storage failure notice simultaneously, in fixed slot order, then clears only the storage notice once storage recovers", () => {
		mountApp();

		const errorText = () => document.getElementById("error")?.textContent;
		const storageText = () => document.getElementById("storage-notice")?.textContent;
		expect(errorText()).toBe("");
		expect(storageText()).toBe("");

		// happy-dom's Storage binds each method onto an internal target the
		// first time it's accessed, which makes vi.spyOn(Storage.prototype, ...)
		// unreliable once localStorage has already been touched — swap the whole
		// `localStorage` global for a throwing stub instead.
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
			makeCycle();

			expect(errorText()).toContain("cycle");
			expect(storageText()).toBe(STORAGE_NOTICE);
			// Tone classes on the two active slots: graph is always "error",
			// storage-unavailable is always "warning".
			expect(document.getElementById("error")?.className).toBe("notice-error");
			expect(document.getElementById("storage-notice")?.className).toBe("notice-warning");
			// Display order — graph, storage, then I/O — is the fixed slot order
			// NoticeRegion renders, not something either notice's presence can
			// reorder.
			expect(
				Array.from(document.querySelectorAll<HTMLElement>(".notice-region > div")).map(
					(slot) => slot.id,
				),
			).toEqual(["error", "storage-notice", "io-notice"]);
		} finally {
			Object.defineProperty(globalThis, "localStorage", {
				value: originalLocalStorage,
				configurable: true,
				writable: true,
			});
		}

		// A further committed edit with working storage: the graph is still
		// invalid (the cycle was never fixed), so the graph error persists, but
		// the storage notice clears now that saves succeed again.
		const nameInput = byRole<HTMLInputElement>(document, "textbox", "Name for Coal");
		nameInput.value = "Lignite";
		fireInput(nameInput);

		expect(errorText()).toContain("cycle");
		expect(storageText()).toBe("");
	});

	it("graph error alone: only the #error slot is active, in error tone, with storage and io inactive", () => {
		mountApp();

		makeCycle();

		const error = document.getElementById("error");
		expect(error?.textContent).toContain("cycle");
		expect(error?.className).toBe("notice-error");

		const storage = document.getElementById("storage-notice");
		const io = document.getElementById("io-notice");
		expect(storage?.textContent).toBe("");
		expect(io?.textContent).toBe("");
		// NoticeRegion omits `class` entirely for an inactive slot (see
		// shared/notice.tsx) rather than assigning an empty string.
		expect(storage?.getAttribute("class")).toBeNull();
		expect(io?.getAttribute("class")).toBeNull();
	});

	it("does not recreate the graph notice element for an unrelated committed action that leaves the error active", () => {
		mountApp();

		makeCycle();
		const errorBefore = document.getElementById("error");
		const textBefore = errorBefore?.textContent;
		expect(textBefore).toContain("cycle");

		// add-node is unrelated to the n1/n3 cycle path and doesn't touch either
		// node's name, so the cycle message (built from node names, see
		// model/validation.ts) is untouched too — this is the happy-dom proxy for
		// "no repeated live-region announcement": NoticeRegion always renders all
		// three fixed-id slots unconditionally, so the real risk this guards is
		// Preact discarding and rebuilding the slot's div on every render instead
		// of patching its text in place.
		click(byRole(document, "button", "Add node"));

		const errorAfter = document.getElementById("error");
		expect(errorAfter).toBe(errorBefore);
		expect(errorAfter?.textContent).toBe(textBefore);
	});

	it("keeps a field-local link-value error out of the root notice region", async () => {
		mountApp();

		const valueInput = byRole<HTMLInputElement>(document, "textbox", "Value for link 1");
		valueInput.value = "abc";
		fireInput(valueInput);
		await tick();

		const describedbyId = valueInput.getAttribute("aria-describedby");
		const fieldError = describedbyId ? document.getElementById(describedbyId) : null;
		expect(fieldError?.textContent).toBe("Enter a plain number greater than 0.");

		const noticeRegion = requireElement<HTMLElement>(".notice-region");
		expect(fieldError).not.toBeNull();
		if (!fieldError) throw new Error("unreachable");
		expect(noticeRegion.contains(fieldError)).toBe(false);
		// The region's only children are its three fixed kind slots — a field
		// error never lands as a fourth.
		expect(noticeRegion.children).toHaveLength(3);
	});
});
