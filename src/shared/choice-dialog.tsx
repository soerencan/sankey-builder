import type { ComponentChildren } from "preact";
import type { DialogHandle } from "./use-dialog";

export interface ChoiceDialogProps {
	id: string;
	heading: string;
	handle: DialogHandle;
	children: ComponentChildren;
}

export function ChoiceDialog({ id, heading, handle, children }: ChoiceDialogProps) {
	const headingId = `${id}-heading`;
	return (
		<dialog id={id} ref={handle.ref} aria-labelledby={headingId}>
			<h3 id={headingId}>{heading}</h3>
			{children}
			<button type="button" class="dialog-close" onClick={() => handle.close()}>
				Close
			</button>
		</dialog>
	);
}
