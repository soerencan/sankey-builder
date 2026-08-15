"use strict";

/** @typedef {{id:string, name:string, color?:string}} Node */
/** @typedef {{source:string, target:string, value:number}} Link */
/** @typedef {{palette:string, colorMode:"auto"|"manual", linkColor:string, alignment:string}} Settings */
/** @typedef {{nodes:Node[], links:Link[], settings:Settings}} State */

const DIAGRAM_WIDTH = 960;
const DIAGRAM_HEIGHT = 480;

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
  const { nodes, links } = layout({ nodes: state.nodes, links: state.links });

  // Explicit domain so colors stay stable regardless of iteration order.
  const color = d3.scaleOrdinal(
    state.nodes.map((n) => n.id),
    d3.schemeObservable10
  );

  const container = d3.select("#diagram");
  container.html("");

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
    .attr("stroke", (d) => color(d.source.id))
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
    .attr("fill", (d) => color(d.id));

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
  renderDiagram(defaultState());
}

init();
