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
	it("returns the real d3 scheme array for each palette", () => {
		expect(paletteColors("observable10")).toEqual(schemeObservable10);
		expect(paletteColors("tableau10")).toEqual(schemeTableau10);
		expect(paletteColors("category10")).toEqual(schemeCategory10);
		expect(paletteColors("set2")).toEqual(schemeSet2);
		expect(paletteColors("dark2")).toEqual(schemeDark2);
	});
});
