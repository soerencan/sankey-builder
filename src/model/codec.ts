import type { Diagram, Link, Node, State } from "./graph";
import { defaultState, nextLinkId } from "./graph";
import type { DiagramSettingKey, DiagramSettings } from "./settings";
import { DEFAULT_SETTINGS, DIAGRAM_SETTING_KEYS, assignSetting, isSettingValue } from "./settings";
import { MAX_LINK_VALUE } from "./validation";

export interface RawDiagram {
	nodes: unknown[];
	links: unknown[];
	settings?: unknown;
}

export function isRawDiagram(value: unknown): value is RawDiagram {
	if (!value || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	return Array.isArray(v.nodes) && Array.isArray(v.links);
}

export const SETTING_NAMES: Record<DiagramSettingKey, string> = {
	palette: "palette",
	linkColor: "link color",
	alignment: "alignment",
	aspectRatio: "aspect ratio",
};

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeSettings(settings: unknown, repairs?: string[]): DiagramSettings {
	const s = asRecord(settings);
	const result = {} as DiagramSettings;

	for (const key of DIAGRAM_SETTING_KEYS) {
		const value = s[key];
		if (isSettingValue(key, value)) {
			assignSetting(result, key, value);
		} else {
			assignSetting(result, key, DEFAULT_SETTINGS[key]);
			if (value !== undefined) {
				repairs?.push(`settings: unknown ${SETTING_NAMES[key]} — using default`);
			}
		}
	}

	// colorMode is a legacy setting; only its "manual" value is worth a
	// repair notice, since the user loses per-node colors.
	if (s.colorMode === "manual") {
		repairs?.push("settings: manual colors are no longer supported — using the saved palette");
	}

	return result;
}

function isRawNode(value: unknown): value is { id: string; name: string } {
	if (!value || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	return typeof v.id === "string" && typeof v.name === "string";
}

function isRawLink(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object";
}

function normalizeNodes(rawNodes: unknown[], repairs?: string[]): Node[] {
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
function normalizeLinks(rawLinks: unknown[], nodeIds: Set<string>, repairs?: string[]): Link[] {
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
 * The whole nodes → ids → links → settings pipeline. The storage load path
 * (`normalizeState`) calls this silently; the import path calls it with a
 * repair collector after its own structural gate.
 */
export function normalizeDiagram(raw: RawDiagram, repairs?: string[]): Diagram {
	const nodes = normalizeNodes(raw.nodes, repairs);
	const nodeIds = new Set(nodes.map((n) => n.id));
	const links = normalizeLinks(raw.links, nodeIds, repairs);
	const settings = normalizeSettings(raw.settings, repairs);
	return { nodes, links, settings };
}

/** `theme` is never reported in repairs: the import path drops it and the load path keeps it. */
export function normalizeState(parsed: unknown): State {
	if (!isRawDiagram(parsed)) return defaultState();
	const diagram = normalizeDiagram(parsed);
	const rawSettings = asRecord(parsed.settings);
	const theme = isSettingValue("theme", rawSettings.theme)
		? rawSettings.theme
		: DEFAULT_SETTINGS.theme;
	return { ...diagram, settings: { ...diagram.settings, theme } };
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
