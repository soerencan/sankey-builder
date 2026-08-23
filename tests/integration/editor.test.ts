// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { STORAGE_KEY } from "../../src/persist";
import {
	click,
	fireChange,
	fireInput,
	getStoredState,
	mountApp,
	requireElement,
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

	it("leaves state untouched on empty/invalid value edits and restores the text on blur", () => {
		mountApp();

		const svgBefore = document.querySelector("#diagram svg");
		expect(svgBefore).not.toBeNull();

		// First link (n1 "Coal" -> n3 "Electricity", value 10 in defaultState).
		const valueInput = document.querySelector<HTMLInputElement>('.link-value[data-index="0"]');
		expect(valueInput).not.toBeNull();
		if (!valueInput) throw new Error("unreachable");

		// Emptying the field never reaches state: no error, no re-render, and
		// the stored value stays at defaultState's 10.
		valueInput.value = "";
		fireInput(valueInput);

		expect(document.getElementById("error")?.textContent).toBe("");
		expect(valueInput.hasAttribute("aria-invalid")).toBe(false);
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);
		expect(document.contains(valueInput)).toBe(true);
		expect(getStoredState().links[0].value).toBe(10);

		// An invalid string marks the field but still leaves state/storage alone.
		valueInput.value = "abc";
		fireInput(valueInput);

		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(document.getElementById("error")?.textContent).toBe("");
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);
		expect(getStoredState().links[0].value).toBe(10);

		// Blur restores the last committed value and clears the marker.
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

		// A valid edit flows through to state, storage, and a fresh diagram.
		valueInput.value = "20";
		fireInput(valueInput);

		expect(document.getElementById("error")?.textContent).toBe("");
		const svgAfter = document.querySelector("#diagram svg");
		expect(svgAfter).not.toBeNull();
		expect(svgAfter).not.toBe(svgBefore);
		expect(document.querySelectorAll("#diagram svg rect")).toHaveLength(4);
		expect(getStoredState().links[0].value).toBe(20);
	});

	it("shows an inline, accessible error message for an invalid link value and clears it once valid", () => {
		mountApp();

		const valueInput = requireElement<HTMLInputElement>('.link-value[data-index="0"]');

		const describedbyId = valueInput.getAttribute("aria-describedby");
		expect(describedbyId).toBeTruthy();
		const errorEl = describedbyId ? document.getElementById(describedbyId) : null;
		expect(errorEl).not.toBeNull();
		if (!errorEl) throw new Error("unreachable");

		// aria-describedby is wired up before any error occurs, and the paired
		// element starts empty.
		expect(errorEl.textContent).toBe("");

		valueInput.value = "abc";
		fireInput(valueInput);

		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(errorEl.textContent).toBe("Enter a plain number greater than 0.");

		// Further invalid keystrokes keep the message (not cleared on every
		// keypress, only when the value actually becomes valid or blank).
		valueInput.value = "abcd";
		fireInput(valueInput);

		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(errorEl.textContent).toBe("Enter a plain number greater than 0.");

		// Becoming valid clears both the marker and the message.
		valueInput.value = "20";
		fireInput(valueInput);

		expect(valueInput.hasAttribute("aria-invalid")).toBe(false);
		expect(errorEl.textContent).toBe("");

		// Above the 1e15 cap gets its own message.
		valueInput.value = "9999999999999999";
		fireInput(valueInput);
		expect(errorEl.textContent).toBe("Enter a number no greater than 1000000000000000.");

		// Over 4 fractional digits, set directly (bypassing beforeinput's
		// keystroke/paste interception), still reaches the message branch.
		valueInput.value = "0.00001";
		fireInput(valueInput);
		expect(errorEl.textContent).toBe("Enter a number with up to 4 decimal places.");

		// Blur on an invalid value reverts the text to the last committed
		// value and clears both the marker and the message.
		fireChange(valueInput);
		expect(valueInput.value).toBe("20");
		expect(valueInput.hasAttribute("aria-invalid")).toBe(false);
		expect(errorEl.textContent).toBe("");
	});

	it("intercepts the 4-decimal cap at beforeinput (block keystroke, truncate paste)", () => {
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

		// Typing a 5th fractional digit onto an at-cap value is blocked.
		valueInput.value = "1.2345";
		valueInput.setSelectionRange(6, 6);
		expect(beforeinput({ inputType: "insertText", data: "6" }).defaultPrevented).toBe(true);
		expect(valueInput.value).toBe("1.2345");

		// Typing the 4th fractional digit stays under the cap and is allowed.
		valueInput.value = "1.234";
		valueInput.setSelectionRange(5, 5);
		expect(beforeinput({ inputType: "insertText", data: "5" }).defaultPrevented).toBe(false);

		// Deletions carry no data and are never intercepted, even from an
		// over-precise legacy value.
		valueInput.value = "1.23456";
		valueInput.setSelectionRange(7, 7);
		expect(beforeinput({ inputType: "deleteContentBackward", data: null }).defaultPrevented).toBe(
			false,
		);

		// An over-precise paste is truncated (not rounded) to 4 fractional digits
		// and committed straight to state/storage.
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

		// A paste replacing a mid-string selection exercises the
		// slice+data+slice splice non-degenerately, then truncates the
		// over-precise spliced result.
		valueInput.value = "12.3400";
		valueInput.setSelectionRange(5, 7);
		expect(beforeinput({ inputType: "insertFromPaste", data: "56789" }).defaultPrevented).toBe(
			true,
		);
		expect(valueInput.value).toBe("12.3456");
		expect(valueInput.selectionStart).toBe(7);
		expect(getStoredState().links[0].value).toBe(12.3456);

		// A truncated paste that still lands invalid is highlighted, not silently
		// dropped: the field shows the truncated text but state/storage stay put.
		valueInput.value = "";
		valueInput.setSelectionRange(0, 0);
		expect(beforeinput({ inputType: "insertFromPaste", data: "0.00001" }).defaultPrevented).toBe(
			true,
		);
		expect(valueInput.value).toBe("0.0000");
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(getStoredState().links[0].value).toBe(12.3456);

		// A garbage paste is not intercepted — it falls through to the input
		// handler's highlight path.
		valueInput.value = "";
		valueInput.setSelectionRange(0, 0);
		expect(beforeinput({ inputType: "insertFromPaste", data: "abc" }).defaultPrevented).toBe(false);
		valueInput.value = "abc";
		fireInput(valueInput);
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
	});

	it("Add link appends an unassigned row that stays inert until both endpoints are chosen", () => {
		mountApp();

		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(3);
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(3);

		const addLinkButton = document.querySelector<HTMLButtonElement>('[data-action="add-link"]');
		expect(addLinkButton).not.toBeNull();
		click(addLinkButton);

		// New row appended with both endpoints on the placeholder; the diagram is
		// unchanged because the row is incomplete.
		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(4);
		const source = () => document.querySelector<HTMLSelectElement>('.link-source[data-index="3"]');
		const target = () => document.querySelector<HTMLSelectElement>('.link-target[data-index="3"]');
		expect(source()?.value).toBe("");
		expect(target()?.value).toBe("");
		expect(source()?.querySelector('option[value=""]')?.textContent).toBe("— select —");
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(3);

		// The incomplete row is persisted end-to-end straight after the click.
		expect(getStoredState().links[3]).toEqual({
			source: null,
			target: null,
			value: 1,
		});

		// Choosing a source alone leaves the link incomplete — still no new flow.
		const chosenSource = source();
		if (!chosenSource) throw new Error("unreachable");
		chosenSource.value = "n1";
		fireChange(chosenSource);
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(3);

		// Choosing the target completes the link — the flow appears and persists.
		const chosenTarget = target();
		if (!chosenTarget) throw new Error("unreachable");
		chosenTarget.value = "n2";
		fireChange(chosenTarget);
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(4);

		const parsed = getStoredState();
		expect(parsed.links[3]).toEqual({ source: "n1", target: "n2", value: 1 });

		// Un-assigning the source ("" → null) makes the row incomplete again —
		// the flow disappears and the null endpoint round-trips to storage.
		const clearedSource = source();
		if (!clearedSource) throw new Error("unreachable");
		clearedSource.value = "";
		fireChange(clearedSource);
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(3);
		expect(getStoredState().links[3].source).toBeNull();
	});
});
