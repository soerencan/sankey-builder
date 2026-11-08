// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { byRole, click, mountApp } from "../helpers/mount-app";

describe("editor focus", () => {
	it("does not move focus on initial load", () => {
		mountApp();
		expect(document.activeElement).toBe(document.body);
	});

	it.each([false, true])("focuses and selects each added node name (empty list: %s)", (empty) => {
		mountApp();
		if (empty) {
			for (const button of document.querySelectorAll(".node-delete")) click(button);
		}
		const add = byRole<HTMLButtonElement>(document, "button", "Add node");
		for (let i = 0; i < 2; i++) {
			add.focus();
			click(add);
			const fields = document.querySelectorAll<HTMLInputElement>(".node-name");
			const added = fields[fields.length - 1];
			expect(document.activeElement).toBe(added);
			expect(added.selectionStart).toBe(0);
			expect(added.selectionEnd).toBe(added.value.length);
		}
	});

	it.each([false, true])("focuses each added link's source (empty list: %s)", (empty) => {
		mountApp();
		if (empty) {
			for (const button of document.querySelectorAll(".link-delete")) click(button);
		}
		const add = byRole<HTMLButtonElement>(document, "button", "Add link");
		for (let i = 0; i < 2; i++) {
			add.focus();
			click(add);
			const fields = document.querySelectorAll<HTMLSelectElement>(".link-source");
			expect(document.activeElement).toBe(fields[fields.length - 1]);
		}
	});
});
