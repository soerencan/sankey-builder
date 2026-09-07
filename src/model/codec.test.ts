import { describe, expect, it } from "vitest";
import { SETTING_NAMES, isRawDiagram, normalizeDiagram, normalizeState } from "./codec";
import type { State } from "./graph";
import { defaultState, withoutLinkId } from "./graph";
import { DEFAULT_SETTINGS, DIAGRAM_SETTING_KEYS } from "./settings";

/** Link ids from two independent loads necessarily differ. */
function stripLinkIds(state: State) {
	return { ...state, links: state.links.map(withoutLinkId) };
}

describe("normalizeState", () => {
	it("returns the default state when the parsed payload is null", () => {
		expect(stripLinkIds(normalizeState(null))).toEqual(stripLinkIds(defaultState()));
	});

	it("returns the default state when the parsed payload is a non-object", () => {
		expect(stripLinkIds(normalizeState(42))).toEqual(stripLinkIds(defaultState()));
	});

	it("returns the default state when nodes/links are missing", () => {
		expect(stripLinkIds(normalizeState({ settings: {} }))).toEqual(stripLinkIds(defaultState()));
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
		expect(normalizeState(payload).links.map(withoutLinkId)).toEqual([
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
		expect(normalizeState(payload).links.map(withoutLinkId)).toEqual([
			{ source: "n1", target: null, value: 1 },
		]);
	});

	it("round-trips null endpoints (an unassigned link)", () => {
		const payload = {
			nodes: [{ id: "n1", name: "A" }],
			links: [{ source: null, target: null, value: 1 }],
			settings: {},
		};
		expect(normalizeState(payload).links.map(withoutLinkId)).toEqual([
			{ source: null, target: null, value: 1 },
		]);
	});

	it("normalizes a bare {} raw link to a fully unassigned row", () => {
		const payload = {
			nodes: [{ id: "n1", name: "A" }],
			links: [{}],
			settings: {},
		};
		expect(normalizeState(payload).links.map(withoutLinkId)).toEqual([
			{ source: null, target: null, value: 1 },
		]);
	});

	it("drops individual malformed nodes rather than failing the whole hydration", () => {
		const payload = {
			nodes: [{ id: "n1", name: "A" }, { id: "n2" }, { name: "no id" }, null],
			links: [],
			settings: {},
		};
		expect(normalizeState(payload).nodes).toEqual([{ id: "n1", name: "A", colorIndex: 0 }]);
	});

	it("drops unknown fields on nodes and links", () => {
		const payload = {
			nodes: [{ id: "n1", name: "A", extra: "nope" }],
			links: [{ source: "n1", target: "n1", value: 1, extra: "nope" }],
			settings: {},
		};
		const state = normalizeState(payload);
		expect(state.nodes).toEqual([{ id: "n1", name: "A", colorIndex: 0 }]);
		expect(state.links.map(withoutLinkId)).toEqual([{ source: "n1", target: "n1", value: 1 }]);
	});

	it("loads a stored node carrying a legacy color without a color key", () => {
		const payload = {
			nodes: [{ id: "n1", name: "A", color: "#a1b2c3" }],
			links: [],
			settings: {},
		};
		expect(normalizeState(payload).nodes[0]).toEqual({ id: "n1", name: "A", colorIndex: 0 });
	});

	describe("link ids", () => {
		function payloadWithLinks(links: unknown[]) {
			return {
				nodes: [
					{ id: "n1", name: "A" },
					{ id: "n2", name: "B" },
				],
				links,
				settings: {},
			};
		}

		it("assigns every normalized link a non-empty, distinct id", () => {
			const state = normalizeState(
				payloadWithLinks([
					{ source: "n1", target: "n2", value: 1 },
					{ source: "n2", target: "n1", value: 2 },
				]),
			);
			const ids = state.links.map((l) => l.id);
			expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
			expect(new Set(ids).size).toBe(2);
		});

		it("ignores a stray id in the input, minting a fresh one instead", () => {
			const state = normalizeState(
				payloadWithLinks([{ id: "stray-id", source: "n1", target: "n2", value: 1 }]),
			);
			expect(state.links[0].id).not.toBe("stray-id");
		});
	});

	describe("link value coercion", () => {
		function normalizeWithValue(value: unknown) {
			const payload = {
				nodes: [
					{ id: "n1", name: "A" },
					{ id: "n2", name: "B" },
				],
				links: [{ source: "n1", target: "n2", value }],
				settings: {},
			};
			return normalizeState(payload).links;
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
			expect(normalizeWithValue(value)[0].value).toBe(expected);
		});
	});

	describe("settings normalization", () => {
		function normalizeWithSettings(settings: unknown) {
			const payload = { nodes: [], links: [], settings };
			return normalizeState(payload).settings;
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
			expect(normalizeWithSettings(settings)[field]).toBe(expected);
		});

		it("loads a legacy manual colorMode silently, keeping the saved palette and dropping colorMode", () => {
			const settings = normalizeWithSettings({ colorMode: "manual", palette: "set2" });
			expect(settings.palette).toBe("set2");
			expect("colorMode" in settings).toBe(false);
		});
	});

	describe("theme", () => {
		it("keeps a valid stored theme", () => {
			const payload = { nodes: [], links: [], settings: { theme: "dark" } };
			expect(normalizeState(payload).settings.theme).toBe("dark");
		});

		it("defaults an invalid stored theme without reporting it", () => {
			const payload = { nodes: [], links: [], settings: { theme: "bogus" } };
			expect(normalizeState(payload).settings.theme).toBe(DEFAULT_SETTINGS.theme);
		});
	});
});

describe("isRawDiagram", () => {
	it("accepts an object with nodes and links arrays", () => {
		expect(isRawDiagram({ nodes: [], links: [] })).toBe(true);
	});

	it("accepts an object that also carries a settings field", () => {
		expect(isRawDiagram({ nodes: [], links: [], settings: {} })).toBe(true);
	});

	it.each<[string, unknown]>([
		["null", null],
		["a non-object", 42],
		["an array", []],
		["an object missing nodes", { links: [] }],
		["an object missing links", { nodes: [] }],
		["an object with a non-array nodes field", { nodes: {}, links: [] }],
		["an object with a non-array links field", { nodes: [], links: {} }],
	])("rejects %s", (_label, value) => {
		expect(isRawDiagram(value)).toBe(false);
	});
});

describe("normalizeDiagram", () => {
	function repairsFor(settings: Record<string, unknown>): string[] {
		const repairs: string[] = [];
		normalizeDiagram({ nodes: [], links: [], settings }, repairs);
		return repairs;
	}

	it.each(DIAGRAM_SETTING_KEYS)("reports an unknown %s with the shared message template", (key) => {
		expect(repairsFor({ [key]: "not-a-real-value" })).toContain(
			`settings: unknown ${SETTING_NAMES[key]} — using default`,
		);
	});

	it("uses the default for every diagram setting silently when all keys are missing", () => {
		expect(repairsFor({})).toEqual([]);
	});
});

describe("node palette slots", () => {
	it("assigns legacy nodes their existing palette order, sharing duplicate ids", () => {
		const state = normalizeState({
			nodes: [
				{ id: "b", name: "B" },
				{ id: "a", name: "A" },
				{ id: "b", name: "B again" },
				{ id: "c", name: "C" },
			],
			links: [],
		});
		expect(state.nodes.map((n) => n.colorIndex)).toEqual([0, 1, 0, 2]);
	});
	it("preserves saved slots independently of row order", () => {
		const state = normalizeState({
			nodes: [
				{ id: "b", name: "B", colorIndex: 9 },
				{ id: "a", name: "A", colorIndex: 0 },
			],
			links: [],
		});
		expect(normalizeState(state).nodes.map((n) => n.colorIndex)).toEqual([9, 0]);
	});
	it.each([-1, 1.5, "2", null, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
		"repairs invalid palette slot %s",
		(colorIndex) => {
			const repairs: string[] = [];
			const diagram = normalizeDiagram(
				{ nodes: [{ id: "a", name: "A", colorIndex }], links: [] },
				repairs,
			);
			expect(diagram.nodes[0].colorIndex).toBe(0);
			expect(repairs).toEqual(["node 1: invalid color index — using default"]);
		},
	);
});
