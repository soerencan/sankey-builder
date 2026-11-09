import { MAX_LINK_VALUE } from "../../model/validation";

export type LinkValueInvalidReason = "format" | "precision" | "non-positive" | "above-maximum";

export type LinkValueParse =
	| { kind: "empty" }
	| { kind: "valid"; value: number }
	| { kind: "invalid"; reason: LinkValueInvalidReason };

// Plain decimal only: no sign, exponent, comma, or inner whitespace. "5." and
// ".5" are deliberately allowed (Number() reads them as 5 and 0.5).
const LINK_VALUE_RE = /^(\d+(\.\d*)?|\.\d+)$/;
const MAX_FRACTION_DIGITS = 4;

/**
 * The fractional-digit cap is an input-format rule, counted on the raw
 * string, so excess precision cannot disappear through numeric conversion.
 * Check precision before positivity and magnitude so an input that violates
 * several rules gets a consistent error.
 */
export function parseLinkValue(raw: string): LinkValueParse {
	const trimmed = raw.trim();
	if (trimmed === "") return { kind: "empty" };
	if (!LINK_VALUE_RE.test(trimmed)) return { kind: "invalid", reason: "format" };

	// Still reachable despite the editor's beforeinput interception:
	// whitespace-padded pastes, composition input, and insertReplacementText
	// bypass it.
	if (exceedsFractionDigits(trimmed)) return { kind: "invalid", reason: "precision" };

	const value = Number(trimmed);
	if (!(value > 0)) return { kind: "invalid", reason: "non-positive" };
	if (value > MAX_LINK_VALUE) return { kind: "invalid", reason: "above-maximum" };
	return { kind: "valid", value };
}

/** Not trimmed: inspects the prospective field value verbatim. */
export function exceedsFractionDigits(raw: string): boolean {
	if (!LINK_VALUE_RE.test(raw)) return false;
	const dot = raw.indexOf(".");
	return dot !== -1 && raw.length - dot - 1 > MAX_FRACTION_DIGITS;
}

export function truncateFractionDigits(raw: string): string {
	const dot = raw.indexOf(".");
	return dot === -1 ? raw : raw.slice(0, dot + 1 + MAX_FRACTION_DIGITS);
}
