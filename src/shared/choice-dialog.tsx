import type { ComponentChildren } from "preact";
import type { DialogHandle } from "./use-dialog";

export interface ChoiceDialogProps {
	id: string;
	heading: string;
	handle: DialogHandle;
	children: ComponentChildren;
}

/**
 * The <dialog>/heading/close-button shell every settings chooser dialog
 * shares, wired to a useDialog() handle. Callers supply only their own
 * option list (typically a ChoiceGroup) as children.
 */
export function ChoiceDialog({ id, heading, handle, children }: ChoiceDialogProps) {
	const headingId = `${id}-heading`;
	return (
		<dialog id={id} ref={handle.ref} aria-labelledby={headingId}>
			<h3 id={headingId}>{heading}</h3>
			{children}
			<button type="button" class="dialog-close" data-action="close-dialog">
				Close
			</button>
		</dialog>
	);
}
