import { isPaletteKey } from "./colors";
import type {
	Alignment,
	ColorMode,
	Link,
	LinkColorMode,
	Node,
	Palette,
	Settings,
	State,
	Theme,
} from "./state";
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

/**
 * Normalizes settings, optionally collecting human-readable repair strings for
 * the import path. When `repairs` is omitted (the localStorage load path) the
 * behavior is unchanged and silent. `theme` is normalized silently and never
 * reported — the import path drops it, the load path keeps it.
 */
export function normalizeSettings(settings: unknown, repairs?: string[]): Settings {
	const s = settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {};

	let palette: Palette = "observable10";
	if (isPaletteKey(s.palette)) palette = s.palette;
	else if (s.palette !== undefined) repairs?.push("settings: unknown palette — using default");

	let colorMode: ColorMode = "auto";
	if (s.colorMode === "manual") colorMode = "manual";
	else if (s.colorMode !== undefined && s.colorMode !== "auto")
		repairs?.push("settings: unknown color mode — using default");

	// An unrecognized linkColor would otherwise render as url() references to
	// gradients that don't exist — invisible links — so it falls back rather
	// than passing through like alignment/palette do downstream.
	let linkColor: LinkColorMode = "source-target";
	if (isLinkColorMode(s.linkColor)) linkColor = s.linkColor;
	else if (s.linkColor !== undefined) repairs?.push("settings: unknown link color — using default");

	let alignment: Alignment = "justify";
	if (isAlignment(s.alignment)) alignment = s.alignment;
	else if (s.alignment !== undefined) repairs?.push("settings: unknown alignment — using default");

	const theme: Theme = isTheme(s.theme) ? s.theme : "auto";

	return { palette, colorMode, linkColor, alignment, theme };
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
 * Normalizes raw nodes, dropping malformed rows (missing id/name) and stripping
 * a color that isn't a 6-digit hex. Reports both when `repairs` is provided.
 */
export function normalizeNodes(rawNodes: unknown[], repairs?: string[]): Node[] {
	const nodes: Node[] = [];
	rawNodes.forEach((value, index) => {
		if (!isRawNode(value)) {
			repairs?.push(`node ${index + 1}: missing id or name — dropped`);
			return;
		}
		const node: Node = { id: value.id, name: value.name };
		if (value.color !== undefined) {
			if (typeof value.color === "string" && NODE_COLOR_RE.test(value.color)) {
				node.color = value.color;
			} else {
				repairs?.push(`node ${value.id}: invalid color removed`);
			}
		}
		nodes.push(node);
	});
	return nodes;
}

/**
 * Normalizes raw links against the known node ids. An endpoint that isn't a
 * string or references a missing node is coerced to null (the link becomes an
 * incomplete, inert row) rather than dropping the whole link — no data loss
 * from typo'd or hand-edited storage. A malformed value (legacy `null`,
 * negative, zero, out of range, non-number) is coerced to 1. Reports each
 * coercion when `repairs` is provided.
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
		links.push({ source, target, value: normalizeLinkValue(value.value) });
	});
	return links;
}

/**
 * Shape-validates a hydrated localStorage payload, dropping/coercing individual
 * malformed rows rather than failing the whole hydration. Silent — the import
 * path (io.ts) reuses these same normalizers with a repair collector.
 */
function normalizeState(parsed: unknown): State {
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
