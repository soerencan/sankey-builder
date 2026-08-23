import { describe, expect, it } from "vitest";
import { STORAGE_KEY, loadState, saveState } from "../src/persist";
import type { State } from "../src/state";
import { defaultState } from "../src/state";

// No import from colors.ts (or anything importing it) in this file — proves
// persist.ts (and its palette.ts dependency, isPaletteKey) stay d3-free at
// both module-eval and call time.

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

	it("returns the default state when the stored payload is null", () => {
		expect(loadState(fakeLocalStorage({ [STORAGE_KEY]: "null" }))).toEqual(defaultState());
	});

	it("returns the default state when the stored payload is a non-object", () => {
		expect(loadState(fakeLocalStorage({ [STORAGE_KEY]: "42" }))).toEqual(defaultState());
	});

	it("returns the default state when nodes/links are missing", () => {
		expect(
			loadState(fakeLocalStorage({ [STORAGE_KEY]: JSON.stringify({ settings: {} }) })),
		).toEqual(defaultState());
	});

	it("returns the default state when localStorage is unavailable", () => {
		expect(loadState(unavailableLocalStorage())).toEqual(defaultState());
	});

	it("coerces a dangling endpoint to null instead of dropping the link", () => {
		const payload = {
			nodes: [{ id: "n1", name: "A" }],
			links: [
				{ source: "n1", target: "missing", value: 1 },
				{ source: "missing", target: "n1", value: 1 },
			],
			settings: {},
		};
		const storage = fakeLocalStorage({ [STORAGE_KEY]: JSON.stringify(payload) });
		expect(loadState(storage).links).toEqual([
			{ source: "n1", target: null, value: 1 },
			{ source: null, target: "n1", value: 1 },
		]);
	});

	it("coerces a non-string endpoint to null", () => {
		const payload = {
			nodes: [{ id: "n1", name: "A" }],
			links: [{ source: "n1", target: 42, value: 1 }],
			settings: {},
		};
		const storage = fakeLocalStorage({ [STORAGE_KEY]: JSON.stringify(payload) });
		expect(loadState(storage).links).toEqual([{ source: "n1", target: null, value: 1 }]);
	});

	it("round-trips null endpoints (an unassigned link)", () => {
		const payload = {
			nodes: [{ id: "n1", name: "A" }],
			links: [{ source: null, target: null, value: 1 }],
			settings: {},
		};
		const storage = fakeLocalStorage({ [STORAGE_KEY]: JSON.stringify(payload) });
		expect(loadState(storage).links).toEqual([{ source: null, target: null, value: 1 }]);
	});

	it("normalizes a bare {} raw link to a fully unassigned row", () => {
		const payload = {
			nodes: [{ id: "n1", name: "A" }],
			links: [{}],
			settings: {},
		};
		const storage = fakeLocalStorage({ [STORAGE_KEY]: JSON.stringify(payload) });
		expect(loadState(storage).links).toEqual([{ source: null, target: null, value: 1 }]);
	});

	it("drops individual malformed nodes rather than failing the whole hydration", () => {
		const payload = {
			nodes: [{ id: "n1", name: "A" }, { id: "n2" }, { name: "no id" }, null],
			links: [],
			settings: {},
		};
		const storage = fakeLocalStorage({ [STORAGE_KEY]: JSON.stringify(payload) });
		expect(loadState(storage).nodes).toEqual([{ id: "n1", name: "A" }]);
	});

	it("drops unknown fields on nodes and links", () => {
		const payload = {
			nodes: [{ id: "n1", name: "A", extra: "nope" }],
			links: [{ source: "n1", target: "n1", value: 1, extra: "nope" }],
			settings: {},
		};
		const storage = fakeLocalStorage({ [STORAGE_KEY]: JSON.stringify(payload) });
		const state = loadState(storage);
		expect(state.nodes).toEqual([{ id: "n1", name: "A" }]);
		expect(state.links).toEqual([{ source: "n1", target: "n1", value: 1 }]);
	});

	it("loads a stored node carrying a legacy color without a color key", () => {
		const payload = {
			nodes: [{ id: "n1", name: "A", color: "#a1b2c3" }],
			links: [],
			settings: {},
		};
		const storage = fakeLocalStorage({ [STORAGE_KEY]: JSON.stringify(payload) });
		expect(loadState(storage).nodes[0]).toEqual({ id: "n1", name: "A" });
	});

	describe("link value coercion", () => {
		function loadWithValue(value: unknown) {
			const payload = {
				nodes: [
					{ id: "n1", name: "A" },
					{ id: "n2", name: "B" },
				],
				links: [{ source: "n1", target: "n2", value }],
				settings: {},
			};
			const storage = fakeLocalStorage({ [STORAGE_KEY]: JSON.stringify(payload) });
			return loadState(storage).links;
		}

		it.each<[string, unknown, number]>([
			["keeps a plain finite value in range", 12.5, 12.5],
			["does not round a stored decimal below the 4-digit input cap", 0.123456, 0.123456],
			["coerces a legacy null (blank mid-edit row) to 1", null, 1],
			["coerces a negative value to 1", -3, 1],
			["coerces zero to 1", 0, 1],
			["coerces an out-of-range value to 1", 1e16, 1],
			["coerces a non-number value to 1", "abc", 1],
			["coerces a numeric string to 1 (no lenient parsing)", "5", 1],
		])("%s", (_label, value, expected) => {
			expect(loadWithValue(value)[0].value).toBe(expected);
		});
	});

	describe("settings normalization", () => {
		function loadWithSettings(settings: unknown) {
			const payload = { nodes: [], links: [], settings };
			const storage = fakeLocalStorage({ [STORAGE_KEY]: JSON.stringify(payload) });
			return loadState(storage).settings;
		}

		it.each<[string, Record<string, unknown>, keyof State["settings"], unknown]>([
			[
				"falls back to observable10 for a prototype-chain hole (e.g. toString)",
				{ palette: "toString" },
				"palette",
				"observable10",
			],
			[
				"falls back to observable10 for an unknown palette",
				{ palette: "rainbow" },
				"palette",
				"observable10",
			],
			["keeps a recognized palette", { palette: "dark2" }, "palette", "dark2"],
			[
				"falls back to source-target for an unknown linkColor",
				{ linkColor: "bogus" },
				"linkColor",
				"source-target",
			],
			["keeps a recognized linkColor", { linkColor: "static" }, "linkColor", "static"],
			[
				"falls back to justify for an unknown alignment",
				{ alignment: "bogus" },
				"alignment",
				"justify",
			],
			["keeps a recognized alignment", { alignment: "center" }, "alignment", "center"],
			["defaults legacy diagrams without an aspect ratio to 2:1", {}, "aspectRatio", "2:1"],
			["keeps a recognized aspect ratio", { aspectRatio: "16:9" }, "aspectRatio", "16:9"],
			[
				"falls back to 2:1 for an unknown aspect ratio",
				{ aspectRatio: "portrait" },
				"aspectRatio",
				"2:1",
			],
			["falls back to auto for an unknown theme", { theme: "bogus" }, "theme", "auto"],
			["keeps a recognized theme", { theme: "dark" }, "theme", "dark"],
		])("%s", (_label, settings, field, expected) => {
			expect(loadWithSettings(settings)[field]).toBe(expected);
		});

		it("loads a legacy manual colorMode silently, keeping the saved palette and dropping colorMode", () => {
			const settings = loadWithSettings({ colorMode: "manual", palette: "set2" });
			expect(settings.palette).toBe("set2");
			expect("colorMode" in settings).toBe(false);
		});
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
