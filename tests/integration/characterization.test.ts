// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import {
	click,
	fireChange,
	fireInput,
	getStoredState,
	mountApp,
	requireElement,
	tick,
} from "../helpers/mount-app";

// Pinned verbatim from src/app/start-app.ts's STORAGE_NOTICE — app/start-app.ts doesn't export
// it, so this hardcodes (and thereby pins) the user-visible copy.
const STORAGE_NOTICE =
	"Changes can't be saved in this browser right now (storage may be full or unavailable). " +
	"The diagram keeps working, but edits won't survive closing or reloading this tab — " +
	"try freeing up space or leaving private/incognito mode.";

/** Retargets the third link to n1, closing a 2-node cycle (n1 -> n3 -> n1). */
function makeCycle(): void {
	const target = requireElement<HTMLSelectElement>('.link-target[data-index="2"]');
	target.value = "n1";
	fireChange(target);
}

/** Reverses makeCycle(), restoring the default (valid) third link. */
function fixCycle(): void {
	const target = requireElement<HTMLSelectElement>('.link-target[data-index="2"]');
	target.value = "n4";
	fireChange(target);
}

describe("characterization: pre-Preact-migration behavior", () => {
	it("shows a graph error and a storage failure notice simultaneously, then clears only the storage notice once storage recovers", () => {
		mountApp();

		const errorText = () => document.getElementById("error")?.textContent;
		const storageText = () => document.getElementById("storage-notice")?.textContent;
		expect(errorText()).toBe("");
		expect(storageText()).toBe("");

		// happy-dom's Storage binds each method onto an internal target the
		// first time it's accessed, which makes vi.spyOn(Storage.prototype, ...)
		// unreliable once localStorage has already been touched — swap the whole
		// `localStorage` global for a throwing stub instead (see lifecycle.test.ts).
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
			// Tone classes (PLAN.md's Notice policy: graph is always "error",
			// storage-unavailable is always "warning") on the two active slots.
			expect(document.getElementById("error")?.className).toBe("notice-error");
			expect(document.getElementById("storage-notice")?.className).toBe("notice-warning");
			// Display order — graph, storage, then I/O (PLAN.md's Notice
			// policy) — is the fixed slot order NoticeRegion renders, not
			// something either notice's presence can reorder.
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
		const nameInput = requireElement<HTMLInputElement>('.node-name[data-id="n1"]');
		nameInput.value = "Lignite";
		fireInput(nameInput);

		expect(errorText()).toContain("cycle");
		expect(storageText()).toBe("");
	});

	it("keeps the same last-valid <svg> element across an invalid edit, then renders a new one once the graph recovers", () => {
		mountApp();

		const svgBefore = document.querySelector("#diagram svg");
		expect(svgBefore).not.toBeNull();

		makeCycle();
		expect(document.getElementById("error")?.textContent).toContain("cycle");
		// Identity, not just presence — refresh() bails before renderDiagram on
		// an invalid graph, so the last-good element must be the exact same node.
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);

		fixCycle();
		expect(document.getElementById("error")?.textContent).toBe("");
		const svgAfter = document.querySelector("#diagram svg");
		expect(svgAfter).not.toBeNull();
		expect(svgAfter).not.toBe(svgBefore);
	});

	it("SVG-exports the visible last-valid diagram while the current graph is invalid", async () => {
		mountApp();

		const rectsBefore = document.querySelectorAll("#diagram svg rect").length;
		expect(rectsBefore).toBeGreaterThan(0);

		makeCycle();
		expect(document.getElementById("error")?.textContent).toContain("cycle");

		// A second committed edit while still invalid: state changes (n1's name),
		// but refresh() bails before renderDiagram, so the on-screen svg — and
		// therefore the export below — must keep showing the OLD label. Node
		// count doesn't change (rectsBefore alone can't tell stale from fresh),
		// so this label swap is the real discriminator for "export what you see".
		const nameInput = requireElement<HTMLInputElement>('.node-name[data-id="n1"]');
		const oldName = nameInput.value;
		nameInput.value = "Renamed For Export Test";
		fireInput(nameInput);
		expect(document.getElementById("error")?.textContent).toContain("cycle");

		const createObjectURL = vi.spyOn(URL, "createObjectURL");
		const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		let blob: Blob | undefined;
		// Capture the blob from inside the mock implementation itself, not via
		// mock.calls afterward — mockRestore() clears recorded calls, so reading
		// mock.calls after restore (as this test previously did) is a latent
		// ordering hazard, not a documented guarantee.
		createObjectURL.mockImplementation((b) => {
			blob = b as Blob;
			return "blob:fake";
		});
		try {
			const trigger = document.getElementById("diagram-export-button");
			const dialog = document.getElementById("diagram-export-dialog") as HTMLDialogElement;
			click(trigger);
			click(dialog.querySelector('[data-action="export-svg"]'));
		} finally {
			createObjectURL.mockRestore();
			revokeObjectURL.mockRestore();
		}

		expect(blob).toBeDefined();
		const svgText = await (blob as Blob).text();
		// +1: serializeDiagramSvg adds one opaque background rect ahead of the
		// node rects (see export.ts) — not itself a node.
		expect((svgText.match(/<rect/g) ?? []).length).toBe(rectsBefore + 1);
		expect(svgText).toContain(oldName);
		expect(svgText).not.toContain("Renamed For Export Test");
		// Deliberate pin change (PLAN.md's Notice policy): a successful export no
		// longer installs a visible notice — the download itself is the feedback.
		expect(document.getElementById("io-notice")?.textContent).toBe("");
	});

	it("keeps focus on a link-value input through its own committed valid keystroke, which still redraws the diagram", () => {
		mountApp();

		const svgBefore = document.querySelector("#diagram svg");
		expect(svgBefore).not.toBeNull();

		const valueInput = requireElement<HTMLInputElement>('.link-value[data-index="0"]');
		valueInput.focus();
		expect(document.activeElement).toBe(valueInput);

		valueInput.value = "20";
		fireInput(valueInput);

		expect(document.activeElement).toBe(valueInput);
		const svgAfter = document.querySelector("#diagram svg");
		expect(svgAfter).not.toBeNull();
		expect(svgAfter).not.toBe(svgBefore);
		expect(getStoredState().links[0].value).toBe(20);
	});

	it("leaves an invalid link-value draft untouched by an unrelated committed rename", async () => {
		mountApp();

		const valueInput = requireElement<HTMLInputElement>('.link-value[data-index="0"]');
		const describedbyId = valueInput.getAttribute("aria-describedby");
		const errorEl = describedbyId ? document.getElementById(describedbyId) : null;
		expect(errorEl).not.toBeNull();
		if (!errorEl) throw new Error("unreachable");

		valueInput.value = "abc";
		fireInput(valueInput);
		await tick();

		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(errorEl.textContent).toBe("Enter a plain number greater than 0.");

		// The link row's draft is row-local state, keyed by link (see
		// app/view.ts's createLinkProjector) rather than array index — an
		// unrelated rename's re-render patches this row's DOM in place instead
		// of rebuilding it, so the draft/error state must survive intact.
		const nameInput = requireElement<HTMLInputElement>('.node-name[data-id="n1"]');
		nameInput.value = "Lignite";
		fireInput(nameInput);

		// Identity, not just value/attribute equality: if the link row were ever
		// rebuilt instead of patched, the rebuilt row would carry the same
		// default value/attributes on a *detached* node and these assertions
		// would pass while the visible draft was actually lost.
		expect(requireElement<HTMLInputElement>('.link-value[data-index="0"]')).toBe(valueInput);
		expect(valueInput.value).toBe("abc");
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(errorEl.textContent).toBe("Enter a plain number greater than 0.");

		// Confirms the rename itself actually reached the app (and the link
		// editor's re-projected node options picked it up) rather than the
		// assertions above merely tolerating a no-op rename.
		const n1Option = requireElement<HTMLOptionElement>(
			'#link-editor option.node-option[value="n1"]',
		);
		expect(n1Option.textContent).toBe("Lignite");
	});

	it("keeps the diagram SVG untouched by a row-local invalid draft that never commits", async () => {
		mountApp();

		const svgBefore = document.querySelector("#diagram svg");
		const valueInput = requireElement<HTMLInputElement>('.link-value[data-index="0"]');

		valueInput.value = "abc";
		fireInput(valueInput);
		await tick();

		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		// The draft is row-local state (see link-row.tsx) and never reaches the
		// controller, so it can't touch lastValidRequest — same <svg> element,
		// not just equivalent markup.
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);
	});
});
