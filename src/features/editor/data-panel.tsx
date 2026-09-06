import type { JSX } from "preact";
import { useRef } from "preact/hooks";
import type { Diagram, State } from "../../model/graph";
import { Icon } from "../../shared/icon";
import type { IoNoticeActions } from "../../shared/notice";
import { parseImport, serializeState } from "../files/diagram-file";
import { download } from "../files/download";
import type { LinkEditorActions } from "./link-editor";
import { LinkEditor } from "./link-editor";
import type { NodeEditorActions, NodeView } from "./node-editor";
import { NodeEditor } from "./node-editor";

const EXPORT_JSON_FILENAME = "sankey.json";

export interface DataPanelActions extends IoNoticeActions {
	importDiagram(imported: Diagram, repairs: string[]): void;
}

export interface DataPanelProps {
	/** The live state, not a projected view: JSON export must serialize exactly what serializeState defines. */
	state: State;
	nodes: readonly NodeView[];
	nodeActions: NodeEditorActions;
	linkActions: LinkEditorActions;
	actions: DataPanelActions;
	signal: AbortSignal;
}

export function DataPanel({
	state,
	nodes,
	nodeActions,
	linkActions,
	actions,
	signal,
}: DataPanelProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);

	function handleExport(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void {
		actions.clearIoNotice();
		const blob = new Blob([serializeState(state)], { type: "application/json" });
		download(event.currentTarget.ownerDocument, blob, EXPORT_JSON_FILENAME);
	}

	async function handleFileChange(): Promise<void> {
		const input = fileInputRef.current;
		if (!input) return;
		const file = input.files?.[0];
		// Reset before the read so re-picking the same file still fires 'change'.
		input.value = "";
		if (!file) return;
		actions.clearIoNotice();

		let text: string;
		try {
			text = await file.text();
		} catch {
			if (signal.aborted) return;
			actions.reportIoError("Could not read the selected file. Please try again.");
			return;
		}
		// File.text() isn't cancellable, so a read that completes after
		// destroy() must do nothing user-visible.
		if (signal.aborted) return;

		const result = parseImport(text);
		if (result.ok) actions.importDiagram(result.diagram, result.repairs);
		else actions.reportIoError(result.error);
	}

	return (
		<>
			<header class="data-card-header">
				<h2 id="data-heading">Data</h2>
				<div
					class="data-card-actions"
					// biome-ignore lint/a11y/useSemanticElements: groups action buttons, not submittable form controls, so <fieldset> doesn't apply here.
					role="group"
					aria-label="Data file actions"
				>
					<button
						type="button"
						class="data-card-action"
						aria-label="Import data"
						title="Import data"
						onClick={() => fileInputRef.current?.click()}
					>
						<Icon id="icon-import" />
					</button>
					<button
						type="button"
						id="export-button"
						class="data-card-action"
						aria-label="Export data as JSON"
						title="Export data as JSON"
						onClick={handleExport}
					>
						<Icon id="icon-export" />
					</button>
					<input
						type="file"
						id="import-file"
						accept=".json,application/json"
						hidden
						ref={fileInputRef}
						onChange={handleFileChange}
					/>
				</div>
			</header>

			<div class="data-sections">
				<section id="node-editor" class="data-section" aria-labelledby="node-editor-heading">
					<NodeEditor nodes={nodes} actions={nodeActions} />
				</section>

				<section id="link-editor" class="data-section" aria-labelledby="link-editor-heading">
					<LinkEditor links={state.links} nodes={nodes} actions={linkActions} />
				</section>
			</div>
		</>
	);
}
