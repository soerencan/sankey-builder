import type { Link, Node, State } from "./graph";
import { defaultState, nextLinkId } from "./graph";
import type { Alignment, AspectRatio, LinkColorMode, Palette, Settings, Theme } from "./settings";
import { DEFAULT_SETTINGS, isSettingValue } from "./settings";
import { MAX_LINK_VALUE } from "./validation";

/** `theme` is never reported in `repairs`: the import path drops it and the load path keeps it. */
export function normalizeSettings(settings: unknown, repairs?: string[]): Settings {
	const s = settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {};

	let palette: Palette = DEFAULT_SETTINGS.palette;
	if (isSettingValue("palette", s.palette)) palette = s.palette;
	else if (s.palette !== undefined) repairs?.push("settings: unknown palette — using default");

	// colorMode is a legacy setting; only its "manual" value is worth a repair
	// notice, since the user loses per-node colors.
	if (s.colorMode === "manual") {
		repairs?.push("settings: manual colors are no longer supported — using the saved palette");
	}

	let linkColor: LinkColorMode = DEFAULT_SETTINGS.linkColor;
	if (isSettingValue("linkColor", s.linkColor)) linkColor = s.linkColor;
	else if (s.linkColor !== undefined) repairs?.push("settings: unknown link color — using default");

	let alignment: Alignment = DEFAULT_SETTINGS.alignment;
	if (isSettingValue("alignment", s.alignment)) alignment = s.alignment;
	else if (s.alignment !== undefined) repairs?.push("settings: unknown alignment — using default");

	let aspectRatio: AspectRatio = DEFAULT_SETTINGS.aspectRatio;
	if (isSettingValue("aspectRatio", s.aspectRatio)) aspectRatio = s.aspectRatio;
	else if (s.aspectRatio !== undefined) {
		repairs?.push("settings: unknown aspect ratio — using 2:1");
	}

	const theme: Theme = isSettingValue("theme", s.theme) ? s.theme : DEFAULT_SETTINGS.theme;

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
 * A bad endpoint or value is coerced (to null, i.e. an incomplete row, or to
 * 1) rather than dropping the link, so hand-edited storage loses no data.
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

/** The silent load path; import reuses the same normalizers with a repair collector. */
export function normalizeState(parsed: unknown): State {
	if (!isRawState(parsed)) return defaultState();
	const nodes = normalizeNodes(parsed.nodes);
	const nodeIds = new Set(nodes.map((n) => n.id));
	const links = normalizeLinks(parsed.links, nodeIds);
	return { nodes, links, settings: normalizeSettings(parsed.settings) };
}

function normalizeEndpoint(value: unknown, nodeIds: Set<string>): string | null {
	return typeof value === "string" && nodeIds.has(value) ? value : null;
}

function isValidLinkValue(value: unknown): value is number {
	return typeof value === "number" && value > 0 && value <= MAX_LINK_VALUE;
}

function normalizeLinkValue(value: unknown): number {
	return isValidLinkValue(value) ? value : 1;
}
