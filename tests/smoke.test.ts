// @vitest-environment happy-dom

import { readFileSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEY } from "../src/persist";
import { loadD3Global } from "./helpers/d3-global";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let bundle: string;
let bodyMarkup: string;
let tempDir: string;

beforeAll(async () => {
	loadD3Global();

	// A fresh scratch build, never the committed app.js — the whole point of
	// this test is to catch a stale/missing bundle that `make check`'s cmp
	// guard hasn't run yet.
	tempDir = await mkdtemp(join(tmpdir(), "sankey-builder-smoke-"));
	const outfile = join(tempDir, "app.js");
	await build({
		entryPoints: [join(REPO_ROOT, "src/main.ts")],
		bundle: true,
		format: "iife",
		minify: false,
		outfile,
	});
	bundle = readFileSync(outfile, "utf8");

	// Real markup, not a hand-rolled fixture, so the smoke test exercises the
	// actual element ids/structure — but strip the <script> tags, since
	// evaluating this bundle directly is the whole point.
	const html = readFileSync(join(REPO_ROOT, "index.html"), "utf8");
	const bodyMatch = /<body>([\s\S]*)<\/body>/.exec(html);
	if (!bodyMatch) throw new Error("index.html has no <body> to extract");
	bodyMarkup = bodyMatch[1].replace(/<script[\s\S]*?<\/script>\s*/g, "");
}, 30_000);

afterAll(() => {
	rmSync(tempDir, { recursive: true, force: true });
});

beforeEach(() => {
	document.body.innerHTML = bodyMarkup;
	localStorage.clear();
});

describe("artifact smoke test", () => {
	it("boots without throwing and renders the default diagram", () => {
		// Indirect eval, same pattern as the d3-global helper: runs as global
		// code so the IIFE's own top-level `init()` call executes against the
		// real `document`/`localStorage` rather than this module's scope.
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		expect(() => globalEval(bundle)).not.toThrow();

		const diagram = document.getElementById("diagram");
		expect(diagram?.querySelector("svg")).not.toBeNull();

		// defaultState (src/state.ts) has 4 nodes / 3 links.
		expect(diagram?.querySelectorAll("svg rect")).toHaveLength(4);
		expect(diagram?.querySelectorAll("svg path")).toHaveLength(3);
		expect(document.querySelectorAll("#node-editor .node-row")).toHaveLength(4);
		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(3);
	});

	it("round-trips a basic mutation: add node updates editor, diagram, and storage", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const addNodeButton = document.querySelector<HTMLButtonElement>('[data-action="add-node"]');
		expect(addNodeButton).not.toBeNull();
		addNodeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(document.querySelectorAll("#node-editor .node-row")).toHaveLength(5);
		expect(document.querySelectorAll("#diagram svg rect")).toHaveLength(5);

		const stored = localStorage.getItem(STORAGE_KEY);
		expect(stored).not.toBeNull();
		const parsed = JSON.parse(stored ?? "{}");
		expect(parsed.nodes.some((n: { id: string }) => n.id === "n5")).toBe(true);
	});
});
