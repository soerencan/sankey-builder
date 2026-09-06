/**
 * Accessible-role-and-name element queries — the one convention every test
 * uses to locate elements. Only the roles this app's suites actually query
 * are implemented (native HTML semantics plus this app's own explicit
 * role="group"); it's a small hand-written stand-in for testing-library's
 * getByRole, not a general ARIA implementation.
 */

const IMPLICIT_ROLE_SELECTORS: Record<string, string> = {
	button: "button",
	textbox: 'input[type="text"], input:not([type]), textarea',
	combobox: "select",
};

function roleSelector(role: string): string {
	const implicit = IMPLICIT_ROLE_SELECTORS[role];
	const explicit = `[role="${role}"]`;
	return implicit ? `${implicit}, ${explicit}` : explicit;
}

/** The element's accessible name: aria-labelledby's referenced text, then aria-label, then trimmed text content — the accname spec's own precedence. */
export function accessibleName(el: Element): string {
	const labelledBy = el.getAttribute("aria-labelledby");
	if (labelledBy) {
		const referenced = el.ownerDocument.getElementById(labelledBy);
		if (referenced) return (referenced.textContent ?? "").trim();
	}
	const label = el.getAttribute("aria-label");
	if (label !== null) return label.trim();
	return (el.textContent ?? "").trim();
}

/** Every descendant of `root` matching `role`, optionally filtered to those whose accessible name is exactly `name`. */
export function allByRole<T extends Element = HTMLElement>(
	root: ParentNode,
	role: string,
	name?: string,
): T[] {
	const matches = Array.from(root.querySelectorAll<T>(roleSelector(role)));
	return name === undefined ? matches : matches.filter((el) => accessibleName(el) === name);
}

/** The one descendant of `root` matching `role` (and `name`, if given) — throws if there isn't exactly one. */
export function byRole<T extends Element = HTMLElement>(
	root: ParentNode,
	role: string,
	name?: string,
): T {
	const matches = allByRole<T>(root, role, name);
	const suffix = name === undefined ? "" : ` named "${name}"`;
	if (matches.length === 0) {
		throw new Error(`expected an element with role "${role}"${suffix}`);
	}
	if (matches.length > 1) {
		throw new Error(
			`expected exactly one element with role "${role}"${suffix}, found ${matches.length} — scope the search with a narrower root`,
		);
	}
	return matches[0];
}
