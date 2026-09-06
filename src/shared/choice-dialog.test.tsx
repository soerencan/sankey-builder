// @vitest-environment happy-dom

import { render } from "preact";
import { describe, expect, it } from "vitest";
import { byRole } from "../../tests/helpers/dom-queries";
import { ChoiceDialog } from "./choice-dialog";
import { useDialog } from "./use-dialog";

function Fixture() {
	const dialog = useDialog();
	return (
		<>
			<button type="button" id="trigger" onClick={(event) => dialog.open(event.currentTarget)}>
				Open
			</button>
			<ChoiceDialog id="fixture-dialog" heading="Fixture" handle={dialog}>
				<p>Body content</p>
			</ChoiceDialog>
		</>
	);
}

function mount() {
	const container = document.createElement("div");
	document.body.appendChild(container);
	render(<Fixture />, container);
	return container;
}

describe("ChoiceDialog", () => {
	it("renders a <dialog> labelled by its own heading, with the given children and a close button", () => {
		const container = mount();

		const dialogEl = container.querySelector("#fixture-dialog");
		expect(dialogEl).toBeInstanceOf(HTMLDialogElement);
		expect(dialogEl?.getAttribute("aria-labelledby")).toBe("fixture-dialog-heading");
		expect(dialogEl?.querySelector("#fixture-dialog-heading")?.textContent).toBe("Fixture");
		expect(dialogEl?.querySelector("p")?.textContent).toBe("Body content");
		byRole(dialogEl as Element, "button", "Close");
	});

	it("opens via the handle's ref, moving focus into the dialog", () => {
		const container = mount();

		container.querySelector<HTMLButtonElement>("#trigger")?.click();

		const dialogEl = container.querySelector("#fixture-dialog") as HTMLDialogElement;
		expect(dialogEl.open).toBe(true);
		expect(document.activeElement).toBe(byRole(dialogEl, "button", "Close"));
	});

	it("closes via its own close button, returning focus to the trigger", () => {
		const container = mount();
		const trigger = container.querySelector<HTMLButtonElement>("#trigger");
		trigger?.click();

		const dialogEl = container.querySelector("#fixture-dialog") as HTMLDialogElement;
		byRole(dialogEl, "button", "Close").dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(dialogEl.open).toBe(false);
		expect(document.activeElement).toBe(trigger);
	});
});
