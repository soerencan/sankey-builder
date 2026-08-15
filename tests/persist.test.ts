import { afterEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY, loadState, saveState } from "../src/persist";
import { defaultState } from "../src/state";

// No d3-global helper import in this file — proves persist.ts (and its
// colors.ts dependency, isPaletteKey) stay d3-free at both module-eval and
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

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("loadState", () => {
	it("returns the default state when nothing is stored", () => {
		vi.stubGlobal("localStorage", fakeLocalStorage());
		expect(loadState()).toEqual(defaultState());
	});

	it("returns the default state for invalid JSON", () => {
		vi.stubGlobal("localStorage", fakeLocalStorage({ [STORAGE_KEY]: "not json" }));
		expect(loadState()).toEqual(defaultState());
	});

	it("returns the default state when the stored payload is null", () => {
		vi.stubGlobal("localStorage", fakeLocalStorage({ [STORAGE_KEY]: "null" }));
		expect(loadState()).toEqual(defaultState());
	});

	it("returns the default state when the stored payload is a non-object", () => {
		vi.stubGlobal("localStorage", fakeLocalStorage({ [STORAGE_KEY]: "42" }));
		expect(loadState()).toEqual(defaultState());
	});

	it("returns the default state when nodes/links are missing", () => {
		vi.stubGlobal(
			"localStorage",
			fakeLocalStorage({ [STORAGE_KEY]: JSON.stringify({ settings: {} }) }),
		);
		expect(loadState()).toEqual(defaultState());
	});

	it("returns the default state when localStorage is unavailable", () => {
		vi.stubGlobal("localStorage", undefined);
		expect(loadState()).toEqual(defaultState());
	});

	it("drops dangling links referencing a missing node id", () => {
		const payload = {
			nodes: [{ id: "n1", name: "A" }],
			links: [
				{ source: "n1", target: "missing", value: 1 },
				{ source: "missing", target: "n1", value: 1 },
			],
			settings: {},
		};
		vi.stubGlobal("localStorage", fakeLocalStorage({ [STORAGE_KEY]: JSON.stringify(payload) }));
		expect(loadState().links).toEqual([]);
	});

	it("drops individual malformed nodes rather than failing the whole hydration", () => {
		const payload = {
			nodes: [{ id: "n1", name: "A" }, { id: "n2" }, { name: "no id" }, null],
			links: [],
			settings: {},
		};
		vi.stubGlobal("localStorage", fakeLocalStorage({ [STORAGE_KEY]: JSON.stringify(payload) }));
		expect(loadState().nodes).toEqual([{ id: "n1", name: "A" }]);
	});

	it("drops unknown fields on nodes and links", () => {
		const payload = {
			nodes: [{ id: "n1", name: "A", extra: "nope" }],
			links: [{ source: "n1", target: "n1", value: 1, extra: "nope" }],
			settings: {},
		};
		vi.stubGlobal("localStorage", fakeLocalStorage({ [STORAGE_KEY]: JSON.stringify(payload) }));
		const state = loadState();
		expect(state.nodes).toEqual([{ id: "n1", name: "A" }]);
		expect(state.links).toEqual([{ source: "n1", target: "n1", value: 1 }]);
	});

	describe("node color regex", () => {
		function loadWithColor(color: unknown) {
			const payload = {
				nodes: [{ id: "n1", name: "A", color }],
				links: [],
				settings: {},
			};
			vi.stubGlobal("localStorage", fakeLocalStorage({ [STORAGE_KEY]: JSON.stringify(payload) }));
			return loadState().nodes[0];
		}

		it("keeps a valid 6-digit hex color", () => {
			expect(loadWithColor("#a1b2c3")).toEqual({ id: "n1", name: "A", color: "#a1b2c3" });
		});

		it("keeps a valid uppercase 6-digit hex color", () => {
			expect(loadWithColor("#A1B2C3")).toEqual({ id: "n1", name: "A", color: "#A1B2C3" });
		});

		it("drops a named color", () => {
			expect(loadWithColor("red")).toEqual({ id: "n1", name: "A" });
		});

		it("drops a short hex color", () => {
			expect(loadWithColor("#abc")).toEqual({ id: "n1", name: "A" });
		});

		it("drops an rgb() color", () => {
			expect(loadWithColor("rgb(1,2,3)")).toEqual({ id: "n1", name: "A" });
		});
	});

	describe("value NaN round-trip", () => {
		it("restores a null value (blank mid-edit row) as NaN", () => {
			const payload = {
				nodes: [
					{ id: "n1", name: "A" },
					{ id: "n2", name: "B" },
				],
				links: [{ source: "n1", target: "n2", value: null }],
				settings: {},
			};
			vi.stubGlobal("localStorage", fakeLocalStorage({ [STORAGE_KEY]: JSON.stringify(payload) }));
			expect(loadState().links[0].value).toBeNaN();
		});

		it("saveState followed by loadState round-trips a NaN link value", () => {
			vi.stubGlobal("localStorage", fakeLocalStorage());
			const state = defaultState();
			state.links[0].value = Number.NaN;

			expect(saveState(state)).toBe(true);
			expect(loadState().links[0].value).toBeNaN();
		});
	});

	describe("settings normalization", () => {
		function loadWithSettings(settings: unknown) {
			const payload = { nodes: [], links: [], settings };
			vi.stubGlobal("localStorage", fakeLocalStorage({ [STORAGE_KEY]: JSON.stringify(payload) }));
			return loadState().settings;
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

		it("falls back to auto for an unknown colorMode", () => {
			expect(loadWithSettings({ colorMode: "bogus" }).colorMode).toBe("auto");
		});

		it("keeps manual colorMode", () => {
			expect(loadWithSettings({ colorMode: "manual" }).colorMode).toBe("manual");
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
		vi.stubGlobal("localStorage", storage);
		const state = defaultState();

		expect(saveState(state)).toBe(true);
		expect(JSON.parse(storage.getItem(STORAGE_KEY) as string)).toEqual(state);
	});

	it("returns false when localStorage.setItem throws (quota exceeded, private mode)", () => {
		vi.stubGlobal("localStorage", {
			getItem: () => null,
			setItem: () => {
				throw new Error("quota exceeded");
			},
			removeItem: () => {},
			clear: () => {},
			key: () => null,
			length: 0,
		});

		expect(saveState(defaultState())).toBe(false);
	});
});
