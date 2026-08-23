// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { startApp } from "../../src/app/start-app";
import { PREVIEW_HEIGHT_STORAGE_KEY } from "../../src/features/diagram/preview-resizer";
import { click, getStoredState, installMarkup, mountApp } from "../helpers/mount-app";

describe("application boot", () => {
	it("places the diagram before the data editor and has no obsolete resize control", () => {
		installMarkup();

		const diagramPanel = document.querySelector(".diagram-panel");
		const dataCard = document.querySelector(".data-card");
		expect(diagramPanel).not.toBeNull();
		expect(dataCard).not.toBeNull();
		expect(
			diagramPanel && dataCard
				? diagramPanel.compareDocumentPosition(dataCard) & Node.DOCUMENT_POSITION_FOLLOWING
				: 0,
		).toBeTruthy();
		expect(document.getElementById("resizer")).toBeNull();
	});

	it("resizes only the preview through the splitter controls", () => {
		mountApp();

		const diagram = document.getElementById("diagram");
		const viewBoxBefore = diagram?.querySelector("svg")?.getAttribute("viewBox");
		click(document.querySelector('[data-action="preview-larger"]'));

		expect(diagram?.style.getPropertyValue("--diagram-preview-height")).toBe("400px");
		expect(diagram?.querySelector("svg")?.getAttribute("viewBox")).toBe(viewBoxBefore);
		expect(localStorage.getItem(PREVIEW_HEIGHT_STORAGE_KEY)).toBe("400");
		expect(getStoredState().settings.aspectRatio).toBe("2:1");
	});

	it("boots without throwing and renders the default diagram", () => {
		expect(() => {
			mountApp();
		}).not.toThrow();

		const diagram = document.getElementById("diagram");
		expect(diagram?.querySelector("svg")).not.toBeNull();

		// defaultState (src/model/graph.ts) has 4 nodes / 3 links.
		expect(diagram?.querySelectorAll("svg rect")).toHaveLength(4);
		expect(diagram?.querySelectorAll("svg path")).toHaveLength(3);
		expect(document.querySelectorAll("#node-editor .node-row")).toHaveLength(4);
		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(3);
	});

	it("throws a useful error naming the missing root when a required static root is absent", () => {
		installMarkup();
		document.getElementById("error")?.remove();

		expect(() => startApp(document)).toThrow(/#error/);
	});
});
