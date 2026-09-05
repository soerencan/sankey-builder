import { useRef } from "preact/hooks";
import type { IoNoticeActions } from "../../app/notices";
import type { NodeView } from "../../app/view";
import type { Diagram, Link, State } from "../../model/graph";
import { parseImport, serializeState } from "../files/diagram-file";
import { download } from "../files/download";
import type { LinkEditorActions } from "./link-editor";
import { LinkEditor } from "./link-editor";
import type { NodeEditorActions } from "./node-editor";
import { NodeEditor } from "./node-editor";

const EXPORT_JSON_FILENAME = "sankey.json";

export interface DataPanelActions
	extends Pick<IoNoticeActions, "clearIoNotice" | "reportImportError"> {
	importDiagram(imported: Diagram, repairs: string[]): void;
}

export interface DataPanelProps {
	doc: Document;
	win: Window;
	/** The live domain state — read directly (not a projected view) so JSON export serializes exactly what diagram-file.ts's serializeState already defines. */
	state: State;
	nodes: readonly NodeView[];
	links: readonly Readonly<Link>[];
	nodeActions: NodeEditorActions;
	linkActions: LinkEditorActions;
	actions: DataPanelActions;
	/** The owning app instance's AbortSignal — guards the async import file read; see diagram-panel.tsx's exportPng for the same pattern. */
	signal: AbortSignal;
}

/**
 * The Data-panel's header (import/JSON-export controls) plus the node and
 * link editors, all under one root. The file input is owned via ref rather
 * than a DOM id lookup, matching how DiagramPanel owns its own dialogs/refs.
 */
export function DataPanel({
	doc,
	win,
	state,
	nodes,
	links,
	nodeActions,
	linkActions,
	actions,
	signal,
}: DataPanelProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);

	function handleExport(): void {
		actions.clearIoNotice();
		const blob = new Blob([serializeState(state)], { type: "application/json" });
		download(doc, win, blob, EXPORT_JSON_FILENAME);
	}

	async function handleFileChange(): Promise<void> {
		const input = fileInputRef.current;
		if (!input) return;
		const file = input.files?.[0];
		// Reset now, before the read, so re-picking the same file still re-fires 'change'.
		input.value = "";
		if (!file) return;
		actions.clearIoNotice();

		let text: string;
		try {
			text = await file.text();
		} catch {
			// A disk/read error (permissions, the file vanished mid-pick) rejects
			// here — surface it rather than leaving an unhandled rejection.
			if (signal.aborted) return;
			actions.reportImportError("Could not read the selected file. Please try again.");
			return;
		}
		// File.text() isn't cancellable — a stale completion from a destroyed
		// app instance must do nothing user-visible. Checked again just below,
		// right before the dispatch, in case destroy() lands between this check
		// and the synchronous parse.
		if (signal.aborted) return;

		const result = parseImport(text);
		if (signal.aborted) return;
		if (result.ok) actions.importDiagram(result.diagram, result.repairs);
		else actions.reportImportError(result.error);
	}

	return (
		<>
			<header class="data-card-header">
				<h2 id="data-heading">Data</h2>
				<div
					class="data-actions"
					// biome-ignore lint/a11y/useSemanticElements: groups action buttons, not submittable form controls, so <fieldset> doesn't apply here.
					role="group"
					aria-label="Data file actions"
				>
					<button
						type="button"
						id="import-button"
						class="data-action"
						data-action="import"
						aria-label="Import data"
						title="Import data"
						onClick={() => fileInputRef.current?.click()}
					>
						<svg class="icon" aria-hidden="true" focusable="false">
							<use href="#icon-import" />
						</svg>
					</button>
					<button
						type="button"
						id="export-button"
						class="data-action"
						data-action="export"
						aria-label="Export data as JSON"
						title="Export data as JSON"
						onClick={handleExport}
					>
						<svg class="icon" aria-hidden="true" focusable="false">
							<use href="#icon-export" />
						</svg>
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
					<LinkEditor links={links} nodes={nodes} actions={linkActions} />
				</section>
			</div>
		</>
	);
}
