import type { Theme } from "../../model/settings";
import { ChoiceDialog } from "../../shared/choice-dialog";
import { ChoiceGroup } from "../../shared/choice-group";
import { useDialog } from "../../shared/use-dialog";
import { THEME_OPTIONS } from "./options";

export interface ThemeControlActions {
	setTheme(theme: Theme): void;
}

export interface ThemeControlProps {
	theme: Theme;
	actions: ThemeControlActions;
}

// Runtime iteration order follows THEME_OPTIONS's own declaration order:
// system, light, dark.
const THEME_CHOICES = Object.entries(THEME_OPTIONS).map(([value, option]) => ({
	value: value as Theme,
	...option,
}));

/**
 * The header's theme button and its dialog — no validation/redraw on
 * selection, since theme is a per-browser preference, not diagram data (see
 * ThemeControlActions.setTheme's caller in start-app.tsx).
 */
export function ThemeControl({ theme, actions }: ThemeControlProps) {
	const dialog = useDialog();
	const { label, iconId } = THEME_OPTIONS[theme];

	return (
		<>
			<button
				type="button"
				id="theme-button"
				class="toolbar-button"
				aria-haspopup="dialog"
				aria-label={`Theme: ${label}`}
				onClick={(event) => dialog.open(event.currentTarget)}
			>
				<svg class="icon" aria-hidden="true" focusable="false">
					<use href={`#${iconId}`} />
				</svg>
			</button>

			<ChoiceDialog id="theme-dialog" heading="Theme" handle={dialog}>
				<ChoiceGroup
					options={THEME_CHOICES}
					value={theme}
					label="Theme"
					class="choice-options"
					optionClass="choice-option"
					onSelect={(value) => {
						actions.setTheme(value);
						dialog.close();
					}}
					renderLabel={(option) => (
						<>
							<svg class="icon" aria-hidden="true" focusable="false">
								<use href={`#${option.iconId}`} />
							</svg>
							<span class="choice-option-label">{option.label}</span>
						</>
					)}
				/>
			</ChoiceDialog>
		</>
	);
}
