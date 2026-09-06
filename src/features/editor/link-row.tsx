import type { JSX } from "preact";
import { useState } from "preact/hooks";
import type { NodeView } from "../../app/view";
import type { Link } from "../../model/graph";
import { MAX_LINK_VALUE } from "../../model/validation";
import type { LinkEditorActions } from "./link-editor";
import {
	type LinkValueInvalidReason,
	exceedsFractionDigits,
	parseLinkValue,
	truncateFractionDigits,
} from "./link-value";

function linkValueErrorId(id: string): string {
	return `link-value-error-${id}`;
}

/**
 * Message for the "invalid" parseLinkValue branch, keyed on its `reason`
 * rather than re-deriving it here — parseLinkValue owns the precedence
 * (format, then precision, then non-positive, then above-maximum), so this
 * is a pure lookup. "format" and "non-positive" share a message: from the
 * user's perspective both mean "that's not an accepted positive number".
 */
function linkValueErrorMessage(reason: LinkValueInvalidReason): string {
	switch (reason) {
		case "precision":
			return "Enter a number with up to 4 decimal places.";
		case "above-maximum":
			return `Enter a number no greater than ${MAX_LINK_VALUE}.`;
		case "format":
		case "non-positive":
			return "Enter a plain number greater than 0.";
	}
}

/**
 * Populates a source/target <select> with a "— select —" placeholder (empty
 * value) followed by all nodes. The placeholder is selected while the
 * endpoint is null and stays selectable afterward, so an endpoint can be
 * un-assigned again — consistent with incomplete links being harmless. The
 * node matching the other select of the same row is disabled, making a
 * self-link impossible to choose rather than merely rejecting it after the
 * fact.
 *
 * The enclosing <select>'s `value` prop (set by the caller) drives the real,
 * live selection — Preact assigns it as a DOM property, which works
 * regardless of the select's "dirty" flag. `selected`/`disabled` are
 * additionally mirrored onto each <option> as real attributes here, purely
 * for Sortable's cloneNode drag ghost (which copies attributes, not live
 * properties) and for tests that read them back with getAttribute.
 */
function renderLinkOptions(
	nodes: readonly NodeView[],
	selectedId: string | null,
	excludedId: string | null,
) {
	return (
		<>
			<option
				value=""
				ref={(el) => {
					el?.toggleAttribute("selected", selectedId === null);
				}}
			>
				— select —
			</option>
			{nodes.map((node) => (
				<option
					key={node.id}
					class="node-option"
					value={node.id}
					ref={(el) => {
						el?.toggleAttribute("disabled", node.id === excludedId);
						el?.toggleAttribute("selected", node.id === selectedId);
					}}
				>
					{node.name}
				</option>
			))}
		</>
	);
}

interface LinkValueDraft {
	readonly text: string;
	readonly invalid: boolean;
	readonly message: string;
}

export interface LinkRowProps {
	link: Readonly<Link>;
	/** The row's current position — display numbering only; actions below take the link's id. */
	index: number;
	nodes: readonly NodeView[];
	actions: LinkEditorActions;
}

/**
 * Owns the link-value field's in-progress draft as row-local state: an
 * invalid or empty keystroke never reaches `actions.updateLinkValue`, and
 * this draft — not the committed `link.value` prop — is what the field
 * displays, so a controller re-render triggered by an unrelated action never
 * clobbers text the user is still typing. Keyed by `link.id`, drawn from a
 * monotonic per-instance sequence, rather than array index, so the draft
 * follows its link across a reorder and resets only when this is genuinely a
 * different Link object (e.g. import).
 */
export function LinkRow({ link, index, nodes, actions }: LinkRowProps) {
	const [draft, setDraft] = useState<LinkValueDraft>(() => ({
		text: String(link.value),
		invalid: false,
		message: "",
	}));

	function commitDraft(text: string): void {
		const parsed = parseLinkValue(text);
		if (parsed.kind === "valid") {
			setDraft({ text, invalid: false, message: "" });
			actions.updateLinkValue(link.id, parsed.value);
		} else if (parsed.kind === "empty") {
			// Mid-edit blank — leave state untouched rather than writing NaN.
			setDraft({ text, invalid: false, message: "" });
		} else {
			setDraft({ text, invalid: true, message: linkValueErrorMessage(parsed.reason) });
		}
	}

	function handleInput(event: JSX.TargetedEvent<HTMLInputElement>): void {
		commitDraft(event.currentTarget.value);
	}

	// Constrained-input interception for the 4-decimal cap: blocks a 5th
	// fractional digit at the keystroke (maxlength-style) and truncates an
	// over-precise paste/drop, rather than routing them through the highlight
	// path. Every other invalid case (0, garbage, over the 1e15 cap) still
	// falls through to handleInput's aria-invalid marker.
	function handleBeforeInput(event: JSX.TargetedInputEvent<HTMLInputElement>): void {
		const target = event.currentTarget;
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
			// The browser's own insertion was just prevented, so this handler
			// must apply the replacement itself, synchronously — deferring it to
			// the row's draft state (like commitDraft's other effects, which
			// flush through Preact's async render) would leave the field showing
			// the untruncated text until the next render.
			target.value = trimmed;
			const caret = Math.min(start + event.data.length, trimmed.length);
			target.setSelectionRange(caret, caret);
			commitDraft(trimmed);
		}
	}

	// Native "change" (fires on blur/commit, not per keystroke). Restoration
	// is draft state, like every other path here — the field's `value` prop
	// (below) is what actually rewrites the DOM, on the next render.
	function handleChange(event: JSX.TargetedEvent<HTMLInputElement>): void {
		const parsed = parseLinkValue(event.currentTarget.value);
		if (parsed.kind === "valid") return;
		setDraft({ text: String(link.value), invalid: false, message: "" });
	}

	return (
		<div class="link-row">
			<button type="button" class="drag-handle" aria-label={`Reorder link ${index + 1}`}>
				⠿
			</button>
			<select
				class="link-source"
				aria-label={`Source for link ${index + 1}`}
				value={link.source ?? ""}
				onChange={(event) => actions.updateLinkSource(link.id, event.currentTarget.value || null)}
			>
				{renderLinkOptions(nodes, link.source, link.target)}
			</select>
			<select
				class="link-target"
				aria-label={`Target for link ${index + 1}`}
				value={link.target ?? ""}
				onChange={(event) => actions.updateLinkTarget(link.id, event.currentTarget.value || null)}
			>
				{renderLinkOptions(nodes, link.target, link.source)}
			</select>
			<input
				type="text"
				inputmode="decimal"
				class="link-value"
				aria-label={`Value for link ${index + 1}`}
				aria-describedby={linkValueErrorId(link.id)}
				aria-invalid={draft.invalid ? "true" : undefined}
				value={draft.text}
				// Sortable builds its drag ghost with cloneNode, which copies
				// attributes but not the live value property; mirror it so the
				// ghost is not a blank field mid-drag.
				ref={(el) => el?.setAttribute("value", draft.text)}
				onInput={handleInput}
				onBeforeInput={handleBeforeInput}
				onChange={handleChange}
			/>
			<button
				type="button"
				class="link-delete"
				aria-label={`Delete link ${index + 1}`}
				onClick={() => actions.deleteLink(link.id)}
			>
				Delete
			</button>
			{/*
				Last in DOM order (after all 5 row-1 cells) so it lands in a fresh
				implicit row under sparse auto-placement — earlier placement leaves
				row 1 short a cell, pushing Delete onto its own row 3 the moment an
				error shows. Always present (empty when valid) so aria-describedby
				has a stable target; empty is visually hidden via CSS (:empty).
			*/}
			<span class="field-error" id={linkValueErrorId(link.id)}>
				{draft.message}
			</span>
		</div>
	);
}
