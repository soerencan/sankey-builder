import type { Theme } from "../../model/settings";

/** "auto" removes the attribute entirely so prefers-color-scheme drives style.css. */
export function applyTheme(doc: Document, theme: Theme): void {
	if (theme === "auto") {
		doc.documentElement.removeAttribute("data-theme");
	} else {
		doc.documentElement.setAttribute("data-theme", theme);
	}
}
