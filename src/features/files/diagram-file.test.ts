import { describe, expect, it } from "vitest";
import { normalizeState } from "../../model/codec";
import { type State, defaultState, moveLink, moveNode, withoutLinkId } from "../../model/graph";
import { DEFAULT_SETTINGS, pickDiagramSettings } from "../../model/settings";
import { parseImport, serializeState } from "./diagram-file";

function sampleState(): State {
	return {
		nodes: [
			{ id: "n1", name: "A" },
			{ id: "n2", name: "B" },
		],
		links: [{ id: "l1", source: "n1", target: "n2", value: 5 }],
		settings: {
			...DEFAULT_SETTINGS,
			palette: "dark2",
			linkColor: "static",
			alignment: "center",
			aspectRatio: "16:9",
			theme: "dark",
		},
	};
}

describe("serializeState", () => {
	it("omits theme from the exported settings", () => {
		const parsed = JSON.parse(serializeState(sampleState()));
		expect(parsed.settings).toEqual(pickDiagramSettings(sampleState().settings));
		expect("theme" in parsed.settings).toBe(false);
	});

	it("includes the output aspect ratio in diagram JSON", () => {
		const parsed = JSON.parse(serializeState(sampleState()));
		expect(parsed.settings.aspectRatio).toBe("16:9");
	});

	it("omits colorMode from the exported settings", () => {
		const parsed = JSON.parse(serializeState(sampleState()));
		expect("colorMode" in parsed.settings).toBe(false);
	});

	it("omits link ids — in-memory identity, not data", () => {
		const parsed = JSON.parse(serializeState(sampleState()));
		expect(parsed.links).toEqual([{ source: "n1", target: "n2", value: 5 }]);
		expect(parsed.links.some((l: Record<string, unknown>) => "id" in l)).toBe(false);
	});

	it("exports complete links only, skipping incomplete rows", () => {
		const state = sampleState();
		state.links.push({ id: "l2", source: "n1", target: null, value: 1 });
		state.links.push({ id: "l3", source: null, target: null, value: 2 });
		const parsed = JSON.parse(serializeState(state));
		expect(parsed.links).toEqual([{ source: "n1", target: "n2", value: 5 }]);
	});

	it("pretty-prints with a 2-space indent", () => {
		const json = serializeState(sampleState());
		expect(json).toContain('\n  "nodes"');
		expect(json).toContain('\n  "links"');
		// Idempotent under a re-pretty-print at the same indent.
		expect(json).toBe(JSON.stringify(JSON.parse(json), null, 2));
	});

	it("preserves array order after a reorder (row order is array order)", () => {
		const state = defaultState();
		moveNode(state, 0, 3);
		moveLink(state, 0, 2);
		const parsed = JSON.parse(serializeState(state));
		expect(parsed.nodes.map((n: { id: string }) => n.id)).toEqual(state.nodes.map((n) => n.id));
		expect(parsed.links.map((l: { value: number }) => l.value)).toEqual(
			state.links.map((l) => l.value),
		);
	});
});

describe("parseImport round-trip", () => {
	it("round-trips a valid state losslessly (sans theme and link ids)", () => {
		const state = sampleState();
		const result = parseImport(serializeState(state));
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");
		expect(result.repairs).toEqual([]);
		expect(result.diagram.nodes).toEqual(state.nodes);
		expect(result.diagram.links.map(withoutLinkId)).toEqual([
			{ source: "n1", target: "n2", value: 5 },
		]);
		expect(result.diagram.settings).toEqual(pickDiagramSettings(state.settings));
	});

	it("assigns every imported link a fresh id, ignoring any id in the file", () => {
		const result = parseImport(
			JSON.stringify({
				nodes: [
					{ id: "n1", name: "A" },
					{ id: "n2", name: "B" },
				],
				links: [{ id: "stray-id", source: "n1", target: "n2", value: 1 }],
			}),
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");
		expect(result.diagram.links[0].id).not.toBe("stray-id");
		expect(typeof result.diagram.links[0].id).toBe("string");
	});
});

describe("parseImport hard rejections", () => {
	it.each<[string, string]>([
		["text that isn't valid JSON", "not json at all"],
		["a top-level array", "[]"],
		["an object without nodes/links arrays", "{}"],
		["a non-array nodes field", JSON.stringify({ nodes: {}, links: [] })],
		["a top-level JSON null", "null"],
		["a top-level primitive", "42"],
	])("rejects %s", (_label, input) => {
		const result = parseImport(input);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable");
		expect(result.error).toContain("diagram export");
	});
});

describe("parseImport empty graph", () => {
	it("imports an empty-but-valid graph as an intentional wipe", () => {
		const result = parseImport(JSON.stringify({ nodes: [], links: [] }));
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");
		expect(result.diagram.nodes).toEqual([]);
		expect(result.diagram.links).toEqual([]);
		expect(result.repairs).toEqual([]);
	});
});

describe("parseImport repairs", () => {
	function importPayload(payload: unknown) {
		const result = parseImport(JSON.stringify(payload));
		if (!result.ok) throw new Error(`unexpected rejection: ${result.error}`);
		return result;
	}

	it("imports a legacy manual-color export, dropping node colors and reporting the switch", () => {
		const result = importPayload({
			nodes: [
				{ id: "n1", name: "A", color: "#112233" },
				{ id: "n2", name: "B", color: "#445566" },
			],
			links: [],
			settings: { colorMode: "manual", palette: "set2" },
		});
		expect(result.diagram.nodes).toEqual([
			{ id: "n1", name: "A" },
			{ id: "n2", name: "B" },
		]);
		expect(result.diagram.settings.palette).toBe("set2");
		expect(result.repairs).toEqual([
			"settings: manual colors are no longer supported — using the saved palette",
		]);
	});

	it("ignores an unrecognized legacy colorMode value silently", () => {
		const result = importPayload({
			nodes: [{ id: "n1", name: "A" }],
			links: [],
			settings: { colorMode: "bogus" },
		});
		expect(result.repairs).toEqual([]);
	});

	it("imports node colors without a manual colorMode silently", () => {
		const result = importPayload({
			nodes: [{ id: "n1", name: "A", color: "#112233" }],
			links: [],
			settings: {},
		});
		expect(result.diagram.nodes).toEqual([{ id: "n1", name: "A" }]);
		expect(result.repairs).toEqual([]);
	});

	it("falls back to the default palette and reports an unknown one", () => {
		const result = importPayload({ nodes: [], links: [], settings: { palette: "rainbow" } });
		expect(result.diagram.settings.palette).toBe("observable10");
		expect(result.repairs).toContain("settings: unknown palette — using default");
	});

	it("coerces a dangling endpoint to null and reports it", () => {
		const result = importPayload({
			nodes: [{ id: "n1", name: "A" }],
			links: [{ source: "n1", target: "gone", value: 1 }],
			settings: {},
		});
		expect(result.diagram.links.map(withoutLinkId)).toEqual([
			{ source: "n1", target: null, value: 1 },
		]);
		expect(result.repairs).toContain("link 1: unknown target — left unassigned");
	});

	it("coerces a bad value to 1 and reports it", () => {
		const result = importPayload({
			nodes: [
				{ id: "n1", name: "A" },
				{ id: "n2", name: "B" },
			],
			links: [{ source: "n1", target: "n2", value: -4 }],
			settings: {},
		});
		expect(result.diagram.links.map(withoutLinkId)).toEqual([
			{ source: "n1", target: "n2", value: 1 },
		]);
		expect(result.repairs).toContain("link 1: invalid value — set to 1");
	});

	it("ignores a theme key in the file — never applied, never a repair", () => {
		const result = importPayload({ nodes: [], links: [], settings: { theme: "dark" } });
		expect("theme" in result.diagram.settings).toBe(false);
		expect(result.repairs).toEqual([]);
	});

	it("tolerates unknown extra keys without repairs", () => {
		const result = importPayload({
			nodes: [{ id: "n1", name: "A", extra: "x" }],
			links: [],
			settings: { palette: "set2" },
			meta: { author: "someone" },
		});
		expect(result.diagram.nodes).toEqual([{ id: "n1", name: "A" }]);
		expect(result.diagram.settings.palette).toBe("set2");
		expect(result.repairs).toEqual([]);
	});

	it("normalizes a default state cleanly with no repairs", () => {
		const result = parseImport(serializeState(defaultState()));
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");
		expect(result.repairs).toEqual([]);
	});
});

describe("normalizeState and parseImport agreement", () => {
	it("share one normalizer: same repaired diagram, minus theme, for every repair kind", () => {
		const payload = {
			nodes: [{ id: "n1", name: "A" }, { id: "n2", name: "B" }, { name: "no id" }],
			links: [
				"not an object",
				{ source: "missing", target: "n1", value: 1 },
				{ source: "n1", target: "missing", value: 1 },
				{ source: "n1", target: "n2", value: -5 },
			],
			settings: {
				palette: "nope",
				colorMode: "manual",
				linkColor: "nope",
				alignment: "nope",
				aspectRatio: "nope",
			},
		};

		const imported = parseImport(JSON.stringify(payload));
		expect(imported.ok).toBe(true);
		if (!imported.ok) throw new Error("unreachable");

		const loaded = normalizeState(payload);
		const { theme: _theme, ...loadedSettings } = loaded.settings;

		expect(imported.diagram.nodes).toEqual(loaded.nodes);
		expect(imported.diagram.links.map(withoutLinkId)).toEqual(loaded.links.map(withoutLinkId));
		expect(imported.diagram.settings).toEqual(loadedSettings);
		expect(imported.repairs).toEqual([
			"node 3: missing id or name — dropped",
			"link 1: not an object — dropped",
			"link 2: unknown source — left unassigned",
			"link 3: unknown target — left unassigned",
			"link 4: invalid value — set to 1",
			"settings: unknown palette — using default",
			"settings: unknown link color — using default",
			"settings: unknown alignment — using default",
			"settings: unknown aspect ratio — using default",
			"settings: manual colors are no longer supported — using the saved palette",
		]);
	});
});
