import { normalizeState } from "../model/codec";
import type { State } from "../model/graph";
import { defaultState, withoutLinkId } from "../model/graph";

export const STORAGE_KEY = "sankey-builder";

export function loadState(storage: Storage): State {
	let raw: string | null = null;
	try {
		raw = storage.getItem(STORAGE_KEY);
	} catch {
		// Storage unavailable (file://, private mode).
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
 * Best-effort: a full quota or private mode must not break the app. Persists
 * the editor's current state, valid or not and incomplete links included:
 * there is no "last-good state" in storage.
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
