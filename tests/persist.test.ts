import { describe, expect, it } from "vitest";
import { STORAGE_KEY, loadState, saveState } from "../src/persist";
import { defaultState } from "../src/state";

// No d3-global helper import in this file — proves persist.ts (and its
// palette.ts dependency, isPaletteKey) stay d3-free at both module-eval and
// call time.

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

		it("keeps a plain finite value in range", () => {
			expect(loadWithValue(12.5)).toEqual([{ source: "n1", target: "n2", value: 12.5 }]);
		});

		it("does not round a stored decimal below the 4-digit input cap", () => {
			expect(loadWithValue(0.123456)[0].value).toBe(0.123456);
		});

		it("coerces a legacy null (blank mid-edit row) to 1 rather than dropping it", () => {
			expect(loadWithValue(null)).toEqual([{ source: "n1", target: "n2", value: 1 }]);
		});

		it("coerces a negative value to 1", () => {
			expect(loadWithValue(-3)[0].value).toBe(1);
		});

		it("coerces zero to 1", () => {
			expect(loadWithValue(0)[0].value).toBe(1);
		});

		it("coerces an out-of-range value to 1", () => {
			expect(loadWithValue(1e16)[0].value).toBe(1);
		});

		it("coerces a non-number value to 1", () => {
			expect(loadWithValue("abc")[0].value).toBe(1);
		});

		it("coerces a numeric string to 1 (no lenient parsing)", () => {
			expect(loadWithValue("5")[0].value).toBe(1);
		});
	});

	describe("settings normalization", () => {
		function loadWithSettings(settings: unknown) {
			const payload = { nodes: [], links: [], settings };
			const storage = fakeLocalStorage({ [STORAGE_KEY]: JSON.stringify(payload) });
			return loadState(storage).settings;
		}

		it("falls back to observable10 for a prototype-chain hole (e.g. toString)", () => {
			expect(loadWithSettings({ palette: "toString" }).palette).toBe("observable10");
		});

		it("falls back to observable10 for an unknown palette", () => {
			expect(loadWithSettings({ palette: "rainbow" }).palette).toBe("observable10");
		});

		it("keeps a recognized palette", () => {
			expect(loadWithSettings({ palette: "dark2" }).palette).toBe("dark2");
		});

		it("loads a legacy manual colorMode silently, keeping the saved palette and dropping colorMode", () => {
			const settings = loadWithSettings({ colorMode: "manual", palette: "set2" });
			expect(settings.palette).toBe("set2");
			expect("colorMode" in settings).toBe(false);
		});

		it("falls back to source-target for an unknown linkColor", () => {
			expect(loadWithSettings({ linkColor: "bogus" }).linkColor).toBe("source-target");
		});

		it("keeps a recognized linkColor", () => {
			expect(loadWithSettings({ linkColor: "static" }).linkColor).toBe("static");
		});

		it("falls back to justify for an unknown alignment", () => {
			expect(loadWithSettings({ alignment: "bogus" }).alignment).toBe("justify");
		});

		it("keeps a recognized alignment", () => {
			expect(loadWithSettings({ alignment: "center" }).alignment).toBe("center");
		});

		it("defaults legacy diagrams without an aspect ratio to 2:1", () => {
			expect(loadWithSettings({}).aspectRatio).toBe("2:1");
		});

		it("keeps a recognized aspect ratio", () => {
			expect(loadWithSettings({ aspectRatio: "16:9" }).aspectRatio).toBe("16:9");
		});

		it("falls back to 2:1 for an unknown aspect ratio", () => {
			expect(loadWithSettings({ aspectRatio: "portrait" }).aspectRatio).toBe("2:1");
		});

		it("falls back to auto for an unknown theme", () => {
			expect(loadWithSettings({ theme: "bogus" }).theme).toBe("auto");
		});

		it("keeps a recognized theme", () => {
			expect(loadWithSettings({ theme: "dark" }).theme).toBe("dark");
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
