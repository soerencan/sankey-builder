import { MAX_LINK_VALUE } from "../../model/validation";

export type LinkValueParse =
	| { kind: "empty" }
	| { kind: "valid"; value: number }
	| { kind: "invalid" };

// Plain decimal only: no sign, exponent, comma, or inner whitespace. "5." and
// ".5" are deliberately allowed (Number() reads them as 5 and 0.5).
const LINK_VALUE_RE = /^(\d+(\.\d*)?|\.\d+)$/;
const MAX_FRACTION_DIGITS = 4;

/**
 * Strict parse for the link-value text input, keeping NaN out of state
 * entirely. The fractional-digit cap is counted from the raw string, not the
 * parsed float, so trailing-zero precision ("0.00001") is rejected before it
 * rounds away — it's an input-format rule, not a value-magnitude one.
 */
export function parseLinkValue(raw: string): LinkValueParse {
	const trimmed = raw.trim();
	if (trimmed === "") return { kind: "empty" };
	if (!LINK_VALUE_RE.test(trimmed)) return { kind: "invalid" };

	const dot = trimmed.indexOf(".");
	if (dot !== -1 && trimmed.length - dot - 1 > MAX_FRACTION_DIGITS) {
		return { kind: "invalid" };
	}

	const value = Number(trimmed);
	if (!(value > 0) || value > MAX_LINK_VALUE) return { kind: "invalid" };
	return { kind: "valid", value };
}

/**
 * True when `raw` is a well-formed plain decimal whose fractional part exceeds
 * the 4-digit cap — the one invalid case the link editor intercepts at the
 * keystroke (maxlength-style) instead of merely highlighting after the fact.
 * Not trimmed: it inspects the raw prospective field value verbatim.
 */
export function exceedsFractionDigits(raw: string): boolean {
	if (!LINK_VALUE_RE.test(raw)) return false;
	const dot = raw.indexOf(".");
	return dot !== -1 && raw.length - dot - 1 > MAX_FRACTION_DIGITS;
}

/** Truncates (never rounds) a decimal's fractional part to the 4-digit cap. */
export function truncateFractionDigits(raw: string): string {
	const dot = raw.indexOf(".");
	return dot === -1 ? raw : raw.slice(0, dot + 1 + MAX_FRACTION_DIGITS);
}

/**
 * True when `trimmed` matches the same plain-decimal format parseLinkValue
 * requires (no sign, exponent, comma, or inner whitespace). Exposed so
 * callers can tell "not a plain number at all" (e.g. "1e5", "+5") apart from
 * "a plain number, just out of range" without duplicating the regex.
 */
export function isPlainDecimalFormat(trimmed: string): boolean {
	return LINK_VALUE_RE.test(trimmed);
}
