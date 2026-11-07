import {
	schemeCategory10,
	schemeDark2,
	schemeObservable10,
	schemeSet2,
	schemeTableau10,
} from "d3-scale-chromatic";
import { describe, expect, it } from "vitest";
import { paletteColors } from "./palettes";

describe("paletteColors", () => {
	it("uses the first eight colors of each d3 palette", () => {
		expect(paletteColors("observable10")).toEqual(schemeObservable10.slice(0, 8));
		expect(paletteColors("tableau10")).toEqual(schemeTableau10.slice(0, 8));
		expect(paletteColors("category10")).toEqual(schemeCategory10.slice(0, 8));
		expect(paletteColors("set2")).toEqual(schemeSet2);
		expect(paletteColors("dark2")).toEqual(schemeDark2);
	});
});
