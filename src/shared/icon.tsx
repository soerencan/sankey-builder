/** The only place the `<svg><use/></svg>` icon snippet is written. */
export function Icon({ id }: { id: string }) {
	return (
		<svg class="icon" aria-hidden="true" focusable="false">
			<use href={`#${id}`} />
		</svg>
	);
}
