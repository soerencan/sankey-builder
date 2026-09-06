import { describe, expect, it } from "vitest";
import type { State } from "../model/graph";
import { defaultState, withoutLinkId } from "../model/graph";
import { DEFAULT_SETTINGS } from "../model/settings";
import { STORAGE_KEY, loadState, saveState } from "./storage";

// Deliberately imports nothing from features/: proves storage.ts and
// codec.ts stay d3-free at module-eval and call time.

function fakeLocalStorage(initial: Record<string, string> = {}): Storage {
	const store = new Map(Object.entries(initial));
	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => {
			store.set(key, value);
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
		clear: () => store.clear(),
		key: () => null,
		get length() {
			return store.size;
		},
	};
}

/** Accessors throw, as in Safari private mode or file://. */
function unavailableLocalStorage(): Storage {
	const unavailable = () => {
		throw new Error("storage unavailable");
	};
	return {
		getItem: unavailable,
		setItem: unavailable,
		removeItem: unavailable,
		clear: unavailable,
		key: unavailable,
		length: 0,
	};
}

/** Link ids from two independent loads necessarily differ. */
function stripLinkIds(state: State) {
	return { ...state, links: state.links.map(withoutLinkId) };
}

describe("loadState", () => {
	it("returns the default state when nothing is stored", () => {
		expect(stripLinkIds(loadState(fakeLocalStorage()))).toEqual(stripLinkIds(defaultState()));
	});

	it("returns the default state for invalid JSON", () => {
		expect(stripLinkIds(loadState(fakeLocalStorage({ [STORAGE_KEY]: "not json" })))).toEqual(
			stripLinkIds(defaultState()),
		);
	});

	it("returns the default state when localStorage is unavailable", () => {
		expect(stripLinkIds(loadState(unavailableLocalStorage()))).toEqual(
			stripLinkIds(defaultState()),
		);
	});

	it("round-trips a saved non-default state, minting fresh link ids", () => {
		const storage = fakeLocalStorage();
		const state: State = {
			nodes: [
				{ id: "n1", name: "A" },
				{ id: "n2", name: "B" },
			],
			links: [{ id: "original-id", source: "n1", target: "n2", value: 5 }],
			settings: {
				...DEFAULT_SETTINGS,
				palette: "dark2",
				linkColor: "static",
				alignment: "center",
				aspectRatio: "16:9",
				theme: "dark",
			},
		};

		saveState(storage, state);

		const loaded = loadState(storage);
		expect(loaded.nodes).toEqual(state.nodes);
		expect(loaded.links.map(withoutLinkId)).toEqual([{ source: "n1", target: "n2", value: 5 }]);
		expect(loaded.links[0].id).not.toBe("original-id");
		expect(loaded.settings).toEqual(state.settings);
	});

	it("preserves theme and a link with a null endpoint across a save/load round trip", () => {
		const storage = fakeLocalStorage();
		const state: State = {
			nodes: [{ id: "n1", name: "A" }],
			links: [{ id: "l1", source: "n1", target: null, value: 3 }],
			settings: {
				...DEFAULT_SETTINGS,
				palette: "dark2",
				linkColor: "static",
				alignment: "center",
				aspectRatio: "16:9",
				theme: "dark",
			},
		};

		saveState(storage, state);

		const loaded = loadState(storage);
		expect(loaded.settings.theme).toBe("dark");
		expect(loaded.links).toHaveLength(1);
		expect(loaded.links[0].source).toBe("n1");
		expect(loaded.links[0].target).toBeNull();
	});

	it("loads a stored entry carrying stray link id fields with fresh ids", () => {
		const storage = fakeLocalStorage();
		storage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				nodes: [
					{ id: "n1", name: "A" },
					{ id: "n2", name: "B" },
				],
				links: [
					{ id: "stray-1", source: "n1", target: "n2", value: 1 },
					{ id: "stray-2", source: "n2", target: "n1", value: 2 },
				],
				settings: {},
			}),
		);

		const loaded = loadState(storage);
		const ids = loaded.links.map((l) => l.id);
		expect(ids).not.toContain("stray-1");
		expect(ids).not.toContain("stray-2");
		expect(new Set(ids).size).toBe(2);
	});
});

describe("saveState", () => {
	it("returns true and persists on success", () => {
		const storage = fakeLocalStorage();
		const state = defaultState();

		expect(saveState(storage, state)).toBe(true);
		const persisted = JSON.parse(storage.getItem(STORAGE_KEY) as string);
		expect(persisted.nodes).toEqual(state.nodes);
		expect(persisted.links.map(withoutLinkId)).toEqual(state.links.map(withoutLinkId));
		expect(persisted.settings).toEqual(state.settings);
	});

	it("omits link ids from the persisted entry", () => {
		const storage = fakeLocalStorage();
		saveState(storage, defaultState());
		const persisted = JSON.parse(storage.getItem(STORAGE_KEY) as string);
		expect(persisted.links.some((l: Record<string, unknown>) => "id" in l)).toBe(false);
	});

	it("returns false when localStorage.setItem throws (quota exceeded, private mode)", () => {
		expect(saveState(unavailableLocalStorage(), defaultState())).toBe(false);
	});
});
