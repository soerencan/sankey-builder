// @vitest-environment happy-dom

import type { ComponentChild } from "preact";
import { render } from "preact";
import { describe, expect, it, vi } from "vitest";
import { accessibleName, allByRole, byRole } from "../../../tests/helpers/dom-queries";
import { SETTING_DOMAINS } from "../../model/settings";
import { SwatchStrip, ThemeChoices } from "./choices";
import { SETTING_LABELS } from "./options";
import { PALETTE_SIZE, paletteColors } from "./palettes";

function mount(vnode: ComponentChild) {
	const container = document.createElement("div");
	document.body.appendChild(container);
	render(vnode, container);
	return container;
}

describe("ThemeChoices", () => {
	it("renders one button per theme in SETTING_DOMAINS order, tracking aria-pressed and reporting the clicked value", () => {
		const onSelect = vi.fn();
		const container = mount(<ThemeChoices value="dark" label="Theme" onSelect={onSelect} />);
		expect(byRole(container, "group").getAttribute("aria-label")).toBe("Theme");

		const buttons = allByRole<HTMLButtonElement>(container, "button");
		expect(buttons.map((button) => accessibleName(button))).toEqual(
			SETTING_DOMAINS.theme.map((value) => SETTING_LABELS.theme[value]),
		);
		expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual(
			SETTING_DOMAINS.theme.map((value) => String(value === "dark")),
		);

		byRole<HTMLButtonElement>(container, "button", SETTING_LABELS.theme.light).click();
		expect(onSelect).toHaveBeenCalledWith("light");
	});

	it("preserves the buttons and keyboard focus when the selected theme changes", () => {
		const onSelect = vi.fn();
		const container = mount(<ThemeChoices value="auto" label="Theme" onSelect={onSelect} />);
		const before = allByRole<HTMLButtonElement>(container, "button");
		byRole<HTMLButtonElement>(container, "button", "Dark").focus();

		render(<ThemeChoices value="dark" label="Theme" onSelect={onSelect} />, container);

		const after = allByRole<HTMLButtonElement>(container, "button");
		expect(after).toHaveLength(before.length);
		after.forEach((button, index) => {
			expect(button).toBe(before[index]);
		});
		expect(document.activeElement).toBe(byRole(container, "button", "Dark"));
		expect(after.map((button) => button.getAttribute("aria-pressed"))).toEqual([
			"false",
			"false",
			"true",
		]);
		expect(
			after.map((button) => button.querySelector(".selection-indicator")?.textContent),
		).toEqual(["", "", "✓"]);
	});
});

describe("labelledBy", () => {
	it("sets the group's aria-labelledby instead of aria-label when given", () => {
		const container = mount(
			<ThemeChoices value="auto" labelledBy="external-heading" onSelect={vi.fn()} />,
		);

		const group = byRole(container, "group");
		expect(group.getAttribute("aria-labelledby")).toBe("external-heading");
		expect(group.hasAttribute("aria-label")).toBe(false);
	});
});

describe("SwatchStrip", () => {
	it("renders PALETTE_SIZE swatches with the palette's first colors", () => {
		const container = mount(<SwatchStrip palette="muted" />);

		const swatches = Array.from(container.querySelectorAll<HTMLElement>(".swatch"));
		expect(swatches).toHaveLength(PALETTE_SIZE);
		expect(swatches.map((swatch) => swatch.style.backgroundColor)).toEqual(paletteColors("muted"));
	});
});
