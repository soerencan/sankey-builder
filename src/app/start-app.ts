import { select } from "d3";
import type Sortable from "sortablejs";
import { createNodeColorResolver } from "../features/diagram/colors";
import { setupPreviewResizer } from "../features/diagram/preview-resizer";
import { renderDiagram } from "../features/diagram/render";
import type { LinkEditorActions } from "../features/editor/link-editor";
import { renderLinkEditor, setupLinkEditor } from "../features/editor/link-editor";
import type { NodeEditorActions } from "../features/editor/node-editor";
import {
	renderNodeEditor,
	setupNodeEditor,
	updateNodeSwatches,
} from "../features/editor/node-editor";
import { destroySortable } from "../features/editor/row-reorder";
import type { IoActions } from "../features/files/controls";
import { setupIo } from "../features/files/controls";
import { applyTheme } from "../features/settings/theme";
import type { ThemeControlActions } from "../features/settings/theme-control";
import { setupThemeControl, syncThemeControl } from "../features/settings/theme-control";
import type { ToolbarActions } from "../features/settings/toolbar";
import { setupToolbar, syncToolbar } from "../features/settings/toolbar";
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

export interface AppHandle {
	/** Idempotent — safe to call more than once. */
	destroy(): void;
}

const STORAGE_NOTICE =
	"Changes can't be saved in this browser right now (storage may be full or unavailable). " +
	"The diagram keeps working, but edits won't survive closing or reloading this tab — " +
	"try freeing up space or leaving private/incognito mode.";

interface RefreshOptions {
	rebuildNodes?: boolean;
	rebuildLinks?: boolean;
}

/**
 * Boots one application instance against `doc`. Every setup module below is
 * markup-agnostic and reads no ambient `window`/`document`/`localStorage`
 * itself — this is the sole owner of state, the action objects, the Sortable
 * instances, and the app-scoped AbortController, so a second `startApp` call
 * after `destroy()` on the first never shares mutable state or duplicated
 * listeners with it. Calling `startApp` again without destroying the first
 * instance is not supported — both instances would bind listeners to the
 * same document.
 */
export function startApp(doc: Document = globalThis.document): AppHandle {
	const view = doc.defaultView;
	if (!view) throw new Error("startApp: document has no defaultView/window to bind to");
	// Re-bound to a non-nullable type (rather than relying on narrowing of
	// `view`) so closures below — refresh() and the action objects — don't
	// need their own null checks.
	const win: Window = view;

	const controller = new AbortController();
	const { signal } = controller;
	let destroyed = false;

	const state: State = loadState(win.localStorage);
	// Recreated on every renderNodeEditor/renderLinkEditor call (their row
	// containers are torn down and rebuilt each time) — owned here, per
	// instance, rather than as a module-level singleton in the editor
	// modules, so destroy() can tear down exactly this instance's Sortables.
	let nodeRowSortable: Sortable | null = null;
	let linkRowSortable: Sortable | null = null;

	applyTheme(doc, state.settings.theme);

	/**
	 * The save/notice portion of refresh() below, factored out so the
	 * theme-change path can reuse it without also validating or redrawing.
	 * Order matters and is preserved exactly (see refresh()'s own doc comment
	 * for the surrounding rationale):
	 *
	 * 1. Clear any I/O notice (import or export): it's a one-shot result of the
	 *    last action, so the next user action retires it. importDiagram() sets
	 *    #io-notice AFTER its own refresh() call, so its message survives that
	 *    refresh and clears here on the following action.
	 * 2. Save — regardless of validity: an invalid *topology* the user is still
	 *    editing (e.g. a cycle) is retained in the editor and must survive a
	 *    reload; there is no "last-good state" in storage, only the last-good
	 *    *diagram*, which stays on screen without needing its own storage.
	 * 3. Update the storage notice from the save result — storage may recover
	 *    (e.g. quota freed up elsewhere), so a previously shown notice clears
	 *    rather than staying stuck once saves work again.
	 */
	function persistAndClearNotices(): void {
		select(doc.getElementById("io-notice")).text("");
		const saved = saveState(win.localStorage, state);
		select(doc.getElementById("storage-notice")).text(saved ? "" : STORAGE_NOTICE);
	}

	/**
	 * The current validateAndRender flow, ported from the pre-migration
	 * bundle and the subtlest behavior in the app. Order matters and is
	 * preserved exactly:
	 *
	 * 1. Rebuild the color resolver fresh from state (replaces the
	 *    pre-migration bundle's module-level currentColorScale singleton).
	 * 2. Validate and update the error notice.
	 * 3. Persist and update the I/O/storage notices — see
	 *    persistAndClearNotices()'s own doc comment.
	 * 4. Rebuild the requested editors — regardless of validity — so the user
	 *    can see and fix the offending row. The flags exist to preserve input
	 *    focus/caret: rebuilding the editor being typed in would drop it.
	 * 5. Bail before the diagram rebuild so the last good render stays on
	 *    screen when invalid.
	 * 6. Otherwise render the diagram — full SVG rebuild.
	 */
	function refresh({ rebuildNodes = true, rebuildLinks = true }: RefreshOptions = {}): void {
		const nodeColor = createNodeColorResolver(state);
		const result = validate(state);
		select(doc.getElementById("error")).text(result.ok ? "" : (result.error ?? ""));

		persistAndClearNotices();

		if (rebuildNodes) {
			nodeRowSortable = renderNodeEditor(
				doc,
				state,
				nodeColor,
				nodeEditorActions.moveNode,
				nodeRowSortable,
			);
		}
		if (rebuildLinks) {
			linkRowSortable = renderLinkEditor(doc, state, linkEditorActions.moveLink, linkRowSortable);
		}
		// Bail before the diagram rebuild so the last good render stays on
		// screen; the editors above still rebuild (when requested) so the user
		// can see and fix the offending row.
		if (!result.ok) return;
		renderDiagram(doc, state, nodeColor);
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
			// Skip the node editor's own rebuild (would reset this input's
			// focus/caret mid-keystroke) but still rebuild the link editor, whose
			// source/target <select> options show node names and would otherwise
			// go stale.
			refresh({ rebuildNodes: false });
		},
		moveNode(from, to) {
			moveNode(state, from, to);
			// Node order drives the link dropdowns' option order, so rebuild both
			// editors (same reason renameNode rebuilds the link editor).
			refresh();
		},
	};

	const linkEditorActions: LinkEditorActions = {
		addLink() {
			addLink(state);
			// The node editor is unaffected by link changes — rebuild only the links.
			refresh({ rebuildNodes: false });
		},
		deleteLink(index) {
			deleteLink(state, index);
			refresh({ rebuildNodes: false });
		},
		updateLinkSource(index, id) {
			updateLink(state, index, { source: id });
			refresh({ rebuildNodes: false });
		},
		updateLinkTarget(index, id) {
			updateLink(state, index, { target: id });
			refresh({ rebuildNodes: false });
		},
		updateLinkValue(index, value) {
			updateLink(state, index, { value });
			// Skip both editor rebuilds: the node editor is unaffected, and
			// rebuilding the link editor here would steal focus mid-keystroke.
			refresh({ rebuildNodes: false, rebuildLinks: false });
		},
		moveLink(from, to) {
			moveLink(state, from, to);
			// The node editor is unaffected by link order — rebuild only the links.
			refresh({ rebuildNodes: false });
		},
	};

	const ioActions: IoActions = {
		importDiagram(imported, repairs) {
			// theme is deliberately untouched — a per-browser preference, not
			// diagram data, so it survives an import. No syncThemeControl call
			// here for that reason: nothing about the theme control could go stale.
			replaceDiagram(state, imported);
			syncToolbar(doc, state);
			refresh();
			let message = `Imported ${state.nodes.length} nodes, ${state.links.length} links.`;
			if (repairs.length > 0) message += ` Adjustments: ${repairs.join("; ")}.`;
			// Set AFTER refresh() (which clears #io-notice) so this message survives
			// the import's own refresh and only retires on the next user action.
			// Separate from #storage-notice so it doesn't disturb that lifecycle.
			select(doc.getElementById("io-notice")).text(message);
		},
		reportImportError(message) {
			select(doc.getElementById("io-notice")).text(message);
		},
		reportExportError(message) {
			select(doc.getElementById("io-notice")).text(message);
		},
		reportExportSuccess(filename) {
			// Not preceded by refresh() (export doesn't touch state), so no risk of
			// this being cleared before it's shown; it retires the same way import's
			// notice does, on the next refresh()-triggering user action.
			select(doc.getElementById("io-notice")).text(`Exported ${filename}.`);
		},
	};

	const themeControlActions: ThemeControlActions = {
		setTheme(value) {
			state.settings.theme = value;
			applyTheme(doc, value);
			// Theme is a per-browser preference, not diagram data — unlike the
			// other settings actions, it deliberately skips refresh() entirely:
			// no validation re-run (the graph's validity can't depend on the
			// theme) and no diagram/editor rebuilds, just persist + notices.
			persistAndClearNotices();
		},
	};

	const toolbarActions: ToolbarActions = {
		setPalette(value) {
			state.settings.palette = value;
			// Node colors are palette-derived, but a palette change doesn't affect
			// graph shape/validity or either editor's markup — skip both editor
			// rebuilds (same as the diagram-only settings below) and instead patch
			// the node editor's swatches directly. refresh() rebuilds its own
			// resolver internally for the diagram but doesn't expose it, so the
			// swatch patch rebuilds a second one here, off the now-updated
			// state.settings.palette, rather than threading a return value through
			// refresh()'s other callers.
			refresh({ rebuildNodes: false, rebuildLinks: false });
			updateNodeSwatches(doc, state, createNodeColorResolver(state));
		},
		setLinkColor(value) {
			state.settings.linkColor = value;
			// Diagram-only setting — skip both editor rebuilds, same as theme above.
			refresh({ rebuildNodes: false, rebuildLinks: false });
		},
		setAlignment(value) {
			state.settings.alignment = value;
			refresh({ rebuildNodes: false, rebuildLinks: false });
		},
		setAspectRatio(value) {
			state.settings.aspectRatio = value;
			refresh({ rebuildNodes: false, rebuildLinks: false });
		},
	};

	setupNodeEditor(doc, nodeEditorActions, signal);
	setupLinkEditor(doc, linkEditorActions, state, signal);
	setupThemeControl(doc, state, themeControlActions, signal);
	setupToolbar(doc, state, toolbarActions, signal);
	// Its returned disposer resets in-progress pointer-drag state on
	// destroy() — a resource an aborted AbortSignal alone can't unwind (see
	// setupPreviewResizer's own docs).
	const cancelPreviewDrag = setupPreviewResizer(doc, win, signal);
	setupIo(doc, win, state, ioActions, signal);

	refresh();
	// setupToolbar/setupThemeControl wire listeners only (see their own docs) —
	// sync the initial preview/dialog rows here, against the state
	// loadState() just restored.
	syncToolbar(doc, state);
	syncThemeControl(doc, state);

	function destroy(): void {
		if (destroyed) return;
		destroyed = true;
		controller.abort();
		// nodeRowSortable/linkRowSortable are (re)created by refresh()'s
		// renderNodeEditor/renderLinkEditor calls, not by the setup* calls
		// above, so there's no "setup order" to reverse here — just tear down
		// preview-drag state, then the link Sortable, then the node Sortable.
		cancelPreviewDrag();
		destroySortable(linkRowSortable);
		destroySortable(nodeRowSortable);
	}

	return { destroy };
}
