// Closed value set straight from the pre-migration bundle's PALETTES' keys.
// Defined here (not graph.ts) so platform/storage.ts's palette validation stays
// d3-free — features/diagram/colors.ts, which owns the actual d3 scheme arrays and ordinal-
// scale construction, imports this module rather than the other way around.
export type Palette = "observable10" | "tableau10" | "category10" | "set2" | "dark2";

/** Display order for the toolbar carousel — also features/diagram/colors.ts's PALETTES' full key set. */
export const PALETTE_ORDER: readonly Palette[] = [
	"observable10",
	"tableau10",
	"category10",
	"set2",
	"dark2",
];

/** Human-readable names, matching the labels index.html's palette chooser rows use. */
export const PALETTE_LABELS: Record<Palette, string> = {
	observable10: "Observable 10",
	tableau10: "Tableau 10",
	category10: "Category 10",
	set2: "Set 2",
	dark2: "Dark 2",
};

/**
 * Own-property guard against the prototype chain (e.g. a palette key of
 * "toString" resolving to `Object.prototype.toString` instead of failing
 * the lookup) — mirrors the pre-migration bundle's `Object.hasOwn(PALETTES,
 * ...)` checks. Checked against PALETTE_LABELS rather than features/diagram/colors.ts's
 * PALETTES map (same key set either way) so this stays callable without
 * importing features/diagram/colors.ts (or the `d3` it pulls in) — platform/storage.ts depends on that.
 */
export function isPaletteKey(key: unknown): key is Palette {
	return typeof key === "string" && Object.hasOwn(PALETTE_LABELS, key);
}
