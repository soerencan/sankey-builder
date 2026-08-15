import { describe, expect, it } from "vitest";
import type { State } from "../src/state";
import { defaultState } from "../src/state";
import { MAX_LINK_VALUE, validate } from "../src/validate";

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
			// persist.ts normally prunes dangling links before validate ever sees
			// the state, but validate is defensive here too: DFS only starts from
			// `state.nodes`, and a dangling target has no outgoing edges of its
			// own, so it can never close a cycle back to itself.
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
