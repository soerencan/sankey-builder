// @vitest-environment happy-dom

import { render } from "preact";
import { beforeEach, describe, expect, it } from "vitest";
import { byRole } from "../../tests/helpers/dom-queries";
import { useDialog } from "./use-dialog";

/**
 * Arbitrary fixture markup, not one of the real DiagramPanel/ThemeControl
 * dialogs: this hook is markup-agnostic, so the test proves that rather than
 * exercising just one real consumer.
 */
function Fixture() {
	const dialog = useDialog();
	return (
		<>
			<button type="button" id="trigger" onClick={(event) => dialog.open(event.currentTarget)}>
				Open
			</button>
			{/* Exercises the hook's own close() directly — a dialog's own close
			    button (see ChoiceDialog) wires the same call to its onClick;
			    useDialog itself only owns the backdrop-click and native "close"
			    event paths, covered by the tests below. */}
			<button type="button" id="direct-close" onClick={() => dialog.close()}>
				Direct close
			</button>
			<dialog id="fixture-dialog" ref={dialog.ref}>
				<h3>Fixture</h3>
				<button type="button" aria-pressed="false">
					A
				</button>
				<button type="button" aria-pressed="true">
					B
				</button>
				<button type="button" aria-pressed="false">
					C
				</button>
			</dialog>
		</>
	);
}

describe("useDialog", () => {
	let container: HTMLElement;
	let trigger: HTMLButtonElement;
	let directClose: HTMLButtonElement;
	let dialog: HTMLDialogElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
		render(<Fixture />, container);
		const triggerEl = container.querySelector("#trigger");
		const directCloseEl = container.querySelector("#direct-close");
		const dialogEl = container.querySelector("#fixture-dialog");
		if (
			!(triggerEl instanceof HTMLButtonElement) ||
			!(directCloseEl instanceof HTMLButtonElement) ||
			!(dialogEl instanceof HTMLDialogElement)
		) {
			throw new Error("fixture markup is missing an expected element");
		}
		trigger = triggerEl;
		directClose = directCloseEl;
		dialog = dialogEl;
	});

	it("open() (via the trigger's click) shows the dialog and moves focus to the pressed option", () => {
		trigger.click();

		expect(dialog.open).toBe(true);
		expect(document.activeElement).toBe(byRole(dialog, "button", "B"));
	});

	it("open() falls back to the first focusable element when nothing is pressed", () => {
		for (const button of Array.from(dialog.querySelectorAll("[aria-pressed]"))) {
			button.setAttribute("aria-pressed", "false");
		}
		trigger.click();

		expect(document.activeElement).toBe(byRole(dialog, "button", "A"));
	});

	it("close() is a no-op when the dialog isn't open", () => {
		expect(dialog.open).toBe(false);
		expect(() => directClose.click()).not.toThrow();
		expect(dialog.open).toBe(false);
	});

	it("close() (called directly, not via a delegated click) closes an open dialog and restores focus to the trigger", () => {
		trigger.click();

		directClose.click();

		expect(dialog.open).toBe(false);
		expect(document.activeElement).toBe(trigger);
	});

	it("a click landing on the dialog element itself (backdrop) closes it and restores focus", () => {
		trigger.click();

		dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(dialog.open).toBe(false);
		expect(document.activeElement).toBe(trigger);
	});

	it("a click on dialog content (not the dialog element itself) does not close it", () => {
		trigger.click();

		byRole(dialog, "button", "A").dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(dialog.open).toBe(true);
	});

	it("calling the native dialog.close() directly still restores focus (the 'close' event, not just click, drives it)", () => {
		trigger.click();

		dialog.close();

		expect(document.activeElement).toBe(trigger);
	});

	it("unmounting the component removes its listeners without throwing on a stray event", () => {
		trigger.click();
		render(null, container);

		expect(() => dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }))).not.toThrow();
	});
});
