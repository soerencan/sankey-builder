import type { Link, Node, State } from "./state";
import { exceedsFractionDigits, parseLinkValue, truncateFractionDigits } from "./validate";

export interface LinkEditorActions {
	addLink(): void;
	deleteLink(index: number): void;
	updateLinkSource(index: number, id: string): void;
	updateLinkTarget(index: number, id: string): void;
	updateLinkValue(index: number, value: number): void;
}

/**
 * Populates a source/target <select> with all nodes, disabling the one
 * chosen in the other select of the same row — makes a self-link
 * impossible to select rather than merely rejecting it after the fact.
 */
function renderLinkOptions(
	selectEl: HTMLSelectElement,
	nodes: Node[],
	selectedId: string,
	excludedId: string,
): void {
	d3.select(selectEl)
		.selectAll("option")
		.data(nodes)
		.join("option")
		.attr("value", (n) => n.id)
		.property("disabled", (n) => n.id === excludedId)
		.property("selected", (n) => n.id === selectedId)
		.text((n) => n.name);
}

/** Rebuilds #link-editor from state — same full-rebuild approach as the node editor. */
export function renderLinkEditor(state: State): void {
	const root = d3.select("#link-editor");
	root.html("");
	root.append("h2").attr("id", "link-editor-heading").text("Links");

	const row = root
		.append("div")
		.attr("class", "link-rows")
		.selectAll<HTMLDivElement, Link>(".link-row")
		.data(state.links)
		.join("div")
		.attr("class", "link-row");

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
		.property("value", (d) => d.value);

	row
		.append("button")
		.attr("type", "button")
		.attr("class", "link-delete")
		.attr("data-action", "delete-link")
		.attr("data-index", (_d, i) => i)
		.attr("aria-label", (_d, i) => `Delete link ${i + 1}`)
		.text("Delete");

	root
		.append("button")
		.attr("type", "button")
		.attr("class", "add-link")
		.attr("data-action", "add-link")
		// A link needs two distinct nodes to default into.
		.property("disabled", state.nodes.length < 2)
		.text("Add link");
}

/**
 * Parse the current field text and reconcile state + the invalid marker.
 * Shared by the `input` handler and the paste branch of `beforeinput`, which
 * rewrites `value` programmatically (no native `input` event follows).
 */
function commitLinkValue(
	target: HTMLInputElement,
	index: number,
	actions: LinkEditorActions,
): void {
	const parsed = parseLinkValue(target.value);
	if (parsed.kind === "valid") {
		target.removeAttribute("aria-invalid");
		actions.updateLinkValue(index, parsed.value);
	} else if (parsed.kind === "empty") {
		// Mid-edit blank — leave state untouched rather than writing NaN.
		target.removeAttribute("aria-invalid");
	} else {
		target.setAttribute("aria-invalid", "true");
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
			if (action === "update-link-source") {
				actions.updateLinkSource(Number(index), target.value);
			} else if (action === "update-link-target") {
				actions.updateLinkTarget(Number(index), target.value);
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
