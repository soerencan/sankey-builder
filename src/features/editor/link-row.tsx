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

// "format" and "non-positive" share a message: to the user both mean "not an
// accepted positive number".
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
 * The placeholder stays selectable so an endpoint can be un-assigned again,
 * and the other endpoint's node is disabled so a self-link can't be chosen
 * in the first place. The enclosing <select>'s `value` prop drives the live
 * selection; `selected`/`disabled` are mirrored as attributes because
 * Sortable's cloneNode drag ghost copies attributes, not properties.
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
	/** Display numbering only; actions take the link's id. */
	index: number;
	nodes: readonly NodeView[];
	actions: LinkEditorActions;
}

/**
 * The value field displays a row-local draft, not `link.value`, so a
 * re-render triggered by an unrelated action never clobbers text the user is
 * still typing.
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
			actions.updateLink(link.id, { value: parsed.value });
		} else if (parsed.kind === "empty") {
			// Mid-edit blank: leave state untouched rather than writing NaN.
			setDraft({ text, invalid: false, message: "" });
		} else {
			setDraft({ text, invalid: true, message: linkValueErrorMessage(parsed.reason) });
		}
	}

	function handleInput(event: JSX.TargetedEvent<HTMLInputElement>): void {
		commitDraft(event.currentTarget.value);
	}

	// The 4-decimal cap is enforced maxlength-style, at the keystroke, instead
	// of through the aria-invalid path every other invalid input takes.
	function handleBeforeInput(event: JSX.TargetedInputEvent<HTMLInputElement>): void {
		const target = event.currentTarget;
		// Deletions carry no data and can only shrink the fractional part.
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
			// Written to the DOM directly: going through draft state would leave
			// the field showing the untruncated text until Preact's next render.
			target.value = trimmed;
			const caret = Math.min(start + event.data.length, trimmed.length);
			target.setSelectionRange(caret, caret);
			commitDraft(trimmed);
		}
	}

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
				onChange={(event) =>
					actions.updateLink(link.id, { source: event.currentTarget.value || null })
				}
			>
				{renderLinkOptions(nodes, link.source, link.target)}
			</select>
			<select
				class="link-target"
				aria-label={`Target for link ${index + 1}`}
				value={link.target ?? ""}
				onChange={(event) =>
					actions.updateLink(link.id, { target: event.currentTarget.value || null })
				}
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
				// Mirrored as an attribute so Sortable's cloneNode drag ghost is
				// not a blank field.
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
				Last in DOM order so grid auto-placement gives it a fresh implicit
				row; placed earlier it would push Delete onto its own row whenever an
				error shows. Always present so aria-describedby has a stable target.
			*/}
			<span class="field-error" id={linkValueErrorId(link.id)}>
				{draft.message}
			</span>
		</div>
	);
}
