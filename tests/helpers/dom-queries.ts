/**
 * A small stand-in for testing-library's getByRole, not a general ARIA
 * implementation: only the roles this app's suites query are covered.
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

/** aria-labelledby, then aria-label, then text content: the accname spec's precedence. */
export function accessibleName(el: Element): string {
	const labelledBy = el.getAttribute("aria-labelledby");
	if (labelledBy) {
		const referenced = el.ownerDocument.getElementById(labelledBy);
		if (referenced) return (referenced.textContent ?? "").trim();
	}
	const label = el.getAttribute("aria-label");
	if (label !== null) return label.trim();
	const clone = el.cloneNode(true) as Element;
	for (const hidden of Array.from(clone.querySelectorAll('[aria-hidden="true"]'))) hidden.remove();
	return (clone.textContent ?? "").trim();
}

export function allByRole<T extends Element = HTMLElement>(
	root: ParentNode,
	role: string,
	name?: string,
): T[] {
	const matches = Array.from(root.querySelectorAll<T>(roleSelector(role)));
	return name === undefined ? matches : matches.filter((el) => accessibleName(el) === name);
}

/** Throws unless exactly one element matches. */
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
