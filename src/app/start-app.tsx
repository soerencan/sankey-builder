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
import { App } from "./app";
import type { IoNoticeActions, Notice } from "./notices";
import { createLinkProjector, projectNodes, projectSettings } from "./view";

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
 * Boots one application instance against `doc`. Every setup module below is
 * markup-agnostic and reads no ambient `window`/`document`/`localStorage`
 * itself — this is the sole owner of state, the action objects, and the
 * app-scoped AbortController, so a second `startApp` call after `destroy()`
 * on the first never shares mutable state or duplicated listeners with it.
 * Calling `startApp` again without destroying the first instance is not
 * supported — both instances would bind listeners to the same document.
 */
export function startApp(doc: Document = globalThis.document): AppHandle {
	const view = doc.defaultView;
	if (!view) throw new Error("startApp: document has no defaultView/window to bind to");
	// Re-bound to a non-nullable type (rather than relying on narrowing of
	// `view`) so closures below — renderApp() and the action objects — don't
	// need their own null checks.
	const win: Window = view;

	// The single Preact root — resolved once, up front, so a markup regression
	// fails loudly at boot rather than silently no-op-ing on every render below.
	const appRoot = requireRoot(doc, "app");

	// win.AbortController, not the bare global: `doc` may belong to a window
	// other than this module's own ambient one (e.g. a second startApp()
	// instance mounted into another window). The `?? globalThis.AbortController`
	// fallback only matters for a window lacking its own constructor — not a
	// case any real browser hits, but cheap insurance.
	const controller = new (win.AbortController ?? globalThis.AbortController)();
	const { signal } = controller;
	let destroyed = false;

	const state: State = loadState(win.localStorage);
	// One projector per application instance (not module-level state), so two
	// concurrent instances (e.g. the cross-realm tests) never share link view
	// keys — see createLinkProjector's own doc comment.
	const projectLinks = createLinkProjector();

	// The last-valid diagram render request. Reassigned wholesale, never
	// mutated in place, so SankeyCanvas can key its redraw off reference
	// identity — see its own doc comment.
	let lastValidRequest: DiagramRenderRequest | null = null;

	// At most one Notice per kind — plain local state, not Preact state, since
	// this controller (not any component) owns every committed action and is
	// the sole source renderApp() below reads.
	let graphNotice: Notice | null = null;
	let storageNotice: Notice | null = null;
	let ioNotice: Notice | null = null;

	applyTheme(doc, state.settings.theme);

	/**
	 * The one controller render function: projects the current domain state
	 * and notices into a fresh view snapshot and hands it to `App`. Every
	 * action path below calls this exactly once, at its own end — after every
	 * mutation and notice-state assignment (showGraphNotice/showStorageNotice/
	 * showIoNotice, which only assign) it cares about have already landed, so
	 * `App` never sees an intermediate mix of a stale `lastValidRequest` with
	 * already-updated notices or vice versa.
	 */
	function renderApp(): void {
		render(
			<App
				doc={doc}
				win={win}
				state={state}
				theme={state.settings.theme}
				nodes={projectNodes(state)}
				links={projectLinks(state)}
				settings={projectSettings(state)}
				notices={[graphNotice, storageNotice, ioNotice].filter(
					(notice): notice is Notice => notice !== null,
				)}
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

	// Assign only — no render. Every caller below is responsible for calling
	// renderApp() itself, exactly once, after it's done assigning/mutating
	// (see renderApp's own doc comment for why).
	function showGraphNotice(notice: Notice | null): void {
		graphNotice = notice;
	}
	function showStorageNotice(notice: Notice | null): void {
		storageNotice = notice;
	}
	function showIoNotice(notice: Notice | null): void {
		ioNotice = notice;
	}

	/**
	 * The save/notice portion of refresh() below, factored out so the
	 * theme-change path can reuse it without also validating or redrawing.
	 * Order matters and is preserved exactly (see refresh()'s own doc comment
	 * for the surrounding rationale):
	 *
	 * 1. Clear any I/O notice (import or export): it's a one-shot result of the
	 *    last action, so the next committed action retires it. importDiagram()
	 *    installs its repair warning AFTER its own refresh() call, so that
	 *    warning survives this clear and only retires on the following action.
	 * 2. Save — regardless of validity: an invalid *topology* the user is still
	 *    editing (e.g. a cycle) is retained in the editor and must survive a
	 *    reload; there is no "last-good state" in storage, only the last-good
	 *    *diagram*, which stays on screen without needing its own storage.
	 * 3. Update the storage notice from the save result — storage may recover
	 *    (e.g. quota freed up elsewhere), so a previously shown notice clears
	 *    rather than staying stuck once saves work again.
	 *
	 * Assigns notice state only; every caller renders once itself afterward.
	 */
	function persistAndClearNotices(): void {
		showIoNotice(null);
		const saved = saveState(win.localStorage, state);
		showStorageNotice(saved ? null : { kind: "storage", tone: "warning", message: STORAGE_NOTICE });
	}

	/**
	 * The validate-then-persist flow — the subtlest sequencing in the app.
	 * Order matters and is preserved exactly:
	 *
	 * 1. Validate. Only on a valid graph does `lastValidRequest` get replaced
	 *    with a fresh deep snapshot (state.nodes/links/settings are still the
	 *    live, mutable objects — cloning here, not on every access, is what
	 *    lets SankeyCanvas treat the request as a stable historical value). An
	 *    invalid graph leaves the previous request's reference untouched, which
	 *    is what keeps a diagram-setting change made mid-invalid-edit from
	 *    disturbing the visible SVG (see DiagramRenderRequest's own comment).
	 * 2. Persist + update notices regardless of validity — see
	 *    persistAndClearNotices's own doc comment for why.
	 * 3. Render exactly once, after every assignment above has landed, so
	 *    `App` never sees a stale `lastValidRequest` paired with
	 *    already-updated notices (see renderApp's own doc comment). Editors/
	 *    DiagramPanel/SankeyCanvas all re-render as part of that one App
	 *    render regardless of validity: the editors' rows are keyed (node id;
	 *    the link projector's weak key), so Preact patches
	 *    names/swatches/values/order in place — preserving focus, an
	 *    in-progress link-value draft, and each row-sortable hook's Sortable
	 *    instance — instead of rebuilding. SankeyCanvas only reruns D3 when
	 *    `lastValidRequest`'s identity actually changed (its own layout
	 *    effect is keyed on it), so an unchanged reference on an invalid
	 *    graph is a no-op redraw.
	 */
	function refresh(): void {
		const result = validate(state);
		showGraphNotice(
			result.ok ? null : { kind: "graph", tone: "error", message: result.error ?? "" },
		);
		if (result.ok) {
			lastValidRequest = {
				state: structuredClone({
					nodes: state.nodes,
					links: state.links,
					settings: state.settings,
				}),
			};
		}

		persistAndClearNotices();
		renderApp();
	}

	const nodeEditorActions: NodeEditorActions = {
		addNode() {
			addNode(state);
			refresh();
		},
		deleteNode(id) {
			deleteNode(state, id);
			refresh();
		},
		renameNode(id, name) {
			renameNode(state, id, name);
			// The link editor's node-option labels come from the same projected
			// `nodes` refresh() now passes it, so a plain refresh() keeps them
			// current without a separate patch path.
			refresh();
		},
		moveNode(from, to) {
			moveNode(state, from, to);
			refresh();
		},
	};

	const linkEditorActions: LinkEditorActions = {
		addLink() {
			addLink(state);
			refresh();
		},
		deleteLink(index) {
			deleteLink(state, index);
			refresh();
		},
		updateLinkSource(index, id) {
			updateLink(state, index, { source: id });
			refresh();
		},
		updateLinkTarget(index, id) {
			updateLink(state, index, { target: id });
			refresh();
		},
		updateLinkValue(index, value) {
			updateLink(state, index, { value });
			refresh();
		},
		moveLink(from, to) {
			moveLink(state, from, to);
			refresh();
		},
	};

	// Shared by DataPanel (import/JSON export) and DiagramPanel (SVG/PNG
	// export) below, so every #io-notice message goes through one
	// implementation regardless of which control produced it; each panel's
	// own actions object below picks only the members its own controls call
	// (see IoNoticeActions's own doc comment).
	const ioNoticeActions: IoNoticeActions = {
		clearIoNotice() {
			showIoNotice(null);
			renderApp();
		},
		reportImportError(message) {
			showIoNotice({ kind: "io", tone: "error", message });
			renderApp();
		},
		reportExportError(message) {
			showIoNotice({ kind: "io", tone: "error", message });
			renderApp();
		},
	};

	const dataPanelActions: DataPanelActions = {
		clearIoNotice: ioNoticeActions.clearIoNotice,
		reportImportError: ioNoticeActions.reportImportError,
		importDiagram(imported, repairs) {
			// theme is deliberately untouched — a per-browser preference, not
			// diagram data, so it survives an import.
			replaceDiagram(state, imported);
			refresh();
			// No notice when nothing needed adjusting — the changed data is
			// sufficient feedback.
			if (repairs.length === 0) return;
			// Set AFTER refresh() (which clears the io notice and already
			// rendered once) so this message survives the import's own refresh
			// and only retires on the next committed action. Its own trailing
			// renderApp() call is this action's second (and final) render.
			showIoNotice({
				kind: "io",
				tone: "warning",
				message: `Imported ${state.nodes.length} nodes, ${state.links.length} links. Adjustments: ${repairs.join("; ")}.`,
			});
			renderApp();
		},
	};

	const themeControlActions: ThemeControlActions = {
		setTheme(value) {
			state.settings.theme = value;
			applyTheme(doc, value);
			// Theme is a per-browser preference, not diagram data — unlike the
			// other settings actions, it deliberately skips refresh() entirely:
			// no validation re-run (the graph's validity can't depend on the
			// theme) and no diagram/editor rebuilds, just persist + notices, then
			// one render (which also picks up the new theme prop for ThemeControl).
			persistAndClearNotices();
			renderApp();
		},
	};

	const diagramPanelActions: DiagramPanelActions = {
		setPalette(value) {
			state.settings.palette = value;
			// Node colors are palette-derived; refresh()'s render re-projects the
			// node editor's swatches from the now-updated state.settings.palette.
			// Neither editor's row DOM/Sortable is rebuilt — see refresh()'s own
			// doc comment.
			refresh();
		},
		setLinkColor(value) {
			state.settings.linkColor = value;
			refresh();
		},
		setAlignment(value) {
			state.settings.alignment = value;
			refresh();
		},
		setAspectRatio(value) {
			state.settings.aspectRatio = value;
			refresh();
		},
		clearIoNotice: ioNoticeActions.clearIoNotice,
		reportExportError: ioNoticeActions.reportExportError,
	};

	refresh();

	function destroy(): void {
		if (destroyed) return;
		destroyed = true;
		controller.abort();
		// Must run before unmounting App below — see removeActiveDragClone's own
		// doc comment for why destroying one editor's Sortable instance first
		// would otherwise poison the other's own mid-drag cleanup.
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
