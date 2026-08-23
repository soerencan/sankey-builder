import { describe, expect, it } from "vitest";
import type { State } from "./graph";
import { defaultState } from "./graph";
import {
	MAX_LINK_VALUE,
	exceedsFractionDigits,
	parseLinkValue,
	truncateFractionDigits,
	validate,
} from "./validation";

describe("parseLinkValue", () => {
	it.each<[string, string, ReturnType<typeof parseLinkValue>]>([
		["empty string", "", { kind: "empty" }],
		["whitespace-only string", "   ", { kind: "empty" }],
		["plain integer", "42", { kind: "valid", value: 42 }],
		["decimal", "3.14", { kind: "valid", value: 3.14 }],
		["trailing-dot integer", "5.", { kind: "valid", value: 5 }],
		["leading-dot fraction", ".5", { kind: "valid", value: 0.5 }],
		["value with surrounding whitespace", "  7  ", { kind: "valid", value: 7 }],
		["exactly 4 fractional digits", "0.1234", { kind: "valid", value: 0.1234 }],
		["exactly the cap", "1000000000000000", { kind: "valid", value: MAX_LINK_VALUE }],
		["zero", "0", { kind: "invalid" }],
		["all-zero decimal", "0.0000", { kind: "invalid" }],
		["negative value", "-1", { kind: "invalid" }],
		["exponent notation", "1e5", { kind: "invalid" }],
		["more than 4 fractional digits", "0.12345", { kind: "invalid" }],
		["thousands separator", "1,000", { kind: "invalid" }],
		["inner whitespace", "1 0", { kind: "invalid" }],
		["non-numeric text", "abc", { kind: "invalid" }],
		["bare dot", ".", { kind: "invalid" }],
		["value above the cap", "1000000000000001", { kind: "invalid" }],
	])("parses %s (%j) as %j", (_label, input, expected) => {
		expect(parseLinkValue(input)).toEqual(expected);
	});
});

describe("exceedsFractionDigits", () => {
	it.each<[string, boolean]>([
		["1.23456", true],
		["1.2345", false],
		["12345", false],
		["1.2.3456", false],
	])("%j exceeds 4 fraction digits: %s", (input, expected) => {
		expect(exceedsFractionDigits(input)).toBe(expected);
	});
});

describe("truncateFractionDigits", () => {
	it.each<[string, string]>([
		["1.23456789", "1.2345"],
		["1.23", "1.23"],
		["100", "100"],
	])("truncates %j to %j", (input, expected) => {
		expect(truncateFractionDigits(input)).toBe(expected);
	});
});

describe("validate", () => {
	it("passes for the default state", () => {
		expect(validate(defaultState())).toEqual({ ok: true });
	});

	describe("invalid numeric values", () => {
		it.each<[string, number]>([
			["NaN (the blank-field mid-edit case)", Number.NaN],
			["Infinity", Number.POSITIVE_INFINITY],
			["zero", 0],
			["a negative value", -5],
		])("rejects %s", (_label, value) => {
			const state = defaultState();
			state.links[0].value = value;
			expect(validate(state)).toEqual({
				ok: false,
				error: "Link 1 (Coal to Electricity) needs a value greater than 0.",
			});
		});

		it("uses the row number to disambiguate duplicate links between the same pair", () => {
			const state = defaultState();
			state.links.push({ source: "n1", target: "n3", value: -1 });
			expect(validate(state)).toEqual({
				ok: false,
				error: "Link 4 (Coal to Electricity) needs a value greater than 0.",
			});
		});
	});

	describe("MAX_LINK_VALUE cap", () => {
		it("passes exactly at the cap", () => {
			const state = defaultState();
			state.links[0].value = MAX_LINK_VALUE;
			expect(validate(state)).toEqual({ ok: true });
		});

		it("rejects a value above the cap", () => {
			const state = defaultState();
			state.links[0].value = MAX_LINK_VALUE + 1;
			expect(validate(state)).toEqual({
				ok: false,
				error: `Link 1 (Coal to Electricity) value is too large (maximum ${MAX_LINK_VALUE}).`,
			});
		});
	});

	describe("self-links", () => {
		it("rejects a link connecting a node to itself", () => {
			const state = defaultState();
			state.links[0].target = state.links[0].source;
			expect(validate(state)).toEqual({
				ok: false,
				error: "A link cannot connect Coal to itself.",
			});
		});
	});

	describe("incomplete links", () => {
		it("skips a link with a null endpoint entirely — never an error", () => {
			const state = defaultState();
			state.links.push({ source: "n1", target: null, value: 1 });
			expect(validate(state)).toEqual({ ok: true });
		});

		it("treats a state whose only structural problem is an incomplete link as valid", () => {
			const state: State = {
				nodes: [
					{ id: "n1", name: "A" },
					{ id: "n2", name: "B" },
				],
				links: [{ source: null, target: null, value: 1 }],
				settings: defaultState().settings,
			};
			expect(validate(state)).toEqual({ ok: true });
		});

		it("ignores an incomplete link's value even when it would otherwise be invalid", () => {
			const state = defaultState();
			state.links.push({ source: null, target: "n2", value: 0 });
			expect(validate(state)).toEqual({ ok: true });
		});

		it("does not let an incomplete link participate in cycle detection", () => {
			const state: State = {
				nodes: [
					{ id: "n1", name: "A" },
					{ id: "n2", name: "B" },
				],
				links: [
					{ source: "n1", target: "n2", value: 1 },
					// A completing edge back to n1 would close a cycle, but it's
					// incomplete (null source) so it's ignored.
					{ source: null, target: "n1", value: 1 },
				],
				settings: defaultState().settings,
			};
			expect(validate(state)).toEqual({ ok: true });
		});
	});

	describe("cycle detection", () => {
		it("reports a simple 2-node cycle by node names", () => {
			const state: State = {
				nodes: [
					{ id: "n1", name: "A" },
					{ id: "n2", name: "B" },
				],
				links: [
					{ source: "n1", target: "n2", value: 1 },
					{ source: "n2", target: "n1", value: 1 },
				],
				settings: defaultState().settings,
			};
			expect(validate(state)).toEqual({
				ok: false,
				error: "This link would create a cycle: A → B → A",
			});
		});

		it("reports a longer cycle by node names", () => {
			const state: State = {
				nodes: [
					{ id: "n1", name: "A" },
					{ id: "n2", name: "B" },
					{ id: "n3", name: "C" },
					{ id: "n4", name: "D" },
				],
				links: [
					{ source: "n1", target: "n2", value: 1 },
					{ source: "n2", target: "n3", value: 1 },
					{ source: "n3", target: "n4", value: 1 },
					{ source: "n4", target: "n1", value: 1 },
				],
				settings: defaultState().settings,
			};
			expect(validate(state)).toEqual({
				ok: false,
				error: "This link would create a cycle: A → B → C → D → A",
			});
		});

		it("doesn't flag a dangling link (no matching node) as a cycle", () => {
			// platform/storage.ts normally coerces a dangling endpoint to null before
			// validate ever sees the state, but validate is defensive here too:
			// DFS only starts from `state.nodes`, and a dangling target has no
			// outgoing edges of its own, so it can never close a cycle back to
			// itself.
			const state: State = {
				nodes: [{ id: "n1", name: "A" }],
				links: [{ source: "n1", target: "missing", value: 1 }],
				settings: defaultState().settings,
			};
			expect(validate(state)).toEqual({ ok: true });
		});

		it("falls back to the raw id when a dangling link also has a bad value", () => {
			const state: State = {
				nodes: [{ id: "n1", name: "A" }],
				links: [{ source: "n1", target: "missing", value: 0 }],
				settings: defaultState().settings,
			};
			expect(validate(state)).toEqual({
				ok: false,
				error: "Link 1 (A to missing) needs a value greater than 0.",
			});
		});
	});

	describe("check order", () => {
		it("reports the self-link error before a bad value on the same link", () => {
			const state = defaultState();
			state.links[0].target = state.links[0].source;
			state.links[0].value = Number.NaN;
			expect(validate(state)).toEqual({
				ok: false,
				error: "A link cannot connect Coal to itself.",
			});
		});

		it("reports value errors (per-link, in link order) before cycle errors", () => {
			const state: State = {
				nodes: [
					{ id: "n1", name: "A" },
					{ id: "n2", name: "B" },
				],
				links: [
					{ source: "n1", target: "n2", value: 1 },
					{ source: "n2", target: "n1", value: -1 },
				],
				settings: defaultState().settings,
			};
			expect(validate(state)).toEqual({
				ok: false,
				error: "Link 2 (B to A) needs a value greater than 0.",
			});
		});
	});
});
