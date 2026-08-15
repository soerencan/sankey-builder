"use strict";

/** @typedef {{id:string, name:string, color?:string}} Node */
/** @typedef {{source:string, target:string, value:number}} Link */
/** @typedef {{palette:string, colorMode:"auto"|"manual", linkColor:string, alignment:string}} Settings */
/** @typedef {{nodes:Node[], links:Link[], settings:Settings}} State */

const DIAGRAM_WIDTH = 960;
const DIAGRAM_HEIGHT = 480;

/** @type {State} */
let state;

/** @returns {State} */
function defaultState() {
  return {
    nodes: [
      { id: "n1", name: "Coal" },
      { id: "n2", name: "Gas" },
      { id: "n3", name: "Electricity" },
      { id: "n4", name: "Homes" },
    ],
    links: [
      { source: "n1", target: "n3", value: 10 },
      { source: "n2", target: "n3", value: 6 },
      { source: "n3", target: "n4", value: 14 },
    ],
    settings: {
      palette: "observable10",
      colorMode: "auto",
      linkColor: "source-target",
      alignment: "justify",
    },
  };
}

/**
 * Next stable node id, derived from the current max numeric suffix rather
 * than a persisted counter — so ids stay correct after localStorage
 * hydration (Step 6) without any extra bookkeeping.
 * @returns {string}
 */
function nextNodeId() {
  const maxSuffix = state.nodes.reduce((max, n) => {
    const match = /^n(\d+)$/.exec(n.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `n${maxSuffix + 1}`;
}

function addNode() {
  const id = nextNodeId();
  state.nodes.push({ id, name: `Node ${id.slice(1)}` });
  validateAndRender();
}

/**
 * @param {string} id
 * @param {string} name
 */
function renameNode(id, name) {
  const node = state.nodes.find((n) => n.id === id);
  if (node) node.name = name;
}

/** @param {string} id */
function deleteNode(id) {
  state.nodes = state.nodes.filter((n) => n.id !== id);
  // Cascade-prune links referencing the node now: d3-sankey throws
  // Error("missing: <id>") on a dangling reference during layout.
  state.links = state.links.filter((l) => l.source !== id && l.target !== id);
  validateAndRender();
}

/** @returns {d3.ScaleOrdinal<string, string>} */
function colorScale() {
  // Explicit domain (current node ids) so colors stay deterministic and
  // don't reshuffle as nodes are added/removed/renamed.
  return d3.scaleOrdinal(
    state.nodes.map((n) => n.id),
    d3.schemeObservable10
  );
}

/**
 * Single seam for palette switching (Step 5) — everything else calls this
 * instead of touching colorScale()/state.settings.palette directly.
 * @param {Node} node
 */
function nodeColor(node) {
  return colorScale()(node.id);
}

/**
 * Passthrough until Step 3 adds real checks (cycles, self-links, values).
 * @param {State} _state
 * @returns {{ok: boolean, error?: string}}
 */
function validate(_state) {
  return { ok: true };
}

/**
 * The single re-render entry point — every mutation routes through this.
 * @param {boolean} [rebuildEditor] Skip the node-editor DOM rebuild for
 *   events (like typing in a name field) where the row markup already
 *   reflects the change and rebuilding would steal focus/caret position.
 */
function validateAndRender(rebuildEditor = true) {
  const result = validate(state);
  if (!result.ok) {
    // Step 3 will surface result.error and bail here, keeping the last
    // good diagram on screen.
    return;
  }
  if (rebuildEditor) renderNodeEditor();
  renderDiagram(state);
}

/** Rebuilds #node-editor from state — same full-rebuild approach as the diagram. */
function renderNodeEditor() {
  const root = d3.select("#node-editor");
  root.html("");
  root.append("h2").attr("id", "node-editor-heading").text("Nodes");
  root
    .append("button")
    .attr("type", "button")
    .attr("class", "add-node")
    .attr("data-action", "add-node")
    .text("Add node");

  const row = root
    .append("div")
    .attr("class", "node-rows")
    .selectAll(".node-row")
    .data(state.nodes, (d) => d.id)
    .join("div")
    .attr("class", "node-row");

  row
    .append("span")
    .attr("class", "node-swatch")
    .style("background-color", (d) => nodeColor(d));

  row
    .append("input")
    .attr("type", "text")
    .attr("class", "node-name")
    .attr("data-action", "rename-node")
    .attr("data-id", (d) => d.id)
    .attr("aria-label", (d) => `Name for ${d.name}`)
    .property("value", (d) => d.name);

  row
    .append("button")
    .attr("type", "button")
    .attr("class", "node-delete")
    .attr("data-action", "delete-node")
    .attr("data-id", (d) => d.id)
    .attr("aria-label", (d) => `Delete ${d.name}`)
    .text("Delete");
}

/**
 * Delegated listeners on the editor root — one handler per event type
 * rather than per-row handlers, since rows get rebuilt wholesale.
 */
function setupNodeEditor() {
  const root = document.getElementById("node-editor");

  root.addEventListener("click", (event) => {
    const { action, id } = event.target.dataset;
    if (action === "add-node") {
      addNode();
    } else if (action === "delete-node") {
      deleteNode(id);
    }
  });

  root.addEventListener("input", (event) => {
    const { action, id } = event.target.dataset;
    if (action === "rename-node") {
      renameNode(id, event.target.value);
      // Keep the row's name-derived aria-labels in sync without touching
      // the input itself, since a full rebuild here would steal focus/caret.
      event.target.setAttribute("aria-label", `Name for ${event.target.value}`);
      const deleteButton = event.target
        .closest(".node-row")
        ?.querySelector(".node-delete");
      deleteButton?.setAttribute("aria-label", `Delete ${event.target.value}`);
      // Re-render the diagram only; rebuilding the editor row here would
      // reset the input's focus/caret mid-keystroke.
      validateAndRender(false);
    }
  });
}

/**
 * Runs d3-sankey layout on a copy of the graph, since d3-sankey mutates
 * whatever it's given.
 * @param {{nodes:Node[], links:Link[]}} graph
 */
function layout(graph) {
  const { nodes, links } = structuredClone(graph);
  return d3
    .sankey()
    .nodeId((d) => d.id)
    .nodeWidth(15)
    .nodePadding(10)
    .extent([
      [1, 5],
      [DIAGRAM_WIDTH - 1, DIAGRAM_HEIGHT - 5],
    ])({ nodes, links });
}

/** @param {State} state */
function renderDiagram(state) {
  const container = d3.select("#diagram");
  container.html("");

  // d3-sankey's internal bin-by-column step does `new Array(-1)` on an
  // empty node list, throwing RangeError before it ever gets to layout.
  if (state.nodes.length === 0) return;

  const { nodes, links } = layout({ nodes: state.nodes, links: state.links });

  const svg = container
    .append("svg")
    .attr("viewBox", `0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}`);

  // Paint order matches the reference example: link ribbons under node rects.
  svg
    .append("g")
    .attr("fill", "none")
    .attr("stroke-opacity", 0.5)
    .selectAll("path")
    .data(links)
    .join("path")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke", (d) => nodeColor(d.source))
    .attr("stroke-width", (d) => Math.max(1, d.width));

  svg
    .append("g")
    .selectAll("rect")
    .data(nodes)
    .join("rect")
    .attr("x", (d) => d.x0)
    .attr("y", (d) => d.y0)
    .attr("width", (d) => d.x1 - d.x0)
    .attr("height", (d) => Math.max(1, d.y1 - d.y0))
    .attr("fill", (d) => nodeColor(d));

  svg
    .append("g")
    .attr("font-family", "system-ui, sans-serif")
    .attr("font-size", 10)
    .selectAll("text")
    .data(nodes)
    .join("text")
    .attr("x", (d) => (d.x0 < DIAGRAM_WIDTH / 2 ? d.x1 + 6 : d.x0 - 6))
    .attr("y", (d) => (d.y0 + d.y1) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", (d) => (d.x0 < DIAGRAM_WIDTH / 2 ? "start" : "end"))
    .attr("fill", "currentColor")
    .text((d) => d.name);
}

function init() {
  state = defaultState();
  setupNodeEditor();
  validateAndRender();
}

init();
