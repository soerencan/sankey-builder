/**
 * One component per setting, so the wide toolbar, the per-setting dialogs,
 * and the narrow "Diagram" sheet share each option set's label rendering
 * instead of passing ChoiceGroup a bespoke `renderLabel` per surface.
 */

import type { Alignment, AspectRatio, LinkColorMode, Palette, Theme } from "../../model/settings";
import type { AccessibleName } from "../../shared/choice-group";
import { ChoiceGroup } from "../../shared/choice-group";
import { Icon } from "../../shared/icon";
import {
	ALIGNMENT_CHOICES,
	ASPECT_RATIO_CHOICES,
	LINK_COLOR_CHOICES,
	PALETTE_CHOICES,
	THEME_CHOICES,
} from "./options";
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

/**
 * ":" is swapped for "-" because a colon in a class selector needs escaping.
 * A `Record` rather than a string-munging function so that a new
 * `AspectRatio` without a matching style.css rule is a compile error.
 */
const RATIO_PREVIEW_CLASSES: Record<AspectRatio, string> = {
	"a-series": "ratio-preview-a-series",
	"3:2": "ratio-preview-3-2",
	"16:9": "ratio-preview-16-9",
	"2:1": "ratio-preview-2-1",
	"3:1": "ratio-preview-3-1",
};

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

export type LinkColorChoicesProps = {
	value: LinkColorMode;
	onSelect(value: LinkColorMode): void;
	/** "short" is the narrow sheet's abbreviated labels; "full" is the links dialog's. */
	variant: "full" | "short";
} & AccessibleName;

export function LinkColorChoices({
	value,
	onSelect,
	variant,
	...accessibleName
}: LinkColorChoicesProps) {
	return (
		<ChoiceGroup
			{...accessibleName}
			options={LINK_COLOR_CHOICES}
			value={value}
			class="choice-options"
			optionClass="choice-option"
			onSelect={onSelect}
			renderLabel={(option) => (
				<>
					<Icon id={option.iconId} />
					<span class="choice-option-label">
						{variant === "short" ? option.shortLabel : option.label}
					</span>
				</>
			)}
		/>
	);
}

export type AlignmentChoicesProps = {
	value: Alignment;
	onSelect(value: Alignment): void;
	/** "segmented" is the wide toolbar's icon-only control; "list" is the dialog rows. */
	variant: "segmented" | "list";
} & AccessibleName;

export function AlignmentChoices({
	value,
	onSelect,
	variant,
	...accessibleName
}: AlignmentChoicesProps) {
	if (variant === "segmented") {
		return (
			<ChoiceGroup
				{...accessibleName}
				options={ALIGNMENT_CHOICES}
				value={value}
				class="align-group"
				optionClass="align-option"
				ariaLabel={(option) => option.label}
				onSelect={onSelect}
				renderLabel={(option) => <Icon id={option.iconId} />}
			/>
		);
	}
	return (
		<ChoiceGroup
			{...accessibleName}
			options={ALIGNMENT_CHOICES}
			value={value}
			class="choice-options"
			optionClass="choice-option"
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

export type AspectRatioChoicesProps = {
	value: AspectRatio;
	onSelect(value: AspectRatio): void;
} & AccessibleName;

export function AspectRatioChoices({
	value,
	onSelect,
	...accessibleName
}: AspectRatioChoicesProps) {
	return (
		<ChoiceGroup
			{...accessibleName}
			options={ASPECT_RATIO_CHOICES}
			value={value}
			class="choice-options aspect-ratio-options"
			optionClass="choice-option"
			onSelect={onSelect}
			renderLabel={(option) => (
				<>
					<span class={`ratio-preview ${RATIO_PREVIEW_CLASSES[option.value]}`} aria-hidden="true" />
					<span class="choice-option-label">{option.label}</span>
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
