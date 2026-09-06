/**
 * Lives in settings, not diagram: both the swatch previews and the node
 * colour resolver need this table, and settings must not depend on diagram.
 * Only this file imports d3-scale-chromatic.
 */

import {
	schemeCategory10,
	schemeDark2,
	schemeObservable10,
	schemeSet2,
	schemeTableau10,
} from "d3-scale-chromatic";
import type { Palette } from "../../model/settings";

const PALETTES: Record<Palette, readonly string[]> = {
	observable10: schemeObservable10,
	tableau10: schemeTableau10,
	category10: schemeCategory10,
	set2: schemeSet2,
	dark2: schemeDark2,
};

export function paletteColors(key: Palette): readonly string[] {
	return PALETTES[key];
}
