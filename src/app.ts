import { select } from "d3";
import type Sortable from "sortablejs";
import { createNodeColorResolver } from "./colors";
import type { IoActions } from "./io-controls";
import { setupIo } from "./io-controls";
import type { LinkEditorActions } from "./link-editor";
import { renderLinkEditor, setupLinkEditor } from "./link-editor";
import type { NodeEditorActions } from "./node-editor";
import { renderNodeEditor, setupNodeEditor } from "./node-editor";
import { loadState, saveState } from "./persist";
import { setupPreviewResizer } from "./preview-resizer";
import { renderDiagram } from "./render";
import { destroySortable } from "./row-reorder";
import type { State } from "./state";
import {
	addLink,
	addNode,
	deleteLink,
	deleteNode,
	moveLink,
	moveNode,
	renameNode,
	updateLink,
} from "./state";
import { applyTheme } from "./theme";
import type { ThemeControlActions } from "./theme-control";
import { setupThemeControl, syncThemeControl } from "./theme-control";
import type { ToolbarActions } from "./toolbar";
import { setupToolbar, syncToolbar } from "./toolbar";
import { validate } from "./validate";

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
	 * The current validateAndRender flow, ported from the pre-migration
	 * bundle and the subtlest behavior in the app. Order matters and is
	 * preserved exactly:
	 *
	 * 1. Rebuild the color resolver fresh from state (replaces the
	 *    pre-migration bundle's module-level currentColorScale singleton).
	 * 2. Validate and update the error notice.
	 * 3. Save — regardless of validity: an invalid *topology* the user is still
	 *    editing (e.g. a cycle) is retained in the editor and must survive a
	 *    reload; there is no "last-good state" in storage, only the last-good
	 *    *diagram*, which stays on screen without needing its own storage.
	 * 4. Update the storage notice from the save result.
	 * 5. Rebuild the requested editors — regardless of validity — so the user
	 *    can see and fix the offending row. The flags exist to preserve input
	 *    focus/caret: rebuilding the editor being typed in would drop it.
	 * 6. Bail before the diagram rebuild so the last good render stays on
	 *    screen when invalid.
	 * 7. Otherwise render the diagram — full SVG rebuild.
	 */
	function refresh({ rebuildNodes = true, rebuildLinks = true }: RefreshOptions = {}): void {
		const nodeColor = createNodeColorResolver(state);
		const result = validate(state);
		select(doc.getElementById("error")).text(result.ok ? "" : (result.error ?? ""));

		// Clear any I/O notice (import or export): it's a one-shot result of the last
		// action, so the next user action retires it. importDiagram() sets #io-notice
		// AFTER its own refresh() call, so its message survives that refresh and
		// clears here on the following action.
		select(doc.getElementById("io-notice")).text("");

		// Always persist, even when invalid — see the rationale above.
		const saved = saveState(win.localStorage, state);
		// Storage may recover (e.g. quota freed up elsewhere) — clear a
		// previously shown notice rather than leaving it stuck once saves work
		// again.
		select(doc.getElementById("storage-notice")).text(saved ? "" : STORAGE_NOTICE);

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
			// state is the stable reference every module captured — mutate in place
			// rather than reassigning, so those captures stay live.
			state.nodes.length = 0;
			state.nodes.push(...imported.nodes);
			state.links.length = 0;
			state.links.push(...imported.links);
			state.settings.palette = imported.settings.palette;
			state.settings.linkColor = imported.settings.linkColor;
			state.settings.alignment = imported.settings.alignment;
			state.settings.aspectRatio = imported.settings.aspectRatio;
			// theme is deliberately untouched — a per-browser preference, not
			// diagram data, so it survives an import. No syncThemeControl call
			// here for that reason: nothing about the theme control could go stale.
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
			// Theme doesn't affect graph validity or editor markup — skip both
			// editor rebuilds, same as the color-drag path above.
			refresh({ rebuildNodes: false, rebuildLinks: false });
		},
	};

	const toolbarActions: ToolbarActions = {
		setPalette(value) {
			state.settings.palette = value;
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
