// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { defaultState } from "../../model/graph";
import { renderNodeEditor, updateNodeSwatches } from "./node-editor";

describe("updateNodeSwatches", () => {
	it("restyles swatches without throwing when a node id contains selector-breaking characters", () => {
		document.body.innerHTML = '<div id="node-editor"></div>';
		const state = defaultState();
		// Imported ids are arbitrary strings — a quote/backslash here would
		// throw from querySelector if the id were interpolated straight into a
		// `[data-id="..."]` attribute selector.
		state.nodes[0].id = 'n"1\\';
		state.links = [];
		renderNodeEditor(
			document,
			state,
			() => "#000000",
			() => {},
			null,
		);

		expect(() => updateNodeSwatches(document, state, () => "#123456")).not.toThrow();

		const swatch = document.querySelector<HTMLElement>(".node-swatch");
		expect(swatch?.style.backgroundColor).toBe("#123456");
	});
});
