// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import {
	byRole,
	click,
	fireInput,
	getStoredState,
	mountApp,
	requireElement,
	tick,
} from "../helpers/mount-app";

function press(handle: HTMLElement, key: string): void {
	handle.focus();
	handle.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

describe("reorder feedback", () => {
	it("associates every handle with instructions and starts with empty, separate live regions", () => {
		mountApp();
		for (const kind of ["node", "link"]) {
			const help = requireElement(`#${kind}-reorder-help`);
			expect(help.textContent).toBe("Use Up and Down arrows to reorder.");
			for (const handle of document.querySelectorAll(`#${kind}-editor .drag-handle`)) {
				expect(handle.getAttribute("aria-describedby")).toBe(help.id);
			}
			const status = requireElement(`#${kind}-reorder-status`);
			expect(status.getAttribute("role")).toBe("status");
			expect(status.getAttribute("aria-live")).toBe("polite");
			expect(status.getAttribute("aria-atomic")).toBe("true");
			expect(status.textContent).toBe("");
		}
	});

	it("announces repeated node moves without losing the handle or reannouncing on unrelated edits", async () => {
		mountApp();
		const handle = byRole<HTMLButtonElement>(document, "button", "Reorder Salary");
		const status = requireElement("#node-reorder-status");
		for (const [key, position] of [
			["ArrowDown", 2],
			["ArrowDown", 3],
			["ArrowUp", 2],
		] as const) {
			press(handle, key);
			await tick();
			expect(status.textContent).toBe(`Salary moved to position ${position} of 6.`);
			expect(document.activeElement).toBe(handle);
		}
		const message = status.firstChild;
		click(byRole(document, "button", "Add link"));
		expect(status.firstChild).toBe(message);
		expect(requireElement("#link-reorder-status").textContent).toBe("");
		expect(document.getElementById("error")?.textContent).toBe("");
	});

	it.each([
		{ name: "Salary", key: "ArrowUp", edge: "first" },
		{ name: "Savings", key: "ArrowDown", edge: "last" },
	])(
		"announces repeated attempts at the $edge boundary without changing the diagram",
		async ({ name, key, edge }) => {
			mountApp();
			const handle = byRole<HTMLButtonElement>(document, "button", `Reorder ${name}`);
			const status = requireElement("#node-reorder-status");
			const before = getStoredState();
			press(handle, key);
			await tick();
			expect(status.textContent).toBe(`${name} is already ${edge}.`);
			const firstMessage = status.firstChild;
			press(handle, key);
			await tick();
			expect(status.textContent).toBe(`${name} is already ${edge}.`);
			expect(status.firstChild).not.toBe(firstMessage);
			expect(getStoredState()).toEqual(before);
			expect(document.activeElement).toBe(handle);
		},
	);

	it("uses current names and row counts for both editors", async () => {
		mountApp();
		click(byRole(document, "button", "Add node"));
		const name = byRole<HTMLInputElement>(document, "textbox", "Name for Salary");
		name.value = "Pay";
		fireInput(name);
		press(byRole(document, "button", "Reorder Pay"), "ArrowDown");
		await tick();
		expect(requireElement("#node-reorder-status").textContent).toBe(
			"Pay moved to position 2 of 7.",
		);

		const handle = byRole<HTMLButtonElement>(document, "button", "Reorder link 1");
		press(handle, "ArrowDown");
		await tick();
		expect(requireElement("#link-reorder-status").textContent).toBe(
			"Link from Pay to Budget moved to position 2 of 5.",
		);
		expect(document.activeElement).toBe(handle);
		expect(handle.getAttribute("aria-label")).toBe("Reorder link 2");
	});

	it("can describe and reorder an unassigned link", async () => {
		mountApp();
		click(byRole(document, "button", "Add link"));
		press(byRole(document, "button", "Reorder link 6"), "ArrowUp");
		await tick();
		expect(requireElement("#link-reorder-status").textContent).toBe(
			"Link from unassigned source to unassigned target moved to position 5 of 6.",
		);
	});
});
