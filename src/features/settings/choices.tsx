import type { Palette, Theme } from "../../model/settings";
import type { AccessibleName } from "../../shared/choice-group";
import { ChoiceGroup } from "../../shared/choice-group";
import { Icon } from "../../shared/icon";
import { PALETTE_CHOICES, THEME_CHOICES } from "./options";
import { paletteColors } from "./palettes";

// Palettes with more colors are truncated so preview and dialog rows keep a
// consistent width.
export const SWATCH_COUNT = 5;

export function SwatchStrip({ palette }: { palette: Palette }) {
	return (
		<span class="swatch-strip">
			{paletteColors(palette)
				.slice(0, SWATCH_COUNT)
				.map((color) => (
					<span key={color} class="swatch" style={{ backgroundColor: color }} />
				))}
		</span>
	);
}

export type PaletteChoicesProps = {
	value: Palette;
	onSelect(value: Palette): void;
} & AccessibleName;

export function PaletteChoices({ value, onSelect, ...accessibleName }: PaletteChoicesProps) {
	return (
		<ChoiceGroup
			{...accessibleName}
			options={PALETTE_CHOICES}
			value={value}
			class="palette-options"
			optionClass="palette-option"
			selectionIndicator
			onSelect={onSelect}
			renderLabel={(option) => (
				<>
					<span class="palette-option-label">{option.label}</span>
					<SwatchStrip palette={option.value} />
				</>
			)}
		/>
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
