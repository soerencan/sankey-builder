import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Resolved from this file's own location, not process.cwd(), so it's stable
// regardless of which directory vitest is invoked from.
const VENDOR_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../vendor");

let loaded = false;

/**
 * Loads the real vendored d3 + d3-sankey UMD builds into the global scope,
 * for tests that need actual d3 behavior (real schemes, a real scaleOrdinal)
 * rather than a hand-rolled stand-in. Idempotent — safe to call from more
 * than one test file without double-registering.
 */
export function loadD3Global(): void {
	if (loaded) return;
	// Indirect eval (calling `eval` through a reference rather than the bare
	// identifier) runs the vendored code as global code rather than in this
	// module's local scope: the UMD wrapper's `this` then resolves to
	// globalThis, and its `typeof module`/`typeof exports` feature-detection
	// sees them as undeclared globals rather than this module's own bindings —
	// both required for the UMD branch that assigns `globalThis.d3` to
	// actually fire.
	// biome-ignore lint/security/noGlobalEval: intentionally loading vendored UMD globals for tests
	const globalEval = eval;
	globalEval(readFileSync(resolve(VENDOR_DIR, "d3.min.js"), "utf8"));
	globalEval(readFileSync(resolve(VENDOR_DIR, "d3-sankey.min.js"), "utf8"));
	loaded = true;
}
