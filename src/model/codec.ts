import type { Link, Node, State } from "./graph";
import { defaultState, nextLinkId } from "./graph";
import type { Alignment, AspectRatio, LinkColorMode, Palette, Settings, Theme } from "./settings";
import {
	DEFAULT_SETTINGS,
	isAlignment,
	isAspectRatio,
	isLinkColorMode,
	isPaletteKey,
	isTheme,
} from "./settings";
import { MAX_LINK_VALUE } from "./validation";

/**
 * Normalizes settings, optionally collecting human-readable repair strings for
 * the import path. When `repairs` is omitted (the localStorage load path) the
 * behavior is unchanged and silent. `theme` is normalized silently and never
 * reported — the import path drops it, the load path keeps it.
 */
export function normalizeSettings(settings: unknown, repairs?: string[]): Settings {
	const s = settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {};

	let palette: Palette = DEFAULT_SETTINGS.palette;
	if (isPaletteKey(s.palette)) palette = s.palette;
	else if (s.palette !== undefined) repairs?.push("settings: unknown palette — using default");

	// colorMode: "manual" isn't a supported setting — manual per-node colors
	// don't exist — so an export/localStorage entry carrying it falls back to
	// the saved palette. Any other stray colorMode value is ignored silently,
	// since none of them is a real setting either.
	if (s.colorMode === "manual") {
		repairs?.push("settings: manual colors are no longer supported — using the saved palette");
	}

	// An unrecognized linkColor would otherwise render as url() references to
	// gradients that don't exist — invisible links — so it falls back rather
	// than passing through like alignment/palette do downstream.
	let linkColor: LinkColorMode = DEFAULT_SETTINGS.linkColor;
	if (isLinkColorMode(s.linkColor)) linkColor = s.linkColor;
	else if (s.linkColor !== undefined) repairs?.push("settings: unknown link color — using default");

	let alignment: Alignment = DEFAULT_SETTINGS.alignment;
	if (isAlignment(s.alignment)) alignment = s.alignment;
	else if (s.alignment !== undefined) repairs?.push("settings: unknown alignment — using default");

	let aspectRatio: AspectRatio = DEFAULT_SETTINGS.aspectRatio;
	if (isAspectRatio(s.aspectRatio)) aspectRatio = s.aspectRatio;
	else if (s.aspectRatio !== undefined) {
		repairs?.push("settings: unknown aspect ratio — using 2:1");
	}

	const theme: Theme = isTheme(s.theme) ? s.theme : DEFAULT_SETTINGS.theme;

	return { palette, linkColor, alignment, aspectRatio, theme };
}

function isRawState(
	value: unknown,
): value is { nodes: unknown[]; links: unknown[]; settings?: unknown } {
	if (!value || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	return Array.isArray(v.nodes) && Array.isArray(v.links);
}

function isRawNode(value: unknown): value is { id: string; name: string } {
	if (!value || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	return typeof v.id === "string" && typeof v.name === "string";
}

function isRawLink(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object";
}

/**
 * Normalizes raw nodes, dropping malformed rows (missing id/name). Any other
 * field — including a stray `color` from a manual-color export — is ignored
 * silently by construction: only id/name are copied over.
 */
export function normalizeNodes(rawNodes: unknown[], repairs?: string[]): Node[] {
	const nodes: Node[] = [];
	rawNodes.forEach((value, index) => {
		if (!isRawNode(value)) {
			repairs?.push(`node ${index + 1}: missing id or name — dropped`);
			return;
		}
		nodes.push({ id: value.id, name: value.name });
	});
	return nodes;
}

/**
 * Normalizes raw links against the known node ids. An endpoint that isn't a
 * string or references a missing node is coerced to null (the link becomes an
 * incomplete, inert row) rather than dropping the whole link — no data loss
 * from typo'd or hand-edited storage. A malformed value (legacy `null`,
 * negative, zero, out of range, non-number) is coerced to 1. Reports each
 * coercion when `repairs` is provided. Every link gets a fresh id from
 * nextLinkId(); any `id` present in the input is ignored — it's in-memory
 * identity, not data, so there's nothing to repair or report.
 */
export function normalizeLinks(
	rawLinks: unknown[],
	nodeIds: Set<string>,
	repairs?: string[],
): Link[] {
	const links: Link[] = [];
	rawLinks.forEach((value, index) => {
		if (!isRawLink(value)) {
			repairs?.push(`link ${index + 1}: not an object — dropped`);
			return;
		}
		const source = normalizeEndpoint(value.source, nodeIds);
		if (source === null && value.source != null) {
			repairs?.push(`link ${index + 1}: unknown source — left unassigned`);
		}
		const target = normalizeEndpoint(value.target, nodeIds);
		if (target === null && value.target != null) {
			repairs?.push(`link ${index + 1}: unknown target — left unassigned`);
		}
		if (value.value !== undefined && !isValidLinkValue(value.value)) {
			repairs?.push(`link ${index + 1}: invalid value — set to 1`);
		}
		links.push({ id: nextLinkId(), source, target, value: normalizeLinkValue(value.value) });
	});
	return links;
}

/**
 * Shape-validates an unknown parsed payload into a State, dropping/coercing
 * individual malformed rows rather than failing the whole thing. Silent — the
 * import path (features/files/diagram-file.ts) reuses these same normalizers
 * with a repair collector.
 */
export function normalizeState(parsed: unknown): State {
	if (!isRawState(parsed)) return defaultState();
	const nodes = normalizeNodes(parsed.nodes);
	const nodeIds = new Set(nodes.map((n) => n.id));
	const links = normalizeLinks(parsed.links, nodeIds);
	return { nodes, links, settings: normalizeSettings(parsed.settings) };
}

/** A non-string or dangling endpoint becomes null; the link stays as an incomplete row. */
function normalizeEndpoint(value: unknown, nodeIds: Set<string>): string | null {
	return typeof value === "string" && nodeIds.has(value) ? value : null;
}

/** State never holds NaN now; only a finite number in (0, MAX_LINK_VALUE] is kept as-is. */
function isValidLinkValue(value: unknown): value is number {
	return typeof value === "number" && value > 0 && value <= MAX_LINK_VALUE;
}

function normalizeLinkValue(value: unknown): number {
	return isValidLinkValue(value) ? value : 1;
}
