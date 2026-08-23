// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { click, fireChange, fireInput, mountApp, requireElement, tick } from "../helpers/mount-app";

/** Retargets the third link to n1, closing a 2-node cycle (n1 -> n3 -> n1) — same setup as characterization.test.ts's makeCycle(). */
function makeCycle(): void {
	const target = requireElement<HTMLSelectElement>('.link-target[data-index="2"]');
	target.value = "n1";
	fireChange(target);
}

describe("NoticeRegion: consolidated notice slots", () => {
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
		// three fixed-id slots (see its own doc comment), so the real risk this
		// guards is Preact discarding and rebuilding the slot's div on every
		// render instead of patching its text in place.
		click(document.querySelector('[data-action="add-node"]'));

		const errorAfter = document.getElementById("error");
		expect(errorAfter).toBe(errorBefore);
		expect(errorAfter?.textContent).toBe(textBefore);
	});

	it("keeps a field-local link-value error out of the root notice region", async () => {
		mountApp();

		const valueInput = requireElement<HTMLInputElement>('.link-value[data-index="0"]');
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
