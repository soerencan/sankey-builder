// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import { setupDialog } from "../src/dialog";

/**
 * Hand-rolled fixture rather than the real palette-dialog markup — this
 * module is markup-agnostic (src/dialog.ts's own claim), so the test proves
 * that by exercising it against arbitrary dialog content instead of the one
 * real consumer.
 */
function mountFixture(): { trigger: HTMLButtonElement; dialog: HTMLDialogElement } {
	document.body.innerHTML = `
		<button type="button" id="trigger">Open</button>
		<dialog id="fixture-dialog">
			<h3>Fixture</h3>
			<button type="button" data-value="a" aria-pressed="false">A</button>
			<button type="button" data-value="b" aria-pressed="true">B</button>
			<button type="button" data-value="c" aria-pressed="false">C</button>
			<button type="button" data-action="close-dialog">Close</button>
		</dialog>
	`;
	const trigger = document.getElementById("trigger");
	const dialog = document.getElementById("fixture-dialog");
	if (!(trigger instanceof HTMLButtonElement) || !(dialog instanceof HTMLDialogElement)) {
		throw new Error("fixture markup is missing an expected element");
	}
	return { trigger, dialog };
}

describe("setupDialog", () => {
	let trigger: HTMLButtonElement;
	let dialog: HTMLDialogElement;

	beforeEach(() => {
		({ trigger, dialog } = mountFixture());
	});

	it("open() shows the dialog and moves focus to the pressed option", () => {
		const controller = setupDialog(dialog);
		controller.open(trigger);

		expect(dialog.open).toBe(true);
		expect(document.activeElement).toBe(dialog.querySelector('[data-value="b"]'));
	});

	it("open() falls back to the first focusable element when nothing is pressed", () => {
		for (const button of Array.from(dialog.querySelectorAll("[aria-pressed]"))) {
			button.setAttribute("aria-pressed", "false");
		}
		const controller = setupDialog(dialog);
		controller.open(trigger);

		expect(document.activeElement).toBe(dialog.querySelector('[data-value="a"]'));
	});

	it("clicking a [data-action=close-dialog] button closes the dialog and returns focus to the trigger", () => {
		const controller = setupDialog(dialog);
		controller.open(trigger);

		const closeButton = dialog.querySelector<HTMLButtonElement>('[data-action="close-dialog"]');
		closeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(dialog.open).toBe(false);
		expect(document.activeElement).toBe(trigger);
	});

	it("a click landing on the dialog element itself (backdrop) closes it", () => {
		const controller = setupDialog(dialog);
		controller.open(trigger);

		dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(dialog.open).toBe(false);
		expect(document.activeElement).toBe(trigger);
	});

	it("a click on dialog content (not the dialog element itself) does not close it", () => {
		const controller = setupDialog(dialog);
		controller.open(trigger);

		dialog
			.querySelector('[data-value="a"]')
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(dialog.open).toBe(true);
	});

	it("close() is a no-op when the dialog isn't open", () => {
		const controller = setupDialog(dialog);
		expect(dialog.open).toBe(false);
		expect(() => controller.close()).not.toThrow();
		expect(dialog.open).toBe(false);
	});

	it("close() closes an open dialog and restores focus to the trigger", () => {
		const controller = setupDialog(dialog);
		controller.open(trigger);
		controller.close();

		expect(dialog.open).toBe(false);
		expect(document.activeElement).toBe(trigger);
	});
});
