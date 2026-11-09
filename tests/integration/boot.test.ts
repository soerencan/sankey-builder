// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { startApp } from "../../src/app/start-app";
import { PREVIEW_HEIGHT_STORAGE_KEY } from "../../src/features/diagram/preview-resizer";
import {
	accessibleName,
	byRole,
	click,
	getStoredState,
	installMarkup,
	mountApp,
	requireElement,
	tick,
} from "../helpers/mount-app";

describe("application boot", () => {
	it("static markup leaves #app empty — production markup comes from startApp() itself", () => {
		installMarkup();

		expect(document.getElementById("app")).not.toBeNull();
		expect(document.getElementById("app")?.children).toHaveLength(0);
		expect(document.querySelector(".app-header")).toBeNull();
		expect(document.querySelector(".diagram-panel")).toBeNull();
		expect(document.querySelector(".data-card")).toBeNull();
	});

	it("orders the header, notices, diagram, data actions, editors, and footer in the document", () => {
		mountApp();

		const sections = [
			".app-header",
			".notice-region",
			".diagram-panel",
			".data-card-actions",
			"#node-editor",
			"#link-editor",
			".app-footer",
		].map((selector) => requireElement<HTMLElement>(selector));
		for (let index = 1; index < sections.length; index++) {
			expect(
				sections[index - 1].compareDocumentPosition(sections[index]) &
					Node.DOCUMENT_POSITION_FOLLOWING,
			).toBeTruthy();
		}
	});

	it("gives page sections an ordered heading hierarchy and matching accessible names", () => {
		mountApp();
		const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
			.filter((heading) => !heading.closest("dialog"))
			.map((heading) => [heading.tagName, heading.textContent]);
		expect(headings).toEqual([
			["H1", "Sankey Builder"],
			["H2", "Diagram"],
			["H2", "Data"],
			["H3", "Nodes"],
			["H3", "Links"],
		]);
		for (const [selector, name] of [
			[".diagram-panel", "Diagram"],
			["#data-panel", "Data"],
			["#node-editor", "Nodes"],
			["#link-editor", "Links"],
		]) {
			const section = requireElement<HTMLElement>(selector);
			expect(section.tagName).toBe("SECTION");
			const headingId = section.getAttribute("aria-labelledby");
			expect(headingId).not.toBeNull();
			const heading = document.getElementById(headingId ?? "");
			expect(heading).not.toBeNull();
			expect(section.contains(heading)).toBe(true);
			expect(accessibleName(section)).toBe(name);
		}
	});

	it.each([
		["Theme: System", "Theme"],
		["Appearance", "Appearance"],
		["Export diagram", "Export diagram"],
	])("opening %s preserves the page banner and labels the dialog", (trigger, heading) => {
		mountApp();
		click(byRole(document, "button", trigger));
		const dialog = requireElement<HTMLDialogElement>("dialog[open]");
		expect(accessibleName(dialog)).toBe(heading);
		expect(dialog.querySelector("h3")?.textContent).toBe(heading);
		// Safari's audit treats a header inside a dialog as another page banner.
		expect(dialog.querySelector('header, [role="banner"]')).toBeNull();
		expect(document.querySelectorAll(".app-header")).toHaveLength(1);
	});

	it("resizes only the preview through the splitter controls", async () => {
		mountApp();

		const diagram = document.getElementById("diagram");
		const viewBoxBefore = diagram?.querySelector("svg")?.getAttribute("viewBox");
		click(byRole(document, "button", "Make diagram preview larger"));
		// The custom-property write lands in a layout effect on the next render.
		await tick();

		expect(diagram?.style.getPropertyValue("--diagram-preview-height")).toBe("400px");
		expect(diagram?.querySelector("svg")?.getAttribute("viewBox")).toBe(viewBoxBefore);
		expect(localStorage.getItem(PREVIEW_HEIGHT_STORAGE_KEY)).toBe("400");
		expect(getStoredState().settings.aspectRatio).toBe("16:9");
	});

	it("boots without throwing and renders the default diagram", () => {
		expect(() => {
			mountApp();
		}).not.toThrow();

		const diagram = document.getElementById("diagram");
		expect(diagram?.querySelector("svg")).not.toBeNull();

		expect(diagram?.querySelectorAll("svg rect")).toHaveLength(6);
		expect(diagram?.querySelectorAll("svg path")).toHaveLength(5);
		expect(document.querySelectorAll("#node-editor .node-row")).toHaveLength(6);
		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(5);
	});

	it("throws a useful error naming the missing root when the static #app mount is absent", () => {
		installMarkup();
		document.getElementById("app")?.remove();

		expect(() => startApp(document)).toThrow(/#app/);
	});
});
