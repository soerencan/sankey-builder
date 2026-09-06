import { describe, expect, it } from "vitest";
import {
	ASPECT_RATIO_OPTIONS,
	DEFAULT_SETTINGS,
	DIAGRAM_SETTING_KEYS,
	SETTING_DOMAINS,
	aspectRatioOption,
	isSettingValue,
	pickDiagramSettings,
} from "./settings";

// Deliberately imports nothing from features/diagram/colors.ts: proves
// settings.ts stays d3-free at module-eval and call time.

const SETTING_KEYS = Object.keys(SETTING_DOMAINS) as (keyof typeof SETTING_DOMAINS)[];

describe.each(SETTING_KEYS)("isSettingValue(%j, value)", (key) => {
	const values = SETTING_DOMAINS[key];
	const ownValues = new Set<string>(values);

	it.each(values.map((value) => [value] as const))("accepts %j", (value) => {
		expect(isSettingValue(key, value)).toBe(true);
	});

	it.each<[unknown]>([
		["not-a-real-value"],
		// Would resolve through Object.prototype on a naive `in` check.
		["toString"],
		[undefined],
		[null],
		[42],
		[{}],
	])("rejects %j", (value) => {
		expect(isSettingValue(key, value)).toBe(false);
	});

	// A value from another setting's domain must not pass here, unless it also
	// happens to be one of this key's own values (none do today; the filter
	// keeps the assertion correct if that ever changes).
	const foreignValues = SETTING_KEYS.filter((otherKey) => otherKey !== key)
		.flatMap((otherKey): readonly string[] => SETTING_DOMAINS[otherKey])
		.filter((value) => !ownValues.has(value));

	it.each(foreignValues.map((value) => [value] as const))(
		"rejects %j from another setting's domain",
		(value) => {
			expect(isSettingValue(key, value)).toBe(false);
		},
	);
});

describe("aspectRatioOption", () => {
	it("returns the matching option for every value in ASPECT_RATIO_OPTIONS", () => {
		for (const option of ASPECT_RATIO_OPTIONS) {
			expect(aspectRatioOption(option.value)).toBe(option);
		}
	});

	it("contains every aspect ratio value exactly once", () => {
		const values = ASPECT_RATIO_OPTIONS.map((option) => option.value);
		expect(new Set(values).size).toBe(values.length);
	});
});

describe("DEFAULT_SETTINGS", () => {
	it("has the expected default value for every setting", () => {
		expect(DEFAULT_SETTINGS).toEqual({
			palette: "observable10",
			linkColor: "source-target",
			alignment: "justify",
			aspectRatio: "2:1",
			theme: "auto",
		});
	});

	it("has a default that is one of the domain's allowed values, for every setting", () => {
		for (const key of Object.keys(SETTING_DOMAINS) as (keyof typeof SETTING_DOMAINS)[]) {
			expect(SETTING_DOMAINS[key]).toContain(DEFAULT_SETTINGS[key]);
		}
	});
});

describe("DIAGRAM_SETTING_KEYS", () => {
	it("is every settings key except theme", () => {
		expect(new Set(DIAGRAM_SETTING_KEYS)).toEqual(
			new Set(Object.keys(SETTING_DOMAINS).filter((key) => key !== "theme")),
		);
	});
});

describe("pickDiagramSettings", () => {
	it("keeps the four diagram keys and drops theme", () => {
		const picked = pickDiagramSettings(DEFAULT_SETTINGS);
		expect(picked).toEqual({
			palette: DEFAULT_SETTINGS.palette,
			linkColor: DEFAULT_SETTINGS.linkColor,
			alignment: DEFAULT_SETTINGS.alignment,
			aspectRatio: DEFAULT_SETTINGS.aspectRatio,
		});
		expect(picked).not.toHaveProperty("theme");
	});
});
