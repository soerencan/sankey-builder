import { useRef } from "preact/hooks";
import { Icon } from "../../shared/icon";
import { useRowFocus } from "./use-row-focus";
import { useRowSortable } from "./use-row-sortable";

export interface NodeView {
	readonly id: string;
	readonly name: string;
	readonly swatchColor: string;
}

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

export function NodeEditor({ nodes, actions }: NodeEditorProps) {
	const rowsRef = useRef<HTMLDivElement>(null);
	const focus = useRowFocus(nodes, true);
	useRowSortable(rowsRef, { rowClass: "node-row", onMove: actions.moveNode });

	return (
		<>
			<h3 id="node-editor-heading">Nodes</h3>
			<div class="node-rows" ref={rowsRef}>
				{nodes.map((node) => (
					<div class="node-row" key={node.id}>
						<button type="button" class="drag-handle" aria-label={`Reorder ${node.name}`}>
							<Icon id="icon-grip-vertical" />
						</button>
						<span class="node-swatch" style={{ backgroundColor: node.swatchColor }} />
						<input
							type="text"
							class="node-name"
							aria-label={`Name for ${node.name}`}
							value={node.name}
							// Mirrored as an attribute so Sortable's cloneNode drag ghost is
							// not a blank field.
							ref={(el) => {
								focus.fieldRef(node.id)(el);
								el?.setAttribute("value", node.name);
							}}
							onInput={(event) => actions.renameNode(node.id, event.currentTarget.value)}
						/>
						<button
							type="button"
							class="icon-button node-delete"
							aria-label={`Delete ${node.name}`}
							title={`Delete ${node.name}`}
							onClick={() => focus.deleteRow(node.id, () => actions.deleteNode(node.id))}
						>
							<Icon id="icon-delete" />
						</button>
					</div>
				))}
			</div>
			<button
				type="button"
				class="add-node"
				ref={focus.addButtonRef}
				onClick={() => focus.addRow(actions.addNode)}
			>
				<Icon id="icon-plus" />
				Add node
			</button>
		</>
	);
}
