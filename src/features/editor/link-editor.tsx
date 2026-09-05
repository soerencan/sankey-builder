import { useRef } from "preact/hooks";
import type { NodeView } from "../../app/view";
import type { Link } from "../../model/graph";
import { LinkRow } from "./link-row";
import { useRowSortable } from "./use-row-sortable";

export interface LinkEditorActions {
	addLink(): void;
	deleteLink(id: string): void;
	updateLinkSource(id: string, source: string | null): void;
	updateLinkTarget(id: string, target: string | null): void;
	updateLinkValue(id: string, value: number): void;
	moveLink(from: number, to: number): void;
}

export interface LinkEditorProps {
	links: readonly Readonly<Link>[];
	nodes: readonly NodeView[];
	actions: LinkEditorActions;
}

/**
 * Rows are keyed by link id, so a value/endpoint edit or a reorder patches
 * the existing DOM in place — preserving an in-progress draft, focus, and
 * the Sortable-owned rows container — while an import's or storage load's
 * fresh Link objects get fresh ids, drawn from a monotonic per-instance
 * sequence, and so correctly reset every row.
 */
export function LinkEditor({ links, nodes, actions }: LinkEditorProps) {
	const rowsRef = useRef<HTMLDivElement>(null);
	useRowSortable(rowsRef, { rowClass: "link-row", onMove: actions.moveLink });

	return (
		<>
			<h3 id="link-editor-heading">Links</h3>
			<div class="link-rows" ref={rowsRef}>
				{links.map((link, index) => (
					<LinkRow key={link.id} link={link} index={index} nodes={nodes} actions={actions} />
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
