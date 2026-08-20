import { createNodeColorResolver, enterManualMode } from "./colors";
import type { ControlsActions } from "./controls";
import { setupControls, syncControls } from "./controls";
import type { IoActions } from "./io-controls";
import { setupIo } from "./io-controls";
import type { LinkEditorActions } from "./link-editor";
import { renderLinkEditor, setupLinkEditor } from "./link-editor";
import type { NodeEditorActions } from "./node-editor";
import { renderNodeEditor, setupNodeEditor } from "./node-editor";
import { loadState, saveState } from "./persist";
import { renderDiagram } from "./render";
import { setupResizer } from "./resizer";
import type { Palette, State } from "./state";
import {
	addLink,
	addNode,
	deleteLink,
	deleteNode,
	moveLink,
	moveNode,
	renameNode,
	updateLink,
	updateNodeColor,
} from "./state";
import { applyTheme } from "./theme";
import { validate } from "./validate";

const STORAGE_NOTICE =
	"Changes can't be saved in this browser right now (storage may be full or unavailable). " +
	"The diagram keeps working, but edits won't survive closing or reloading this tab — " +
	"try freeing up space or leaving private/incognito mode.";

// Assigned in init() rather than at module eval, mirroring app.js:19/902 — no
// UI setup below reads state before init() runs load() first.
let state: State;

interface RefreshOptions {
	rebuildNodes?: boolean;
	rebuildLinks?: boolean;
}

/**
 * The current validateAndRender flow (app.js:385), the subtlest behavior in
 * the app. Order matters and is preserved exactly:
 *
 * 1. Rebuild the color resolver fresh from state (replaces app.js's
 *    module-level currentColorScale singleton).
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
	d3.select("#error").text(result.ok ? "" : (result.error ?? ""));

	// Clear any I/O notice (import or export): it's a one-shot result of the last
	// action, so the next user action retires it. importDiagram() sets #io-notice
	// AFTER its own refresh() call, so its message survives that refresh and
	// clears here on the following action.
	d3.select("#io-notice").text("");

	// Always persist, even when invalid — see the rationale above.
	const saved = saveState(state);
	// Storage may recover (e.g. quota freed up elsewhere) — clear a
	// previously shown notice rather than leaving it stuck once saves work
	// again.
	d3.select("#storage-notice").text(saved ? "" : STORAGE_NOTICE);

	if (rebuildNodes) renderNodeEditor(state, nodeColor);
	if (rebuildLinks) renderLinkEditor(state);
	// Bail before the diagram rebuild so the last good render stays on
	// screen; the editors above still rebuild (when requested) so the user
	// can see and fix the offending row.
	if (!result.ok) return;
	renderDiagram(state, nodeColor);
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
	updateNodeColor(id, color) {
		updateNodeColor(state, id, color);
		// Skip both editor rebuilds: a color picker fires many 'input' events
		// while dragging, and a rebuild mid-drag would tear down the input the
		// user is actively using. Still re-render the diagram so the color
		// change is visible live while dragging.
		refresh({ rebuildNodes: false, rebuildLinks: false });
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
		state.settings.colorMode = imported.settings.colorMode;
		state.settings.linkColor = imported.settings.linkColor;
		state.settings.alignment = imported.settings.alignment;
		// theme is deliberately untouched — a per-browser preference, not
		// diagram data, so it survives an import.
		syncControls(state);
		refresh();
		let message = `Imported ${state.nodes.length} nodes, ${state.links.length} links.`;
		if (repairs.length > 0) message += ` Adjustments: ${repairs.join("; ")}.`;
		// Set AFTER refresh() (which clears #io-notice) so this message survives
		// the import's own refresh and only retires on the next user action.
		// Separate from #storage-notice so it doesn't disturb that lifecycle.
		d3.select("#io-notice").text(message);
	},
	reportImportError(message) {
		d3.select("#io-notice").text(message);
	},
	reportExportSuccess(filename) {
		// Not preceded by refresh() (export doesn't touch state), so no risk of
		// this being cleared before it's shown; it retires the same way import's
		// notice does, on the next refresh()-triggering user action.
		d3.select("#io-notice").text(`Exported ${filename}.`);
	},
};

const controlsActions: ControlsActions = {
	setLinkColor(value) {
		state.settings.linkColor = value;
		refresh();
	},
	setAlignment(value) {
		state.settings.alignment = value;
		refresh();
	},
	selectPalette(raw) {
		if (raw === "manual") {
			enterManualMode(state);
		} else {
			state.settings.palette = raw as Palette;
			state.settings.colorMode = "auto";
		}
		refresh();
	},
	setTheme(value) {
		state.settings.theme = value;
		applyTheme(value);
		// Theme doesn't affect graph validity or editor markup — skip both
		// editor rebuilds, same as the color-drag path above.
		refresh({ rebuildNodes: false, rebuildLinks: false });
	},
};

function init(): void {
	state = loadState();
	applyTheme(state.settings.theme);
	setupNodeEditor(nodeEditorActions);
	setupLinkEditor(linkEditorActions, state);
	setupControls(state, controlsActions);
	setupIo(state, ioActions);
	setupResizer();
	refresh();
}

init();
