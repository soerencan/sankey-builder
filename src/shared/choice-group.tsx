import type { ComponentChildren } from "preact";

/** Exactly one of aria-label or aria-labelledby. */
export type AccessibleName =
	| { label: string; labelledBy?: undefined }
	| { label?: undefined; labelledBy: string };

export type ChoiceGroupProps<Option extends { value: string }> = {
	options: readonly Option[];
	value: Option["value"];
	onSelect(value: Option["value"]): void;
	renderLabel(option: Option): ComponentChildren;
	class?: string;
	optionClass?: string;
	selectionIndicator?: boolean;
	/** For icon-only buttons; omit when renderLabel's content already names the button. */
	ariaLabel?(option: Option): string;
} & AccessibleName;

export function ChoiceGroup<Option extends { value: string }>({
	options,
	value,
	onSelect,
	renderLabel,
	class: groupClass,
	optionClass,
	selectionIndicator,
	ariaLabel,
	label,
	labelledBy,
}: ChoiceGroupProps<Option>) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: These buttons change settings immediately, not as part of a submittable form.
		<div class={groupClass} role="group" aria-label={label} aria-labelledby={labelledBy}>
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
					{selectionIndicator && (
						<span class="selection-indicator" aria-hidden="true">
							{value === option.value ? "✓" : ""}
						</span>
					)}
				</button>
			))}
		</div>
	);
}
