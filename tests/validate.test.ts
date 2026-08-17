import { describe, expect, it } from "vitest";
import type { State } from "../src/state";
import { defaultState } from "../src/state";
import {
	MAX_LINK_VALUE,
	exceedsFractionDigits,
	parseLinkValue,
	truncateFractionDigits,
	validate,
} from "../src/validate";

describe("parseLinkValue", () => {
	it("reports an empty string as empty", () => {
		expect(parseLinkValue("")).toEqual({ kind: "empty" });
	});

	it("treats a whitespace-only string as empty", () => {
		expect(parseLinkValue("   ")).toEqual({ kind: "empty" });
	});

	it("parses a plain integer", () => {
		expect(parseLinkValue("42")).toEqual({ kind: "valid", value: 42 });
	});

	it("parses a decimal", () => {
		expect(parseLinkValue("3.14")).toEqual({ kind: "valid", value: 3.14 });
	});

	it("parses a trailing-dot integer as its integer value", () => {
		expect(parseLinkValue("5.")).toEqual({ kind: "valid", value: 5 });
	});

	it("parses a leading-dot fraction", () => {
		expect(parseLinkValue(".5")).toEqual({ kind: "valid", value: 0.5 });
	});

	it("trims surrounding whitespace before parsing", () => {
		expect(parseLinkValue("  7  ")).toEqual({ kind: "valid", value: 7 });
	});

	it("accepts exactly 4 fractional digits", () => {
		expect(parseLinkValue("0.1234")).toEqual({ kind: "valid", value: 0.1234 });
	});

	it("accepts exactly the cap", () => {
		expect(parseLinkValue("1000000000000000")).toEqual({
			kind: "valid",
			value: MAX_LINK_VALUE,
		});
	});

	it("rejects zero", () => {
		expect(parseLinkValue("0")).toEqual({ kind: "invalid" });
	});

	it("rejects an all-zero decimal", () => {
		expect(parseLinkValue("0.0000")).toEqual({ kind: "invalid" });
	});

	it("rejects a negative value", () => {
		expect(parseLinkValue("-1")).toEqual({ kind: "invalid" });
	});

	it("rejects exponent notation", () => {
		expect(parseLinkValue("1e5")).toEqual({ kind: "invalid" });
	});

	it("rejects more than 4 fractional digits", () => {
		expect(parseLinkValue("0.12345")).toEqual({ kind: "invalid" });
	});

	it("rejects a thousands separator", () => {
		expect(parseLinkValue("1,000")).toEqual({ kind: "invalid" });
	});

	it("rejects inner whitespace", () => {
		expect(parseLinkValue("1 0")).toEqual({ kind: "invalid" });
	});

	it("rejects non-numeric text", () => {
		expect(parseLinkValue("abc")).toEqual({ kind: "invalid" });
	});

	it("rejects a bare dot", () => {
		expect(parseLinkValue(".")).toEqual({ kind: "invalid" });
	});

	it("rejects a value above the cap", () => {
		expect(parseLinkValue("1000000000000001")).toEqual({ kind: "invalid" });
	});
});

describe("exceedsFractionDigits", () => {
	it("is true for a well-formed decimal with 5 fractional digits", () => {
		expect(exceedsFractionDigits("1.23456")).toBe(true);
	});

	it("is false at exactly 4 fractional digits", () => {
		expect(exceedsFractionDigits("1.2345")).toBe(false);
	});

	it("is false for a plain integer", () => {
		expect(exceedsFractionDigits("12345")).toBe(false);
	});

	it("is false for a garbage string even when long", () => {
		expect(exceedsFractionDigits("1.2.3456")).toBe(false);
	});
});

describe("truncateFractionDigits", () => {
	it("truncates (not rounds) to 4 fractional digits", () => {
		expect(truncateFractionDigits("1.23456789")).toBe("1.2345");
	});

	it("leaves a value already within the cap untouched", () => {
		expect(truncateFractionDigits("1.23")).toBe("1.23");
	});

	it("leaves a plain integer untouched", () => {
		expect(truncateFractionDigits("100")).toBe("100");
	});
});

describe("validate", () => {
	it("passes for the default state", () => {
		expect(validate(defaultState())).toEqual({ ok: true });
	});

	describe("invalid numeric values", () => {
		it("rejects NaN (the blank-field mid-edit case)", () => {
			const state = defaultState();
			state.links[0].value = Number.NaN;
			expect(validate(state)).toEqual({
				ok: false,
				error: "Link 1 (Coal to Electricity) needs a value greater than 0.",
			});
		});

		it("rejects Infinity", () => {
			const state = defaultState();
			state.links[0].value = Number.POSITIVE_INFINITY;
			expect(validate(state)).toEqual({
				ok: false,
				error: "Link 1 (Coal to Electricity) needs a value greater than 0.",
			});
		});

		it("rejects zero", () => {
			const state = defaultState();
			state.links[0].value = 0;
			expect(validate(state)).toEqual({
				ok: false,
				error: "Link 1 (Coal to Electricity) needs a value greater than 0.",
			});
		});

		it("rejects negative values", () => {
			const state = defaultState();
			state.links[0].value = -5;
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
			// persist.ts normally coerces a dangling endpoint to null before
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
