import type { Theme } from "../../model/settings";
import { ChoiceDialog } from "../../shared/choice-dialog";
import { Icon } from "../../shared/icon";
import { useDialog } from "../../shared/use-dialog";
import { ThemeChoices } from "./choices";
import { SETTING_LABELS, THEME_ICONS } from "./options";

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
				<ThemeChoices
					value={theme}
					label="Theme"
					onSelect={(value) => {
						actions.setTheme(value);
						dialog.close();
					}}
				/>
			</ChoiceDialog>
		</>
	);
}
