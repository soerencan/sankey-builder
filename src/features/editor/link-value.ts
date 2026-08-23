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
 * Strict parse for the link-value text input, keeping NaN out of state
 * entirely. The fractional-digit cap is counted from the raw string, not the
 * parsed float, so trailing-zero precision ("0.00001") is rejected before it
 * rounds away — it's an input-format rule, not a value-magnitude one.
 *
 * Invalid reasons are checked in a fixed precedence — format, then
 * precision, then non-positive, then above-maximum — so an ambiguous input
 * always resolves to a single reason: "1e20" is a format error (not
 * above-maximum, even though it exceeds MAX_LINK_VALUE), and
 * "1000000000000001.00001" is a precision error (not above-maximum, despite
 * being both).
 */
export function parseLinkValue(raw: string): LinkValueParse {
	const trimmed = raw.trim();
	if (trimmed === "") return { kind: "empty" };
	if (!LINK_VALUE_RE.test(trimmed)) return { kind: "invalid", reason: "format" };

	// Still reachable at commit time even though the editor's beforeinput
	// handler blocks a 5th typed digit: whitespace-padded pastes, composition
	// input, and insertReplacementText all bypass that interception.
	if (exceedsFractionDigits(trimmed)) return { kind: "invalid", reason: "precision" };

	const value = Number(trimmed);
	if (!(value > 0)) return { kind: "invalid", reason: "non-positive" };
	if (value > MAX_LINK_VALUE) return { kind: "invalid", reason: "above-maximum" };
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
