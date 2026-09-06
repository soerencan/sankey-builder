// @vitest-environment happy-dom

import type { ComponentChild } from "preact";
import { render } from "preact";
import { describe, expect, it, vi } from "vitest";
import { accessibleName, allByRole, byRole } from "../../../tests/helpers/dom-queries";
import { SETTING_DOMAINS } from "../../model/settings";
import {
	AlignmentChoices,
	AspectRatioChoices,
	LinkColorChoices,
	PaletteChoices,
	SWATCH_COUNT,
	SwatchStrip,
	ThemeChoices,
} from "./choices";
import { LINK_COLOR_SHORT_LABELS, SETTING_LABELS } from "./options";
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

describe("LinkColorChoices", () => {
	it("renders one button per link-color mode in SETTING_DOMAINS order, tracking aria-pressed and reporting the clicked value", () => {
		const onSelect = vi.fn();
		const container = mount(
			<LinkColorChoices value="target" label="Link colors" variant="full" onSelect={onSelect} />,
		);

		const buttons = allByRole<HTMLButtonElement>(container, "button");
		expect(buttons.map((button) => accessibleName(button))).toEqual(
			SETTING_DOMAINS.linkColor.map((value) => SETTING_LABELS.linkColor[value]),
		);
		expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual(
			SETTING_DOMAINS.linkColor.map((value) => String(value === "target")),
		);

		byRole<HTMLButtonElement>(container, "button", SETTING_LABELS.linkColor.static).click();
		expect(onSelect).toHaveBeenCalledWith("static");
	});

	it("variant 'full' labels options with the long label", () => {
		const container = mount(
			<LinkColorChoices value="source" label="Link colors" variant="full" onSelect={vi.fn()} />,
		);

		byRole(container, "button", SETTING_LABELS.linkColor["source-target"]);
	});

	it("variant 'short' labels options with the narrow-sheet's short label instead", () => {
		const container = mount(
			<LinkColorChoices value="source" label="Link colors" variant="short" onSelect={vi.fn()} />,
		);

		byRole(container, "button", LINK_COLOR_SHORT_LABELS["source-target"]);
	});
});

describe("AlignmentChoices", () => {
	it("renders one button per alignment in SETTING_DOMAINS order, tracking aria-pressed and reporting the clicked value", () => {
		const onSelect = vi.fn();
		const container = mount(
			<AlignmentChoices value="center" label="Alignment" variant="list" onSelect={onSelect} />,
		);

		const buttons = allByRole<HTMLButtonElement>(container, "button");
		expect(buttons.map((button) => accessibleName(button))).toEqual(
			SETTING_DOMAINS.alignment.map((value) => SETTING_LABELS.alignment[value]),
		);
		expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual(
			SETTING_DOMAINS.alignment.map((value) => String(value === "center")),
		);

		byRole<HTMLButtonElement>(container, "button", SETTING_LABELS.alignment.right).click();
		expect(onSelect).toHaveBeenCalledWith("right");
	});

	it("variant 'segmented' is the icon-only wide toolbar control: align-group/align-option classes, no visible label text", () => {
		const container = mount(
			<AlignmentChoices value="left" label="Alignment" variant="segmented" onSelect={vi.fn()} />,
		);

		const group = byRole(container, "group");
		expect(group.classList.contains("align-group")).toBe(true);
		const button = byRole<HTMLButtonElement>(container, "button", SETTING_LABELS.alignment.left);
		expect(button.classList.contains("align-option")).toBe(true);
		expect(button.querySelector(".choice-option-label")).toBeNull();
		expect(button.querySelector("svg.icon")).not.toBeNull();
	});

	it("variant 'list' is the dialog-row control: choice-options/choice-option classes, an icon plus a visible label", () => {
		const container = mount(
			<AlignmentChoices value="left" label="Alignment" variant="list" onSelect={vi.fn()} />,
		);

		const group = byRole(container, "group");
		expect(group.classList.contains("choice-options")).toBe(true);
		const button = byRole<HTMLButtonElement>(container, "button", SETTING_LABELS.alignment.left);
		expect(button.classList.contains("choice-option")).toBe(true);
		expect(button.querySelector(".choice-option-label")?.textContent).toBe(
			SETTING_LABELS.alignment.left,
		);
		expect(button.querySelector("svg.icon")).not.toBeNull();
	});
});

describe("AspectRatioChoices", () => {
	it("renders one button per aspect ratio in SETTING_DOMAINS order, tracking aria-pressed and reporting the clicked value", () => {
		const onSelect = vi.fn();
		const container = mount(
			<AspectRatioChoices value="16:9" label="Aspect ratio" onSelect={onSelect} />,
		);

		const buttons = allByRole<HTMLButtonElement>(container, "button");
		expect(buttons.map((button) => accessibleName(button))).toEqual(
			SETTING_DOMAINS.aspectRatio.map((value) => SETTING_LABELS.aspectRatio[value]),
		);
		expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual(
			SETTING_DOMAINS.aspectRatio.map((value) => String(value === "16:9")),
		);

		byRole<HTMLButtonElement>(container, "button", SETTING_LABELS.aspectRatio["3:1"]).click();
		expect(onSelect).toHaveBeenCalledWith("3:1");
	});

	it("renders the aspect-ratio-options group class and, per option, a ratio-preview swatch plus its label span", () => {
		const ratioPreviewClasses: Record<(typeof SETTING_DOMAINS.aspectRatio)[number], string> = {
			"a-series": "ratio-preview-a-series",
			"3:2": "ratio-preview-3-2",
			"16:9": "ratio-preview-16-9",
			"2:1": "ratio-preview-2-1",
			"3:1": "ratio-preview-3-1",
		};
		const container = mount(
			<AspectRatioChoices value="2:1" label="Aspect ratio" onSelect={vi.fn()} />,
		);

		const group = byRole(container, "group");
		expect(group.classList.contains("aspect-ratio-options")).toBe(true);

		for (const value of SETTING_DOMAINS.aspectRatio) {
			const button = byRole<HTMLButtonElement>(
				container,
				"button",
				SETTING_LABELS.aspectRatio[value],
			);
			const preview = button.querySelector<HTMLElement>(".ratio-preview");
			expect(preview?.getAttribute("aria-hidden")).toBe("true");
			expect(preview?.classList.contains(ratioPreviewClasses[value])).toBe(true);
			expect(button.querySelector(".choice-option-label")?.textContent).toBe(
				SETTING_LABELS.aspectRatio[value],
			);
		}
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
