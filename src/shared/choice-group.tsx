import type { ComponentChildren } from "preact";

/** An accessible name comes from a visible label (aria-label) or a heading elsewhere in the DOM (aria-labelledby) — never both, never neither. */
export type AccessibleName =
	| { label: string; labelledBy?: undefined }
	| { label?: undefined; labelledBy: string };

export type ChoiceGroupProps<Option extends { value: string }> = {
	options: readonly Option[];
	value: Option["value"];
	onSelect(value: Option["value"]): void;
	/** Each option button's content — icon, text, or both; ChoiceGroup owns only the button and its aria-pressed wiring. */
	renderLabel(option: Option): ComponentChildren;
	/** Class on the wrapping group element. */
	class?: string;
	/** Class on every option button. */
	optionClass?: string;
	/** Per-option aria-label, for icon-only buttons that render no visible text (e.g. alignment). Omit when renderLabel's own content already names the button. */
	ariaLabel?(option: Option): string;
} & AccessibleName;

/**
 * A "pick one of N" option list rendered as pressed toggle buttons — the one
 * shape every settings chooser (palette, link color, alignment, aspect
 * ratio, theme) and the narrow display sheet's copies of them are built
 * from. Keying by option.value keeps each button's DOM identity stable
 * across a value change, so only aria-pressed (and any renderLabel content
 * derived from `value`) needs to update.
 */
export function ChoiceGroup<Option extends { value: string }>({
	options,
	value,
	onSelect,
	renderLabel,
	class: groupClass,
	optionClass,
	ariaLabel,
	label,
	labelledBy,
}: ChoiceGroupProps<Option>) {
	return (
		<div
			class={groupClass}
			// biome-ignore lint/a11y/useSemanticElements: role="group" with an accessible name, no <fieldset>/<legend> — a live custom radio-group of pressed buttons, not a submittable form control.
			role="group"
			aria-label={label}
			aria-labelledby={labelledBy}
		>
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					class={optionClass}
					aria-pressed={value === option.value}
					aria-label={ariaLabel?.(option)}
					onClick={() => onSelect(option.value)}
				>
					{renderLabel(option)}
				</button>
			))}
		</div>
	);
}
