"use strict";
(() => {
  // src/colors.ts
  var PALETTES = {
    observable10: () => d3.schemeObservable10,
    tableau10: () => d3.schemeTableau10,
    category10: () => d3.schemeCategory10,
    set2: () => d3.schemeSet2,
    dark2: () => d3.schemeDark2
  };
  function isPaletteKey(key) {
    return typeof key === "string" && Object.hasOwn(PALETTES, key);
  }
  function activePalette(key) {
    return (isPaletteKey(key) ? PALETTES[key] : PALETTES.observable10)();
  }
  function createNodeColorResolver(state2) {
    const scale = d3.scaleOrdinal(
      state2.nodes.map((n) => n.id),
      activePalette(state2.settings.palette)
    );
    return (node) => state2.settings.colorMode === "manual" && node.color || scale(node.id);
  }
  function enterManualMode(state2) {
    const resolve = createNodeColorResolver(state2);
    for (const node of state2.nodes) {
      if (!node.color) node.color = resolve(node);
    }
    state2.settings.colorMode = "manual";
  }

  // src/controls.ts
  function syncControls(state2) {
    const root = document.getElementById("controls");
    if (!root) return;
    const linkColorSelect = root.querySelector("#link-color");
    if (linkColorSelect) linkColorSelect.value = state2.settings.linkColor;
    const alignmentSelect = root.querySelector("#alignment");
    if (alignmentSelect) alignmentSelect.value = state2.settings.alignment;
    const themeSelect = root.querySelector("#theme");
    if (themeSelect) themeSelect.value = state2.settings.theme;
    const paletteSelect = root.querySelector("#palette");
    if (paletteSelect) {
      paletteSelect.value = state2.settings.colorMode === "manual" ? "manual" : state2.settings.palette;
    }
  }
  function setupControls(state2, actions) {
    const root = document.getElementById("controls");
    if (!root) return;
    syncControls(state2);
    root.addEventListener("change", (event) => {
      if (!(event.target instanceof HTMLSelectElement)) return;
      const { action } = event.target.dataset;
      if (action === "update-link-color") {
        actions.setLinkColor(event.target.value);
      } else if (action === "update-alignment") {
        actions.setAlignment(event.target.value);
      } else if (action === "update-palette") {
        actions.selectPalette(event.target.value);
      } else if (action === "update-theme") {
        actions.setTheme(event.target.value);
      }
    });
  }

  // src/state.ts
  function isComplete(link) {
    return link.source !== null && link.target !== null;
  }
  function defaultState() {
    return {
      nodes: [
        { id: "n1", name: "Coal" },
        { id: "n2", name: "Gas" },
        { id: "n3", name: "Electricity" },
        { id: "n4", name: "Homes" }
      ],
      links: [
        { source: "n1", target: "n3", value: 10 },
        { source: "n2", target: "n3", value: 6 },
        { source: "n3", target: "n4", value: 14 }
      ],
      settings: {
        palette: "observable10",
        colorMode: "auto",
        linkColor: "source-target",
        alignment: "justify",
        theme: "auto"
      }
    };
  }
  function nextNodeId(state2) {
    const maxSuffix = state2.nodes.reduce((max, n) => {
      const match = /^n(\d+)$/.exec(n.id);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `n${maxSuffix + 1}`;
  }
  function addNode(state2) {
    const id = nextNodeId(state2);
    state2.nodes.push({ id, name: `Node ${id.slice(1)}` });
  }
  function renameNode(state2, id, name) {
    const node = state2.nodes.find((n) => n.id === id);
    if (node) node.name = name;
  }
  function deleteNode(state2, id) {
    state2.nodes = state2.nodes.filter((n) => n.id !== id);
    state2.links = state2.links.filter((l) => l.source !== id && l.target !== id);
  }
  function updateNodeColor(state2, id, color) {
    const node = state2.nodes.find((n) => n.id === id);
    if (node) node.color = color;
  }
  function updateLink(state2, index, patch) {
    const link = state2.links[index];
    if (link) Object.assign(link, patch);
  }
  function addLink(state2) {
    state2.links.push({ source: null, target: null, value: 1 });
  }
  function deleteLink(state2, index) {
    state2.links.splice(index, 1);
  }
  function moveWithin(items, from, to) {
    if (items.length < 2) return;
    const max = items.length - 1;
    const src = Math.max(0, Math.min(from, max));
    const dst = Math.max(0, Math.min(to, max));
    if (src === dst) return;
    const [moved] = items.splice(src, 1);
    items.splice(dst, 0, moved);
  }
  function moveNode(state2, from, to) {
    moveWithin(state2.nodes, from, to);
  }
  function moveLink(state2, from, to) {
    moveWithin(state2.links, from, to);
  }

  // src/render.ts
  var DIAGRAM_WIDTH = 960;
  var DIAGRAM_HEIGHT = 480;
  function alignFn(name) {
    const table = {
      left: d3.sankeyLeft,
      right: d3.sankeyRight,
      center: d3.sankeyCenter
    };
    return table[name] ?? d3.sankeyJustify;
  }
  function layout(state2, sourceLinks) {
    const { nodes, links } = structuredClone({ nodes: state2.nodes, links: sourceLinks });
    const graph = d3.sankey().nodeId((d) => d.id).nodeAlign(alignFn(state2.settings.alignment)).nodeWidth(15).nodePadding(10).extent([
      [1, 5],
      [DIAGRAM_WIDTH - 1, DIAGRAM_HEIGHT - 5]
    ])({ nodes, links });
    return graph;
  }
  function linkStroke(mode, nodeColor) {
    if (mode === "source") return (d) => nodeColor(d.source);
    if (mode === "target") return (d) => nodeColor(d.target);
    if (mode === "static") return () => "#aaa";
    return (d) => `url(#link-grad-${d.index})`;
  }
  function renderDiagram(state2, nodeColor) {
    const container = d3.select("#diagram");
    container.html("");
    if (state2.nodes.length === 0) return;
    const completeLinks = state2.links.filter(isComplete);
    if (completeLinks.length === 0) return;
    const { nodes, links } = layout(state2, completeLinks);
    const svg = container.append("svg").attr("viewBox", `0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}`);
    const linkGroup = svg.append("g").attr("fill", "none").attr("stroke-opacity", 0.5).selectAll("g").data(links).join("g");
    if (state2.settings.linkColor === "source-target") {
      linkGroup.append("linearGradient").attr("id", (d) => `link-grad-${d.index}`).attr("gradientUnits", "userSpaceOnUse").attr("x1", (d) => d.source.x1).attr("x2", (d) => d.target.x0).call(
        (g) => g.append("stop").attr("offset", "0%").attr("stop-color", (d) => nodeColor(d.source))
      ).call(
        (g) => g.append("stop").attr("offset", "100%").attr("stop-color", (d) => nodeColor(d.target))
      );
    }
    linkGroup.append("path").attr("d", d3.sankeyLinkHorizontal()).attr("stroke", linkStroke(state2.settings.linkColor, nodeColor)).attr("stroke-width", (d) => Math.max(1, d.width));
    svg.append("g").selectAll("rect").data(nodes).join("rect").attr("x", (d) => d.x0).attr("y", (d) => d.y0).attr("width", (d) => d.x1 - d.x0).attr("height", (d) => Math.max(1, d.y1 - d.y0)).attr("fill", (d) => nodeColor(d));
    svg.append("g").attr("font-family", "system-ui, sans-serif").attr("font-size", 10).selectAll("text").data(nodes).join("text").attr("x", (d) => d.x0 < DIAGRAM_WIDTH / 2 ? d.x1 + 6 : d.x0 - 6).attr("y", (d) => (d.y0 + d.y1) / 2).attr("dy", "0.35em").attr("text-anchor", (d) => d.x0 < DIAGRAM_WIDTH / 2 ? "start" : "end").attr("fill", "currentColor").text((d) => d.name);
  }

  // src/export.ts
  var SVG_NS = "http://www.w3.org/2000/svg";
  function serializeDiagramSvg(svg, opts) {
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", SVG_NS);
    clone.setAttribute("width", String(DIAGRAM_WIDTH));
    clone.setAttribute("height", String(DIAGRAM_HEIGHT));
    for (const el of Array.from(clone.querySelectorAll('[fill="currentColor"]'))) {
      el.setAttribute("fill", opts.labelColor);
    }
    const background = clone.ownerDocument.createElementNS(SVG_NS, "rect");
    background.setAttribute("x", "0");
    background.setAttribute("y", "0");
    background.setAttribute("width", String(DIAGRAM_WIDTH));
    background.setAttribute("height", String(DIAGRAM_HEIGHT));
    background.setAttribute("fill", opts.background);
    clone.insertBefore(background, clone.firstChild);
    const xml = new XMLSerializer().serializeToString(clone);
    return `<?xml version="1.0" encoding="UTF-8"?>
${xml}`;
  }
  function rasterizeSvg(xml, width, height, scale) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = width * scale;
          canvas.height = height * scale;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            URL.revokeObjectURL(url);
            reject(new Error("Could not get a 2d canvas context to rasterize the diagram."));
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            URL.revokeObjectURL(url);
            if (blob) resolve(blob);
            else reject(new Error("Rasterizing the diagram to PNG failed."));
          }, "image/png");
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not load the diagram svg for rasterization."));
      };
      img.src = url;
    });
  }

  // src/validate.ts
  var MAX_LINK_VALUE = 1e15;
  var LINK_VALUE_RE = /^(\d+(\.\d*)?|\.\d+)$/;
  var MAX_FRACTION_DIGITS = 4;
  function parseLinkValue(raw) {
    const trimmed = raw.trim();
    if (trimmed === "") return { kind: "empty" };
    if (!LINK_VALUE_RE.test(trimmed)) return { kind: "invalid" };
    const dot = trimmed.indexOf(".");
    if (dot !== -1 && trimmed.length - dot - 1 > MAX_FRACTION_DIGITS) {
      return { kind: "invalid" };
    }
    const value = Number(trimmed);
    if (!(value > 0) || value > MAX_LINK_VALUE) return { kind: "invalid" };
    return { kind: "valid", value };
  }
  function exceedsFractionDigits(raw) {
    if (!LINK_VALUE_RE.test(raw)) return false;
    const dot = raw.indexOf(".");
    return dot !== -1 && raw.length - dot - 1 > MAX_FRACTION_DIGITS;
  }
  function truncateFractionDigits(raw) {
    const dot = raw.indexOf(".");
    return dot === -1 ? raw : raw.slice(0, dot + 1 + MAX_FRACTION_DIGITS);
  }
  function isPlainDecimalFormat(trimmed) {
    return LINK_VALUE_RE.test(trimmed);
  }
  function validate(state2) {
    const nameById = new Map(state2.nodes.map((n) => [n.id, n.name]));
    for (const [index, link] of state2.links.entries()) {
      if (!isComplete(link)) continue;
      if (link.source === link.target) {
        return {
          ok: false,
          error: `A link cannot connect ${nameById.get(link.source) ?? link.source} to itself.`
        };
      }
      if (!Number.isFinite(link.value) || link.value <= 0) {
        const sourceName = nameById.get(link.source) ?? link.source;
        const targetName = nameById.get(link.target) ?? link.target;
        return {
          ok: false,
          error: `Link ${index + 1} (${sourceName} to ${targetName}) needs a value greater than 0.`
        };
      }
      if (link.value > MAX_LINK_VALUE) {
        const sourceName = nameById.get(link.source) ?? link.source;
        const targetName = nameById.get(link.target) ?? link.target;
        return {
          ok: false,
          error: `Link ${index + 1} (${sourceName} to ${targetName}) value is too large (maximum ${MAX_LINK_VALUE}).`
        };
      }
    }
    const adjacency = /* @__PURE__ */ new Map();
    for (const link of state2.links) {
      if (!isComplete(link)) continue;
      if (!adjacency.has(link.source)) adjacency.set(link.source, []);
      adjacency.get(link.source)?.push(link.target);
    }
    const visited = /* @__PURE__ */ new Set();
    const path = [];
    const pathIndex = /* @__PURE__ */ new Map();
    function visit(id) {
      path.push(id);
      pathIndex.set(id, path.length - 1);
      visited.add(id);
      for (const next of adjacency.get(id) ?? []) {
        const nextIndex = pathIndex.get(next);
        if (nextIndex !== void 0) {
          return [...path.slice(nextIndex), next].map((nodeId) => nameById.get(nodeId) ?? nodeId);
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
    for (const node of state2.nodes) {
      if (!visited.has(node.id)) {
        const cycle = visit(node.id);
        if (cycle) {
          return { ok: false, error: `This link would create a cycle: ${cycle.join(" \u2192 ")}` };
        }
      }
    }
    return { ok: true };
  }

  // src/persist.ts
  var STORAGE_KEY = "sankey-builder";
  var LINK_COLOR_MODES = /* @__PURE__ */ new Set([
    "source",
    "target",
    "source-target",
    "static"
  ]);
  var ALIGNMENTS = /* @__PURE__ */ new Set(["left", "right", "center", "justify"]);
  var THEMES = /* @__PURE__ */ new Set(["auto", "light", "dark"]);
  var NODE_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
  function isLinkColorMode(value) {
    return typeof value === "string" && LINK_COLOR_MODES.has(value);
  }
  function isAlignment(value) {
    return typeof value === "string" && ALIGNMENTS.has(value);
  }
  function isTheme(value) {
    return typeof value === "string" && THEMES.has(value);
  }
  function normalizeSettings(settings, repairs) {
    const s = settings && typeof settings === "object" ? settings : {};
    let palette = "observable10";
    if (isPaletteKey(s.palette)) palette = s.palette;
    else if (s.palette !== void 0) repairs?.push("settings: unknown palette \u2014 using default");
    let colorMode = "auto";
    if (s.colorMode === "manual") colorMode = "manual";
    else if (s.colorMode !== void 0 && s.colorMode !== "auto")
      repairs?.push("settings: unknown color mode \u2014 using default");
    let linkColor = "source-target";
    if (isLinkColorMode(s.linkColor)) linkColor = s.linkColor;
    else if (s.linkColor !== void 0) repairs?.push("settings: unknown link color \u2014 using default");
    let alignment = "justify";
    if (isAlignment(s.alignment)) alignment = s.alignment;
    else if (s.alignment !== void 0) repairs?.push("settings: unknown alignment \u2014 using default");
    const theme = isTheme(s.theme) ? s.theme : "auto";
    return { palette, colorMode, linkColor, alignment, theme };
  }
  function isRawState(value) {
    if (!value || typeof value !== "object") return false;
    const v = value;
    return Array.isArray(v.nodes) && Array.isArray(v.links);
  }
  function isRawNode(value) {
    if (!value || typeof value !== "object") return false;
    const v = value;
    return typeof v.id === "string" && typeof v.name === "string";
  }
  function isRawLink(value) {
    return Boolean(value) && typeof value === "object";
  }
  function normalizeNodes(rawNodes, repairs) {
    const nodes = [];
    rawNodes.forEach((value, index) => {
      if (!isRawNode(value)) {
        repairs?.push(`node ${index + 1}: missing id or name \u2014 dropped`);
        return;
      }
      const node = { id: value.id, name: value.name };
      if (value.color !== void 0) {
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
  function normalizeLinks(rawLinks, nodeIds, repairs) {
    const links = [];
    rawLinks.forEach((value, index) => {
      if (!isRawLink(value)) {
        repairs?.push(`link ${index + 1}: not an object \u2014 dropped`);
        return;
      }
      const source = normalizeEndpoint(value.source, nodeIds);
      if (source === null && value.source != null) {
        repairs?.push(`link ${index + 1}: unknown source \u2014 left unassigned`);
      }
      const target = normalizeEndpoint(value.target, nodeIds);
      if (target === null && value.target != null) {
        repairs?.push(`link ${index + 1}: unknown target \u2014 left unassigned`);
      }
      if (value.value !== void 0 && !isValidLinkValue(value.value)) {
        repairs?.push(`link ${index + 1}: invalid value \u2014 set to 1`);
      }
      links.push({ source, target, value: normalizeLinkValue(value.value) });
    });
    return links;
  }
  function normalizeState(parsed) {
    if (!isRawState(parsed)) return defaultState();
    const nodes = normalizeNodes(parsed.nodes);
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = normalizeLinks(parsed.links, nodeIds);
    return { nodes, links, settings: normalizeSettings(parsed.settings) };
  }
  function normalizeEndpoint(value, nodeIds) {
    return typeof value === "string" && nodeIds.has(value) ? value : null;
  }
  function isValidLinkValue(value) {
    return typeof value === "number" && value > 0 && value <= MAX_LINK_VALUE;
  }
  function normalizeLinkValue(value) {
    return isValidLinkValue(value) ? value : 1;
  }
  function loadState() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      return defaultState();
    }
    if (!raw) return defaultState();
    try {
      return normalizeState(JSON.parse(raw));
    } catch {
      return defaultState();
    }
  }
  function saveState(state2) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state2));
      return true;
    } catch {
      return false;
    }
  }

  // src/io.ts
  function serializeState(state2) {
    const exported = {
      nodes: state2.nodes,
      links: state2.links.filter(isComplete),
      settings: {
        palette: state2.settings.palette,
        colorMode: state2.settings.colorMode,
        linkColor: state2.settings.linkColor,
        alignment: state2.settings.alignment
      }
    };
    return JSON.stringify(exported, null, 2);
  }
  var NOT_JSON = "This file isn't valid JSON, so it can't be a diagram export.";
  var NOT_A_DIAGRAM = `This file doesn't look like a diagram export (expected "nodes" and "links" arrays).`;
  function parseImport(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: NOT_JSON };
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: NOT_A_DIAGRAM };
    }
    const obj = parsed;
    if (!Array.isArray(obj.nodes) || !Array.isArray(obj.links)) {
      return { ok: false, error: NOT_A_DIAGRAM };
    }
    const repairs = [];
    const nodes = normalizeNodes(obj.nodes, repairs);
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = normalizeLinks(obj.links, nodeIds, repairs);
    const normalized = normalizeSettings(obj.settings, repairs);
    const settings = {
      palette: normalized.palette,
      colorMode: normalized.colorMode,
      linkColor: normalized.linkColor,
      alignment: normalized.alignment
    };
    return { ok: true, state: { nodes, links, settings }, repairs };
  }

  // src/io-controls.ts
  var EXPORT_JSON_FILENAME = "sankey.json";
  var EXPORT_SVG_FILENAME = "sankey.svg";
  var EXPORT_PNG_FILENAME = "sankey.png";
  var PNG_EXPORT_SCALE = 2;
  function setupIo(state2, actions) {
    const exportButton = document.getElementById("export-button");
    const exportSvgButton = document.getElementById("export-svg-button");
    const exportPngButton = document.getElementById("export-png-button");
    const importButton = document.getElementById("import-button");
    const fileInput = document.getElementById("import-file");
    if (!(fileInput instanceof HTMLInputElement)) return;
    exportButton?.addEventListener("click", () => {
      const blob = new Blob([serializeState(state2)], { type: "application/json" });
      download(blob, EXPORT_JSON_FILENAME);
      actions.reportExportSuccess(EXPORT_JSON_FILENAME);
    });
    exportSvgButton?.addEventListener("click", () => {
      const svg = serializeVisibleDiagram(actions);
      if (!svg) return;
      download(new Blob([svg], { type: "image/svg+xml" }), EXPORT_SVG_FILENAME);
      actions.reportExportSuccess(EXPORT_SVG_FILENAME);
    });
    exportPngButton?.addEventListener("click", () => {
      const svg = serializeVisibleDiagram(actions);
      if (!svg) return;
      rasterizeSvg(svg, DIAGRAM_WIDTH, DIAGRAM_HEIGHT, PNG_EXPORT_SCALE).then((blob) => {
        download(blob, EXPORT_PNG_FILENAME);
        actions.reportExportSuccess(EXPORT_PNG_FILENAME);
      }).catch((err) => {
        console.error(err);
        actions.reportExportError("PNG export failed. Try the SVG export instead.");
      });
    });
    importButton?.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (!file) return;
      let text;
      try {
        text = await file.text();
      } catch {
        actions.reportImportError("Could not read the selected file. Please try again.");
        return;
      }
      const result = parseImport(text);
      if (result.ok) actions.importDiagram(result.state, result.repairs);
      else actions.reportImportError(result.error);
    });
  }
  function serializeVisibleDiagram(actions) {
    const svgEl = document.querySelector("#diagram svg");
    if (!(svgEl instanceof SVGSVGElement)) {
      actions.reportExportError("Nothing to export \u2014 the diagram is empty.");
      return void 0;
    }
    const labelColor = getComputedStyle(svgEl).color;
    const background = getComputedStyle(svgEl.parentElement).backgroundColor;
    return serializeDiagramSvg(svgEl, { labelColor, background });
  }
  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  // src/row-reorder.ts
  function setupRowReorder(config) {
    const root = document.getElementById(config.rootId);
    if (!root) return;
    const rowSelector = `.${config.rowClass}`;
    const rowOf = (target) => target instanceof Element ? target.closest(rowSelector) : null;
    const rows = () => Array.from(root.querySelectorAll(rowSelector));
    root.addEventListener("keydown", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.classList.contains("drag-handle")) return;
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      const row = rowOf(target);
      if (!row) return;
      event.preventDefault();
      const current = rows();
      const from = current.indexOf(row);
      const to = event.key === "ArrowUp" ? from - 1 : from + 1;
      if (to < 0 || to >= current.length) return;
      const selector = config.refocusSelector(target, to);
      config.move(from, to);
      root.querySelector(selector)?.focus();
    });
  }
  var TOUCH_HOLD_DELAY_MS = 150;
  var TOUCH_START_THRESHOLD_PX = 4;
  function attachRowSortable(container, config, previous) {
    if (previous && Sortable.active === previous) {
      Sortable.ghost?.remove();
      Sortable.clone?.remove();
    }
    previous?.destroy();
    return new Sortable(container, {
      handle: ".drag-handle",
      group: config.rowClass,
      animation: 150,
      forceFallback: true,
      ghostClass: "row-ghost",
      chosenClass: "row-chosen",
      fallbackClass: "row-fallback",
      delay: TOUCH_HOLD_DELAY_MS,
      delayOnTouchOnly: true,
      touchStartThreshold: TOUCH_START_THRESHOLD_PX,
      onEnd(event) {
        const { oldIndex, newIndex } = event;
        if (oldIndex === void 0 || newIndex === void 0 || oldIndex === newIndex) return;
        config.move(oldIndex, newIndex);
      }
    });
  }

  // src/link-editor.ts
  function linkValueErrorId(index) {
    return `link-value-error-${index}`;
  }
  function linkValueErrorMessage(raw) {
    const trimmed = raw.trim();
    if (exceedsFractionDigits(trimmed)) return "Enter a number with up to 4 decimal places.";
    if (isPlainDecimalFormat(trimmed) && Number(trimmed) > MAX_LINK_VALUE) {
      return `Enter a number no greater than ${MAX_LINK_VALUE}.`;
    }
    return "Enter a plain number greater than 0.";
  }
  function renderLinkOptions(selectEl, nodes, selectedId, excludedId) {
    const select = d3.select(selectEl);
    select.selectAll("option").remove();
    select.append("option").attr("value", "").attr("selected", selectedId === null ? "" : null).text("\u2014 select \u2014");
    select.selectAll("option.node-option").data(nodes).join("option").attr("class", "node-option").attr("value", (n) => n.id).attr("disabled", (n) => n.id === excludedId ? "" : null).attr("selected", (n) => n.id === selectedId ? "" : null).text((n) => n.name);
  }
  var rowSortable = null;
  function renderLinkEditor(state2, moveLink2) {
    const root = d3.select("#link-editor");
    root.html("");
    root.append("h2").attr("id", "link-editor-heading").text("Links");
    const rowsContainer = root.append("div").attr("class", "link-rows");
    const row = rowsContainer.selectAll(".link-row").data(state2.links).join("div").attr("class", "link-row");
    row.append("button").attr("type", "button").attr("class", "drag-handle").attr("data-index", (_d, i) => i).attr("aria-label", (_d, i) => `Reorder link ${i + 1}`).text("\u283F");
    row.append("select").attr("class", "link-source").attr("data-action", "update-link-source").attr("data-index", (_d, i) => i).attr("aria-label", (_d, i) => `Source for link ${i + 1}`).each(function(d) {
      renderLinkOptions(this, state2.nodes, d.source, d.target);
    });
    row.append("select").attr("class", "link-target").attr("data-action", "update-link-target").attr("data-index", (_d, i) => i).attr("aria-label", (_d, i) => `Target for link ${i + 1}`).each(function(d) {
      renderLinkOptions(this, state2.nodes, d.target, d.source);
    });
    row.append("input").attr("type", "text").attr("inputmode", "decimal").attr("class", "link-value").attr("data-action", "update-link-value").attr("data-index", (_d, i) => i).attr("aria-label", (_d, i) => `Value for link ${i + 1}`).attr("aria-describedby", (_d, i) => linkValueErrorId(i)).attr("value", (d) => d.value);
    row.append("button").attr("type", "button").attr("class", "link-delete").attr("data-action", "delete-link").attr("data-index", (_d, i) => i).attr("aria-label", (_d, i) => `Delete link ${i + 1}`).text("Delete");
    row.append("span").attr("class", "field-error").attr("id", (_d, i) => linkValueErrorId(i));
    root.append("button").attr("type", "button").attr("class", "add-link").attr("data-action", "add-link").text("Add link");
    const container = rowsContainer.node();
    if (container) {
      rowSortable = attachRowSortable(
        container,
        { rowClass: "link-row", move: moveLink2 },
        rowSortable
      );
    }
  }
  function setLinkValueError(index, message) {
    const el = document.getElementById(linkValueErrorId(index));
    if (el) el.textContent = message;
  }
  function commitLinkValue(target, index, actions) {
    target.setAttribute("value", target.value);
    const parsed = parseLinkValue(target.value);
    if (parsed.kind === "valid") {
      target.removeAttribute("aria-invalid");
      setLinkValueError(index, "");
      actions.updateLinkValue(index, parsed.value);
    } else if (parsed.kind === "empty") {
      target.removeAttribute("aria-invalid");
      setLinkValueError(index, "");
    } else {
      target.setAttribute("aria-invalid", "true");
      setLinkValueError(index, linkValueErrorMessage(target.value));
    }
  }
  function setupLinkEditor(actions, state2) {
    const root = document.getElementById("link-editor");
    if (!root) return;
    setupRowReorder({
      rootId: "link-editor",
      rowClass: "link-row",
      move: actions.moveLink,
      // Links have no stable id — refocus the handle now at the new index.
      refocusSelector: (_handle, to) => `.drag-handle[data-index="${to}"]`
    });
    root.addEventListener("click", (event) => {
      if (!(event.target instanceof HTMLElement)) return;
      const { action, index } = event.target.dataset;
      if (action === "add-link") {
        actions.addLink();
      } else if (action === "delete-link" && index !== void 0) {
        actions.deleteLink(Number(index));
      }
    });
    root.addEventListener("change", (event) => {
      const target = event.target;
      if (target instanceof HTMLSelectElement) {
        const { action: action2, index: index2 } = target.dataset;
        if (index2 === void 0) return;
        if (action2 === "update-link-source") {
          actions.updateLinkSource(Number(index2), target.value || null);
        } else if (action2 === "update-link-target") {
          actions.updateLinkTarget(Number(index2), target.value || null);
        }
        return;
      }
      if (!(target instanceof HTMLInputElement)) return;
      const { action, index } = target.dataset;
      if (action !== "update-link-value" || index === void 0) return;
      const parsed = parseLinkValue(target.value);
      if (parsed.kind !== "valid") {
        target.value = String(state2.links[Number(index)].value);
        target.removeAttribute("aria-invalid");
        setLinkValueError(Number(index), "");
      }
    });
    root.addEventListener("beforeinput", (event) => {
      if (!(event instanceof InputEvent)) return;
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      const { action, index } = target.dataset;
      if (action !== "update-link-value" || index === void 0) return;
      if (event.data == null) return;
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      const prospective = target.value.slice(0, start) + event.data + target.value.slice(end);
      if (!exceedsFractionDigits(prospective)) return;
      if (event.inputType === "insertText") {
        event.preventDefault();
      } else if (event.inputType === "insertFromPaste" || event.inputType === "insertFromDrop") {
        event.preventDefault();
        const trimmed = truncateFractionDigits(prospective);
        target.value = trimmed;
        const caret = Math.min(start + event.data.length, trimmed.length);
        target.setSelectionRange(caret, caret);
        commitLinkValue(target, Number(index), actions);
      }
    });
    root.addEventListener("input", (event) => {
      if (!(event.target instanceof HTMLInputElement)) return;
      const target = event.target;
      const { action, index } = target.dataset;
      if (action !== "update-link-value" || index === void 0) return;
      commitLinkValue(target, Number(index), actions);
    });
  }

  // src/node-editor.ts
  var rowSortable2 = null;
  function renderNodeEditor(state2, nodeColor, moveNode2) {
    const root = d3.select("#node-editor");
    root.html("");
    root.append("h2").attr("id", "node-editor-heading").text("Nodes");
    const manual = state2.settings.colorMode === "manual";
    const rowsContainer = root.append("div").attr("class", "node-rows");
    const row = rowsContainer.selectAll(".node-row").data(state2.nodes, (d) => d.id).join("div").attr("class", `node-row${manual ? " manual" : ""}`);
    row.append("button").attr("type", "button").attr("class", "drag-handle").attr("data-index", (_d, i) => i).attr("data-id", (d) => d.id).attr("aria-label", (d) => `Reorder ${d.name}`).text("\u283F");
    row.append("span").attr("class", "node-swatch").style("background-color", (d) => nodeColor(d));
    row.append("input").attr("type", "text").attr("class", "node-name").attr("data-action", "rename-node").attr("data-id", (d) => d.id).attr("aria-label", (d) => `Name for ${d.name}`).attr("value", (d) => d.name);
    if (manual) {
      row.append("input").attr("type", "color").attr("class", "node-color").attr("data-action", "update-node-color").attr("data-id", (d) => d.id).attr("aria-label", (d) => `Color for ${d.name}`).attr("value", (d) => d.color ?? nodeColor(d));
    }
    row.append("button").attr("type", "button").attr("class", "node-delete").attr("data-action", "delete-node").attr("data-id", (d) => d.id).attr("aria-label", (d) => `Delete ${d.name}`).text("Delete");
    root.append("button").attr("type", "button").attr("class", "add-node").attr("data-action", "add-node").text("Add node");
    const container = rowsContainer.node();
    if (container) {
      rowSortable2 = attachRowSortable(
        container,
        { rowClass: "node-row", move: moveNode2 },
        rowSortable2
      );
    }
  }
  function setupNodeEditor(actions) {
    const root = document.getElementById("node-editor");
    if (!root) return;
    setupRowReorder({
      rootId: "node-editor",
      rowClass: "node-row",
      move: actions.moveNode,
      // Refocus the same node's handle by its stable id after the rebuild.
      refocusSelector: (handle) => `.drag-handle[data-id="${handle.dataset.id}"]`
    });
    root.addEventListener("click", (event) => {
      if (!(event.target instanceof HTMLElement)) return;
      const { action, id } = event.target.dataset;
      if (action === "add-node") {
        actions.addNode();
      } else if (action === "delete-node" && id !== void 0) {
        actions.deleteNode(id);
      }
    });
    root.addEventListener("input", (event) => {
      if (!(event.target instanceof HTMLInputElement)) return;
      const { action, id } = event.target.dataset;
      if (action === "rename-node" && id !== void 0) {
        actions.renameNode(id, event.target.value);
        event.target.setAttribute("value", event.target.value);
        event.target.setAttribute("aria-label", `Name for ${event.target.value}`);
        const row = event.target.closest(".node-row");
        const deleteButton = row?.querySelector(".node-delete");
        deleteButton?.setAttribute("aria-label", `Delete ${event.target.value}`);
        const colorInput = row?.querySelector(".node-color");
        colorInput?.setAttribute("aria-label", `Color for ${event.target.value}`);
        const handle = row?.querySelector(".drag-handle");
        handle?.setAttribute("aria-label", `Reorder ${event.target.value}`);
      } else if (action === "update-node-color" && id !== void 0) {
        actions.updateNodeColor(id, event.target.value);
        event.target.setAttribute("value", event.target.value);
        const swatch = event.target.closest(".node-row")?.querySelector(".node-swatch");
        if (swatch) swatch.style.backgroundColor = event.target.value;
      }
    });
  }

  // src/resizer.ts
  var EDITOR_COLUMN_MIN_WIDTH = 240;
  var EDITOR_COLUMN_MAX_WIDTH = 640;
  var EDITOR_COLUMN_ARROW_STEP = 16;
  function setupResizer() {
    const dividerEl = document.getElementById("resizer");
    const editorColumnEl = document.querySelector(".editor-column");
    if (!dividerEl || !editorColumnEl) return;
    const divider = dividerEl;
    const editorColumn = editorColumnEl;
    function clamp(width) {
      return Math.min(EDITOR_COLUMN_MAX_WIDTH, Math.max(EDITOR_COLUMN_MIN_WIDTH, width));
    }
    function setWidth(width) {
      const clamped = clamp(width);
      editorColumn.style.width = `${clamped}px`;
      divider.setAttribute("aria-valuenow", String(Math.round(clamped)));
    }
    divider.setAttribute("aria-valuemin", String(EDITOR_COLUMN_MIN_WIDTH));
    divider.setAttribute("aria-valuemax", String(EDITOR_COLUMN_MAX_WIDTH));
    divider.setAttribute(
      "aria-valuenow",
      String(Math.round(editorColumn.getBoundingClientRect().width))
    );
    let startX = 0;
    let startWidth = 0;
    function onPointerMove(event) {
      setWidth(startWidth + (event.clientX - startX));
    }
    function onPointerUp(event) {
      divider.releasePointerCapture(event.pointerId);
      divider.removeEventListener("pointermove", onPointerMove);
      divider.removeEventListener("pointerup", onPointerUp);
      divider.removeEventListener("pointercancel", onPointerUp);
      divider.classList.remove("is-dragging");
      document.body.classList.remove("resizing");
    }
    divider.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      divider.focus();
      startX = event.clientX;
      startWidth = editorColumn.getBoundingClientRect().width;
      divider.setPointerCapture(event.pointerId);
      divider.classList.add("is-dragging");
      document.body.classList.add("resizing");
      divider.addEventListener("pointermove", onPointerMove);
      divider.addEventListener("pointerup", onPointerUp);
      divider.addEventListener("pointercancel", onPointerUp);
      event.preventDefault();
    });
    divider.addEventListener("keydown", (event) => {
      const current = editorColumn.getBoundingClientRect().width;
      if (event.key === "ArrowLeft") {
        setWidth(current - EDITOR_COLUMN_ARROW_STEP);
        event.preventDefault();
      } else if (event.key === "ArrowRight") {
        setWidth(current + EDITOR_COLUMN_ARROW_STEP);
        event.preventDefault();
      }
    });
  }

  // src/theme.ts
  function applyTheme(theme) {
    if (theme === "auto") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }

  // src/main.ts
  var STORAGE_NOTICE = "Changes can't be saved in this browser right now (storage may be full or unavailable). The diagram keeps working, but edits won't survive closing or reloading this tab \u2014 try freeing up space or leaving private/incognito mode.";
  var state;
  function refresh({ rebuildNodes = true, rebuildLinks = true } = {}) {
    const nodeColor = createNodeColorResolver(state);
    const result = validate(state);
    d3.select("#error").text(result.ok ? "" : result.error ?? "");
    d3.select("#io-notice").text("");
    const saved = saveState(state);
    d3.select("#storage-notice").text(saved ? "" : STORAGE_NOTICE);
    if (rebuildNodes) renderNodeEditor(state, nodeColor, nodeEditorActions.moveNode);
    if (rebuildLinks) renderLinkEditor(state, linkEditorActions.moveLink);
    if (!result.ok) return;
    renderDiagram(state, nodeColor);
  }
  var nodeEditorActions = {
    addNode() {
      addNode(state);
      refresh();
    },
    deleteNode(id) {
      deleteNode(state, id);
      refresh();
    },
    renameNode(id, name) {
      renameNode(state, id, name);
      refresh({ rebuildNodes: false });
    },
    updateNodeColor(id, color) {
      updateNodeColor(state, id, color);
      refresh({ rebuildNodes: false, rebuildLinks: false });
    },
    moveNode(from, to) {
      moveNode(state, from, to);
      refresh();
    }
  };
  var linkEditorActions = {
    addLink() {
      addLink(state);
      refresh();
    },
    deleteLink(index) {
      deleteLink(state, index);
      refresh();
    },
    updateLinkSource(index, id) {
      updateLink(state, index, { source: id });
      refresh();
    },
    updateLinkTarget(index, id) {
      updateLink(state, index, { target: id });
      refresh();
    },
    updateLinkValue(index, value) {
      updateLink(state, index, { value });
      refresh({ rebuildNodes: false, rebuildLinks: false });
    },
    moveLink(from, to) {
      moveLink(state, from, to);
      refresh({ rebuildNodes: false });
    }
  };
  var ioActions = {
    importDiagram(imported, repairs) {
      state.nodes.length = 0;
      state.nodes.push(...imported.nodes);
      state.links.length = 0;
      state.links.push(...imported.links);
      state.settings.palette = imported.settings.palette;
      state.settings.colorMode = imported.settings.colorMode;
      state.settings.linkColor = imported.settings.linkColor;
      state.settings.alignment = imported.settings.alignment;
      syncControls(state);
      refresh();
      let message = `Imported ${state.nodes.length} nodes, ${state.links.length} links.`;
      if (repairs.length > 0) message += ` Adjustments: ${repairs.join("; ")}.`;
      d3.select("#io-notice").text(message);
    },
    reportImportError(message) {
      d3.select("#io-notice").text(message);
    },
    reportExportError(message) {
      d3.select("#io-notice").text(message);
    },
    reportExportSuccess(filename) {
      d3.select("#io-notice").text(`Exported ${filename}.`);
    }
  };
  var controlsActions = {
    setLinkColor(value) {
      state.settings.linkColor = value;
      refresh();
    },
    setAlignment(value) {
      state.settings.alignment = value;
      refresh();
    },
    selectPalette(raw) {
      if (raw === "manual") {
        enterManualMode(state);
      } else {
        state.settings.palette = raw;
        state.settings.colorMode = "auto";
      }
      refresh();
    },
    setTheme(value) {
      state.settings.theme = value;
      applyTheme(value);
      refresh({ rebuildNodes: false, rebuildLinks: false });
    }
  };
  function init() {
    state = loadState();
    applyTheme(state.settings.theme);
    setupNodeEditor(nodeEditorActions);
    setupLinkEditor(linkEditorActions, state);
    setupControls(state, controlsActions);
    setupIo(state, ioActions);
    setupResizer();
    refresh();
  }
  init();
})();
