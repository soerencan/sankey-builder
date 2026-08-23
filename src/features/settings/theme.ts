import type { Theme } from "../../model/settings";

/**
 * Reflects the theme setting onto <html> for style.css to key off. "auto"
 * removes the attribute entirely so the prefers-color-scheme media query
 * (rather than an empty/"auto" attribute value) drives the styling.
 */
export function applyTheme(doc: Document, theme: Theme): void {
	if (theme === "auto") {
		doc.documentElement.removeAttribute("data-theme");
	} else {
		doc.documentElement.setAttribute("data-theme", theme);
	}
}
