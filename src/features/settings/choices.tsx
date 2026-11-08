import type { Palette, Theme } from "../../model/settings";
import type { AccessibleName } from "../../shared/accessible-name";
import { Icon } from "../../shared/icon";
import { THEME_CHOICES } from "./options";
import { paletteColors } from "./palettes";

export function SwatchStrip({ palette }: { palette: Palette }) {
	return (
		<span class="swatch-strip" aria-hidden="true">
			{paletteColors(palette).map((color) => (
				<span key={color} class="swatch" style={{ backgroundColor: color }} />
			))}
		</span>
	);
}

export type ThemeChoicesProps = {
	value: Theme;
	onSelect(value: Theme): void;
} & AccessibleName;

export function ThemeChoices({ value, onSelect, label, labelledBy }: ThemeChoicesProps) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: These buttons change settings immediately, not as part of a submittable form.
		<div class="choice-options" role="group" aria-label={label} aria-labelledby={labelledBy}>
			{THEME_CHOICES.map((option) => (
				<button
					key={option.value}
					type="button"
					class="choice-option"
					aria-pressed={value === option.value}
					onClick={() => onSelect(option.value)}
				>
					<Icon id={option.iconId} />
					<span class="choice-option-label">{option.label}</span>
					<span class="selection-indicator" aria-hidden="true">
						{value === option.value ? "✓" : ""}
					</span>
				</button>
			))}
		</div>
	);
}
