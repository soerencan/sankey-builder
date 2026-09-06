// @vitest-environment happy-dom

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { stripToBodyMarkup } from "../helpers/fixture";

// Resolved from this file's own location, not process.cwd(), so it's stable
// regardless of which directory vitest is invoked from.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIST_DIR = join(REPO_ROOT, "dist");

let distHtml: string;

/** Returns external references too, so a reintroduced CDN reference fails an assertion instead of vanishing from the list. */
function assetRefs(html: string): string[] {
	const refs: string[] = [];
	const tagPattern = /<(?:link|script)\b[^>]*>/gi;
	const attrPattern = /\b(?:href|src)="([^"]+)"/i;
	for (const tag of html.match(tagPattern) ?? []) {
		const match = attrPattern.exec(tag);
		if (match) refs.push(match[1]);
	}
	return refs;
}

function isExternal(ref: string): boolean {
	return /^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith("//");
}

beforeAll(() => {
	// The same build CI's artifact job ships.
	execFileSync("bun", ["run", "build"], { cwd: REPO_ROOT });
	distHtml = readFileSync(join(DIST_DIR, "index.html"), "utf8");
});

describe("production build (dist/)", () => {
	it("references only relative local assets that exist and stay under the site subpath", () => {
		const refs = assetRefs(distHtml);
		expect(refs.length).toBeGreaterThan(0);

		for (const ref of refs) {
			// Everything must be local: no runtime third-party trust.
			expect(isExternal(ref)).toBe(false);
			expect(ref.startsWith("/")).toBe(false);
			expect(existsSync(join(DIST_DIR, ref))).toBe(true);

			// Must stay under whatever subpath the site is hosted at (GitHub
			// Pages project sites).
			const resolved = new URL(ref, "https://example.test/sankey-builder/");
			expect(resolved.pathname.startsWith("/sankey-builder/")).toBe(true);
		}
	});

	it("includes the generated third-party licenses page the footer links to", () => {
		const footerLink = /<a href="([^"]+)">Third-party licenses<\/a>/.exec(distHtml)?.[1];
		expect(footerLink).toBeDefined();
		const notices = readFileSync(join(DIST_DIR, footerLink as string), "utf8");
		for (const name of [
			"d3-sankey",
			"d3-scale-chromatic",
			"d3-selection",
			"preact",
			"sortablejs",
		]) {
			expect(notices).toContain(`<h2>${name} `);
		}

		// Guards against the ordinal scale (and its d3 dependents) creeping
		// back in now that colors.ts uses a plain index lookup instead.
		for (const name of ["d3-scale", "d3-format", "d3-time", "d3-time-format"]) {
			expect(notices).not.toContain(`<h2>${name} `);
		}
	});

	it("boots the emitted entry against the built markup and renders the default diagram", async () => {
		// The entry calls startApp() at import time, so the markup must be in
		// place before the dynamic import below.
		document.body.innerHTML = stripToBodyMarkup(distHtml);

		const entryRef = assetRefs(distHtml).find((ref) => !isExternal(ref) && ref.endsWith(".js"));
		if (!entryRef) throw new Error("dist/index.html has no local script entry");

		await import(pathToFileURL(join(DIST_DIR, entryRef)).href);

		const diagram = document.getElementById("diagram");
		// defaultState has 4 nodes / 3 links.
		expect(diagram?.querySelector("svg")).not.toBeNull();
		expect(diagram?.querySelectorAll("svg rect")).toHaveLength(4);
		expect(diagram?.querySelectorAll("svg path")).toHaveLength(3);
		expect(document.querySelectorAll("#node-editor .node-row")).toHaveLength(4);
		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(3);
	});
});
