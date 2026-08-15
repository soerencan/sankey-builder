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

const PALETTES = {
  observable10: d3.schemeObservable10,
  tableau10: d3.schemeTableau10,
  category10: d3.schemeCategory10,
  set2: d3.schemeSet2,
  dark2: d3.schemeDark2,
};

/**
 * @param {string} key
 * @returns {readonly string[]}
 */
function activePalette(key) {
  return PALETTES[key] ?? PALETTES.observable10;
}

/** @returns {d3.ScaleOrdinal<string, string>} */
function colorScale() {
  // Explicit domain (current node ids) so colors stay deterministic and
  // don't reshuffle as nodes are added/removed/renamed.
  return d3.scaleOrdinal(
    state.nodes.map((n) => n.id),
    activePalette(state.settings.palette)
  );
}

/**
 * Rebuilt once per render pass (by validateAndRender) and reused by both
 * editors and the diagram, rather than rebuilding an O(n) ordinal scale on
 * every single node/link color lookup.
 * @type {d3.ScaleOrdinal<string, string> | null}
 */
let currentColorScale = null;

/**
 * Single seam for palette switching — everything else calls this instead of
 * touching currentColorScale/state.settings.palette directly.
 * @param {Node} node
 */
function nodeColor(node) {
  return (state.settings.colorMode === "manual" && node.color) || currentColorScale(node.id);
}

/**
 * Seeds `color` only for nodes lacking one, from their current computed
 * color, so nothing visually jumps and colors hand-picked in a previous
 * manual session (kept-but-ignored while a named palette was active) are
 * restored rather than re-seeded.
 */
function enterManualMode() {
  currentColorScale = colorScale();
  for (const node of state.nodes) {
    if (!node.color) node.color = nodeColor(node);
  }
  state.settings.colorMode = "manual";
}

/**
 * @param {string} id
 * @param {string} color
 */
function updateNodeColor(id, color) {
  const node = state.nodes.find((n) => n.id === id);
  if (node) node.color = color;
}

/**
 * @param {number} index
 * @param {Partial<Link>} patch
 */
function updateLink(index, patch) {
  const link = state.links[index];
  if (link) Object.assign(link, patch);
}

/**
 * Defaults to the first two distinct nodes and value 1; no-ops when fewer
 * than two nodes exist (the Add-link button is disabled in that case too —
 * this is just a defensive backstop for the state mutation itself).
 */
function addLink() {
  if (state.nodes.length < 2) return;
  const [source, target] = state.nodes;
  state.links.push({ source: source.id, target: target.id, value: 1 });
  validateAndRender();
}

/** @param {number} index */
function deleteLink(index) {
  state.links.splice(index, 1);
  validateAndRender();
}

/**
 * Pre-validates the graph so d3-sankey's failure modes (hard throws on
 * cycles/self-links, silent NaN geometry on bad values) never reach layout.
 * @param {State} state
 * @returns {{ok: boolean, error?: string}}
 */
function validate(state) {
  const nameById = new Map(state.nodes.map((n) => [n.id, n.name]));

  for (const [index, link] of state.links.entries()) {
    if (link.source === link.target) {
      // Safety net only — the link-editor selects already make a self-link
      // impossible to choose.
      return {
        ok: false,
        error: `A link cannot connect ${nameById.get(link.source) ?? link.source} to itself.`,
      };
    }
    if (!Number.isFinite(link.value) || link.value <= 0) {
      // d3-sankey doesn't throw on NaN/zero values — it silently produces
      // NaN geometry, so this has to be caught here rather than at layout.
      // The row number disambiguates duplicate links between the same pair.
      const sourceName = nameById.get(link.source) ?? link.source;
      const targetName = nameById.get(link.target) ?? link.target;
      return {
        ok: false,
        error: `Link ${index + 1} (${sourceName} to ${targetName}) needs a value greater than 0.`,
      };
    }
  }

  const adjacency = new Map();
  for (const link of state.links) {
    if (!adjacency.has(link.source)) adjacency.set(link.source, []);
    adjacency.get(link.source).push(link.target);
  }

  // Standard DFS cycle detection with an explicit path stack: `pathIndex`
  // tracks nodes currently on the stack (gray), `visited` tracks nodes
  // fully explored (black). Hitting a gray node means the stack from that
  // point on IS the cycle, which we return directly for the error message.
  const visited = new Set();
  const path = [];
  const pathIndex = new Map();

  function visit(id) {
    path.push(id);
    pathIndex.set(id, path.length - 1);
    visited.add(id);

    for (const next of adjacency.get(id) ?? []) {
      if (pathIndex.has(next)) {
        return [...path.slice(pathIndex.get(next)), next].map(
          (nodeId) => nameById.get(nodeId) ?? nodeId
        );
      }
      if (!visited.has(next)) {
        const cycle = visit(next);
        if (cycle) return cycle;
      }
    }

    path.pop();
    pathIndex.delete(id);
    return null;
  }

  for (const node of state.nodes) {
    if (!visited.has(node.id)) {
      const cycle = visit(node.id);
      if (cycle) {
        return { ok: false, error: `This link would create a cycle: ${cycle.join(" → ")}` };
      }
    }
  }

  return { ok: true };
}

/**
 * The single re-render entry point — every mutation routes through this.
 * The two rebuild flags are independent because a focus-preserving edit in
 * one editor (e.g. typing a node name) still needs the *other* editor to
 * pick up the change — the link editor's selects show node names, so a
 * rename must rebuild it even while skipping the node editor's own rebuild.
 * @param {boolean} [rebuildNodeEditor] Skip the node-editor DOM rebuild for
 *   events (like typing in a name field) where the row markup already
 *   reflects the change and rebuilding would steal focus/caret position.
 * @param {boolean} [rebuildLinkEditor] Same, for the link editor (typing in
 *   a value field).
 */
function validateAndRender(rebuildNodeEditor = true, rebuildLinkEditor = true) {
  currentColorScale = colorScale();
  const result = validate(state);
  const errorEl = d3.select("#error");
  errorEl.text(result.ok ? "" : result.error);

  if (rebuildNodeEditor) renderNodeEditor();
  if (rebuildLinkEditor) renderLinkEditor();
  // Bail before the diagram rebuild so the last good render stays on
  // screen; the editors above still rebuild (when requested) so the user
  // can see and fix the offending row.
  if (!result.ok) return;
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

  const manual = state.settings.colorMode === "manual";

  const row = root
    .append("div")
    .attr("class", "node-rows")
    .selectAll(".node-row")
    .data(state.nodes, (d) => d.id)
    .join("div")
    .attr("class", `node-row${manual ? " manual" : ""}`);

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

  if (manual) {
    row
      .append("input")
      .attr("type", "color")
      .attr("class", "node-color")
      .attr("data-action", "update-node-color")
      .attr("data-id", (d) => d.id)
      .attr("aria-label", (d) => `Color for ${d.name}`)
      .property("value", (d) => d.color ?? nodeColor(d));
  }

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
 * Populates a source/target <select> with all nodes, disabling the one
 * chosen in the other select of the same row — makes a self-link
 * impossible to select rather than merely rejecting it after the fact.
 * @param {HTMLSelectElement} selectEl
 * @param {string} selectedId
 * @param {string} excludedId
 */
function renderLinkOptions(selectEl, selectedId, excludedId) {
  d3.select(selectEl)
    .selectAll("option")
    .data(state.nodes)
    .join("option")
    .attr("value", (n) => n.id)
    .property("disabled", (n) => n.id === excludedId)
    .property("selected", (n) => n.id === selectedId)
    .text((n) => n.name);
}

/** Rebuilds #link-editor from state — same full-rebuild approach as the node editor. */
function renderLinkEditor() {
  const root = d3.select("#link-editor");
  root.html("");
  root.append("h2").attr("id", "link-editor-heading").text("Links");

  root
    .append("button")
    .attr("type", "button")
    .attr("class", "add-link")
    .attr("data-action", "add-link")
    // A link needs two distinct nodes to default into.
    .property("disabled", state.nodes.length < 2)
    .text("Add link");

  const row = root
    .append("div")
    .attr("class", "link-rows")
    .selectAll(".link-row")
    .data(state.links)
    .join("div")
    .attr("class", "link-row");

  row
    .append("select")
    .attr("class", "link-source")
    .attr("data-action", "update-link-source")
    .attr("data-index", (d, i) => i)
    .attr("aria-label", (d, i) => `Source for link ${i + 1}`)
    .each(function (d) {
      renderLinkOptions(this, d.source, d.target);
    });

  row
    .append("select")
    .attr("class", "link-target")
    .attr("data-action", "update-link-target")
    .attr("data-index", (d, i) => i)
    .attr("aria-label", (d, i) => `Target for link ${i + 1}`)
    .each(function (d) {
      renderLinkOptions(this, d.target, d.source);
    });

  row
    .append("input")
    .attr("type", "number")
    .attr("class", "link-value")
    .attr("data-action", "update-link-value")
    .attr("data-index", (d, i) => i)
    .attr("min", "0")
    .attr("step", "any")
    .attr("aria-label", (d, i) => `Value for link ${i + 1}`)
    .property("value", (d) => d.value);

  row
    .append("button")
    .attr("type", "button")
    .attr("class", "link-delete")
    .attr("data-action", "delete-link")
    .attr("data-index", (d, i) => i)
    .attr("aria-label", (d, i) => `Delete link ${i + 1}`)
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
      const row = event.target.closest(".node-row");
      const deleteButton = row?.querySelector(".node-delete");
      deleteButton?.setAttribute("aria-label", `Delete ${event.target.value}`);
      const colorInput = row?.querySelector(".node-color");
      colorInput?.setAttribute("aria-label", `Color for ${event.target.value}`);
      // Skip the node editor's own rebuild (would reset this input's
      // focus/caret mid-keystroke) but still rebuild the link editor, whose
      // source/target <select> options show node names and would otherwise
      // go stale.
      validateAndRender(false);
    } else if (action === "update-node-color") {
      updateNodeColor(id, event.target.value);
      // Update this row's swatch directly rather than rebuilding: a color
      // picker fires many 'input' events while dragging, and a rebuild
      // mid-drag would tear down the input the user is actively using.
      const swatch = event.target.closest(".node-row")?.querySelector(".node-swatch");
      if (swatch) swatch.style.backgroundColor = event.target.value;
      // Skip both editor rebuilds; still re-render the diagram so the
      // color change is visible live while dragging.
      validateAndRender(false, false);
    }
  });
}

/**
 * Delegated listeners on the link-editor root, mirroring setupNodeEditor.
 * Select changes do a full rebuild (focus loss on a <select> after
 * choosing a value is normal browser behavior); the value input follows
 * the same focus-preserving path as node renames.
 */
function setupLinkEditor() {
  const root = document.getElementById("link-editor");

  root.addEventListener("click", (event) => {
    const { action, index } = event.target.dataset;
    if (action === "add-link") {
      addLink();
    } else if (action === "delete-link") {
      deleteLink(Number(index));
    }
  });

  root.addEventListener("change", (event) => {
    const { action, index } = event.target.dataset;
    if (action === "update-link-source") {
      updateLink(Number(index), { source: event.target.value });
      validateAndRender();
    } else if (action === "update-link-target") {
      updateLink(Number(index), { target: event.target.value });
      validateAndRender();
    }
  });

  root.addEventListener("input", (event) => {
    const { action, index } = event.target.dataset;
    if (action === "update-link-value") {
      // valueAsNumber is NaN on an empty/invalid field, which validate()
      // rejects rather than letting it reach d3-sankey as bad geometry.
      updateLink(Number(index), { value: event.target.valueAsNumber });
      // Skip both editor rebuilds: the node editor is unaffected, and
      // rebuilding the link editor here would steal focus mid-keystroke.
      validateAndRender(false, false);
    }
  });
}

/**
 * @param {string} name
 * @returns {(node: object) => number}
 */
function alignFn(name) {
  return (
    { left: d3.sankeyLeft, right: d3.sankeyRight, center: d3.sankeyCenter }[name] ??
    d3.sankeyJustify
  );
}

/**
 * Delegated change listener on #controls, mirroring the node/link editors'
 * setup functions. Settings are simple string fields, so this writes
 * straight into state.settings rather than going through per-field setters.
 */
function setupControls() {
  const root = document.getElementById("controls");

  // Sync the static <select> markup to state on load, so the defaults live
  // in one place (defaultState()) rather than duplicated as `selected`
  // attributes that could drift out of sync.
  root.querySelector("#link-color").value = state.settings.linkColor;
  root.querySelector("#alignment").value = state.settings.alignment;
  // "Manual" is a colorMode flip, not a palette value — settings.palette
  // keeps the last named palette underneath it as the fallback scale.
  root.querySelector("#palette").value =
    state.settings.colorMode === "manual" ? "manual" : state.settings.palette;

  root.addEventListener("change", (event) => {
    const { action } = event.target.dataset;
    if (action === "update-link-color") {
      state.settings.linkColor = event.target.value;
      validateAndRender();
    } else if (action === "update-alignment") {
      state.settings.alignment = event.target.value;
      validateAndRender();
    } else if (action === "update-palette") {
      if (event.target.value === "manual") {
        enterManualMode();
      } else {
        state.settings.palette = event.target.value;
        state.settings.colorMode = "auto";
      }
      validateAndRender();
    }
  });
}

/**
 * Runs d3-sankey layout on a copy of the graph, since d3-sankey mutates
 * whatever it's given.
 * @param {{nodes:Node[], links:Link[]}} graph
 * @param {Settings} settings
 */
function layout(graph, settings) {
  const { nodes, links } = structuredClone(graph);
  return d3
    .sankey()
    .nodeId((d) => d.id)
    .nodeAlign(alignFn(settings.alignment))
    .nodeWidth(15)
    .nodePadding(10)
    .extent([
      [1, 5],
      [DIAGRAM_WIDTH - 1, DIAGRAM_HEIGHT - 5],
    ])({ nodes, links });
}

/**
 * Per-link stroke accessor for the given link-color mode. `source-target`
 * returns a gradient url referencing the per-link <linearGradient> that
 * renderDiagram appends (its id is keyed by d3-sankey's own `link.index`,
 * so it can't collide within a render).
 * @param {string} mode
 * @returns {(d: {source: Node, target: Node, index: number}) => string}
 */
function linkStroke(mode) {
  if (mode === "source") return (d) => nodeColor(d.source);
  if (mode === "target") return (d) => nodeColor(d.target);
  if (mode === "static") return () => "#aaa";
  return (d) => `url(#link-grad-${d.index})`;
}

/** @param {State} state */
function renderDiagram(state) {
  const container = d3.select("#diagram");
  container.html("");

  // d3-sankey's internal bin-by-column step does `new Array(-1)` on an
  // empty node list, throwing RangeError before it ever gets to layout.
  if (state.nodes.length === 0) return;

  const { nodes, links } = layout(
    { nodes: state.nodes, links: state.links },
    state.settings
  );

  const svg = container
    .append("svg")
    .attr("viewBox", `0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}`);

  // Paint order matches the reference example: link ribbons under node rects.
  // Each link gets its own <g> so the source-target mode can nest a
  // per-link <linearGradient> alongside its <path> (id-referenced by url()).
  const linkGroup = svg
    .append("g")
    .attr("fill", "none")
    .attr("stroke-opacity", 0.5)
    .selectAll("g")
    .data(links)
    .join("g");

  if (state.settings.linkColor === "source-target") {
    linkGroup
      .append("linearGradient")
      .attr("id", (d) => `link-grad-${d.index}`)
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", (d) => d.source.x1)
      .attr("x2", (d) => d.target.x0)
      .call((g) =>
        g.append("stop").attr("offset", "0%").attr("stop-color", (d) => nodeColor(d.source))
      )
      .call((g) =>
        g.append("stop").attr("offset", "100%").attr("stop-color", (d) => nodeColor(d.target))
      );
  }

  linkGroup
    .append("path")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke", linkStroke(state.settings.linkColor))
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
  setupLinkEditor();
  setupControls();
  validateAndRender();
}

init();
