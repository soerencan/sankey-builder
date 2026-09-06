import { render } from "preact";
import type { DiagramPanelActions } from "../features/diagram/diagram-panel";
import type { DataPanelActions } from "../features/editor/data-panel";
import type { LinkEditorActions } from "../features/editor/link-editor";
import type { NodeEditorActions } from "../features/editor/node-editor";
import { removeActiveDragClone } from "../features/editor/row-reorder";
import { applyTheme } from "../features/settings/theme";
import type { ThemeControlActions } from "../features/settings/theme-control";
import type { Diagram, State } from "../model/graph";
import {
	addLink,
	addNode,
	deleteLink,
	deleteNode,
	moveLink,
	moveNode,
	renameNode,
	replaceDiagram,
	updateLink,
} from "../model/graph";
import { pickDiagramSettings } from "../model/settings";
import { validate } from "../model/validation";
import { loadState, saveState } from "../platform/storage";
import type { IoNoticeActions, Notice, NoticeKind } from "../shared/notice";
import { App } from "./app";
import { projectNodes } from "./view";

export interface AppHandle {
	/** Idempotent — safe to call more than once. */
	destroy(): void;
}

const STORAGE_NOTICE =
	"Changes can't be saved in this browser right now (storage may be full or unavailable). " +
	"The diagram keeps working, but edits won't survive closing or reloading this tab — " +
	"try freeing up space or leaving private/incognito mode.";

function requireRoot(doc: Document, id: string): HTMLElement {
	const el = doc.getElementById(id);
	if (!el) throw new Error(`startApp: missing required "#${id}" element in the document`);
	return el;
}

/**
 * Everything mutable (state, actions, the AbortController) lives in this
 * closure so a second `startApp` after `destroy()` shares nothing with the
 * first. Two live instances on one document are not supported: both would
 * bind listeners to it.
 */
export function startApp(doc: Document = globalThis.document): AppHandle {
	// Resolved up front so a markup regression fails at boot instead of
	// silently no-op-ing on every render.
	const appRoot = requireRoot(doc, "app");

	const controller = new AbortController();
	const { signal } = controller;
	let destroyed = false;

	const state: State = loadState(localStorage);

	// Reassigned wholesale, never mutated in place, because SankeySvg
	// memoizes on reference identity; a new reference per valid commit is the
	// whole contract.
	let lastValidDiagram: Diagram | null = null;

	// At most one notice per kind. Plain local state rather than Preact state
	// because this controller, not a component, owns every action.
	const notices: Partial<Record<NoticeKind, Notice>> = {};

	applyTheme(doc, state.settings.theme);

	function renderApp(): void {
		render(
			<App
				state={state}
				nodes={projectNodes(state)}
				notices={notices}
				dismissIoNotice={ioNoticeActions.clearIoNotice}
				lastValidDiagram={lastValidDiagram}
				themeActions={themeControlActions}
				diagramActions={diagramPanelActions}
				nodeActions={nodeEditorActions}
				linkActions={linkEditorActions}
				dataActions={dataPanelActions}
				signal={signal}
			/>,
			appRoot,
		);
	}

	function persist(): void {
		const saved = saveState(localStorage, state);
		notices.storage = saved ? undefined : { tone: "warning", message: STORAGE_NOTICE };
	}

	/**
	 * The one path for every diagram-changing action. `io` is the caller's own
	 * outcome notice, e.g. an import's repair summary; any previous one is
	 * retired here because it described the diagram this change replaces.
	 */
	function commit(mutation: (state: State) => void, io?: Notice): void {
		mutation(state);
		notices.io = io;

		const result = validate(state);
		notices.graph = result.ok ? undefined : { tone: "error", message: result.error };
		if (result.ok) {
			lastValidDiagram = structuredClone({
				nodes: state.nodes,
				links: state.links,
				settings: pickDiagramSettings(state.settings),
			});
		}

		persist();
		renderApp();
	}

	/** Bypasses commit(): a notice change must neither persist nor redraw the diagram. */
	function setIoNotice(notice: Notice | undefined): void {
		notices.io = notice;
		renderApp();
	}

	const nodeEditorActions: NodeEditorActions = {
		addNode() {
			commit((s) => addNode(s));
		},
		deleteNode(id) {
			commit((s) => deleteNode(s, id));
		},
		renameNode(id, name) {
			commit((s) => renameNode(s, id, name));
		},
		moveNode(from, to) {
			commit((s) => moveNode(s, from, to));
		},
	};

	const linkEditorActions: LinkEditorActions = {
		addLink() {
			commit((s) => addLink(s));
		},
		deleteLink(id) {
			commit((s) => deleteLink(s, id));
		},
		updateLink(id, patch) {
			commit((s) => updateLink(s, id, patch));
		},
		moveLink(from, to) {
			commit((s) => moveLink(s, from, to));
		},
	};

	const ioNoticeActions: IoNoticeActions = {
		clearIoNotice() {
			setIoNotice(undefined);
		},
		reportIoError(message) {
			setIoNotice({ tone: "error", message });
		},
	};

	const dataPanelActions: DataPanelActions = {
		...ioNoticeActions,
		importDiagram(imported, repairs) {
			commit(
				(s) => replaceDiagram(s, imported),
				repairs.length === 0
					? undefined
					: {
							tone: "warning",
							message: `Imported ${imported.nodes.length} nodes, ${imported.links.length} links. Adjustments: ${repairs.join("; ")}.`,
						},
			);
		},
	};

	const themeControlActions: ThemeControlActions = {
		// Not routed through commit(): the theme is a per-browser preference,
		// not diagram data, so it needs no validation and must not retire an
		// I/O notice that is still about the current diagram.
		setTheme(value) {
			state.settings.theme = value;
			applyTheme(doc, value);
			persist();
			renderApp();
		},
	};

	const diagramPanelActions: DiagramPanelActions = {
		setDiagramSetting(key, value) {
			commit((s) => {
				s.settings[key] = value;
			});
		},
		...ioNoticeActions,
	};

	// A graph a previous session left invalid must show its notice at boot.
	commit(() => {});

	function destroy(): void {
		if (destroyed) return;
		destroyed = true;
		controller.abort();
		// Must run before unmounting: destroying one editor's Sortable instance
		// first would poison the other's mid-drag cleanup.
		removeActiveDragClone();
		render(null, appRoot);
	}

	return { destroy };
}
