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
  function setupControls(state2, actions) {
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

  // src/link-editor.ts
  function renderLinkOptions(selectEl, nodes, selectedId, excludedId) {
    const select = d3.select(selectEl);
    select.selectAll("option").remove();
    select.append("option").attr("value", "").property("selected", selectedId === null).text("\u2014 select \u2014");
    select.selectAll("option.node-option").data(nodes).join("option").attr("class", "node-option").attr("value", (n) => n.id).property("disabled", (n) => n.id === excludedId).property("selected", (n) => n.id === selectedId).text((n) => n.name);
  }
  function renderLinkEditor(state2) {
    const root = d3.select("#link-editor");
    root.html("");
    root.append("h2").attr("id", "link-editor-heading").text("Links");
    const row = root.append("div").attr("class", "link-rows").selectAll(".link-row").data(state2.links).join("div").attr("class", "link-row");
    row.append("select").attr("class", "link-source").attr("data-action", "update-link-source").attr("data-index", (_d, i) => i).attr("aria-label", (_d, i) => `Source for link ${i + 1}`).each(function(d) {
      renderLinkOptions(this, state2.nodes, d.source, d.target);
    });
    row.append("select").attr("class", "link-target").attr("data-action", "update-link-target").attr("data-index", (_d, i) => i).attr("aria-label", (_d, i) => `Target for link ${i + 1}`).each(function(d) {
      renderLinkOptions(this, state2.nodes, d.target, d.source);
    });
    row.append("input").attr("type", "text").attr("inputmode", "decimal").attr("class", "link-value").attr("data-action", "update-link-value").attr("data-index", (_d, i) => i).attr("aria-label", (_d, i) => `Value for link ${i + 1}`).property("value", (d) => d.value);
    row.append("button").attr("type", "button").attr("class", "link-delete").attr("data-action", "delete-link").attr("data-index", (_d, i) => i).attr("aria-label", (_d, i) => `Delete link ${i + 1}`).text("Delete");
    root.append("button").attr("type", "button").attr("class", "add-link").attr("data-action", "add-link").text("Add link");
  }
  function commitLinkValue(target, index, actions) {
    const parsed = parseLinkValue(target.value);
    if (parsed.kind === "valid") {
      target.removeAttribute("aria-invalid");
      actions.updateLinkValue(index, parsed.value);
    } else if (parsed.kind === "empty") {
      target.removeAttribute("aria-invalid");
    } else {
      target.setAttribute("aria-invalid", "true");
    }
  }
  function setupLinkEditor(actions, state2) {
    const root = document.getElementById("link-editor");
    if (!root) return;
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
  function renderNodeEditor(state2, nodeColor) {
    const root = d3.select("#node-editor");
    root.html("");
    root.append("h2").attr("id", "node-editor-heading").text("Nodes");
    const manual = state2.settings.colorMode === "manual";
    const row = root.append("div").attr("class", "node-rows").selectAll(".node-row").data(state2.nodes, (d) => d.id).join("div").attr("class", `node-row${manual ? " manual" : ""}`);
    row.append("span").attr("class", "node-swatch").style("background-color", (d) => nodeColor(d));
    row.append("input").attr("type", "text").attr("class", "node-name").attr("data-action", "rename-node").attr("data-id", (d) => d.id).attr("aria-label", (d) => `Name for ${d.name}`).property("value", (d) => d.name);
    if (manual) {
      row.append("input").attr("type", "color").attr("class", "node-color").attr("data-action", "update-node-color").attr("data-id", (d) => d.id).attr("aria-label", (d) => `Color for ${d.name}`).property("value", (d) => d.color ?? nodeColor(d));
    }
    row.append("button").attr("type", "button").attr("class", "node-delete").attr("data-action", "delete-node").attr("data-id", (d) => d.id).attr("aria-label", (d) => `Delete ${d.name}`).text("Delete");
    root.append("button").attr("type", "button").attr("class", "add-node").attr("data-action", "add-node").text("Add node");
  }
  function setupNodeEditor(actions) {
    const root = document.getElementById("node-editor");
    if (!root) return;
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
        event.target.setAttribute("aria-label", `Name for ${event.target.value}`);
        const row = event.target.closest(".node-row");
        const deleteButton = row?.querySelector(".node-delete");
        deleteButton?.setAttribute("aria-label", `Delete ${event.target.value}`);
        const colorInput = row?.querySelector(".node-color");
        colorInput?.setAttribute("aria-label", `Color for ${event.target.value}`);
      } else if (action === "update-node-color" && id !== void 0) {
        actions.updateNodeColor(id, event.target.value);
        const swatch = event.target.closest(".node-row")?.querySelector(".node-swatch");
        if (swatch) swatch.style.backgroundColor = event.target.value;
      }
    });
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
  function normalizeSettings(settings) {
    const s = settings && typeof settings === "object" ? settings : {};
    return {
      palette: isPaletteKey(s.palette) ? s.palette : "observable10",
      colorMode: s.colorMode === "manual" ? "manual" : "auto",
      // An unrecognized linkColor would otherwise render as url() references
      // to gradients that don't exist — invisible links — so it falls back
      // rather than passing through like alignment/palette do downstream.
      linkColor: isLinkColorMode(s.linkColor) ? s.linkColor : "source-target",
      alignment: isAlignment(s.alignment) ? s.alignment : "justify",
      theme: isTheme(s.theme) ? s.theme : "auto"
    };
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
  function normalizeState(parsed) {
    if (!isRawState(parsed)) return defaultState();
    const nodes = parsed.nodes.filter(isRawNode).map((n) => {
      const node = { id: n.id, name: n.name };
      if (typeof n.color === "string" && NODE_COLOR_RE.test(n.color)) node.color = n.color;
      return node;
    });
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = parsed.links.filter(isRawLink).map((l) => ({
      source: normalizeEndpoint(l.source, nodeIds),
      target: normalizeEndpoint(l.target, nodeIds),
      value: normalizeLinkValue(l.value)
    }));
    return { nodes, links, settings: normalizeSettings(parsed.settings) };
  }
  function normalizeEndpoint(value, nodeIds) {
    return typeof value === "string" && nodeIds.has(value) ? value : null;
  }
  function normalizeLinkValue(value) {
    return typeof value === "number" && value > 0 && value <= MAX_LINK_VALUE ? value : 1;
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
    const saved = saveState(state);
    d3.select("#storage-notice").text(saved ? "" : STORAGE_NOTICE);
    if (rebuildNodes) renderNodeEditor(state, nodeColor);
    if (rebuildLinks) renderLinkEditor(state);
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
    setupResizer();
    refresh();
  }
  init();
})();
