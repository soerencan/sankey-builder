import type { Theme } from "../../model/settings";
import { useDialog } from "../../shared/use-dialog";
import { THEME_OPTIONS } from "./options";

export interface ThemeControlActions {
	setTheme(theme: Theme): void;
}

export interface ThemeControlProps {
	theme: Theme;
	actions: ThemeControlActions;
}

// Runtime iteration order follows THEME_OPTIONS's own declaration order
// (system, light, dark), matching diagram-panel.tsx's LINK_COLOR_ENTRIES
// pattern for the same kind of dialog.
const THEME_ENTRIES = Object.entries(THEME_OPTIONS) as [Theme, { label: string; iconId: string }][];

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
				data-action="open-theme-dialog"
				aria-haspopup="dialog"
				aria-label={`Theme: ${label}`}
				onClick={(event) => dialog.open(event.currentTarget)}
			>
				<svg class="icon" aria-hidden="true" focusable="false">
					<use href={`#${iconId}`} />
				</svg>
			</button>

			<dialog id="theme-dialog" ref={dialog.ref} aria-labelledby="theme-dialog-heading">
				<h3 id="theme-dialog-heading">Theme</h3>
				<div
					class="choice-options"
					// biome-ignore lint/a11y/useSemanticElements: role="group" (not <fieldset>) matches index.html's original markup exactly, pinned by tests/integration/settings.test.ts's dialog-markup-vs-metadata contract.
					role="group"
					aria-label="Theme"
				>
					{THEME_ENTRIES.map(([value, option]) => (
						<button
							key={value}
							type="button"
							class="choice-option"
							data-action="set-theme"
							data-value={value}
							aria-pressed={theme === value}
							onClick={() => {
								actions.setTheme(value);
								dialog.close();
							}}
						>
							<svg class="icon" aria-hidden="true" focusable="false">
								<use href={`#${option.iconId}`} />
							</svg>
							<span class="choice-option-label">{option.label}</span>
						</button>
					))}
				</div>
				<button type="button" class="dialog-close" data-action="close-dialog">
					Close
				</button>
			</dialog>
		</>
	);
}
