import { useRef } from "preact/hooks";
import type { Link } from "../../model/graph";
import { Icon } from "../../shared/icon";
import { LinkRow } from "./link-row";
import type { NodeView } from "./node-editor";
import { useRowFocus } from "./use-row-focus";
import { useRowSortable } from "./use-row-sortable";

export interface LinkEditorActions {
	addLink(): void;
	deleteLink(id: string): void;
	updateLink(id: string, patch: Partial<Omit<Link, "id">>): void;
	moveLink(from: number, to: number): void;
}

export interface LinkEditorProps {
	links: readonly Readonly<Link>[];
	nodes: readonly NodeView[];
	actions: LinkEditorActions;
}

export function LinkEditor({ links, nodes, actions }: LinkEditorProps) {
	const rowsRef = useRef<HTMLDivElement>(null);
	const focus = useRowFocus(links);
	useRowSortable(rowsRef, { rowClass: "link-row", onMove: actions.moveLink });
	const rowActions: LinkEditorActions = {
		...actions,
		deleteLink: (id) => focus.deleteRow(id, () => actions.deleteLink(id)),
	};

	return (
		<>
			<h3 id="link-editor-heading">Links</h3>
			<div class="link-rows" ref={rowsRef}>
				{links.map((link, index) => (
					<LinkRow
						key={link.id}
						link={link}
						index={index}
						nodes={nodes}
						actions={rowActions}
						sourceRef={focus.fieldRef(link.id)}
					/>
				))}
			</div>
			<button
				type="button"
				class="add-link"
				ref={focus.addButtonRef}
				onClick={() => focus.addRow(actions.addLink)}
			>
				<Icon id="icon-plus" />
				Add link
			</button>
		</>
	);
}
