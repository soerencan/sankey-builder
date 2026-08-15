import { beforeAll, describe, expect, it } from "vitest";
import { createNodeColorResolver, enterManualMode, isPaletteKey } from "../src/colors";
import { defaultState } from "../src/state";
import { loadD3Global } from "./helpers/d3-global";

beforeAll(() => {
	loadD3Global();
});

describe("isPaletteKey", () => {
	it("accepts the five real palette keys", () => {
		for (const key of ["observable10", "tableau10", "category10", "set2", "dark2"]) {
			expect(isPaletteKey(key)).toBe(true);
		}
	});

	it("rejects a prototype-chain hole (e.g. toString)", () => {
		expect(isPaletteKey("toString")).toBe(false);
	});

	it("rejects an unrecognized string", () => {
		expect(isPaletteKey("rainbow")).toBe(false);
	});

	it("rejects non-strings", () => {
		expect(isPaletteKey(undefined)).toBe(false);
		expect(isPaletteKey(null)).toBe(false);
		expect(isPaletteKey(42)).toBe(false);
		expect(isPaletteKey({})).toBe(false);
	});
});

describe("createNodeColorResolver", () => {
	it("resolves the same node id to the same color across separate instances", () => {
		const state = defaultState();
		const first = createNodeColorResolver(state);
		const second = createNodeColorResolver(state);
		for (const node of state.nodes) {
			expect(first(node)).toBe(second(node));
		}
	});

	it("changes resolved colors when the active palette switches", () => {
		const state = defaultState();
		const observable10 = createNodeColorResolver(state);
		const before = state.nodes.map((n) => observable10(n));

		state.settings.palette = "dark2";
		const dark2 = createNodeColorResolver(state);
		const after = state.nodes.map((n) => dark2(n));

		expect(after).not.toEqual(before);
	});

	it("in auto mode ignores node.color and always resolves via the scale", () => {
		const state = defaultState();
		state.nodes[0].color = "#123456";
		const resolve = createNodeColorResolver(state);
		expect(resolve(state.nodes[0])).not.toBe("#123456");
	});

	it("in manual mode returns node.color when set", () => {
		const state = defaultState();
		state.settings.colorMode = "manual";
		state.nodes[0].color = "#123456";
		const resolve = createNodeColorResolver(state);
		expect(resolve(state.nodes[0])).toBe("#123456");
	});

	it("in manual mode falls back to the palette scale for a node without a color", () => {
		const state = defaultState();
		state.settings.colorMode = "manual";
		const resolve = createNodeColorResolver(state);
		const auto = createNodeColorResolver({
			...state,
			settings: { ...state.settings, colorMode: "auto" },
		});
		expect(resolve(state.nodes[0])).toBe(auto(state.nodes[0]));
	});
});

describe("enterManualMode", () => {
	it("seeds color only for nodes lacking one", () => {
		const state = defaultState();
		state.nodes[0].color = "#abcdef";
		enterManualMode(state);
		expect(state.nodes[0].color).toBe("#abcdef");
		for (const node of state.nodes.slice(1)) {
			expect(node.color).toBeDefined();
		}
	});

	it("switches colorMode to manual", () => {
		const state = defaultState();
		enterManualMode(state);
		expect(state.settings.colorMode).toBe("manual");
	});

	it("seeds colors matching the pre-switch auto-mode resolver", () => {
		const state = defaultState();
		const auto = createNodeColorResolver(state);
		const expected = new Map(state.nodes.map((n) => [n.id, auto(n)]));

		enterManualMode(state);

		for (const node of state.nodes) {
			expect(node.color).toBe(expected.get(node.id));
		}
	});

	it("re-entering manual mode doesn't overwrite an already-seeded color", () => {
		const state = defaultState();
		enterManualMode(state);
		const seeded = state.nodes.map((n) => n.color);

		// Switch palettes, then re-enter manual mode — a fresh scale would
		// produce different colors if seeding weren't skipped for nodes that
		// already have one.
		state.settings.palette = "dark2";
		enterManualMode(state);

		expect(state.nodes.map((n) => n.color)).toEqual(seeded);
	});
});
