import { normalizeState } from "../model/codec";
import type { State } from "../model/graph";
import { defaultState, withoutLinkId } from "../model/graph";

export const STORAGE_KEY = "sankey-builder";

export function loadState(storage: Storage): State {
	let raw: string | null = null;
	try {
		raw = storage.getItem(STORAGE_KEY);
	} catch {
		// Unavailable (file://, private mode) — fall back to the default graph.
		return defaultState();
	}
	if (!raw) return defaultState();
	try {
		return normalizeState(JSON.parse(raw));
	} catch {
		return defaultState();
	}
}

/**
 * Best-effort: quota exceeded, private mode, or file:// with storage
 * disabled shouldn't break the app. DOM-free by design — the caller
 * (app/start-app.ts) owns surfacing/clearing the storage notice from this
 * result. Serializes an explicit `{ nodes, links, settings }` shape rather
 * than `state` itself, since `JSON.stringify(state)` would otherwise leak
 * links' in-memory-only ids into storage. Theme and incomplete links (null
 * endpoints) are still persisted — there is no "last-good state" in storage,
 * only the editor's current one, valid or not.
 */
export function saveState(storage: Storage, state: State): boolean {
	try {
		const persisted = {
			nodes: state.nodes,
			links: state.links.map(withoutLinkId),
			settings: state.settings,
		};
		storage.setItem(STORAGE_KEY, JSON.stringify(persisted));
		return true;
	} catch {
		return false;
	}
}
