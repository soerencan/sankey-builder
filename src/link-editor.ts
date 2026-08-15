import type { Link, Node, State } from "./state";

export interface LinkEditorActions {
	addLink(): void;
	deleteLink(index: number): void;
	updateLinkSource(index: number, id: string): void;
	updateLinkTarget(index: number, id: string): void;
	updateLinkValue(index: number, value: number): void;
}

/**
 * Populates a source/target <select> with all nodes, disabling the one
 * chosen in the other select of the same row — makes a self-link
 * impossible to select rather than merely rejecting it after the fact.
 */
function renderLinkOptions(
	selectEl: HTMLSelectElement,
	nodes: Node[],
	selectedId: string,
	excludedId: string,
): void {
	d3.select(selectEl)
		.selectAll("option")
		.data(nodes)
		.join("option")
		.attr("value", (n) => n.id)
		.property("disabled", (n) => n.id === excludedId)
		.property("selected", (n) => n.id === selectedId)
		.text((n) => n.name);
}

/** Rebuilds #link-editor from state — same full-rebuild approach as the node editor. */
export function renderLinkEditor(state: State): void {
	const root = d3.select("#link-editor");
	root.html("");
	root.append("h2").attr("id", "link-editor-heading").text("Links");

	const row = root
		.append("div")
		.attr("class", "link-rows")
		.selectAll<HTMLDivElement, Link>(".link-row")
		.data(state.links)
		.join("div")
		.attr("class", "link-row");

	row
		.append("select")
		.attr("class", "link-source")
		.attr("data-action", "update-link-source")
		.attr("data-index", (_d, i) => i)
		.attr("aria-label", (_d, i) => `Source for link ${i + 1}`)
		.each(function (d) {
			renderLinkOptions(this, state.nodes, d.source, d.target);
		});

	row
		.append("select")
		.attr("class", "link-target")
		.attr("data-action", "update-link-target")
		.attr("data-index", (_d, i) => i)
		.attr("aria-label", (_d, i) => `Target for link ${i + 1}`)
		.each(function (d) {
			renderLinkOptions(this, state.nodes, d.target, d.source);
		});

	row
		.append("input")
		.attr("type", "number")
		.attr("class", "link-value")
		.attr("data-action", "update-link-value")
		.attr("data-index", (_d, i) => i)
		.attr("min", "0")
		.attr("step", "any")
		.attr("aria-label", (_d, i) => `Value for link ${i + 1}`)
		.property("value", (d) => d.value);

	row
		.append("button")
		.attr("type", "button")
		.attr("class", "link-delete")
		.attr("data-action", "delete-link")
		.attr("data-index", (_d, i) => i)
		.attr("aria-label", (_d, i) => `Delete link ${i + 1}`)
		.text("Delete");

	root
		.append("button")
		.attr("type", "button")
		.attr("class", "add-link")
		.attr("data-action", "add-link")
		// A link needs two distinct nodes to default into.
		.property("disabled", state.nodes.length < 2)
		.text("Add link");
}

/**
 * Delegated listeners on the link-editor root, mirroring setupNodeEditor.
 * Select changes do a full rebuild (focus loss on a <select> after
 * choosing a value is normal browser behavior); the value input follows
 * the same focus-preserving path as node renames.
 */
export function setupLinkEditor(actions: LinkEditorActions): void {
	const root = document.getElementById("link-editor");
	if (!root) return;

	root.addEventListener("click", (event) => {
		if (!(event.target instanceof HTMLElement)) return;
		const { action, index } = event.target.dataset;
		if (action === "add-link") {
			actions.addLink();
		} else if (action === "delete-link" && index !== undefined) {
			actions.deleteLink(Number(index));
		}
	});

	root.addEventListener("change", (event) => {
		if (!(event.target instanceof HTMLSelectElement)) return;
		const { action, index } = event.target.dataset;
		if (index === undefined) return;
		if (action === "update-link-source") {
			actions.updateLinkSource(Number(index), event.target.value);
		} else if (action === "update-link-target") {
			actions.updateLinkTarget(Number(index), event.target.value);
		}
	});

	root.addEventListener("input", (event) => {
		if (!(event.target instanceof HTMLInputElement)) return;
		const { action, index } = event.target.dataset;
		if (action === "update-link-value" && index !== undefined) {
			// valueAsNumber is NaN on an empty/invalid field, which validate()
			// rejects rather than letting it reach d3-sankey as bad geometry.
			actions.updateLinkValue(Number(index), event.target.valueAsNumber);
		}
	});
}
