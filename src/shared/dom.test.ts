// @vitest-environment happy-dom

import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { isElement, isHTMLElement } from "./dom";

describe("isElement", () => {
	it("is true for an Element", () => {
		expect(isElement(document.createElement("div"))).toBe(true);
	});

	it("is false for a non-Element EventTarget (e.g. window)", () => {
		expect(isElement(window)).toBe(false);
	});

	it("is false for null", () => {
		expect(isElement(null)).toBe(false);
	});

	it("is true for an Element created by a different window/realm", () => {
		// The whole point of these helpers: `instanceof Element` compares
		// constructor identity, which a foreign realm's Element doesn't share —
		// isElement duck-types on `nodeType` instead, so it stays correct
		// regardless of which window constructed the node.
		const otherWindow = new Window();
		const otherEl = otherWindow.document.createElement("div");
		expect(isElement(otherEl as unknown as EventTarget)).toBe(true);
	});
});

describe("isHTMLElement", () => {
	it("is true for an HTMLElement", () => {
		expect(isHTMLElement(document.createElement("button"))).toBe(true);
	});

	it("is false for an Element-shaped object with no dataset", () => {
		// Real SVG/MathML elements have `dataset` too (the mixin applies to
		// every element category), so this fakes the one shape isHTMLElement
		// is actually meant to exclude, to prove the `dataset` check
		// contributes something beyond isElement's own nodeType check.
		const elementWithoutDataset = { nodeType: 1 } as unknown as EventTarget;
		expect(isHTMLElement(elementWithoutDataset)).toBe(false);
	});

	it("is false for null", () => {
		expect(isHTMLElement(null)).toBe(false);
	});
});
