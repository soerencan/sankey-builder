// @vitest-environment happy-dom

import type { ComponentChild } from "preact";
import { render } from "preact";
import { describe, expect, it, vi } from "vitest";
import { accessibleName, allByRole, byRole } from "../../../tests/helpers/dom-queries";
import { SETTING_DOMAINS } from "../../model/settings";
import { PaletteChoices, SWATCH_COUNT, SwatchStrip, ThemeChoices } from "./choices";
import { SETTING_LABELS } from "./options";
import { paletteColors } from "./palettes";

function mount(vnode: ComponentChild) {
	const container = document.createElement("div");
	document.body.appendChild(container);
	render(vnode, container);
	return container;
}

describe("PaletteChoices", () => {
	it("renders one button per palette in SETTING_DOMAINS order, tracking aria-pressed and reporting the clicked value", () => {
		const onSelect = vi.fn();
		const container = mount(<PaletteChoices value="set2" label="Palette" onSelect={onSelect} />);

		const buttons = allByRole<HTMLButtonElement>(container, "button");
		expect(buttons.map((button) => accessibleName(button))).toEqual(
			SETTING_DOMAINS.palette.map((value) => SETTING_LABELS.palette[value]),
		);
		expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual(
			SETTING_DOMAINS.palette.map((value) => String(value === "set2")),
		);

		byRole<HTMLButtonElement>(container, "button", SETTING_LABELS.palette.dark2).click();
		expect(onSelect).toHaveBeenCalledWith("dark2");
	});
});

describe("ThemeChoices", () => {
	it("renders one button per theme in SETTING_DOMAINS order, tracking aria-pressed and reporting the clicked value", () => {
		const onSelect = vi.fn();
		const container = mount(<ThemeChoices value="dark" label="Theme" onSelect={onSelect} />);

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
	it("renders SWATCH_COUNT swatches with the palette's first colors", () => {
		const container = mount(<SwatchStrip palette="tableau10" />);

		const swatches = Array.from(container.querySelectorAll<HTMLElement>(".swatch"));
		expect(swatches).toHaveLength(SWATCH_COUNT);
		expect(swatches.map((swatch) => swatch.style.backgroundColor)).toEqual(
			paletteColors("tableau10").slice(0, SWATCH_COUNT),
		);
	});
});
