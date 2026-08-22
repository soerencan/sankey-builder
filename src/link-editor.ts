import { attachRowSortable, setupRowReorder } from "./row-reorder";
import type { Link, Node, State } from "./state";
import {
	MAX_LINK_VALUE,
	exceedsFractionDigits,
	isPlainDecimalFormat,
	parseLinkValue,
	truncateFractionDigits,
} from "./validate";

export interface LinkEditorActions {
	addLink(): void;
	deleteLink(index: number): void;
	updateLinkSource(index: number, id: string | null): void;
	updateLinkTarget(index: number, id: string | null): void;
	updateLinkValue(index: number, value: number): void;
	moveLink(from: number, to: number): void;
}

function linkValueErrorId(index: number): string {
	return `link-value-error-${index}`;
}

/**
 * Message for the "invalid" parseLinkValue branch, mirroring its actual
 * rules (src/validate.ts) rather than a generic catch-all. The over-precision
 * branch is reachable even though beforeinput blocks a 5th typed digit and
 * truncates an over-precise paste: a whitespace-padded paste ("  0.00001")
 * or an inputType beforeinput doesn't intercept (composition,
 * insertReplacementText) can still land an over-precise value here. The
 * max-value branch is gated on the plain-decimal format so "1e20" — rejected
 * for its format, not its magnitude — doesn't get a message implying
 * exponent notation would otherwise be accepted.
 */
function linkValueErrorMessage(raw: string): string {
	const trimmed = raw.trim();
	if (exceedsFractionDigits(trimmed)) return "Enter a number with up to 4 decimal places.";
	if (isPlainDecimalFormat(trimmed) && Number(trimmed) > MAX_LINK_VALUE) {
		return `Enter a number no greater than ${MAX_LINK_VALUE}.`;
	}
	return "Enter a plain number greater than 0.";
}

/**
 * Populates a source/target <select> with a "— select —" placeholder (empty
 * value) followed by all nodes. The placeholder is selected while the endpoint
 * is null and stays selectable afterward, so an endpoint can be un-assigned
 * again — consistent with incomplete links being harmless. The node matching
 * the other select of the same row is disabled, making a self-link impossible
 * to choose rather than merely rejecting it after the fact.
 */
function renderLinkOptions(
	selectEl: HTMLSelectElement,
	nodes: Node[],
	selectedId: string | null,
	excludedId: string | null,
): void {
	// selected/disabled as attributes, not properties: Sortable's drag ghost is
	// built via cloneNode, which copies attributes only — property-only state
	// would reset the ghost's selects to the placeholder mid-drag. Safe because
	// every committed change rebuilds these options from state.
	const select = d3.select(selectEl);
	select.selectAll("option").remove();
	select
		.append("option")
		.attr("value", "")
		.attr("selected", selectedId === null ? "" : null)
		.text("— select —");
	select
		.selectAll("option.node-option")
		.data(nodes)
		.join("option")
		.attr("class", "node-option")
		.attr("value", (n) => n.id)
		.attr("disabled", (n) => (n.id === excludedId ? "" : null))
		.attr("selected", (n) => (n.id === selectedId ? "" : null))
		.text((n) => n.name);
}

// Recreated on every renderLinkEditor call (the .link-rows container it's
// attached to is torn down and rebuilt each time) — tracked here so the
// previous instance can be destroy()ed rather than leaked.
let rowSortable: Sortable | null = null;

/** Rebuilds #link-editor from state — same full-rebuild approach as the node editor. */
export function renderLinkEditor(state: State, moveLink: (from: number, to: number) => void): void {
	const root = d3.select("#link-editor");
	root.html("");
	root.append("h3").attr("id", "link-editor-heading").text("Links");

	const rowsContainer = root.append("div").attr("class", "link-rows");

	const row = rowsContainer
		.selectAll<HTMLDivElement, Link>(".link-row")
		.data(state.links)
		.join("div")
		.attr("class", "link-row");

	row
		.append("button")
		.attr("type", "button")
		.attr("class", "drag-handle")
		.attr("data-index", (_d, i) => i)
		.attr("aria-label", (_d, i) => `Reorder link ${i + 1}`)
		.text("⠿");

	row
		.append("select")
		.attr("class", "link-source")
		.attr("data-action", "update-link-source")
		.attr("data-index", (_d, i) => i)
		.attr("aria-label", (_d, i) => `Source for link ${i + 1}`)
		.each(function (d) {
			renderLinkOptions(this, state.nodes, d.source, d.target);
		});

	row
		.append("select")
		.attr("class", "link-target")
		.attr("data-action", "update-link-target")
		.attr("data-index", (_d, i) => i)
		.attr("aria-label", (_d, i) => `Target for link ${i + 1}`)
		.each(function (d) {
			renderLinkOptions(this, state.nodes, d.target, d.source);
		});

	row
		.append("input")
		.attr("type", "text")
		.attr("inputmode", "decimal")
		.attr("class", "link-value")
		.attr("data-action", "update-link-value")
		.attr("data-index", (_d, i) => i)
		.attr("aria-label", (_d, i) => `Value for link ${i + 1}`)
		.attr("aria-describedby", (_d, i) => linkValueErrorId(i))
		.attr("value", (d) => d.value);

	row
		.append("button")
		.attr("type", "button")
		.attr("class", "link-delete")
		.attr("data-action", "delete-link")
		.attr("data-index", (_d, i) => i)
		.attr("aria-label", (_d, i) => `Delete link ${i + 1}`)
		.text("Delete");

	// Appended last (after all 5 row-1 cells) so it lands in a fresh implicit
	// row under sparse auto-placement — appending it earlier left row 1 short
	// a cell, which pushed Delete onto its own row 3 the moment an error
	// showed. Always present (empty when valid) so aria-describedby has a
	// stable target — no attribute toggling needed, just text content. Empty
	// is visually hidden via CSS (:empty), same pattern as the top-level
	// #error banner. No aria-live: validation runs on every keystroke, and a
	// live region would announce mid-typing on each one — the description is
	// still reachable via aria-describedby whenever the field has focus.
	row
		.append("span")
		.attr("class", "field-error")
		.attr("id", (_d, i) => linkValueErrorId(i));

	root
		.append("button")
		.attr("type", "button")
		.attr("class", "add-link")
		.attr("data-action", "add-link")
		.text("Add link");

	const container = rowsContainer.node();
	if (container) {
		rowSortable = attachRowSortable(
			container,
			{ rowClass: "link-row", move: moveLink },
			rowSortable,
		);
	}
}

/** Sets (or clears, for "") the text of the field's paired error element. */
function setLinkValueError(index: number, message: string): void {
	const el = document.getElementById(linkValueErrorId(index));
	if (el) el.textContent = message;
}

/**
 * Parse the current field text and reconcile state + the invalid marker +
 * its paired error message. Shared by the `input` handler and the paste
 * branch of `beforeinput`, which rewrites `value` programmatically (no
 * native `input` event follows). Re-run on every keystroke, so the message
 * persists across further invalid edits and clears the moment the value
 * becomes valid (or blank) again — never cleared unconditionally.
 */
function commitLinkValue(
	target: HTMLInputElement,
	index: number,
	actions: LinkEditorActions,
): void {
	// Value edits skip the row rebuild (focus preservation), so mirror the live
	// value into the attribute — Sortable's cloneNode ghost reads only that.
	target.setAttribute("value", target.value);
	const parsed = parseLinkValue(target.value);
	if (parsed.kind === "valid") {
		target.removeAttribute("aria-invalid");
		setLinkValueError(index, "");
		actions.updateLinkValue(index, parsed.value);
	} else if (parsed.kind === "empty") {
		// Mid-edit blank — leave state untouched rather than writing NaN.
		target.removeAttribute("aria-invalid");
		setLinkValueError(index, "");
	} else {
		target.setAttribute("aria-invalid", "true");
		setLinkValueError(index, linkValueErrorMessage(target.value));
	}
}

/**
 * Delegated listeners on the link-editor root, mirroring setupNodeEditor.
 * Select changes do a full rebuild (focus loss on a <select> after
 * choosing a value is normal browser behavior); the value input follows
 * the same focus-preserving path as node renames.
 *
 * `state` is the stable, mutated-in-place reference from main.ts, so the
 * blur handler reads the value that in-progress edits have already written.
 */
export function setupLinkEditor(actions: LinkEditorActions, state: State): void {
	const root = document.getElementById("link-editor");
	if (!root) return;

	setupRowReorder({
		rootId: "link-editor",
		rowClass: "link-row",
		move: actions.moveLink,
		// Links have no stable id — refocus the handle now at the new index.
		refocusSelector: (_handle, to) => `.drag-handle[data-index="${to}"]`,
	});

	root.addEventListener("click", (event) => {
		if (!(event.target instanceof HTMLElement)) return;
		const { action, index } = event.target.dataset;
		if (action === "add-link") {
			actions.addLink();
		} else if (action === "delete-link" && index !== undefined) {
			actions.deleteLink(Number(index));
		}
	});

	root.addEventListener("change", (event) => {
		const target = event.target;
		if (target instanceof HTMLSelectElement) {
			const { action, index } = target.dataset;
			if (index === undefined) return;
			// The placeholder's empty value maps back to a null endpoint.
			if (action === "update-link-source") {
				actions.updateLinkSource(Number(index), target.value || null);
			} else if (action === "update-link-target") {
				actions.updateLinkTarget(Number(index), target.value || null);
			}
			return;
		}
		if (!(target instanceof HTMLInputElement)) return;
		const { action, index } = target.dataset;
		if (action !== "update-link-value" || index === undefined) return;
		// On blur, an empty or invalid field never reached state — restore the
		// input's text from the last committed value so the row stays coherent.
		const parsed = parseLinkValue(target.value);
		if (parsed.kind !== "valid") {
			target.value = String(state.links[Number(index)].value);
			target.removeAttribute("aria-invalid");
			setLinkValueError(Number(index), "");
		}
	});

	// Constrained-input interception for the 4-decimal cap: block a 5th
	// fractional digit at the keystroke (maxlength-style) and truncate an
	// over-precise paste, rather than routing them through the highlight path.
	// Every other invalid case (0, garbage, over the 1e15 cap) still falls
	// through to the `input` handler's aria-invalid marker.
	root.addEventListener("beforeinput", (event) => {
		if (!(event instanceof InputEvent)) return;
		const target = event.target;
		if (!(target instanceof HTMLInputElement)) return;
		const { action, index } = target.dataset;
		if (action !== "update-link-value" || index === undefined) return;

		// Deletions carry no data and can only shrink the fractional part —
		// never intercept them.
		if (event.data == null) return;

		const start = target.selectionStart ?? target.value.length;
		const end = target.selectionEnd ?? target.value.length;
		const prospective = target.value.slice(0, start) + event.data + target.value.slice(end);
		if (!exceedsFractionDigits(prospective)) return;

		if (event.inputType === "insertText") {
			event.preventDefault();
		} else if (event.inputType === "insertFromPaste" || event.inputType === "insertFromDrop") {
			event.preventDefault();
			const trimmed = truncateFractionDigits(prospective);
			target.value = trimmed;
			const caret = Math.min(start + event.data.length, trimmed.length);
			target.setSelectionRange(caret, caret);
			commitLinkValue(target, Number(index), actions);
		}
	});

	root.addEventListener("input", (event) => {
		if (!(event.target instanceof HTMLInputElement)) return;
		const target = event.target;
		const { action, index } = target.dataset;
		if (action !== "update-link-value" || index === undefined) return;
		commitLinkValue(target, Number(index), actions);
	});
}
