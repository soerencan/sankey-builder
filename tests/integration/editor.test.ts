// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "../../src/platform/storage";
import {
	byRole,
	click,
	fireChange,
	fireInput,
	getStoredState,
	mountApp,
	requireElement,
	settle,
	tick,
} from "../helpers/mount-app";

describe("node & link editing", () => {
	it("round-trips a basic mutation: add node updates editor, diagram, and storage", () => {
		mountApp();

		const addNodeButton = byRole<HTMLButtonElement>(document, "button", "Add node");
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

		const valueInput = byRole<HTMLInputElement>(document, "textbox", "Value for link 1");

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
		// Draft state renders on the next microtask, unlike a committed action.
		await tick();

		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(document.getElementById("error")?.textContent).toBe("");
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);
		expect(getStoredState().links[0].value).toBe(10);

		// Blur restoration is draft state too, rendered on the next microtask.
		fireChange(valueInput);
		await tick();
		expect(valueInput.value).toBe("10");
		expect(valueInput.hasAttribute("aria-invalid")).toBe(false);

		// Blur must not rewrite a valid draft: "5." parses to 5 but the trailing
		// dot stays so the user can keep typing. No render is scheduled, so no
		// tick is needed.
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

		const valueInput = byRole<HTMLInputElement>(document, "textbox", "Value for link 1");

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

		// The message clears only once the value becomes valid or blank.
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

		// Set directly, bypassing beforeinput's interception.
		valueInput.value = "0.00001";
		fireInput(valueInput);
		await tick();
		expect(errorEl.textContent).toBe("Enter a number with up to 4 decimal places.");

		fireChange(valueInput);
		await tick();
		expect(valueInput.value).toBe("20");
		expect(valueInput.hasAttribute("aria-invalid")).toBe(false);
		expect(errorEl.textContent).toBe("");
	});

	it("pins the exact error message for other ambiguous link-value inputs", async () => {
		mountApp();

		const valueInput = byRole<HTMLInputElement>(document, "textbox", "Value for link 1");
		const describedbyId = valueInput.getAttribute("aria-describedby");
		const errorEl = describedbyId ? document.getElementById(describedbyId) : null;
		expect(errorEl).not.toBeNull();
		if (!errorEl) throw new Error("unreachable");

		// Format wins over above-maximum.
		valueInput.value = "1e20";
		fireInput(valueInput);
		await tick();
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(errorEl.textContent).toBe("Enter a plain number greater than 0.");

		// Precision wins over non-positive.
		valueInput.value = "0.00000";
		fireInput(valueInput);
		await tick();
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(errorEl.textContent).toBe("Enter a number with up to 4 decimal places.");

		// Precision wins over above-maximum.
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

		const valueInput = byRole<HTMLInputElement>(document, "textbox", "Value for link 1");

		// happy-dom has no native editing pipeline for beforeinput, so these
		// assert defaultPrevented and the handler's own DOM writes, never a
		// value the browser would have inserted.
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

		// Deletions are never intercepted, even from an over-precise value.
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

		// A mid-string selection, not just a caret.
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
		// The truncated value and caret are synchronous DOM writes; the
		// aria-invalid marker is a render on the next microtask.
		expect(valueInput.value).toBe("0.0000");
		await tick();
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(getStoredState().links[0].value).toBe(12.3456);

		// A garbage paste falls through to the input handler's highlight path.
		valueInput.value = "";
		valueInput.setSelectionRange(0, 0);
		expect(beforeinput({ inputType: "insertFromPaste", data: "abc" }).defaultPrevented).toBe(false);
		valueInput.value = "abc";
		fireInput(valueInput);
		await tick();
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
	});

	it("invalid committed state (link-endpoint cycle) persists to storage while the diagram keeps the last valid SVG, then redraws once the cycle is fixed", () => {
		mountApp();

		const svgBefore = document.querySelector("#diagram svg");
		expect(svgBefore).not.toBeNull();
		const svgHtmlBefore = svgBefore?.outerHTML;

		// Retargeting the third link to n1 closes a 2-node cycle.
		const target = byRole<HTMLSelectElement>(document, "combobox", "Target for link 3");
		target.value = "n1";
		fireChange(target);

		expect(document.getElementById("error")?.textContent).toContain("cycle");

		// There is no "last-good state" in storage, only a last-good diagram.
		const stored = getStoredState();
		expect(stored.links[2].target).toBe("n1");

		expect(document.querySelector("#diagram svg")).toBe(svgBefore);
		expect(document.querySelector("#diagram svg")?.outerHTML).toBe(svgHtmlBefore);

		target.value = "n4";
		fireChange(target);

		expect(document.getElementById("error")?.textContent).toBe("");
		const svgAfter = document.querySelector("#diagram svg");
		expect(svgAfter).not.toBeNull();
		expect(svgAfter).not.toBe(svgBefore);
	});

	it("keeps focus on a link-value input through its own committed valid keystroke, which still redraws the diagram", () => {
		mountApp();

		const svgBefore = document.querySelector("#diagram svg");
		expect(svgBefore).not.toBeNull();

		const valueInput = byRole<HTMLInputElement>(document, "textbox", "Value for link 1");
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

		const valueInput = byRole<HTMLInputElement>(document, "textbox", "Value for link 1");
		const describedbyId = valueInput.getAttribute("aria-describedby");
		const errorEl = describedbyId ? document.getElementById(describedbyId) : null;
		expect(errorEl).not.toBeNull();
		if (!errorEl) throw new Error("unreachable");

		valueInput.value = "abc";
		fireInput(valueInput);
		await tick();

		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(errorEl.textContent).toBe("Enter a plain number greater than 0.");

		// An unrelated rename's re-render must leave the row's draft intact.
		const nameInput = byRole<HTMLInputElement>(document, "textbox", "Name for Coal");
		nameInput.value = "Lignite";
		fireInput(nameInput);

		// Identity, not attribute equality: a rebuilt row would carry the same
		// defaults on a detached node and pass while the draft was lost.
		expect(byRole<HTMLInputElement>(document, "textbox", "Value for link 1")).toBe(valueInput);
		expect(valueInput.value).toBe("abc");
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(errorEl.textContent).toBe("Enter a plain number greater than 0.");

		// The rename must actually have reached the app.
		const n1Option = requireElement<HTMLOptionElement>(
			'#link-editor option.node-option[value="n1"]',
		);
		expect(n1Option.textContent).toBe("Lignite");
	});

	it("invalid draft: no persist, no notice change, no redraw", async () => {
		mountApp();

		// Seed #io-notice via a repaired import so "unchanged" below is a real
		// assertion, not two empty strings.
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
		await settle();
		expect(document.getElementById("io-notice")?.textContent).toBe(
			"Imported 2 nodes, 1 links. Adjustments: link 1: unknown target — left unassigned.",
		);

		const valueInput = byRole<HTMLInputElement>(document, "textbox", "Value for link 1");
		const storedBefore = localStorage.getItem(STORAGE_KEY);
		const svgBefore = document.querySelector("#diagram svg");
		const errorBefore = document.getElementById("error")?.textContent;
		const noticeBefore = document.getElementById("io-notice")?.textContent;

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

		// The draft goes on the link after the one about to be deleted, so its
		// index shifts. Rows keyed by index would hand it the deleted row's
		// state.
		const valueInput = byRole<HTMLInputElement>(document, "textbox", "Value for link 3");
		valueInput.value = "abc";
		fireInput(valueInput);
		await tick();
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");

		// Cascades to remove the n2->n3 link, so the edited link becomes row 1.
		click(byRole<HTMLButtonElement>(document, "button", "Delete Gas"));

		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(2);
		const survivingValueInput = byRole<HTMLInputElement>(document, "textbox", "Value for link 2");
		expect(survivingValueInput).toBe(valueInput);
		expect(survivingValueInput.value).toBe("abc");
		expect(survivingValueInput.getAttribute("aria-invalid")).toBe("true");
		const describedbyId = survivingValueInput.getAttribute("aria-describedby");
		const errorEl = describedbyId ? document.getElementById(describedbyId) : null;
		expect(errorEl?.textContent).toBe("Enter a plain number greater than 0.");

		// The other surviving link (n1->n3, untouched, now row 0) is unaffected.
		const otherValueInput = byRole<HTMLInputElement>(document, "textbox", "Value for link 1");
		expect(otherValueInput.value).toBe("10");
		expect(otherValueInput.hasAttribute("aria-invalid")).toBe(false);
	});

	it("Add link appends an unassigned row that stays inert until both endpoints are chosen", () => {
		mountApp();

		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(3);
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(3);

		const addLinkButton = byRole<HTMLButtonElement>(document, "button", "Add link");
		click(addLinkButton);

		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(4);
		const source = () => byRole<HTMLSelectElement>(document, "combobox", "Source for link 4");
		const target = () => byRole<HTMLSelectElement>(document, "combobox", "Target for link 4");
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

	it("renaming a node keeps the input's focus/identity and patches link-option labels without rebuilding link rows", () => {
		mountApp();

		const svgBefore = document.querySelector("#diagram svg");
		expect(svgBefore).not.toBeNull();

		const linkRowElsBefore = Array.from(document.querySelectorAll("#link-editor .link-row"));

		// Only option text may change.
		const optionsBefore = Array.from(
			document.querySelectorAll<HTMLOptionElement>("#link-editor option.node-option"),
		).map((option) => ({
			value: option.value,
			selected: option.getAttribute("selected"),
			disabled: option.getAttribute("disabled"),
		}));

		const nameInput = byRole<HTMLInputElement>(document, "textbox", "Name for Coal");
		nameInput.focus();
		expect(document.activeElement).toBe(nameInput);

		nameInput.value = "Lignite";
		fireInput(nameInput);

		// Reassigning `.value` collapses the selection to the end in every
		// engine, so mid-string caret preservation is unfalsifiable here;
		// selectionStart is only a smoke check that the app never reprograms it.
		expect(document.contains(nameInput)).toBe(true);
		expect(document.activeElement).toBe(nameInput);
		expect(nameInput.selectionStart).toBe("Lignite".length);

		const n1Options = Array.from(
			document.querySelectorAll<HTMLOptionElement>('#link-editor option.node-option[value="n1"]'),
		);
		expect(n1Options.length).toBeGreaterThan(0);
		for (const option of n1Options) {
			expect(option.textContent).toBe("Lignite");
		}

		// Each link row keeps its DOM identity.
		const linkRowElsAfter = Array.from(document.querySelectorAll("#link-editor .link-row"));
		expect(linkRowElsAfter.length).toBe(linkRowElsBefore.length);
		linkRowElsAfter.forEach((row, i) => expect(row).toBe(linkRowElsBefore[i]));

		const optionsAfter = Array.from(
			document.querySelectorAll<HTMLOptionElement>("#link-editor option.node-option"),
		).map((option) => ({
			value: option.value,
			selected: option.getAttribute("selected"),
			disabled: option.getAttribute("disabled"),
		}));
		expect(optionsAfter).toEqual(optionsBefore);

		const svgAfter = document.querySelector("#diagram svg");
		expect(svgAfter).not.toBeNull();
		expect(svgAfter).not.toBe(svgBefore);

		expect(getStoredState().nodes.find((n: { id: string }) => n.id === "n1")?.name).toBe("Lignite");
	});
});
