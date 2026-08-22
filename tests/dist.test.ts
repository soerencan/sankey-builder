// @vitest-environment happy-dom

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { stripToBodyMarkup } from "./helpers/fixture";

// Resolved from this file's own location, not process.cwd(), so it's stable
// regardless of which directory vitest is invoked from.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST_DIR = join(REPO_ROOT, "dist");

let distHtml: string;

/**
 * Extracts every `<link ... href="...">` / `<script ... src="...">`
 * reference from the built HTML — external or not. Callers assert externality
 * themselves (rather than this function silently dropping externals), so a
 * regression that reintroduces a CDN reference fails loudly instead of just
 * vanishing from the list.
 */
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

/** True for scheme-relative (`//host/...`) or absolute (`https://...`) URLs. */
function isExternal(ref: string): boolean {
	return /^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith("//");
}

beforeAll(() => {
	// The canonical clean production build — same command CI's artifact job
	// runs via `make test-dist` — so this test exercises exactly what ships.
	execFileSync("bun", ["run", "build"], { cwd: REPO_ROOT });
	distHtml = readFileSync(join(DIST_DIR, "index.html"), "utf8");
});

describe("production build (dist/)", () => {
	it("references only relative local assets that exist and stay under the site subpath", () => {
		const refs = assetRefs(distHtml);
		expect(refs.length).toBeGreaterThan(0);

		for (const ref of refs) {
			// No CDN/external references — everything the build emits must be
			// local, so the site works with zero runtime third-party trust.
			expect(isExternal(ref)).toBe(false);
			expect(ref.startsWith("/")).toBe(false);
			expect(existsSync(join(DIST_DIR, ref))).toBe(true);

			// A relative URL must resolve underneath whatever subpath the site is
			// hosted at (e.g. GitHub Pages project sites), not escape it.
			const resolved = new URL(ref, "https://example.test/sankey-builder/");
			expect(resolved.pathname.startsWith("/sankey-builder/")).toBe(true);
		}
	});

	it("includes THIRD_PARTY_LICENSES.md", () => {
		expect(existsSync(join(DIST_DIR, "THIRD_PARTY_LICENSES.md"))).toBe(true);
	});

	it("boots the emitted entry against the built markup and renders the default diagram", async () => {
		// startApp() (invoked by the entry's own top-level call, not a manual
		// re-invocation here) runs on import — see src/main.ts — so the fixture
		// document must be installed and already be the global happy-dom
		// document (per the @vitest-environment pragma above) before the
		// dynamic import below executes.
		document.body.innerHTML = stripToBodyMarkup(distHtml);

		const entryRef = assetRefs(distHtml).find((ref) => !isExternal(ref) && ref.endsWith(".js"));
		if (!entryRef) throw new Error("dist/index.html has no local script entry");

		// Rejection fails the test on its own — no wrapping matcher needed.
		await import(pathToFileURL(join(DIST_DIR, entryRef)).href);

		const diagram = document.getElementById("diagram");
		// defaultState (src/state.ts) has 4 nodes / 3 links — mirrors
		// tests/app.test.ts's "boots without throwing" assertions.
		expect(diagram?.querySelector("svg")).not.toBeNull();
		expect(diagram?.querySelectorAll("svg rect")).toHaveLength(4);
		expect(diagram?.querySelectorAll("svg path")).toHaveLength(3);
		expect(document.querySelectorAll("#node-editor .node-row")).toHaveLength(4);
		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(3);
	});
});
