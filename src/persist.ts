import { isPaletteKey } from "./colors";
import type { Alignment, Link, LinkColorMode, Node, Settings, State, Theme } from "./state";
import { defaultState } from "./state";
import { MAX_LINK_VALUE } from "./validate";

export const STORAGE_KEY = "sankey-builder";

// Sole consumers of these four are normalizeSettings/normalizeState below —
// kept private rather than exported (app.js:99-104). Typed as a set of the
// state union itself (not ReadonlySet<string>) so a typo'd member fails to
// compile instead of silently narrowing the set of accepted values.
const LINK_COLOR_MODES: ReadonlySet<LinkColorMode> = new Set([
	"source",
	"target",
	"source-target",
	"static",
]);
const ALIGNMENTS: ReadonlySet<Alignment> = new Set(["left", "right", "center", "justify"]);
const THEMES: ReadonlySet<Theme> = new Set(["auto", "light", "dark"]);
// Same shape input[type=color] accepts; anything else (named colors, rgb(),
// short hex, etc.) renders as black in the picker, so it's dropped instead.
const NODE_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function isLinkColorMode(value: unknown): value is LinkColorMode {
	return typeof value === "string" && (LINK_COLOR_MODES as ReadonlySet<string>).has(value);
}

function isAlignment(value: unknown): value is Alignment {
	return typeof value === "string" && (ALIGNMENTS as ReadonlySet<string>).has(value);
}

function isTheme(value: unknown): value is Theme {
	return typeof value === "string" && (THEMES as ReadonlySet<string>).has(value);
}

function normalizeSettings(settings: unknown): Settings {
	const s = settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {};
	return {
		palette: isPaletteKey(s.palette) ? s.palette : "observable10",
		colorMode: s.colorMode === "manual" ? "manual" : "auto",
		// An unrecognized linkColor would otherwise render as url() references
		// to gradients that don't exist — invisible links — so it falls back
		// rather than passing through like alignment/palette do downstream.
		linkColor: isLinkColorMode(s.linkColor) ? s.linkColor : "source-target",
		alignment: isAlignment(s.alignment) ? s.alignment : "justify",
		theme: isTheme(s.theme) ? s.theme : "auto",
	};
}

function isRawState(
	value: unknown,
): value is { nodes: unknown[]; links: unknown[]; settings?: unknown } {
	if (!value || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	return Array.isArray(v.nodes) && Array.isArray(v.links);
}

function isRawNode(value: unknown): value is { id: string; name: string; color?: unknown } {
	if (!value || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	return typeof v.id === "string" && typeof v.name === "string";
}

function isRawLink(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object";
}

/**
 * Shape-validates a hydrated localStorage payload, dropping individual
 * malformed rows rather than failing the whole hydration. An endpoint that
 * isn't a string or references a node id that no longer exists is coerced to
 * null (the link becomes incomplete and inert) rather than dropping the whole
 * link — no data loss from typo'd or hand-edited storage. A malformed value
 * (legacy `null`, negative, zero, out of range, non-number) is likewise
 * coerced to 1 rather than dropping the link.
 */
function normalizeState(parsed: unknown): State {
	if (!isRawState(parsed)) return defaultState();

	const nodes: Node[] = parsed.nodes.filter(isRawNode).map((n) => {
		const node: Node = { id: n.id, name: n.name };
		if (typeof n.color === "string" && NODE_COLOR_RE.test(n.color)) node.color = n.color;
		return node;
	});

	const nodeIds = new Set(nodes.map((n) => n.id));
	const links: Link[] = parsed.links.filter(isRawLink).map((l) => ({
		source: normalizeEndpoint(l.source, nodeIds),
		target: normalizeEndpoint(l.target, nodeIds),
		value: normalizeLinkValue(l.value),
	}));

	return { nodes, links, settings: normalizeSettings(parsed.settings) };
}

/** A non-string or dangling endpoint becomes null; the link stays as an incomplete row. */
function normalizeEndpoint(value: unknown, nodeIds: Set<string>): string | null {
	return typeof value === "string" && nodeIds.has(value) ? value : null;
}

/** State never holds NaN now; anything out of (0, MAX_LINK_VALUE] falls back to 1. */
function normalizeLinkValue(value: unknown): number {
	return typeof value === "number" && value > 0 && value <= MAX_LINK_VALUE ? value : 1;
}

export function loadState(): State {
	let raw: string | null = null;
	try {
		raw = localStorage.getItem(STORAGE_KEY);
	} catch {
		// Unavailable (file://, private mode) — fall back to the default graph.
		return defaultState();
	}
	if (!raw) return defaultState();
	try {
		return normalizeState(JSON.parse(raw));
	} catch {
		return defaultState();
	}
}

/**
 * Best-effort: quota exceeded, private mode, or file:// with storage
 * disabled shouldn't break the app. DOM-free by design — the caller (main.ts)
 * owns surfacing/clearing the storage notice from this result.
 */
export function saveState(state: State): boolean {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		return true;
	} catch {
		return false;
	}
}
