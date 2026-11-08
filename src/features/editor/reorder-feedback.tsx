export interface ReorderFeedbackProps {
	id: string;
	message: string;
	sequence: number;
}

export function ReorderFeedback({ id, message, sequence }: ReorderFeedbackProps) {
	return (
		<>
			<p id={`${id}-help`} class="reorder-instructions">
				Use Up and Down arrows to reorder.
			</p>
			<div
				id={`${id}-status`}
				class="visually-hidden"
				role="status"
				aria-live="polite"
				aria-atomic="true"
			>
				{/* Replace even repeated boundary messages so each keypress updates the live region. */}
				<span key={sequence}>{message}</span>
			</div>
		</>
	);
}
