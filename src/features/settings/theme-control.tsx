import type { Theme } from "../../model/settings";
import { ChoiceDialog } from "../../shared/choice-dialog";
import { ChoiceGroup } from "../../shared/choice-group";
import { Icon } from "../../shared/icon";
import { useDialog } from "../../shared/use-dialog";
import { SETTING_LABELS, THEME_CHOICES, THEME_ICONS } from "./options";

export interface ThemeControlActions {
	setTheme(theme: Theme): void;
}

export interface ThemeControlProps {
	theme: Theme;
	actions: ThemeControlActions;
}

export function ThemeControl({ theme, actions }: ThemeControlProps) {
	const dialog = useDialog();
	const label = SETTING_LABELS.theme[theme];
	const iconId = THEME_ICONS[theme];

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
				<Icon id={iconId} />
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
							<Icon id={option.iconId} />
							<span class="choice-option-label">{option.label}</span>
						</>
					)}
				/>
			</ChoiceDialog>
		</>
	);
}
