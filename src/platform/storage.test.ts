import { describe, expect, it } from "vitest";
import type { State } from "../model/graph";
import { defaultState } from "../model/graph";
import { STORAGE_KEY, loadState, saveState } from "./storage";

// No import from features/diagram/colors.ts (or anything importing it) in this file — proves
// storage.ts (and its model/codec.ts dependency) stay d3-free at both module-eval and call time.

/** Minimal in-memory stand-in for the `Storage` interface. */
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

/** Storage stand-in whose accessors throw, mirroring Safari private mode / file://. */
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

describe("loadState", () => {
	it("returns the default state when nothing is stored", () => {
		expect(loadState(fakeLocalStorage())).toEqual(defaultState());
	});

	it("returns the default state for invalid JSON", () => {
		expect(loadState(fakeLocalStorage({ [STORAGE_KEY]: "not json" }))).toEqual(defaultState());
	});

	it("returns the default state when localStorage is unavailable", () => {
		expect(loadState(unavailableLocalStorage())).toEqual(defaultState());
	});

	it("round-trips a saved non-default state", () => {
		const storage = fakeLocalStorage();
		const state: State = {
			nodes: [
				{ id: "n1", name: "A" },
				{ id: "n2", name: "B" },
			],
			links: [{ source: "n1", target: "n2", value: 5 }],
			settings: {
				palette: "dark2",
				linkColor: "static",
				alignment: "center",
				aspectRatio: "16:9",
				theme: "dark",
			},
		};

		saveState(storage, state);

		expect(loadState(storage)).toEqual(state);
	});
});

describe("saveState", () => {
	it("returns true and persists on success", () => {
		const storage = fakeLocalStorage();
		const state = defaultState();

		expect(saveState(storage, state)).toBe(true);
		expect(JSON.parse(storage.getItem(STORAGE_KEY) as string)).toEqual(state);
	});

	it("returns false when localStorage.setItem throws (quota exceeded, private mode)", () => {
		expect(saveState(unavailableLocalStorage(), defaultState())).toBe(false);
	});
});
