import { describe, expect, it } from "vitest";
import { parseImport, serializeState } from "../src/io";
import { type State, defaultState } from "../src/state";

function sampleState(): State {
	return {
		nodes: [
			{ id: "n1", name: "A", color: "#112233" },
			{ id: "n2", name: "B" },
		],
		links: [{ source: "n1", target: "n2", value: 5 }],
		settings: {
			palette: "dark2",
			colorMode: "manual",
			linkColor: "static",
			alignment: "center",
			theme: "dark",
		},
	};
}

describe("serializeState", () => {
	it("omits theme from the exported settings", () => {
		const parsed = JSON.parse(serializeState(sampleState()));
		expect(parsed.settings).toEqual({
			palette: "dark2",
			colorMode: "manual",
			linkColor: "static",
			alignment: "center",
		});
		expect("theme" in parsed.settings).toBe(false);
	});

	it("exports complete links only, skipping incomplete rows", () => {
		const state = sampleState();
		state.links.push({ source: "n1", target: null, value: 1 });
		state.links.push({ source: null, target: null, value: 2 });
		const parsed = JSON.parse(serializeState(state));
		expect(parsed.links).toEqual([{ source: "n1", target: "n2", value: 5 }]);
	});

	it("keeps node colors as stored", () => {
		const parsed = JSON.parse(serializeState(sampleState()));
		expect(parsed.nodes).toEqual([
			{ id: "n1", name: "A", color: "#112233" },
			{ id: "n2", name: "B" },
		]);
	});

	it("pretty-prints with a 2-space indent", () => {
		const json = serializeState(sampleState());
		expect(json).toContain('\n  "nodes"');
		expect(json).toContain('\n  "links"');
		// Idempotent under a re-pretty-print at the same indent.
		expect(json).toBe(JSON.stringify(JSON.parse(json), null, 2));
	});
});

describe("parseImport round-trip", () => {
	it("round-trips a valid state losslessly (sans theme)", () => {
		const state = sampleState();
		const result = parseImport(serializeState(state));
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");
		expect(result.repairs).toEqual([]);
		expect(result.state).toEqual({
			nodes: state.nodes,
			links: state.links,
			settings: {
				palette: "dark2",
				colorMode: "manual",
				linkColor: "static",
				alignment: "center",
			},
		});
	});
});

describe("parseImport hard rejections", () => {
	it("rejects text that isn't valid JSON", () => {
		const result = parseImport("not json at all");
		expect(result).toEqual({ ok: false, error: expect.stringContaining("diagram export") });
	});

	it("rejects a top-level array", () => {
		const result = parseImport("[]");
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable");
		expect(result.error).toContain("diagram export");
	});

	it("rejects an object without nodes/links arrays", () => {
		const result = parseImport("{}");
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable");
		expect(result.error).toContain("diagram export");
	});

	it("rejects a non-array nodes field", () => {
		const result = parseImport(JSON.stringify({ nodes: {}, links: [] }));
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable");
		expect(result.error).toContain("diagram export");
	});

	it("rejects a top-level JSON null", () => {
		const result = parseImport("null");
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable");
		expect(result.error).toContain("diagram export");
	});

	it("rejects a top-level primitive", () => {
		const result = parseImport("42");
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
		expect(result.state.nodes).toEqual([]);
		expect(result.state.links).toEqual([]);
		expect(result.repairs).toEqual([]);
	});
});

describe("parseImport repairs", () => {
	function importPayload(payload: unknown) {
		const result = parseImport(JSON.stringify(payload));
		if (!result.ok) throw new Error(`unexpected rejection: ${result.error}`);
		return result;
	}

	it("removes an invalid node color and reports it", () => {
		const result = importPayload({
			nodes: [{ id: "n1", name: "A", color: "not-a-hex" }],
			links: [],
			settings: {},
		});
		expect(result.state.nodes).toEqual([{ id: "n1", name: "A" }]);
		expect(result.repairs).toContain("node n1: invalid color removed");
	});

	it("falls back to the default palette and reports an unknown one", () => {
		const result = importPayload({ nodes: [], links: [], settings: { palette: "rainbow" } });
		expect(result.state.settings.palette).toBe("observable10");
		expect(result.repairs).toContain("settings: unknown palette — using default");
	});

	it("coerces a dangling endpoint to null and reports it", () => {
		const result = importPayload({
			nodes: [{ id: "n1", name: "A" }],
			links: [{ source: "n1", target: "gone", value: 1 }],
			settings: {},
		});
		expect(result.state.links).toEqual([{ source: "n1", target: null, value: 1 }]);
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
		expect(result.state.links).toEqual([{ source: "n1", target: "n2", value: 1 }]);
		expect(result.repairs).toContain("link 1: invalid value — set to 1");
	});

	it("ignores a theme key in the file — never applied, never a repair", () => {
		const result = importPayload({ nodes: [], links: [], settings: { theme: "dark" } });
		expect("theme" in result.state.settings).toBe(false);
		expect(result.repairs).toEqual([]);
	});

	it("tolerates unknown extra keys without repairs", () => {
		const result = importPayload({
			nodes: [{ id: "n1", name: "A", extra: "x" }],
			links: [],
			settings: { palette: "set2" },
			meta: { author: "someone" },
		});
		expect(result.state.nodes).toEqual([{ id: "n1", name: "A" }]);
		expect(result.state.settings.palette).toBe("set2");
		expect(result.repairs).toEqual([]);
	});

	it("normalizes a default state cleanly with no repairs", () => {
		const result = parseImport(serializeState(defaultState()));
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");
		expect(result.repairs).toEqual([]);
	});
});
