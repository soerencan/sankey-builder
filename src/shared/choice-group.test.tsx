// @vitest-environment happy-dom

import { render } from "preact";
import { describe, expect, it, vi } from "vitest";
import { allByRole, byRole } from "../../tests/helpers/dom-queries";
import { ChoiceGroup } from "./choice-group";

interface Fixture {
	value: string;
	label: string;
}

const OPTIONS: readonly Fixture[] = [
	{ value: "red", label: "Red" },
	{ value: "green", label: "Green" },
	{ value: "blue", label: "Blue" },
];

function mount(value: string, onSelect: (value: string) => void) {
	const container = document.createElement("div");
	document.body.appendChild(container);
	render(
		<ChoiceGroup
			options={OPTIONS}
			value={value}
			label="Color"
			class="fixture-group"
			optionClass="fixture-option"
			onSelect={onSelect}
			renderLabel={(option) => option.label}
		/>,
		container,
	);
	return container;
}

describe("ChoiceGroup", () => {
	it("renders one button per option, with aria-pressed matching the current value", () => {
		const container = mount("green", vi.fn());

		const buttons = allByRole<HTMLButtonElement>(container, "button");
		expect(buttons).toHaveLength(OPTIONS.length);
		for (const [index, button] of buttons.entries()) {
			const option = OPTIONS[index];
			expect(button.textContent).toBe(option.label);
			expect(button.getAttribute("aria-pressed")).toBe(option.value === "green" ? "true" : "false");
		}
	});

	it("renders the group with an accessible name from `label`", () => {
		const container = mount("red", vi.fn());

		const group = byRole(container, "group");
		expect(group.getAttribute("aria-label")).toBe("Color");
	});

	it("renders the group with an accessible name from `labelledBy` instead", () => {
		const container = document.createElement("div");
		document.body.appendChild(container);
		render(
			<ChoiceGroup
				options={OPTIONS}
				value="red"
				labelledBy="external-heading"
				onSelect={vi.fn()}
				renderLabel={(option) => option.label}
			/>,
			container,
		);

		const group = byRole(container, "group");
		expect(group.getAttribute("aria-labelledby")).toBe("external-heading");
		expect(group.hasAttribute("aria-label")).toBe(false);
	});

	it("calls onSelect with the clicked option's value", () => {
		const onSelect = vi.fn();
		const container = mount("red", onSelect);

		byRole<HTMLButtonElement>(container, "button", "Blue").click();

		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect).toHaveBeenCalledWith("blue");
	});

	it("sets a per-option aria-label from `ariaLabel` when given", () => {
		const container = document.createElement("div");
		document.body.appendChild(container);
		render(
			<ChoiceGroup
				options={OPTIONS}
				value="red"
				label="Color"
				onSelect={vi.fn()}
				ariaLabel={(option) => `Choose ${option.label}`}
				renderLabel={() => null}
			/>,
			container,
		);

		byRole(container, "button", "Choose Green");
	});

	it("keeps each option button's DOM identity across a value change (keyed by option.value)", () => {
		const container = mount("red", vi.fn());
		const before = allByRole<HTMLButtonElement>(container, "button");
		const pressedBefore = before.map((button) => button.getAttribute("aria-pressed"));

		render(
			<ChoiceGroup
				options={OPTIONS}
				value="blue"
				label="Color"
				class="fixture-group"
				optionClass="fixture-option"
				onSelect={vi.fn()}
				renderLabel={(option) => option.label}
			/>,
			container,
		);
		const after = allByRole<HTMLButtonElement>(container, "button");

		// Same elements, not new ones — a rerender with a different `value`
		// patches aria-pressed on the existing buttons rather than remounting.
		// toEqual would pass on structurally-identical clones too, so identity
		// is asserted per element with toBe instead.
		expect(after).toHaveLength(before.length);
		after.forEach((button, index) => expect(button).toBe(before[index]));
		expect(pressedBefore).toEqual(["true", "false", "false"]);
		expect(after.map((button) => button.getAttribute("aria-pressed"))).toEqual([
			"false",
			"false",
			"true",
		]);
	});
});
