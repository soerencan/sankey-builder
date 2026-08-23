import { render } from "preact";
import { setupPreviewResizer } from "../features/diagram/preview-resizer";
import { renderDiagram } from "../features/diagram/render";
import type { LinkEditorActions } from "../features/editor/link-editor";
import { LinkEditor } from "../features/editor/link-editor";
import type { NodeEditorActions } from "../features/editor/node-editor";
import { NodeEditor } from "../features/editor/node-editor";
import { removeActiveDragClone } from "../features/editor/row-reorder";
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
import { createLinkProjector, projectNodes } from "./view";

export interface AppHandle {
	/** Idempotent — safe to call more than once. */
	destroy(): void;
}

const STORAGE_NOTICE =
	"Changes can't be saved in this browser right now (storage may be full or unavailable). " +
	"The diagram keeps working, but edits won't survive closing or reloading this tab — " +
	"try freeing up space or leaving private/incognito mode.";

/** Looks up a static root `startApp` itself writes to, throwing a message naming the id if it's missing from `doc`. */
function requireRoot(doc: Document, id: string): HTMLElement {
	const el = doc.getElementById(id);
	if (!el) throw new Error(`startApp: missing required "#${id}" element in the document`);
	return el;
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

	// Resolved once, up front, so a markup regression fails loudly at boot
	// rather than silently no-op-ing on every notice update below.
	const errorRoot = requireRoot(doc, "error");
	const ioNoticeRoot = requireRoot(doc, "io-notice");
	const storageNoticeRoot = requireRoot(doc, "storage-notice");
	const nodeEditorRoot = requireRoot(doc, "node-editor");
	const linkEditorRoot = requireRoot(doc, "link-editor");
	const diagramRoot = requireRoot(doc, "diagram");

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
		ioNoticeRoot.textContent = "";
		const saved = saveState(win.localStorage, state);
		storageNoticeRoot.textContent = saved ? "" : STORAGE_NOTICE;
	}

	/**
	 * The validate-then-render flow — the subtlest sequencing in the app.
	 * Order matters and is preserved exactly:
	 *
	 * 1. Validate, then persist + update notices — see persistAndClearNotices's
	 *    own doc comment for why persistence runs regardless of validity.
	 * 2. Render both editors unconditionally: their rows are keyed (node id;
	 *    the link projector's weak key), so a Preact re-render patches
	 *    names/swatches/values/order in place — preserving focus, an
	 *    in-progress link-value draft, and each row-sortable hook's Sortable
	 *    instance — instead of rebuilding. There's no rebuild-flag/focus
	 *    trade-off left to make for either editor.
	 * 3. Bail before the diagram rebuild on an invalid graph (see the inline
	 *    comment below) — otherwise render. renderDiagram builds its own color
	 *    resolver from the snapshot it's handed (see createNodeColorResolver's
	 *    own doc comment for why it's rebuilt per pass rather than cached).
	 */
	function refresh(): void {
		const result = validate(state);
		errorRoot.textContent = result.ok ? "" : (result.error ?? "");

		persistAndClearNotices();

		const nodes = projectNodes(state);
		render(<NodeEditor nodes={nodes} actions={nodeEditorActions} />, nodeEditorRoot);
		render(
			<LinkEditor links={projectLinks(state)} nodes={nodes} actions={linkEditorActions} />,
			linkEditorRoot,
		);
		// Bail before the diagram rebuild so the last good render stays on
		// screen; the editors above still update so the user can see and fix
		// the offending row.
		if (!result.ok) return;
		renderDiagram(diagramRoot, {
			nodes: state.nodes,
			links: state.links,
			settings: state.settings,
		});
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
			ioNoticeRoot.textContent = message;
		},
		reportImportError(message) {
			ioNoticeRoot.textContent = message;
		},
		reportExportError(message) {
			ioNoticeRoot.textContent = message;
		},
		reportExportSuccess(filename) {
			// Not preceded by refresh() (export doesn't touch state), so no risk of
			// this being cleared before it's shown; it retires the same way import's
			// notice does, on the next refresh()-triggering user action.
			ioNoticeRoot.textContent = `Exported ${filename}.`;
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
			// Node colors are palette-derived; refresh()'s unconditional render
			// re-projects the node editor's swatches from the now-updated
			// state.settings.palette. Neither editor's row DOM/Sortable is rebuilt
			// — see refresh()'s own doc comment.
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
		cancelPreviewDrag();
		// Must run before unmounting either editor below — see
		// removeActiveDragClone's own doc comment for why destroying one
		// editor's Sortable instance first would otherwise poison the other's
		// own mid-drag cleanup.
		removeActiveDragClone();
		// Unmounting runs each editor's use-row-sortable.ts cleanup
		// synchronously, tearing down its own Sortable instance.
		render(null, nodeEditorRoot);
		render(null, linkEditorRoot);
	}

	return { destroy };
}
