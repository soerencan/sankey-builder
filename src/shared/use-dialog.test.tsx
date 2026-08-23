// @vitest-environment happy-dom

import { render } from "preact";
import { beforeEach, describe, expect, it } from "vitest";
import { useDialog } from "./use-dialog";

/**
 * Same fixture shape as shared/dialog.test.ts's, adapted to JSX: this hook is
 * markup-agnostic too, so the test proves that against arbitrary content
 * rather than the one real DiagramPanel consumer.
 */
function Fixture() {
	const dialog = useDialog();
	return (
		<>
			<button type="button" id="trigger" onClick={(event) => dialog.open(event.currentTarget)}>
				Open
			</button>
			<dialog id="fixture-dialog" ref={dialog.ref}>
				<h3>Fixture</h3>
				<button type="button" data-value="a" aria-pressed="false">
					A
				</button>
				<button type="button" data-value="b" aria-pressed="true">
					B
				</button>
				<button type="button" data-value="c" aria-pressed="false">
					C
				</button>
				<button type="button" data-action="close-dialog">
					Close
				</button>
			</dialog>
		</>
	);
}

describe("useDialog", () => {
	let container: HTMLElement;
	let trigger: HTMLButtonElement;
	let dialog: HTMLDialogElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
		render(<Fixture />, container);
		const triggerEl = container.querySelector("#trigger");
		const dialogEl = container.querySelector("#fixture-dialog");
		if (!(triggerEl instanceof HTMLButtonElement) || !(dialogEl instanceof HTMLDialogElement)) {
			throw new Error("fixture markup is missing an expected element");
		}
		trigger = triggerEl;
		dialog = dialogEl;
	});

	it("open() (via the trigger's click) shows the dialog and moves focus to the pressed option", () => {
		trigger.click();

		expect(dialog.open).toBe(true);
		expect(document.activeElement).toBe(dialog.querySelector('[data-value="b"]'));
	});

	it("clicking a [data-action=close-dialog] button closes the dialog and returns focus to the trigger", () => {
		trigger.click();

		dialog
			.querySelector<HTMLButtonElement>('[data-action="close-dialog"]')
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

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

		dialog
			.querySelector('[data-value="a"]')
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

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
