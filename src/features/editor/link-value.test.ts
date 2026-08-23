import { describe, expect, it } from "vitest";
import { MAX_LINK_VALUE } from "../../model/validation";
import { exceedsFractionDigits, parseLinkValue, truncateFractionDigits } from "./link-value";

describe("parseLinkValue", () => {
	it.each<[string, string, ReturnType<typeof parseLinkValue>]>([
		["empty string", "", { kind: "empty" }],
		["whitespace-only string", "   ", { kind: "empty" }],
		["plain integer", "42", { kind: "valid", value: 42 }],
		["decimal", "3.14", { kind: "valid", value: 3.14 }],
		["trailing-dot integer", "5.", { kind: "valid", value: 5 }],
		["leading-dot fraction", ".5", { kind: "valid", value: 0.5 }],
		["value with surrounding whitespace", "  7  ", { kind: "valid", value: 7 }],
		["exactly 4 fractional digits", "0.1234", { kind: "valid", value: 0.1234 }],
		["exactly the cap", "1000000000000000", { kind: "valid", value: MAX_LINK_VALUE }],
		["zero", "0", { kind: "invalid" }],
		["all-zero decimal", "0.0000", { kind: "invalid" }],
		["negative value", "-1", { kind: "invalid" }],
		["exponent notation", "1e5", { kind: "invalid" }],
		["more than 4 fractional digits", "0.12345", { kind: "invalid" }],
		["thousands separator", "1,000", { kind: "invalid" }],
		["inner whitespace", "1 0", { kind: "invalid" }],
		["non-numeric text", "abc", { kind: "invalid" }],
		["bare dot", ".", { kind: "invalid" }],
		["value above the cap", "1000000000000001", { kind: "invalid" }],
	])("parses %s (%j) as %j", (_label, input, expected) => {
		expect(parseLinkValue(input)).toEqual(expected);
	});
});

describe("exceedsFractionDigits", () => {
	it.each<[string, boolean]>([
		["1.23456", true],
		["1.2345", false],
		["12345", false],
		["1.2.3456", false],
	])("%j exceeds 4 fraction digits: %s", (input, expected) => {
		expect(exceedsFractionDigits(input)).toBe(expected);
	});
});

describe("truncateFractionDigits", () => {
	it.each<[string, string]>([
		["1.23456789", "1.2345"],
		["1.23", "1.23"],
		["100", "100"],
	])("truncates %j to %j", (input, expected) => {
		expect(truncateFractionDigits(input)).toBe(expected);
	});
});
