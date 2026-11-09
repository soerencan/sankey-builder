// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import {
	byRole,
	click,
	getStoredState,
	mountApp,
	requireElement,
	tick,
} from "../helpers/mount-app";

function openAppearance() {
	mountApp();
	const trigger = byRole(document, "button", "Appearance");
	click(trigger);
	const dialog = requireElement<HTMLDialogElement>("#display-dialog");
	const dropdown = byRole(dialog, "combobox", "Color saturation");
	const list = byRole<HTMLElement>(dialog, "listbox");
	return { trigger, dialog, dropdown, list };
}

async function press(target: HTMLElement, key: string, shiftKey = false): Promise<KeyboardEvent> {
	const event = new KeyboardEvent("keydown", {
		key,
		shiftKey,
		bubbles: true,
		cancelable: true,
	});
	target.dispatchEvent(event);
	await tick();
	return event;
}

describe("palette keyboard selection and dismissal", () => {
	it("opens with Space, navigates Home without committing, and selects with Space", async () => {
		const { dialog, dropdown, list } = openAppearance();
		expect((await press(dropdown, " ")).defaultPrevented).toBe(true);
		expect(list.hidden).toBe(false);
		expect(dropdown.getAttribute("aria-activedescendant")).toBe("setting-palette-balanced");

		expect((await press(dropdown, "Home")).defaultPrevented).toBe(true);
		expect(dropdown.getAttribute("aria-activedescendant")).toBe("setting-palette-grayscale");
		expect(getStoredState().settings.palette).toBe("balanced");
		expect(byRole(list, "option", "Balanced").getAttribute("aria-selected")).toBe("true");

		await press(dropdown, " ");
		expect(getStoredState().settings.palette).toBe("grayscale");
		expect(byRole(list, "option", "Grayscale").getAttribute("aria-selected")).toBe("true");
		expect(list.hidden).toBe(true);
		expect(dropdown.getAttribute("aria-expanded")).toBe("false");
		expect(dropdown.hasAttribute("aria-activedescendant")).toBe(false);
		expect(document.activeElement).toBe(dropdown);
		expect(dialog.open).toBe(true);
	});

	it.each([false, true])(
		"Tab commits the active option without preventing native focus navigation (Shift: %s)",
		async (shiftKey) => {
			const { dialog, dropdown, list } = openAppearance();
			await press(dropdown, "End");
			const event = await press(dropdown, "Tab", shiftKey);

			expect(event.defaultPrevented).toBe(false);
			expect(getStoredState().settings.palette).toBe("intense");
			expect(byRole(list, "option", "Intense").getAttribute("aria-selected")).toBe("true");
			expect(dropdown.getAttribute("aria-expanded")).toBe("false");
			expect(list.hidden).toBe(true);
			expect(dialog.open).toBe(true);
		},
	);

	it.each(["pointer", "focus"])(
		"dismisses an uncommitted choice on outside %s and reopens at the saved choice",
		async (input) => {
			const { dialog, dropdown, list } = openAppearance();
			await press(dropdown, "End");
			dropdown.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
			await tick();
			expect(list.hidden).toBe(false);
			const otherControl = byRole(dialog, "combobox", "Link colors");
			if (input === "pointer") {
				otherControl.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
			} else otherControl.focus();
			await tick();

			expect(list.hidden).toBe(true);
			expect(dropdown.getAttribute("aria-expanded")).toBe("false");
			expect(dropdown.hasAttribute("aria-activedescendant")).toBe(false);
			expect(getStoredState().settings.palette).toBe("balanced");
			expect(dialog.open).toBe(true);

			click(dropdown);
			await tick();
			expect(list.hidden).toBe(false);
			expect(dropdown.getAttribute("aria-activedescendant")).toBe("setting-palette-balanced");
		},
	);

	it("closing Appearance discards an uncommitted choice and leaves the dropdown closed on reopen", async () => {
		const { trigger, dialog, dropdown, list } = openAppearance();
		await press(dropdown, "End");
		click(byRole(dialog, "button", "Close"));
		await tick();
		expect(dialog.open).toBe(false);
		expect(getStoredState().settings.palette).toBe("balanced");
		expect(document.activeElement).toBe(trigger);

		click(trigger);
		expect(dialog.open).toBe(true);
		expect(document.activeElement).toBe(dropdown);
		expect(list.hidden).toBe(true);
		expect(dropdown.getAttribute("aria-expanded")).toBe("false");
		expect(dropdown.hasAttribute("aria-activedescendant")).toBe(false);
		click(dropdown);
		await tick();
		expect(list.hidden).toBe(false);
		expect(dropdown.getAttribute("aria-activedescendant")).toBe("setting-palette-balanced");
	});
});
