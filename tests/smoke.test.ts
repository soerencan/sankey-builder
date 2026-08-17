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

	it("leaves state untouched on empty/invalid value edits and restores the text on blur", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const svgBefore = document.querySelector("#diagram svg");
		expect(svgBefore).not.toBeNull();

		// First link (n1 "Coal" -> n3 "Electricity", value 10 in defaultState).
		const valueInput = document.querySelector<HTMLInputElement>('.link-value[data-index="0"]');
		expect(valueInput).not.toBeNull();
		if (!valueInput) throw new Error("unreachable");

		// Emptying the field never reaches state: no error, no re-render, and
		// the stored value stays at defaultState's 10.
		valueInput.value = "";
		valueInput.dispatchEvent(new Event("input", { bubbles: true }));

		expect(document.getElementById("error")?.textContent).toBe("");
		expect(valueInput.hasAttribute("aria-invalid")).toBe(false);
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);
		expect(document.contains(valueInput)).toBe(true);
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").links[0].value).toBe(10);

		// An invalid string marks the field but still leaves state/storage alone.
		valueInput.value = "abc";
		valueInput.dispatchEvent(new Event("input", { bubbles: true }));

		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(document.getElementById("error")?.textContent).toBe("");
		expect(document.querySelector("#diagram svg")).toBe(svgBefore);
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").links[0].value).toBe(10);

		// Blur restores the last committed value and clears the marker.
		valueInput.dispatchEvent(new Event("change", { bubbles: true }));
		expect(valueInput.value).toBe("10");
		expect(valueInput.hasAttribute("aria-invalid")).toBe(false);

		// After a *valid* edit, blur must not rewrite the text — "5." parses to
		// 5 but the trailing dot is preserved so the user can keep typing.
		valueInput.value = "5.";
		valueInput.dispatchEvent(new Event("input", { bubbles: true }));
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").links[0].value).toBe(5);
		valueInput.dispatchEvent(new Event("change", { bubbles: true }));
		expect(valueInput.value).toBe("5.");
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").links[0].value).toBe(5);

		// A valid edit flows through to state, storage, and a fresh diagram.
		valueInput.value = "20";
		valueInput.dispatchEvent(new Event("input", { bubbles: true }));

		expect(document.getElementById("error")?.textContent).toBe("");
		const svgAfter = document.querySelector("#diagram svg");
		expect(svgAfter).not.toBeNull();
		expect(svgAfter).not.toBe(svgBefore);
		expect(document.querySelectorAll("#diagram svg rect")).toHaveLength(4);
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").links[0].value).toBe(20);
	});

	it("intercepts the 4-decimal cap at beforeinput (block keystroke, truncate paste)", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		const valueInput = document.querySelector<HTMLInputElement>('.link-value[data-index="0"]');
		if (!valueInput) throw new Error("unreachable");

		// happy-dom does not run the native editing pipeline for beforeinput, so
		// these assert defaultPrevented (+ programmatic effects the handler
		// applies itself), never a value the browser would have inserted.
		const beforeinput = (init: InputEventInit) => {
			const ev = new InputEvent("beforeinput", { bubbles: true, cancelable: true, ...init });
			valueInput.dispatchEvent(ev);
			return ev;
		};

		// Typing a 5th fractional digit onto an at-cap value is blocked.
		valueInput.value = "1.2345";
		valueInput.setSelectionRange(6, 6);
		expect(beforeinput({ inputType: "insertText", data: "6" }).defaultPrevented).toBe(true);
		expect(valueInput.value).toBe("1.2345");

		// Typing the 4th fractional digit stays under the cap and is allowed.
		valueInput.value = "1.234";
		valueInput.setSelectionRange(5, 5);
		expect(beforeinput({ inputType: "insertText", data: "5" }).defaultPrevented).toBe(false);

		// Deletions carry no data and are never intercepted, even from an
		// over-precise legacy value.
		valueInput.value = "1.23456";
		valueInput.setSelectionRange(7, 7);
		expect(beforeinput({ inputType: "deleteContentBackward", data: null }).defaultPrevented).toBe(
			false,
		);

		// An over-precise paste is truncated (not rounded) to 4 fractional digits
		// and committed straight to state/storage.
		valueInput.value = "";
		valueInput.setSelectionRange(0, 0);
		expect(beforeinput({ inputType: "insertFromPaste", data: "1.23456789" }).defaultPrevented).toBe(
			true,
		);
		expect(valueInput.value).toBe("1.2345");
		// Caret lands at the end of the inserted region, clamped to the clip point.
		expect(valueInput.selectionStart).toBe(6);
		expect(valueInput.hasAttribute("aria-invalid")).toBe(false);
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").links[0].value).toBe(1.2345);

		// A paste replacing a mid-string selection exercises the
		// slice+data+slice splice non-degenerately, then truncates the
		// over-precise spliced result.
		valueInput.value = "12.3400";
		valueInput.setSelectionRange(5, 7);
		expect(beforeinput({ inputType: "insertFromPaste", data: "56789" }).defaultPrevented).toBe(
			true,
		);
		expect(valueInput.value).toBe("12.3456");
		expect(valueInput.selectionStart).toBe(7);
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").links[0].value).toBe(12.3456);

		// A truncated paste that still lands invalid is highlighted, not silently
		// dropped: the field shows the truncated text but state/storage stay put.
		valueInput.value = "";
		valueInput.setSelectionRange(0, 0);
		expect(beforeinput({ inputType: "insertFromPaste", data: "0.00001" }).defaultPrevented).toBe(
			true,
		);
		expect(valueInput.value).toBe("0.0000");
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").links[0].value).toBe(12.3456);

		// A garbage paste is not intercepted — it falls through to the input
		// handler's highlight path.
		valueInput.value = "";
		valueInput.setSelectionRange(0, 0);
		expect(beforeinput({ inputType: "insertFromPaste", data: "abc" }).defaultPrevented).toBe(false);
		valueInput.value = "abc";
		valueInput.dispatchEvent(new Event("input", { bubbles: true }));
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");
	});

	it("Add link appends an unassigned row that stays inert until both endpoints are chosen", () => {
		// biome-ignore lint/security/noGlobalEval: intentionally evaluating the freshly built artifact
		const globalEval = eval;
		globalEval(bundle);

		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(3);
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(3);

		const addLinkButton = document.querySelector<HTMLButtonElement>('[data-action="add-link"]');
		expect(addLinkButton).not.toBeNull();
		addLinkButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		// New row appended with both endpoints on the placeholder; the diagram is
		// unchanged because the row is incomplete.
		expect(document.querySelectorAll("#link-editor .link-row")).toHaveLength(4);
		const source = () => document.querySelector<HTMLSelectElement>('.link-source[data-index="3"]');
		const target = () => document.querySelector<HTMLSelectElement>('.link-target[data-index="3"]');
		expect(source()?.value).toBe("");
		expect(target()?.value).toBe("");
		expect(source()?.querySelector('option[value=""]')?.textContent).toBe("— select —");
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(3);

		// The incomplete row is persisted end-to-end straight after the click.
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").links[3]).toEqual({
			source: null,
			target: null,
			value: 1,
		});

		// Choosing a source alone leaves the link incomplete — still no new flow.
		const chosenSource = source();
		if (!chosenSource) throw new Error("unreachable");
		chosenSource.value = "n1";
		chosenSource.dispatchEvent(new Event("change", { bubbles: true }));
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(3);

		// Choosing the target completes the link — the flow appears and persists.
		const chosenTarget = target();
		if (!chosenTarget) throw new Error("unreachable");
		chosenTarget.value = "n2";
		chosenTarget.dispatchEvent(new Event("change", { bubbles: true }));
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(4);

		const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
		expect(parsed.links[3]).toEqual({ source: "n1", target: "n2", value: 1 });

		// Un-assigning the source ("" → null) makes the row incomplete again —
		// the flow disappears and the null endpoint round-trips to storage.
		const clearedSource = source();
		if (!clearedSource) throw new Error("unreachable");
		clearedSource.value = "";
		clearedSource.dispatchEvent(new Event("change", { bubbles: true }));
		expect(document.querySelectorAll("#diagram svg path")).toHaveLength(3);
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").links[3].source).toBeNull();
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
