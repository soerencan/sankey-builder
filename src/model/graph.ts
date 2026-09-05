import type { DiagramSettings, Settings } from "./settings";
import { DEFAULT_SETTINGS } from "./settings";

export interface Node {
	id: string;
	name: string;
}

/**
 * `id` is in-memory identity, not data: nothing else references it, the
 * codec assigns a fresh one to every link it normalizes (ignoring any `id`
 * in the input), and export/storage omit it. See nextLinkId.
 */
export interface Link {
	id: string;
	source: string | null;
	target: string | null;
	value: number;
}

/**
 * A link is complete once both endpoints are assigned. Incomplete links are
 * inert downstream — validate skips them and render filters them out — so an
 * "Add link" click never draws a flow the user didn't choose. Persistence
 * deliberately keeps them, so an in-progress row survives a reload.
 */
export function isComplete(link: Link): link is Link & { source: string; target: string } {
	return link.source !== null && link.target !== null;
}

/** Sheds the in-memory-only link id before code that treats a Link as data (export, storage). */
export function withoutLinkId(link: Readonly<Link>): Omit<Link, "id"> {
	const { source, target, value } = link;
	return { source, target, value };
}

export interface State {
	nodes: Node[];
	links: Link[];
	settings: Settings;
}

let linkIdSequence = 0;

/**
 * Fresh link id, drawn from a module-level counter that only ever
 * increments — not derived from `state.links` like nextNodeId's "max
 * existing + 1". A link id is in-memory identity, not data, so a replaced
 * diagram (import, storage load) must never reuse an id that a still-mounted
 * LinkRow already holds; this counter runs for the lifetime of the app
 * instance regardless of how many links have since been deleted.
 */
export function nextLinkId(): string {
	linkIdSequence += 1;
	return `link-${linkIdSequence}`;
}

export function defaultState(): State {
	return {
		nodes: [
			{ id: "n1", name: "Coal" },
			{ id: "n2", name: "Gas" },
			{ id: "n3", name: "Electricity" },
			{ id: "n4", name: "Homes" },
		],
		links: [
			{ id: nextLinkId(), source: "n1", target: "n3", value: 10 },
			{ id: nextLinkId(), source: "n2", target: "n3", value: 6 },
			{ id: nextLinkId(), source: "n3", target: "n4", value: 14 },
		],
		settings: { ...DEFAULT_SETTINGS },
	};
}

/**
 * Next stable node id, derived from the current max numeric suffix rather
 * than a persisted counter — so ids stay correct after localStorage
 * hydration without any extra bookkeeping.
 */
export function nextNodeId(state: State): string {
	const maxSuffix = state.nodes.reduce((max, n) => {
		const match = /^n(\d+)$/.exec(n.id);
		return match ? Math.max(max, Number(match[1])) : max;
	}, 0);
	return `n${maxSuffix + 1}`;
}

export function addNode(state: State): void {
	const id = nextNodeId(state);
	state.nodes.push({ id, name: `Node ${id.slice(1)}` });
}

export function renameNode(state: State, id: string, name: string): void {
	const node = state.nodes.find((n) => n.id === id);
	if (node) node.name = name;
}

export function deleteNode(state: State, id: string): void {
	state.nodes = state.nodes.filter((n) => n.id !== id);
	// Cascade-prune links referencing the node now: d3-sankey throws
	// Error("missing: <id>") on a dangling reference during layout. Null
	// endpoints don't match `id`, so incomplete links are left intact.
	state.links = state.links.filter((l) => l.source !== id && l.target !== id);
}

export function updateLink(state: State, id: string, patch: Partial<Link>): void {
	const link = state.links.find((l) => l.id === id);
	if (link) Object.assign(link, patch);
}

/**
 * Adds an unassigned link — both endpoints null, value 1. The user picks
 * source and target from the row's dropdowns; until then the link is
 * incomplete and inert, so this works at any node count (including zero).
 */
export function addLink(state: State): void {
	state.links.push({ id: nextLinkId(), source: null, target: null, value: 1 });
}

export function deleteLink(state: State, id: string): void {
	state.links = state.links.filter((l) => l.id !== id);
}

/**
 * Splice-move: pull the item at `from` and reinsert it at `to`. Out-of-range
 * indices clamp to the valid range; a no-op when the resolved indices match or
 * the array has fewer than two items. Row order IS array order — everything
 * downstream (editor rows, dropdown options, export, persistence) follows.
 */
function moveWithin<T>(items: T[], from: number, to: number): void {
	if (items.length < 2) return;
	const max = items.length - 1;
	const src = Math.max(0, Math.min(from, max));
	const dst = Math.max(0, Math.min(to, max));
	if (src === dst) return;
	const [moved] = items.splice(src, 1);
	items.splice(dst, 0, moved);
}

export function moveNode(state: State, from: number, to: number): void {
	moveWithin(state.nodes, from, to);
}

export function moveLink(state: State, from: number, to: number): void {
	moveWithin(state.links, from, to);
}

/** The one shape for import and replaceDiagram; settings exclude theme, a per-browser preference rather than diagram data. */
export interface Diagram {
	nodes: Node[];
	links: Link[];
	settings: DiagramSettings;
}

/**
 * Whole-diagram replacement, used by import. Mutates nodes/links/settings in
 * place (array length=0+push, not reassignment) rather than replacing
 * `state` itself, so callers that captured the State reference in closures
 * (editors, Sortable) keep seeing live data. `settings.theme` is deliberately
 * left untouched — a per-browser preference, not diagram data.
 */
export function replaceDiagram(state: State, diagram: Diagram): void {
	state.nodes.length = 0;
	state.nodes.push(...diagram.nodes);
	state.links.length = 0;
	state.links.push(...diagram.links);
	state.settings.palette = diagram.settings.palette;
	state.settings.linkColor = diagram.settings.linkColor;
	state.settings.alignment = diagram.settings.alignment;
	state.settings.aspectRatio = diagram.settings.aspectRatio;
}
