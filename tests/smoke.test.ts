// @vitest-environment happy-dom

import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEY } from "../src/persist";
import { loadD3Global } from "./helpers/d3-global";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Pinned verbatim from src/main.ts's STORAGE_NOTICE — main.ts doesn't export
// it, so this hardcodes (and thereby pins) the user-visible copy.
const STORAGE_NOTICE =
	"Changes can't be saved in this browser right now (storage may be full or unavailable). " +
	"The diagram keeps working, but edits won't survive closing or reloading this tab — " +
	"try freeing up space or leaving private/incognito mode.";

let bundle: string;
let bodyMarkup: string;
let tempDir: string;

beforeAll(async () => {
	loadD3Global();

	// A fresh scratch build, never the committed app.js — the whole point of
	// this test is to catch a stale/missing bundle that `make check`'s cmp
	// guard hasn't run yet. Built via the same "bundle" script the build,
	// watch, and freshness Makefile targets use, so the esbuild option set
	// can't drift from what actually produced the committed artifact.
	tempDir = await mkdtemp(join(tmpdir(), "sankey-builder-smoke-"));
	const outfile = join(tempDir, "app.js");
	execFileSync("bun", ["run", "bundle", `--outfile=${outfile}`], { cwd: REPO_ROOT });
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

	it("keeps the last-good diagram and focus on an invalid edit, then recovers on fix", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const svgBefore = document.querySelector("#diagram svg");
		expect(svgBefore).not.toBeNull();

		// First link (n1 "Coal" -> n3 "Electricity", value 10 in defaultState).
		const valueInput = document.querySelector<HTMLInputElement>('.link-value[data-index="0"]');
		expect(valueInput).not.toBeNull();
		if (!valueInput) throw new Error("unreachable");

		valueInput.value = "";
		valueInput.dispatchEvent(new Event("input", { bubbles: true }));

		expect(document.getElementById("error")?.textContent).toBe(
			"Link 1 (Coal to Electricity) needs a value greater than 0.",
		);

		// Diagram untouched: same svg reference, still the last-good 4 rects —
		// renderDiagram never ran (refresh bails before it on an invalid state).
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);
		expect(document.querySelectorAll("#diagram svg rect")).toHaveLength(4);

		// Link editor untouched: updateLinkValue's refresh() call passes
		// rebuildLinks: false, so the input the user is typing in survives —
		// the same reference is still attached to the document.
		expect(document.contains(valueInput)).toBe(true);

		// Still persisted despite being invalid — save-regardless-of-validity —
		// and the blank value round-trips through JSON.stringify as null.
		const midEditStored = localStorage.getItem(STORAGE_KEY);
		expect(midEditStored).not.toBeNull();
		const midEditParsed = JSON.parse(midEditStored ?? "{}");
		expect(midEditParsed.links[0].value).toBeNull();

		valueInput.value = "10";
		valueInput.dispatchEvent(new Event("input", { bubbles: true }));

		expect(document.getElementById("error")?.textContent).toBe("");
		// renderDiagram clears #diagram and rebuilds from scratch, so the fixed
		// state produces a fresh svg rather than reusing the old element.
		const svgAfter = document.querySelector("#diagram svg");
		expect(svgAfter).not.toBeNull();
		expect(svgAfter).not.toBe(svgBefore);
		expect(document.querySelectorAll("#diagram svg rect")).toHaveLength(4);
	});

	it("surfaces a storage notice on save failure and clears it once saves recover", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const notice = () => document.getElementById("storage-notice")?.textContent;
		expect(notice()).toBe("");

		const addNodeButton = document.querySelector<HTMLButtonElement>('[data-action="add-node"]');
		expect(addNodeButton).not.toBeNull();

		// happy-dom's Storage binds each method onto an internal target the
		// first time it's accessed (see happy-dom's ClassMethodBinder), and by
		// this point the earlier tests in this file have already forced that —
		// so `vi.spyOn(Storage.prototype, "setItem")` silently stops taking
		// effect. Swapping the whole `localStorage` global for a throwing stub
		// sidesteps that caching rather than fighting it.
		const originalLocalStorage = localStorage;
		const throwingStorage: Partial<Storage> = {
			setItem: () => {
				throw new Error("QuotaExceededError");
			},
		};
		Object.defineProperty(globalThis, "localStorage", {
			value: throwingStorage,
			configurable: true,
			writable: true,
		});
		try {
			addNodeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
			expect(notice()).toBe(STORAGE_NOTICE);
		} finally {
			Object.defineProperty(globalThis, "localStorage", {
				value: originalLocalStorage,
				configurable: true,
				writable: true,
			});
		}

		// The failed save above still rebuilt the node editor (editors rebuild
		// regardless of validity), which tore down and recreated the button —
		// re-query rather than reuse the now-detached reference.
		const addNodeButtonAfterFailure = document.querySelector<HTMLButtonElement>(
			'[data-action="add-node"]',
		);
		addNodeButtonAfterFailure?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(notice()).toBe("");
	});
});
