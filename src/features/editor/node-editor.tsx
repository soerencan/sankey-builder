import { useRef } from "preact/hooks";
import type { NodeView } from "../../app/view";
import { useRowSortable } from "./use-row-sortable";

export interface NodeEditorActions {
	addNode(): void;
	deleteNode(id: string): void;
	renameNode(id: string, name: string): void;
	moveNode(from: number, to: number): void;
}

export interface NodeEditorProps {
	nodes: readonly NodeView[];
	actions: NodeEditorActions;
}

/**
 * Rows are keyed by node id, so a rename/palette-driven re-render patches the
 * existing DOM in place (preserving focus/caret and the Sortable-owned rows
 * container) instead of rebuilding — see use-row-sortable.ts for the
 * container's Sortable/keyboard-reorder ownership.
 */
export function NodeEditor({ nodes, actions }: NodeEditorProps) {
	const rowsRef = useRef<HTMLDivElement>(null);
	useRowSortable(rowsRef, { rowClass: "node-row", onMove: actions.moveNode });

	return (
		<>
			<h3 id="node-editor-heading">Nodes</h3>
			<div class="node-rows" ref={rowsRef}>
				{nodes.map((node) => (
					<div class="node-row" key={node.id}>
						<button type="button" class="drag-handle" aria-label={`Reorder ${node.name}`}>
							⠿
						</button>
						<span class="node-swatch" style={{ backgroundColor: node.swatchColor }} />
						<input
							type="text"
							class="node-name"
							aria-label={`Name for ${node.name}`}
							value={node.name}
							// Preact sets `value` as a DOM property, not an attribute, but
							// Sortable's drag ghost is built via cloneNode, which copies
							// attributes only — mirror it explicitly so the ghost doesn't
							// degrade to a blank field mid-drag.
							ref={(el) => el?.setAttribute("value", node.name)}
							onInput={(event) => actions.renameNode(node.id, event.currentTarget.value)}
						/>
						<button
							type="button"
							class="node-delete"
							aria-label={`Delete ${node.name}`}
							onClick={() => actions.deleteNode(node.id)}
						>
							Delete
						</button>
					</div>
				))}
			</div>
			<button type="button" class="add-node" onClick={() => actions.addNode()}>
				Add node
			</button>
		</>
	);
}
