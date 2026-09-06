import { describe, expect, it } from "vitest";
import type { State } from "./graph";
import { defaultState } from "./graph";
import { MAX_LINK_VALUE, validate } from "./validation";

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
			state.links.push({ id: "l4", source: "n1", target: "n3", value: -1 });
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
			state.links.push({ id: "l4", source: "n1", target: null, value: 1 });
			expect(validate(state)).toEqual({ ok: true });
		});

		it("treats a state whose only structural problem is an incomplete link as valid", () => {
			const state: State = {
				nodes: [
					{ id: "n1", name: "A" },
					{ id: "n2", name: "B" },
				],
				links: [{ id: "l1", source: null, target: null, value: 1 }],
				settings: defaultState().settings,
			};
			expect(validate(state)).toEqual({ ok: true });
		});

		it("ignores an incomplete link's value even when it would otherwise be invalid", () => {
			const state = defaultState();
			state.links.push({ id: "l4", source: null, target: "n2", value: 0 });
			expect(validate(state)).toEqual({ ok: true });
		});

		it("does not let an incomplete link participate in cycle detection", () => {
			const state: State = {
				nodes: [
					{ id: "n1", name: "A" },
					{ id: "n2", name: "B" },
				],
				links: [
					{ id: "l1", source: "n1", target: "n2", value: 1 },
					// Would close a cycle if it were complete.
					{ id: "l2", source: null, target: "n1", value: 1 },
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
					{ id: "l1", source: "n1", target: "n2", value: 1 },
					{ id: "l2", source: "n2", target: "n1", value: 1 },
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
					{ id: "l1", source: "n1", target: "n2", value: 1 },
					{ id: "l2", source: "n2", target: "n3", value: 1 },
					{ id: "l3", source: "n3", target: "n4", value: 1 },
					{ id: "l4", source: "n4", target: "n1", value: 1 },
				],
				settings: defaultState().settings,
			};
			expect(validate(state)).toEqual({
				ok: false,
				error: "This link would create a cycle: A → B → C → D → A",
			});
		});

		it("doesn't flag a dangling link (no matching node) as a cycle", () => {
			// The codec normally nulls a dangling endpoint first; validate must
			// still cope, since DFS starts only from `state.nodes`.
			const state: State = {
				nodes: [{ id: "n1", name: "A" }],
				links: [{ id: "l1", source: "n1", target: "missing", value: 1 }],
				settings: defaultState().settings,
			};
			expect(validate(state)).toEqual({ ok: true });
		});

		it("falls back to the raw id when a dangling link also has a bad value", () => {
			const state: State = {
				nodes: [{ id: "n1", name: "A" }],
				links: [{ id: "l1", source: "n1", target: "missing", value: 0 }],
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
					{ id: "l1", source: "n1", target: "n2", value: 1 },
					{ id: "l2", source: "n2", target: "n1", value: -1 },
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
