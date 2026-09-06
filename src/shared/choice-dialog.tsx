import type { ComponentChildren } from "preact";
import { Icon } from "./icon";
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
			<header class="dialog-header">
				<h3 id={headingId}>{heading}</h3>
				<button
					type="button"
					class="dialog-close"
					aria-label="Close"
					onClick={() => handle.close()}
				>
					<Icon id="icon-close" />
				</button>
			</header>
			<div class="dialog-content">{children}</div>
		</dialog>
	);
}
