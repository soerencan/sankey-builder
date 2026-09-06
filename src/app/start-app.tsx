import { render } from "preact";
import type { DiagramPanelActions } from "../features/diagram/diagram-panel";
import type { DiagramRenderRequest } from "../features/diagram/render";
import type { DataPanelActions } from "../features/editor/data-panel";
import type { LinkEditorActions } from "../features/editor/link-editor";
import type { NodeEditorActions } from "../features/editor/node-editor";
import { removeActiveDragClone } from "../features/editor/row-reorder";
import { applyTheme } from "../features/settings/theme";
import type { ThemeControlActions } from "../features/settings/theme-control";
import type { State } from "../model/graph";
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

/** Looks up the one static root `startApp` renders the whole app into, throwing a message naming it if it's missing from `doc`. */
function requireRoot(doc: Document, id: string): HTMLElement {
	const el = doc.getElementById(id);
	if (!el) throw new Error(`startApp: missing required "#${id}" element in the document`);
	return el;
}

/**
 * Boots one application instance against `doc`, the one point where a test
 * can hand it a fresh document. This is the sole owner of state, the action
 * objects, and the app-scoped AbortController, so a second `startApp` call
 * after `destroy()` on the first never shares mutable state or duplicated
 * listeners with it. Calling `startApp` again without destroying the first
 * instance is not supported — both instances would bind listeners to the
 * same document.
 */
export function startApp(doc: Document = globalThis.document): AppHandle {
	// The single Preact root — resolved once, up front, so a markup regression
	// fails loudly at boot rather than silently no-op-ing on every render below.
	const appRoot = requireRoot(doc, "app");

	const controller = new AbortController();
	const { signal } = controller;
	let destroyed = false;

	const state: State = loadState(localStorage);

	// The last-valid diagram render request. Reassigned wholesale, never
	// mutated in place, so SankeyCanvas can key its redraw off reference
	// identity.
	let lastValidRequest: DiagramRenderRequest | null = null;

	// At most one Notice per kind — plain local state, not Preact state, since
	// this controller (not any component) owns every committed action and is
	// the sole source renderApp() below reads.
	const notices: Partial<Record<NoticeKind, Notice>> = {};

	applyTheme(doc, state.settings.theme);

	/**
	 * The one controller render function: projects the current domain state
	 * and notices into a fresh view snapshot and hands it to `App`. Called
	 * from exactly three places: commit(), setTheme(), and setIoNotice().
	 */
	function renderApp(): void {
		render(
			<App
				state={state}
				theme={state.settings.theme}
				nodes={projectNodes(state)}
				links={state.links}
				settings={state.settings}
				notices={Object.values(notices).filter((notice): notice is Notice => notice !== undefined)}
				lastValidRequest={lastValidRequest}
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

	/**
	 * Retires the previous I/O notice in favor of the caller's, if any, then
	 * persists the current state and derives the storage notice from the
	 * result — shared by commit() and setTheme(), the only two paths that
	 * save, and the only place either touches `notices.io`/`notices.storage`.
	 */
	function persist(io?: Notice): void {
		notices.io = io;
		const saved = saveState(localStorage, state);
		notices.storage = saved
			? undefined
			: { kind: "storage", tone: "warning", message: STORAGE_NOTICE };
	}

	/**
	 * The one path for every diagram-changing action: mutate, validate,
	 * snapshot the diagram for rendering when (and only when) it's valid,
	 * persist, set the graph/storage/io notices, and render once. `io` is the
	 * caller's own outcome notice, if any (e.g. an import's repair summary).
	 */
	function commit(mutation: (state: State) => void, io?: Notice): void {
		mutation(state);

		const result = validate(state);
		notices.graph = result.ok
			? undefined
			: { kind: "graph", tone: "error", message: result.error ?? "" };
		if (result.ok) {
			lastValidRequest = {
				state: structuredClone({
					nodes: state.nodes,
					links: state.links,
					settings: state.settings,
				}),
			};
		}

		persist(io);
		renderApp();
	}

	/** Sets the I/O notice and renders — no validation, persistence, or diagram redraw, since the canvas keys its redraw off `lastValidRequest`'s identity, which this never touches. */
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
		updateLinkSource(id, source) {
			commit((s) => updateLink(s, id, { source }));
		},
		updateLinkTarget(id, target) {
			commit((s) => updateLink(s, id, { target }));
		},
		updateLinkValue(id, value) {
			commit((s) => updateLink(s, id, { value }));
		},
		moveLink(from, to) {
			commit((s) => moveLink(s, from, to));
		},
	};

	// Shared by DataPanel (import/JSON export) and DiagramPanel (SVG/PNG
	// export) below, so every #io-notice message goes through one
	// implementation regardless of which control produced it.
	const ioNoticeActions: IoNoticeActions = {
		clearIoNotice() {
			setIoNotice(undefined);
		},
		reportIoError(message) {
			setIoNotice({ kind: "io", tone: "error", message });
		},
	};

	const dataPanelActions: DataPanelActions = {
		clearIoNotice: ioNoticeActions.clearIoNotice,
		reportIoError: ioNoticeActions.reportIoError,
		importDiagram(imported, repairs) {
			// theme is deliberately untouched — a per-browser preference, not
			// diagram data, so it survives an import. No notice when nothing
			// needed adjusting — the changed data is sufficient feedback.
			commit(
				(s) => replaceDiagram(s, imported),
				repairs.length === 0
					? undefined
					: {
							kind: "io",
							tone: "warning",
							message: `Imported ${imported.nodes.length} nodes, ${imported.links.length} links. Adjustments: ${repairs.join("; ")}.`,
						},
			);
		},
	};

	const themeControlActions: ThemeControlActions = {
		// Theme is a per-browser preference, not diagram data — unlike the other
		// settings actions, this skips validation and the diagram/editor redraw
		// entirely: apply, persist, render once.
		setTheme(value) {
			state.settings.theme = value;
			applyTheme(doc, value);
			persist();
			renderApp();
		},
	};

	const diagramPanelActions: DiagramPanelActions = {
		setPalette(value) {
			commit((s) => {
				s.settings.palette = value;
			});
		},
		setLinkColor(value) {
			commit((s) => {
				s.settings.linkColor = value;
			});
		},
		setAlignment(value) {
			commit((s) => {
				s.settings.alignment = value;
			});
		},
		setAspectRatio(value) {
			commit((s) => {
				s.settings.aspectRatio = value;
			});
		},
		clearIoNotice: ioNoticeActions.clearIoNotice,
		reportIoError: ioNoticeActions.reportIoError,
	};

	// Validates and renders the state loaded above, exactly like any other
	// committed action, so a graph a previous session left invalid shows its
	// notice immediately instead of an unvalidated diagram.
	commit(() => {});

	function destroy(): void {
		if (destroyed) return;
		destroyed = true;
		controller.abort();
		// Must run before unmounting App below: destroying one editor's Sortable
		// instance first would otherwise poison the other's own mid-drag cleanup.
		removeActiveDragClone();
		// Unmounts the whole App tree in one pass: DataPanel's own
		// use-row-sortable.ts cleanup tears down each editor's Sortable instance,
		// DiagramPanel/ThemeControl's useDialog() hooks tear down their own
		// listeners, SankeyCanvas's layout-effect cleanup clears the SVG, and
		// PreviewResizer's layout-effect cleanup cancels any in-progress drag and
		// releases pointer capture — all as ordinary Preact unmount cleanup, not
		// via the AbortSignal above.
		render(null, appRoot);
	}

	return { destroy };
}
