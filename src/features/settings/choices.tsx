import type { Palette, Theme } from "../../model/settings";
import type { AccessibleName } from "../../shared/choice-group";
import { ChoiceGroup } from "../../shared/choice-group";
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

export function ThemeChoices({ value, onSelect, ...accessibleName }: ThemeChoicesProps) {
	return (
		<ChoiceGroup
			{...accessibleName}
			options={THEME_CHOICES}
			value={value}
			class="choice-options"
			optionClass="choice-option"
			selectionIndicator
			onSelect={onSelect}
			renderLabel={(option) => (
				<>
					<Icon id={option.iconId} />
					<span class="choice-option-label">{option.label}</span>
				</>
			)}
		/>
	);
}
