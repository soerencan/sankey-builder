import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Resolved from this file's own location, not process.cwd(), so it's stable
// regardless of which directory vitest is invoked from.
const VENDOR_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../vendor");

let loaded = false;

/**
 * Loads the real vendored SortableJS UMD build into the global scope, for
 * tests that need the actual constructor/options wiring rather than a
 * hand-rolled stand-in. Idempotent — safe to call from more than one test
 * file without double-registering. Mirrors loadD3Global (./d3-global.ts).
 */
export function loadSortableGlobal(): void {
	if (loaded) return;
	// Indirect eval, same rationale as loadD3Global: runs the UMD wrapper as
	// global code so its `this = self` / `typeof module` feature-detection
	// resolves against globalThis rather than this module's own scope.
	// biome-ignore lint/security/noGlobalEval: intentionally loading a vendored UMD global for tests
	const globalEval = eval;
	globalEval(readFileSync(resolve(VENDOR_DIR, "sortable.min.js"), "utf8"));
	loaded = true;
}
