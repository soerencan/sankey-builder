// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { startApp } from "../../src/app/start-app";
import { PREVIEW_HEIGHT_STORAGE_KEY } from "../../src/features/diagram/preview-resizer";
import { byRole, click, getStoredState, installMarkup, mountApp, tick } from "../helpers/mount-app";

describe("application boot", () => {
	it("static markup is only the icon sprite and the #app mount — production markup comes from startApp() itself", () => {
		installMarkup();

		expect(document.getElementById("app")).not.toBeNull();
		expect(document.getElementById("app")?.children).toHaveLength(0);
		expect(document.querySelector("svg[hidden] symbol")).not.toBeNull();
		// Nothing of the booted app (header, notices, diagram/data panels) is
		// present until startApp() itself renders it.
		expect(document.querySelector(".app-header")).toBeNull();
		expect(document.querySelector(".diagram-panel")).toBeNull();
		expect(document.querySelector(".data-card")).toBeNull();
	});

	it("places the diagram before the data editor", () => {
		mountApp();

		const diagramPanel = document.querySelector(".diagram-panel");
		const dataCard = document.querySelector(".data-card");
		expect(diagramPanel).not.toBeNull();
		expect(dataCard).not.toBeNull();
		expect(
			diagramPanel && dataCard
				? diagramPanel.compareDocumentPosition(dataCard) & Node.DOCUMENT_POSITION_FOLLOWING
				: 0,
		).toBeTruthy();
	});

	it("resizes only the preview through the splitter controls", async () => {
		mountApp();

		const diagram = document.getElementById("diagram");
		const viewBoxBefore = diagram?.querySelector("svg")?.getAttribute("viewBox");
		click(byRole(document, "button", "Make diagram preview larger"));
		// PreviewResizer's CSS custom-property write happens in a layout effect,
		// on the next render.
		await tick();

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

	it("throws a useful error naming the missing root when the static #app mount is absent", () => {
		installMarkup();
		document.getElementById("app")?.remove();

		expect(() => startApp(document)).toThrow(/#app/);
	});
});
