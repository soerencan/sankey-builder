// @vitest-environment happy-dom

import Sortable from "sortablejs";
import { describe, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "../../src/platform/storage";
import {
	click,
	fireChange,
	fireInput,
	getStoredState,
	mountApp,
	requireElement,
	tick,
} from "../helpers/mount-app";

describe("node & link editing", () => {
	it("round-trips a basic mutation: add node updates editor, diagram, and storage", () => {
		mountApp();

		const addNodeButton = document.querySelector<HTMLButtonElement>('[data-action="add-node"]');
		expect(addNodeButton).not.toBeNull();
		click(addNodeButton);

		expect(document.querySelectorAll("#node-editor .node-row")).toHaveLength(5);
		expect(document.querySelectorAll("#diagram svg rect")).toHaveLength(5);

		const stored = localStorage.getItem(STORAGE_KEY);
		expect(stored).not.toBeNull();
		const parsed = JSON.parse(stored ?? "{}");
		expect(parsed.nodes.some((n: { id: string }) => n.id === "n5")).toBe(true);
	});

	it("leaves state untouched on empty/invalid value edits and restores the text on blur", async () => {
		mountApp();

		const svgBefore = document.querySelector("#diagram svg");
		expect(svgBefore).not.toBeNull();

		const valueInput = document.querySelector<HTMLInputElement>('.link-value[data-index="0"]');
		expect(valueInput).not.toBeNull();
		if (!valueInput) throw new Error("unreachable");

		valueInput.value = "";
		fireInput(valueInput);
		await tick();

		expect(document.getElementById("error")?.textContent).toBe("");
		expect(valueInput.hasAttribute("aria-invalid")).toBe(false);
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);
		expect(document.contains(valueInput)).toBe(true);
		expect(getStoredState().links[0].value).toBe(10);

		valueInput.value = "abc";
		fireInput(valueInput);
		// The row-local draft's aria-invalid marker is set by a Preact render,
		// which — unlike a committed action's controller refresh() — is only
		// scheduled, not run synchronously within this event (see tick()'s doc
		// comment in tests/helpers/mount-app.ts).
		await tick();

		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(document.getElementById("error")?.textContent).toBe("");
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);
		expect(getStoredState().links[0].value).toBe(10);

		// Blur restoration, unlike per-keystroke draft feedback, is a
		// synchronous DOM write (see link-row.tsx's handleChange) — no tick()
		// needed here.
		fireChange(valueInput);
		expect(valueInput.value).toBe("10");
		expect(valueInput.hasAttribute("aria-invalid")).toBe(false);

		// After a *valid* edit, blur must not rewrite the text — "5." parses to
		// 5 but the trailing dot is preserved so the user can keep typing.
		valueInput.value = "5.";
		fireInput(valueInput);
		expect(getStoredState().links[0].value).toBe(5);
		fireChange(valueInput);
		expect(valueInput.value).toBe("5.");
		expect(getStoredState().links[0].value).toBe(5);

		valueInput.value = "20";
		fireInput(valueInput);

		expect(document.getElementById("error")?.textContent).toBe("");
		const svgAfter = document.querySelector("#diagram svg");
		expect(svgAfter).not.toBeNull();
		expect(svgAfter).not.toBe(svgBefore);
		expect(document.querySelectorAll("#diagram svg rect")).toHaveLength(4);
		expect(getStoredState().links[0].value).toBe(20);
	});

	it("shows an inline, accessible error message for an invalid link value and clears it once valid", async () => {
		mountApp();

		const valueInput = requireElement<HTMLInputElement>('.link-value[data-index="0"]');

		const describedbyId = valueInput.getAttribute("aria-describedby");
		expect(describedbyId).toBeTruthy();
		const errorEl = describedbyId ? document.getElementById(describedbyId) : null;
		expect(errorEl).not.toBeNull();
		if (!errorEl) throw new Error("unreachable");

		expect(errorEl.textContent).toBe("");

		valueInput.value = "abc";
		fireInput(valueInput);
		await tick();

		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(errorEl.textContent).toBe("Enter a plain number greater than 0.");

		// Further invalid keystrokes keep the message (not cleared on every
		// keypress, only when the value actually becomes valid or blank).
		valueInput.value = "abcd";
		fireInput(valueInput);
		await tick();

		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(errorEl.textContent).toBe("Enter a plain number greater than 0.");

		valueInput.value = "20";
		fireInput(valueInput);

		expect(valueInput.hasAttribute("aria-invalid")).toBe(false);
		expect(errorEl.textContent).toBe("");

		valueInput.value = "9999999999999999";
		fireInput(valueInput);
		await tick();
		expect(errorEl.textContent).toBe("Enter a number no greater than 1000000000000000.");

		// Over 4 fractional digits, set directly (bypassing beforeinput's
		// keystroke/paste interception), still reaches the message branch.
		valueInput.value = "0.00001";
		fireInput(valueInput);
		await tick();
		expect(errorEl.textContent).toBe("Enter a number with up to 4 decimal places.");

		fireChange(valueInput);
		expect(valueInput.value).toBe("20");
		expect(valueInput.hasAttribute("aria-invalid")).toBe(false);
		expect(errorEl.textContent).toBe("");
	});

	it("pins the exact error message for other ambiguous link-value inputs, ahead of a parser refactor", async () => {
		mountApp();

		const valueInput = requireElement<HTMLInputElement>('.link-value[data-index="0"]');
		const describedbyId = valueInput.getAttribute("aria-describedby");
		const errorEl = describedbyId ? document.getElementById(describedbyId) : null;
		expect(errorEl).not.toBeNull();
		if (!errorEl) throw new Error("unreachable");

		// Exponent notation isn't the plain-decimal format parseLinkValue
		// requires, so it falls to the generic catch-all message rather than
		// the maximum-value one, even though 1e20 is itself above MAX_LINK_VALUE.
		valueInput.value = "1e20";
		fireInput(valueInput);
		await tick();
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(errorEl.textContent).toBe("Enter a plain number greater than 0.");

		// A zero value with excess fractional precision hits the precision
		// message first — exceedsFractionDigits is checked ahead of the
		// non-positive rule in linkValueErrorMessage, so this is NOT the
		// "greater than 0" message despite the parsed value being 0.
		valueInput.value = "0.00000";
		fireInput(valueInput);
		await tick();
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(errorEl.textContent).toBe("Enter a number with up to 4 decimal places.");

		// Above the maximum AND over-precise: the precision message still
		// wins, same ordering as above.
		valueInput.value = "1000000000000001.00001";
		fireInput(valueInput);
		await tick();
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(errorEl.textContent).toBe("Enter a number with up to 4 decimal places.");

		valueInput.value = "   ";
		fireInput(valueInput);
		await tick();
		expect(valueInput.hasAttribute("aria-invalid")).toBe(false);
		expect(errorEl.textContent).toBe("");
		expect(getStoredState().links[0].value).toBe(10);
	});

	it("intercepts the 4-decimal cap at beforeinput (block keystroke, truncate paste)", async () => {
		mountApp();

		const valueInput = requireElement<HTMLInputElement>('.link-value[data-index="0"]');

		// happy-dom does not run the native editing pipeline for beforeinput, so
		// these assert defaultPrevented (+ programmatic effects the handler
		// applies itself), never a value the browser would have inserted.
		const beforeinput = (init: InputEventInit) => {
			const ev = new InputEvent("beforeinput", { bubbles: true, cancelable: true, ...init });
			valueInput.dispatchEvent(ev);
			return ev;
		};

		valueInput.value = "1.2345";
		valueInput.setSelectionRange(6, 6);
		expect(beforeinput({ inputType: "insertText", data: "6" }).defaultPrevented).toBe(true);
		expect(valueInput.value).toBe("1.2345");

		valueInput.value = "1.234";
		valueInput.setSelectionRange(5, 5);
		expect(beforeinput({ inputType: "insertText", data: "5" }).defaultPrevented).toBe(false);

		// Deletions carry no data, so they're never intercepted — even from an
		// already over-precise value.
		valueInput.value = "1.23456";
		valueInput.setSelectionRange(7, 7);
		expect(beforeinput({ inputType: "deleteContentBackward", data: null }).defaultPrevented).toBe(
			false,
		);

		valueInput.value = "";
		valueInput.setSelectionRange(0, 0);
		expect(beforeinput({ inputType: "insertFromPaste", data: "1.23456789" }).defaultPrevented).toBe(
			true,
		);
		expect(valueInput.value).toBe("1.2345");
		// Caret lands at the end of the inserted region, clamped to the clip point.
		expect(valueInput.selectionStart).toBe(6);
		expect(valueInput.hasAttribute("aria-invalid")).toBe(false);
		expect(getStoredState().links[0].value).toBe(1.2345);

		// A mid-string selection (not just a caret) exercises the
		// slice+data+slice splice non-degenerately.
		valueInput.value = "12.3400";
		valueInput.setSelectionRange(5, 7);
		expect(beforeinput({ inputType: "insertFromPaste", data: "56789" }).defaultPrevented).toBe(
			true,
		);
		expect(valueInput.value).toBe("12.3456");
		expect(valueInput.selectionStart).toBe(7);
		expect(getStoredState().links[0].value).toBe(12.3456);

		valueInput.value = "";
		valueInput.setSelectionRange(0, 0);
		expect(beforeinput({ inputType: "insertFromPaste", data: "0.00001" }).defaultPrevented).toBe(
			true,
		);
		// The truncated value/caret are synchronous DOM writes the beforeinput
		// handler must make itself (having just prevented the browser's own
		// insertion) — but the invalid draft's aria-invalid marker is a Preact
		// render, scheduled rather than run inline; see tick()'s doc comment.
		expect(valueInput.value).toBe("0.0000");
		await tick();
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(getStoredState().links[0].value).toBe(12.3456);

		// A garbage paste is not intercepted — it falls through to the input
		// handler's highlight path.
		valueInput.value = "";
		valueInput.setSelectionRange(0, 0);
		expect(beforeinput({ inputType: "insertFromPaste", data: "abc" }).defaultPrevented).toBe(false);
		valueInput.value = "abc";
		fireInput(valueInput);
		await tick();
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
	});

	it("invalid committed state (link-endpoint cycle) persists to storage while the diagram keeps the last valid SVG", () => {
		mountApp();

		const svgBefore = document.querySelector("#diagram svg");
		expect(svgBefore).not.toBeNull();
		const svgHtmlBefore = svgBefore?.outerHTML;

		// Retargeting the third link to n1 closes a 2-node cycle without
		// touching node count/shape — isolates the cycle-invalid path from any
		// other validation failure.
		const target = requireElement<HTMLSelectElement>('.link-target[data-index="2"]');
		target.value = "n1";
		fireChange(target);

		expect(document.getElementById("error")?.textContent).toContain("cycle");

		// The invalid graph is still committed to storage — there is no
		// "last-good state" in storage, only the last-good diagram.
		const stored = getStoredState();
		expect(stored.links[2].target).toBe("n1");

		expect(document.querySelector("#diagram svg")).toBe(svgBefore);
		expect(document.querySelector("#diagram svg")?.outerHTML).toBe(svgHtmlBefore);
	});

	it("invalid draft: no persist, no notice change, no redraw", async () => {
		mountApp();

		// Give #io-notice non-empty content first (a repaired import's warning —
		// export success installs no notice under the current policy, so it
		// can't seed this the way it once did) so "the notice doesn't change"
		// below is a real assertion rather than two empty strings.
		const payload = {
			nodes: [
				{ id: "n1", name: "X" },
				{ id: "n2", name: "Y" },
			],
			links: [{ source: "n1", target: "gone", value: 1 }],
			settings: {},
		};
		const file = new File([JSON.stringify(payload)], "sankey.json", { type: "application/json" });
		const input = document.getElementById("import-file") as HTMLInputElement;
		Object.defineProperty(input, "files", { value: [file], configurable: true, writable: true });
		fireChange(input);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(document.getElementById("io-notice")?.textContent).toBe(
			"Imported 2 nodes, 1 links. Adjustments: link 1: unknown target — left unassigned.",
		);

		const valueInput = requireElement<HTMLInputElement>('.link-value[data-index="0"]');
		const storedBefore = localStorage.getItem(STORAGE_KEY);
		const svgBefore = document.querySelector("#diagram svg");
		const errorBefore = document.getElementById("error")?.textContent;
		const noticeBefore = document.getElementById("io-notice")?.textContent;

		// An invalid draft only ever updates the field's own error state — the
		// rest of the app (storage, validation banner, I/O notice, diagram) must
		// be byte-for-byte untouched.
		valueInput.value = "abc";
		fireInput(valueInput);
		await tick();

		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(localStorage.getItem(STORAGE_KEY)).toBe(storedBefore);
		expect(document.getElementById("error")?.textContent).toBe(errorBefore);
		expect(document.getElementById("io-notice")?.textContent).toBe(noticeBefore);
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);

		valueInput.value = "";
		fireInput(valueInput);
		await tick();

		expect(valueInput.hasAttribute("aria-invalid")).toBe(false);
		expect(localStorage.getItem(STORAGE_KEY)).toBe(storedBefore);
		expect(document.getElementById("error")?.textContent).toBe(errorBefore);
		expect(document.getElementById("io-notice")?.textContent).toBe(noticeBefore);
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);
	});

	it("node deletion cascades: rows for a deleted link disappear, but an invalid draft on a surviving link (whose index shifts) persists", async () => {
		mountApp();

		// Draft goes on the n3->n4 link at index 2 — AFTER the link that's about
		// to be cascade-deleted, so its own index shifts (2 -> 1). Keying rows by
		// array index instead of link identity would make this row (now index 1)
		// pick up whatever the *previous* index-1 row (n2->n3, deleted) happened
		// to render, silently discarding the draft instead of carrying it along.
		const valueInput = requireElement<HTMLInputElement>('.link-value[data-index="2"]');
		valueInput.value = "abc";
		fireInput(valueInput);
		await tick();
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");

		// Deleting n2 cascades to remove the n2->n3 link at index 1 (see
		// model/graph.ts's deleteNode), leaving the edited n3->n4 link — same
		// Link object, same view key — as the new row 1.
		click(requireElement<HTMLButtonElement>('.node-delete[data-id="n2"]'));

		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(2);
		const survivingValueInput = requireElement<HTMLInputElement>('.link-value[data-index="1"]');
		expect(survivingValueInput).toBe(valueInput);
		expect(survivingValueInput.value).toBe("abc");
		expect(survivingValueInput.getAttribute("aria-invalid")).toBe("true");
		const describedbyId = survivingValueInput.getAttribute("aria-describedby");
		const errorEl = describedbyId ? document.getElementById(describedbyId) : null;
		expect(errorEl?.textContent).toBe("Enter a plain number greater than 0.");

		// The other surviving link (n1->n3, untouched, now row 0) is unaffected.
		const otherValueInput = requireElement<HTMLInputElement>('.link-value[data-index="0"]');
		expect(otherValueInput.value).toBe("10");
		expect(otherValueInput.hasAttribute("aria-invalid")).toBe(false);
	});

	it("Add link appends an unassigned row that stays inert until both endpoints are chosen", () => {
		mountApp();

		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(3);
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(3);

		const addLinkButton = document.querySelector<HTMLButtonElement>('[data-action="add-link"]');
		expect(addLinkButton).not.toBeNull();
		click(addLinkButton);

		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(4);
		const source = () => document.querySelector<HTMLSelectElement>('.link-source[data-index="3"]');
		const target = () => document.querySelector<HTMLSelectElement>('.link-target[data-index="3"]');
		expect(source()?.value).toBe("");
		expect(target()?.value).toBe("");
		expect(source()?.querySelector('option[value=""]')?.textContent).toBe("— select —");
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(3);

		expect(getStoredState().links[3]).toEqual({
			source: null,
			target: null,
			value: 1,
		});

		const chosenSource = source();
		if (!chosenSource) throw new Error("unreachable");
		chosenSource.value = "n1";
		fireChange(chosenSource);
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(3);

		const chosenTarget = target();
		if (!chosenTarget) throw new Error("unreachable");
		chosenTarget.value = "n2";
		fireChange(chosenTarget);
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(4);

		const parsed = getStoredState();
		expect(parsed.links[3]).toEqual({ source: "n1", target: "n2", value: 1 });

		const clearedSource = source();
		if (!clearedSource) throw new Error("unreachable");
		clearedSource.value = "";
		fireChange(clearedSource);
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(3);
		expect(getStoredState().links[3].source).toBeNull();
	});

	it("renaming a node keeps the input's focus/identity, patches link-option labels, and leaves the link editor's rows/Sortable untouched", () => {
		mountApp();

		const svgBefore = document.querySelector("#diagram svg");
		expect(svgBefore).not.toBeNull();

		const linkEditorRoot = requireElement<HTMLElement>("#link-editor");
		const linkRowsBefore = requireElement<HTMLElement>("#link-editor .link-rows");
		const linkRowElsBefore = Array.from(document.querySelectorAll("#link-editor .link-row"));
		const sortableBefore = Sortable.get(linkRowsBefore);
		expect(sortableBefore).toBeTruthy();

		// Snapshot order + selected/disabled attributes of every node-option
		// across every source/target select — renaming must leave all of this
		// untouched, only the text should change.
		const optionsBefore = Array.from(
			document.querySelectorAll<HTMLOptionElement>("#link-editor option.node-option"),
		).map((option) => ({
			value: option.value,
			selected: option.getAttribute("selected"),
			disabled: option.getAttribute("disabled"),
		}));

		// n1 appears as an option (selected or not) in every source/target select.
		const nameInput = requireElement<HTMLInputElement>('.node-name[data-id="n1"]');
		nameInput.focus();
		expect(document.activeElement).toBe(nameInput);

		nameInput.value = "Lignite";
		fireInput(nameInput);

		// (a) same input element, still focused. happy-dom has no native typing
		// pipeline, so this harness (like the link-value tests above) simulates
		// a keystroke by reassigning `.value` wholesale — but browsers (and
		// happy-dom) collapse the selection to the end of the field whenever
		// `.value` is reassigned that way, regardless of what the app does with
		// focus. That makes a mid-string caret-preservation assertion
		// unfalsifiable through this harness, so it's dropped; selectionStart
		// is checked only as a smoke check that the property still reads back
		// (i.e. the app never blurs/reprograms it after the fact).
		expect(document.contains(nameInput)).toBe(true);
		expect(document.activeElement).toBe(nameInput);
		expect(nameInput.selectionStart).toBe("Lignite".length);

		// (b) every node-option showing n1, across every select, gets its text
		// updated.
		const n1Options = Array.from(
			document.querySelectorAll<HTMLOptionElement>('#link-editor option.node-option[value="n1"]'),
		);
		expect(n1Options.length).toBeGreaterThan(0);
		for (const option of n1Options) {
			expect(option.textContent).toBe("Lignite");
		}

		// (c) the link editor's container/rows/Sortable instance survive: rows
		// are keyed by link (see app/view.ts's createLinkProjector), so the
		// rename's re-render patches existing DOM in place rather than
		// rebuilding.
		expect(document.getElementById("link-editor")).toBe(linkEditorRoot);
		expect(document.querySelector("#link-editor .link-rows")).toBe(linkRowsBefore);
		const linkRowElsAfter = Array.from(document.querySelectorAll("#link-editor .link-row"));
		expect(linkRowElsAfter.length).toBe(linkRowElsBefore.length);
		linkRowElsAfter.forEach((row, i) => expect(row).toBe(linkRowElsBefore[i]));
		expect(Sortable.get(linkRowsBefore)).toBe(sortableBefore);

		// (e) option order and selected/disabled attributes are exactly as
		// before — only textContent changed.
		const optionsAfter = Array.from(
			document.querySelectorAll<HTMLOptionElement>("#link-editor option.node-option"),
		).map((option) => ({
			value: option.value,
			selected: option.getAttribute("selected"),
			disabled: option.getAttribute("disabled"),
		}));
		expect(optionsAfter).toEqual(optionsBefore);

		// (d) the diagram still redraws for a still-valid graph.
		const svgAfter = document.querySelector("#diagram svg");
		expect(svgAfter).not.toBeNull();
		expect(svgAfter).not.toBe(svgBefore);

		expect(getStoredState().nodes.find((n: { id: string }) => n.id === "n1")?.name).toBe("Lignite");
	});
});
