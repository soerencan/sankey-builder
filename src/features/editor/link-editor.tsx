import { useRef } from "preact/hooks";
import type { LinkView, NodeView } from "../../app/view";
import { LinkRow } from "./link-row";
import { useRowSortable } from "./use-row-sortable";

export interface LinkEditorActions {
	addLink(): void;
	deleteLink(index: number): void;
	updateLinkSource(index: number, id: string | null): void;
	updateLinkTarget(index: number, id: string | null): void;
	updateLinkValue(index: number, value: number): void;
	moveLink(from: number, to: number): void;
}

export interface LinkEditorProps {
	links: readonly LinkView[];
	nodes: readonly NodeView[];
	actions: LinkEditorActions;
}

/**
 * Rows are keyed by the view projector's per-Link weak key, not array index,
 * so a value/endpoint edit or a reorder patches the existing DOM in
 * place — preserving an in-progress draft, focus, and the Sortable-owned
 * rows container — while an import's fresh Link objects get fresh keys and
 * so correctly reset every row.
 */
export function LinkEditor({ links, nodes, actions }: LinkEditorProps) {
	const rowsRef = useRef<HTMLDivElement>(null);
	useRowSortable(rowsRef, { rowClass: "link-row", onMove: actions.moveLink });

	return (
		<>
			<h3 id="link-editor-heading">Links</h3>
			<div class="link-rows" ref={rowsRef}>
				{links.map((link) => (
					<LinkRow key={link.key} link={link} nodes={nodes} actions={actions} />
				))}
			</div>
			<button
				type="button"
				class="add-link"
				data-action="add-link"
				onClick={() => actions.addLink()}
			>
				Add link
			</button>
		</>
	);
}
