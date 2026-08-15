import type { Theme } from "./state";

/**
 * Reflects the theme setting onto <html> for style.css to key off. "auto"
 * removes the attribute entirely so the prefers-color-scheme media query
 * (rather than an empty/"auto" attribute value) drives the styling.
 */
export function applyTheme(theme: Theme): void {
	if (theme === "auto") {
		document.documentElement.removeAttribute("data-theme");
	} else {
		document.documentElement.setAttribute("data-theme", theme);
	}
}
