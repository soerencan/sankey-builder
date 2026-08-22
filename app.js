"use strict";
(() => {
  // node_modules/internmap/src/index.js
  var InternMap = class extends Map {
    constructor(entries, key = keyof) {
      super();
      Object.defineProperties(this, { _intern: { value: /* @__PURE__ */ new Map() }, _key: { value: key } });
      if (entries != null) for (const [key2, value2] of entries) this.set(key2, value2);
    }
    get(key) {
      return super.get(intern_get(this, key));
    }
    has(key) {
      return super.has(intern_get(this, key));
    }
    set(key, value2) {
      return super.set(intern_set(this, key), value2);
    }
    delete(key) {
      return super.delete(intern_delete(this, key));
    }
  };
  function intern_get({ _intern, _key }, value2) {
    const key = _key(value2);
    return _intern.has(key) ? _intern.get(key) : value2;
  }
  function intern_set({ _intern, _key }, value2) {
    const key = _key(value2);
    if (_intern.has(key)) return _intern.get(key);
    _intern.set(key, value2);
    return value2;
  }
  function intern_delete({ _intern, _key }, value2) {
    const key = _key(value2);
    if (_intern.has(key)) {
      value2 = _intern.get(value2);
      _intern.delete(key);
    }
    return value2;
  }
  function keyof(value2) {
    return value2 !== null && typeof value2 === "object" ? value2.valueOf() : value2;
  }

  // node_modules/d3-dispatch/src/dispatch.js
  var noop = { value: () => {
  } };
  function dispatch() {
    for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
      if (!(t = arguments[i] + "") || t in _ || /[\s.]/.test(t)) throw new Error("illegal type: " + t);
      _[t] = [];
    }
    return new Dispatch(_);
  }
  function Dispatch(_) {
    this._ = _;
  }
  function parseTypenames(typenames, types) {
    return typenames.trim().split(/^|\s+/).map(function(t) {
      var name = "", i = t.indexOf(".");
      if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
      if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
      return { type: t, name };
    });
  }
  Dispatch.prototype = dispatch.prototype = {
    constructor: Dispatch,
    on: function(typename, callback) {
      var _ = this._, T = parseTypenames(typename + "", _), t, i = -1, n = T.length;
      if (arguments.length < 2) {
        while (++i < n) if ((t = (typename = T[i]).type) && (t = get(_[t], typename.name))) return t;
        return;
      }
      if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
      while (++i < n) {
        if (t = (typename = T[i]).type) _[t] = set(_[t], typename.name, callback);
        else if (callback == null) for (t in _) _[t] = set(_[t], typename.name, null);
      }
      return this;
    },
    copy: function() {
      var copy = {}, _ = this._;
      for (var t in _) copy[t] = _[t].slice();
      return new Dispatch(copy);
    },
    call: function(type2, that) {
      if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
      if (!this._.hasOwnProperty(type2)) throw new Error("unknown type: " + type2);
      for (t = this._[type2], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
    },
    apply: function(type2, that, args) {
      if (!this._.hasOwnProperty(type2)) throw new Error("unknown type: " + type2);
      for (var t = this._[type2], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
    }
  };
  function get(type2, name) {
    for (var i = 0, n = type2.length, c; i < n; ++i) {
      if ((c = type2[i]).name === name) {
        return c.value;
      }
    }
  }
  function set(type2, name, callback) {
    for (var i = 0, n = type2.length; i < n; ++i) {
      if (type2[i].name === name) {
        type2[i] = noop, type2 = type2.slice(0, i).concat(type2.slice(i + 1));
        break;
      }
    }
    if (callback != null) type2.push({ name, value: callback });
    return type2;
  }
  var dispatch_default = dispatch;

  // node_modules/d3-selection/src/namespaces.js
  var xhtml = "http://www.w3.org/1999/xhtml";
  var namespaces_default = {
    svg: "http://www.w3.org/2000/svg",
    xhtml,
    xlink: "http://www.w3.org/1999/xlink",
    xml: "http://www.w3.org/XML/1998/namespace",
    xmlns: "http://www.w3.org/2000/xmlns/"
  };

  // node_modules/d3-selection/src/namespace.js
  function namespace_default(name) {
    var prefix = name += "", i = prefix.indexOf(":");
    if (i >= 0 && (prefix = name.slice(0, i)) !== "xmlns") name = name.slice(i + 1);
    return namespaces_default.hasOwnProperty(prefix) ? { space: namespaces_default[prefix], local: name } : name;
  }

  // node_modules/d3-selection/src/creator.js
  function creatorInherit(name) {
    return function() {
      var document2 = this.ownerDocument, uri = this.namespaceURI;
      return uri === xhtml && document2.documentElement.namespaceURI === xhtml ? document2.createElement(name) : document2.createElementNS(uri, name);
    };
  }
  function creatorFixed(fullname) {
    return function() {
      return this.ownerDocument.createElementNS(fullname.space, fullname.local);
    };
  }
  function creator_default(name) {
    var fullname = namespace_default(name);
    return (fullname.local ? creatorFixed : creatorInherit)(fullname);
  }

  // node_modules/d3-selection/src/selector.js
  function none() {
  }
  function selector_default(selector) {
    return selector == null ? none : function() {
      return this.querySelector(selector);
    };
  }

  // node_modules/d3-selection/src/selection/select.js
  function select_default(select) {
    if (typeof select !== "function") select = selector_default(select);
    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
        if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
          if ("__data__" in node) subnode.__data__ = node.__data__;
          subgroup[i] = subnode;
        }
      }
    }
    return new Selection(subgroups, this._parents);
  }

  // node_modules/d3-selection/src/array.js
  function array(x2) {
    return x2 == null ? [] : Array.isArray(x2) ? x2 : Array.from(x2);
  }

  // node_modules/d3-selection/src/selectorAll.js
  function empty() {
    return [];
  }
  function selectorAll_default(selector) {
    return selector == null ? empty : function() {
      return this.querySelectorAll(selector);
    };
  }

  // node_modules/d3-selection/src/selection/selectAll.js
  function arrayAll(select) {
    return function() {
      return array(select.apply(this, arguments));
    };
  }
  function selectAll_default(select) {
    if (typeof select === "function") select = arrayAll(select);
    else select = selectorAll_default(select);
    for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          subgroups.push(select.call(node, node.__data__, i, group));
          parents.push(node);
        }
      }
    }
    return new Selection(subgroups, parents);
  }

  // node_modules/d3-selection/src/matcher.js
  function matcher_default(selector) {
    return function() {
      return this.matches(selector);
    };
  }
  function childMatcher(selector) {
    return function(node) {
      return node.matches(selector);
    };
  }

  // node_modules/d3-selection/src/selection/selectChild.js
  var find = Array.prototype.find;
  function childFind(match) {
    return function() {
      return find.call(this.children, match);
    };
  }
  function childFirst() {
    return this.firstElementChild;
  }
  function selectChild_default(match) {
    return this.select(match == null ? childFirst : childFind(typeof match === "function" ? match : childMatcher(match)));
  }

  // node_modules/d3-selection/src/selection/selectChildren.js
  var filter = Array.prototype.filter;
  function children() {
    return Array.from(this.children);
  }
  function childrenFilter(match) {
    return function() {
      return filter.call(this.children, match);
    };
  }
  function selectChildren_default(match) {
    return this.selectAll(match == null ? children : childrenFilter(typeof match === "function" ? match : childMatcher(match)));
  }

  // node_modules/d3-selection/src/selection/filter.js
  function filter_default(match) {
    if (typeof match !== "function") match = matcher_default(match);
    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
        if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
          subgroup.push(node);
        }
      }
    }
    return new Selection(subgroups, this._parents);
  }

  // node_modules/d3-selection/src/selection/sparse.js
  function sparse_default(update) {
    return new Array(update.length);
  }

  // node_modules/d3-selection/src/selection/enter.js
  function enter_default() {
    return new Selection(this._enter || this._groups.map(sparse_default), this._parents);
  }
  function EnterNode(parent, datum2) {
    this.ownerDocument = parent.ownerDocument;
    this.namespaceURI = parent.namespaceURI;
    this._next = null;
    this._parent = parent;
    this.__data__ = datum2;
  }
  EnterNode.prototype = {
    constructor: EnterNode,
    appendChild: function(child) {
      return this._parent.insertBefore(child, this._next);
    },
    insertBefore: function(child, next) {
      return this._parent.insertBefore(child, next);
    },
    querySelector: function(selector) {
      return this._parent.querySelector(selector);
    },
    querySelectorAll: function(selector) {
      return this._parent.querySelectorAll(selector);
    }
  };

  // node_modules/d3-selection/src/constant.js
  function constant_default(x2) {
    return function() {
      return x2;
    };
  }

  // node_modules/d3-selection/src/selection/data.js
  function bindIndex(parent, group, enter, update, exit, data) {
    var i = 0, node, groupLength = group.length, dataLength = data.length;
    for (; i < dataLength; ++i) {
      if (node = group[i]) {
        node.__data__ = data[i];
        update[i] = node;
      } else {
        enter[i] = new EnterNode(parent, data[i]);
      }
    }
    for (; i < groupLength; ++i) {
      if (node = group[i]) {
        exit[i] = node;
      }
    }
  }
  function bindKey(parent, group, enter, update, exit, data, key) {
    var i, node, nodeByKeyValue = /* @__PURE__ */ new Map(), groupLength = group.length, dataLength = data.length, keyValues = new Array(groupLength), keyValue;
    for (i = 0; i < groupLength; ++i) {
      if (node = group[i]) {
        keyValues[i] = keyValue = key.call(node, node.__data__, i, group) + "";
        if (nodeByKeyValue.has(keyValue)) {
          exit[i] = node;
        } else {
          nodeByKeyValue.set(keyValue, node);
        }
      }
    }
    for (i = 0; i < dataLength; ++i) {
      keyValue = key.call(parent, data[i], i, data) + "";
      if (node = nodeByKeyValue.get(keyValue)) {
        update[i] = node;
        node.__data__ = data[i];
        nodeByKeyValue.delete(keyValue);
      } else {
        enter[i] = new EnterNode(parent, data[i]);
      }
    }
    for (i = 0; i < groupLength; ++i) {
      if ((node = group[i]) && nodeByKeyValue.get(keyValues[i]) === node) {
        exit[i] = node;
      }
    }
  }
  function datum(node) {
    return node.__data__;
  }
  function data_default(value2, key) {
    if (!arguments.length) return Array.from(this, datum);
    var bind = key ? bindKey : bindIndex, parents = this._parents, groups = this._groups;
    if (typeof value2 !== "function") value2 = constant_default(value2);
    for (var m = groups.length, update = new Array(m), enter = new Array(m), exit = new Array(m), j = 0; j < m; ++j) {
      var parent = parents[j], group = groups[j], groupLength = group.length, data = arraylike(value2.call(parent, parent && parent.__data__, j, parents)), dataLength = data.length, enterGroup = enter[j] = new Array(dataLength), updateGroup = update[j] = new Array(dataLength), exitGroup = exit[j] = new Array(groupLength);
      bind(parent, group, enterGroup, updateGroup, exitGroup, data, key);
      for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) {
        if (previous = enterGroup[i0]) {
          if (i0 >= i1) i1 = i0 + 1;
          while (!(next = updateGroup[i1]) && ++i1 < dataLength) ;
          previous._next = next || null;
        }
      }
    }
    update = new Selection(update, parents);
    update._enter = enter;
    update._exit = exit;
    return update;
  }
  function arraylike(data) {
    return typeof data === "object" && "length" in data ? data : Array.from(data);
  }

  // node_modules/d3-selection/src/selection/exit.js
  function exit_default() {
    return new Selection(this._exit || this._groups.map(sparse_default), this._parents);
  }

  // node_modules/d3-selection/src/selection/join.js
  function join_default(onenter, onupdate, onexit) {
    var enter = this.enter(), update = this, exit = this.exit();
    if (typeof onenter === "function") {
      enter = onenter(enter);
      if (enter) enter = enter.selection();
    } else {
      enter = enter.append(onenter + "");
    }
    if (onupdate != null) {
      update = onupdate(update);
      if (update) update = update.selection();
    }
    if (onexit == null) exit.remove();
    else onexit(exit);
    return enter && update ? enter.merge(update).order() : update;
  }

  // node_modules/d3-selection/src/selection/merge.js
  function merge_default(context) {
    var selection2 = context.selection ? context.selection() : context;
    for (var groups0 = this._groups, groups1 = selection2._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
      for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group0[i] || group1[i]) {
          merge[i] = node;
        }
      }
    }
    for (; j < m0; ++j) {
      merges[j] = groups0[j];
    }
    return new Selection(merges, this._parents);
  }

  // node_modules/d3-selection/src/selection/order.js
  function order_default() {
    for (var groups = this._groups, j = -1, m = groups.length; ++j < m; ) {
      for (var group = groups[j], i = group.length - 1, next = group[i], node; --i >= 0; ) {
        if (node = group[i]) {
          if (next && node.compareDocumentPosition(next) ^ 4) next.parentNode.insertBefore(node, next);
          next = node;
        }
      }
    }
    return this;
  }

  // node_modules/d3-selection/src/selection/sort.js
  function sort_default(compare) {
    if (!compare) compare = ascending;
    function compareNode(a, b) {
      return a && b ? compare(a.__data__, b.__data__) : !a - !b;
    }
    for (var groups = this._groups, m = groups.length, sortgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, sortgroup = sortgroups[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          sortgroup[i] = node;
        }
      }
      sortgroup.sort(compareNode);
    }
    return new Selection(sortgroups, this._parents).order();
  }
  function ascending(a, b) {
    return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
  }

  // node_modules/d3-selection/src/selection/call.js
  function call_default() {
    var callback = arguments[0];
    arguments[0] = this;
    callback.apply(null, arguments);
    return this;
  }

  // node_modules/d3-selection/src/selection/nodes.js
  function nodes_default() {
    return Array.from(this);
  }

  // node_modules/d3-selection/src/selection/node.js
  function node_default() {
    for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
      for (var group = groups[j], i = 0, n = group.length; i < n; ++i) {
        var node = group[i];
        if (node) return node;
      }
    }
    return null;
  }

  // node_modules/d3-selection/src/selection/size.js
  function size_default() {
    let size = 0;
    for (const node of this) ++size;
    return size;
  }

  // node_modules/d3-selection/src/selection/empty.js
  function empty_default() {
    return !this.node();
  }

  // node_modules/d3-selection/src/selection/each.js
  function each_default(callback) {
    for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
      for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
        if (node = group[i]) callback.call(node, node.__data__, i, group);
      }
    }
    return this;
  }

  // node_modules/d3-selection/src/selection/attr.js
  function attrRemove(name) {
    return function() {
      this.removeAttribute(name);
    };
  }
  function attrRemoveNS(fullname) {
    return function() {
      this.removeAttributeNS(fullname.space, fullname.local);
    };
  }
  function attrConstant(name, value2) {
    return function() {
      this.setAttribute(name, value2);
    };
  }
  function attrConstantNS(fullname, value2) {
    return function() {
      this.setAttributeNS(fullname.space, fullname.local, value2);
    };
  }
  function attrFunction(name, value2) {
    return function() {
      var v = value2.apply(this, arguments);
      if (v == null) this.removeAttribute(name);
      else this.setAttribute(name, v);
    };
  }
  function attrFunctionNS(fullname, value2) {
    return function() {
      var v = value2.apply(this, arguments);
      if (v == null) this.removeAttributeNS(fullname.space, fullname.local);
      else this.setAttributeNS(fullname.space, fullname.local, v);
    };
  }
  function attr_default(name, value2) {
    var fullname = namespace_default(name);
    if (arguments.length < 2) {
      var node = this.node();
      return fullname.local ? node.getAttributeNS(fullname.space, fullname.local) : node.getAttribute(fullname);
    }
    return this.each((value2 == null ? fullname.local ? attrRemoveNS : attrRemove : typeof value2 === "function" ? fullname.local ? attrFunctionNS : attrFunction : fullname.local ? attrConstantNS : attrConstant)(fullname, value2));
  }

  // node_modules/d3-selection/src/window.js
  function window_default(node) {
    return node.ownerDocument && node.ownerDocument.defaultView || node.document && node || node.defaultView;
  }

  // node_modules/d3-selection/src/selection/style.js
  function styleRemove(name) {
    return function() {
      this.style.removeProperty(name);
    };
  }
  function styleConstant(name, value2, priority) {
    return function() {
      this.style.setProperty(name, value2, priority);
    };
  }
  function styleFunction(name, value2, priority) {
    return function() {
      var v = value2.apply(this, arguments);
      if (v == null) this.style.removeProperty(name);
      else this.style.setProperty(name, v, priority);
    };
  }
  function style_default(name, value2, priority) {
    return arguments.length > 1 ? this.each((value2 == null ? styleRemove : typeof value2 === "function" ? styleFunction : styleConstant)(name, value2, priority == null ? "" : priority)) : styleValue(this.node(), name);
  }
  function styleValue(node, name) {
    return node.style.getPropertyValue(name) || window_default(node).getComputedStyle(node, null).getPropertyValue(name);
  }

  // node_modules/d3-selection/src/selection/property.js
  function propertyRemove(name) {
    return function() {
      delete this[name];
    };
  }
  function propertyConstant(name, value2) {
    return function() {
      this[name] = value2;
    };
  }
  function propertyFunction(name, value2) {
    return function() {
      var v = value2.apply(this, arguments);
      if (v == null) delete this[name];
      else this[name] = v;
    };
  }
  function property_default(name, value2) {
    return arguments.length > 1 ? this.each((value2 == null ? propertyRemove : typeof value2 === "function" ? propertyFunction : propertyConstant)(name, value2)) : this.node()[name];
  }

  // node_modules/d3-selection/src/selection/classed.js
  function classArray(string) {
    return string.trim().split(/^|\s+/);
  }
  function classList(node) {
    return node.classList || new ClassList(node);
  }
  function ClassList(node) {
    this._node = node;
    this._names = classArray(node.getAttribute("class") || "");
  }
  ClassList.prototype = {
    add: function(name) {
      var i = this._names.indexOf(name);
      if (i < 0) {
        this._names.push(name);
        this._node.setAttribute("class", this._names.join(" "));
      }
    },
    remove: function(name) {
      var i = this._names.indexOf(name);
      if (i >= 0) {
        this._names.splice(i, 1);
        this._node.setAttribute("class", this._names.join(" "));
      }
    },
    contains: function(name) {
      return this._names.indexOf(name) >= 0;
    }
  };
  function classedAdd(node, names) {
    var list = classList(node), i = -1, n = names.length;
    while (++i < n) list.add(names[i]);
  }
  function classedRemove(node, names) {
    var list = classList(node), i = -1, n = names.length;
    while (++i < n) list.remove(names[i]);
  }
  function classedTrue(names) {
    return function() {
      classedAdd(this, names);
    };
  }
  function classedFalse(names) {
    return function() {
      classedRemove(this, names);
    };
  }
  function classedFunction(names, value2) {
    return function() {
      (value2.apply(this, arguments) ? classedAdd : classedRemove)(this, names);
    };
  }
  function classed_default(name, value2) {
    var names = classArray(name + "");
    if (arguments.length < 2) {
      var list = classList(this.node()), i = -1, n = names.length;
      while (++i < n) if (!list.contains(names[i])) return false;
      return true;
    }
    return this.each((typeof value2 === "function" ? classedFunction : value2 ? classedTrue : classedFalse)(names, value2));
  }

  // node_modules/d3-selection/src/selection/text.js
  function textRemove() {
    this.textContent = "";
  }
  function textConstant(value2) {
    return function() {
      this.textContent = value2;
    };
  }
  function textFunction(value2) {
    return function() {
      var v = value2.apply(this, arguments);
      this.textContent = v == null ? "" : v;
    };
  }
  function text_default(value2) {
    return arguments.length ? this.each(value2 == null ? textRemove : (typeof value2 === "function" ? textFunction : textConstant)(value2)) : this.node().textContent;
  }

  // node_modules/d3-selection/src/selection/html.js
  function htmlRemove() {
    this.innerHTML = "";
  }
  function htmlConstant(value2) {
    return function() {
      this.innerHTML = value2;
    };
  }
  function htmlFunction(value2) {
    return function() {
      var v = value2.apply(this, arguments);
      this.innerHTML = v == null ? "" : v;
    };
  }
  function html_default(value2) {
    return arguments.length ? this.each(value2 == null ? htmlRemove : (typeof value2 === "function" ? htmlFunction : htmlConstant)(value2)) : this.node().innerHTML;
  }

  // node_modules/d3-selection/src/selection/raise.js
  function raise() {
    if (this.nextSibling) this.parentNode.appendChild(this);
  }
  function raise_default() {
    return this.each(raise);
  }

  // node_modules/d3-selection/src/selection/lower.js
  function lower() {
    if (this.previousSibling) this.parentNode.insertBefore(this, this.parentNode.firstChild);
  }
  function lower_default() {
    return this.each(lower);
  }

  // node_modules/d3-selection/src/selection/append.js
  function append_default(name) {
    var create2 = typeof name === "function" ? name : creator_default(name);
    return this.select(function() {
      return this.appendChild(create2.apply(this, arguments));
    });
  }

  // node_modules/d3-selection/src/selection/insert.js
  function constantNull() {
    return null;
  }
  function insert_default(name, before) {
    var create2 = typeof name === "function" ? name : creator_default(name), select = before == null ? constantNull : typeof before === "function" ? before : selector_default(before);
    return this.select(function() {
      return this.insertBefore(create2.apply(this, arguments), select.apply(this, arguments) || null);
    });
  }

  // node_modules/d3-selection/src/selection/remove.js
  function remove() {
    var parent = this.parentNode;
    if (parent) parent.removeChild(this);
  }
  function remove_default() {
    return this.each(remove);
  }

  // node_modules/d3-selection/src/selection/clone.js
  function selection_cloneShallow() {
    var clone2 = this.cloneNode(false), parent = this.parentNode;
    return parent ? parent.insertBefore(clone2, this.nextSibling) : clone2;
  }
  function selection_cloneDeep() {
    var clone2 = this.cloneNode(true), parent = this.parentNode;
    return parent ? parent.insertBefore(clone2, this.nextSibling) : clone2;
  }
  function clone_default(deep) {
    return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
  }

  // node_modules/d3-selection/src/selection/datum.js
  function datum_default(value2) {
    return arguments.length ? this.property("__data__", value2) : this.node().__data__;
  }

  // node_modules/d3-selection/src/selection/on.js
  function contextListener(listener) {
    return function(event) {
      listener.call(this, event, this.__data__);
    };
  }
  function parseTypenames2(typenames) {
    return typenames.trim().split(/^|\s+/).map(function(t) {
      var name = "", i = t.indexOf(".");
      if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
      return { type: t, name };
    });
  }
  function onRemove(typename) {
    return function() {
      var on2 = this.__on;
      if (!on2) return;
      for (var j = 0, i = -1, m = on2.length, o; j < m; ++j) {
        if (o = on2[j], (!typename.type || o.type === typename.type) && o.name === typename.name) {
          this.removeEventListener(o.type, o.listener, o.options);
        } else {
          on2[++i] = o;
        }
      }
      if (++i) on2.length = i;
      else delete this.__on;
    };
  }
  function onAdd(typename, value2, options) {
    return function() {
      var on2 = this.__on, o, listener = contextListener(value2);
      if (on2) for (var j = 0, m = on2.length; j < m; ++j) {
        if ((o = on2[j]).type === typename.type && o.name === typename.name) {
          this.removeEventListener(o.type, o.listener, o.options);
          this.addEventListener(o.type, o.listener = listener, o.options = options);
          o.value = value2;
          return;
        }
      }
      this.addEventListener(typename.type, listener, options);
      o = { type: typename.type, name: typename.name, value: value2, listener, options };
      if (!on2) this.__on = [o];
      else on2.push(o);
    };
  }
  function on_default(typename, value2, options) {
    var typenames = parseTypenames2(typename + ""), i, n = typenames.length, t;
    if (arguments.length < 2) {
      var on2 = this.node().__on;
      if (on2) for (var j = 0, m = on2.length, o; j < m; ++j) {
        for (i = 0, o = on2[j]; i < n; ++i) {
          if ((t = typenames[i]).type === o.type && t.name === o.name) {
            return o.value;
          }
        }
      }
      return;
    }
    on2 = value2 ? onAdd : onRemove;
    for (i = 0; i < n; ++i) this.each(on2(typenames[i], value2, options));
    return this;
  }

  // node_modules/d3-selection/src/selection/dispatch.js
  function dispatchEvent(node, type2, params) {
    var window2 = window_default(node), event = window2.CustomEvent;
    if (typeof event === "function") {
      event = new event(type2, params);
    } else {
      event = window2.document.createEvent("Event");
      if (params) event.initEvent(type2, params.bubbles, params.cancelable), event.detail = params.detail;
      else event.initEvent(type2, false, false);
    }
    node.dispatchEvent(event);
  }
  function dispatchConstant(type2, params) {
    return function() {
      return dispatchEvent(this, type2, params);
    };
  }
  function dispatchFunction(type2, params) {
    return function() {
      return dispatchEvent(this, type2, params.apply(this, arguments));
    };
  }
  function dispatch_default2(type2, params) {
    return this.each((typeof params === "function" ? dispatchFunction : dispatchConstant)(type2, params));
  }

  // node_modules/d3-selection/src/selection/iterator.js
  function* iterator_default() {
    for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
      for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
        if (node = group[i]) yield node;
      }
    }
  }

  // node_modules/d3-selection/src/selection/index.js
  var root = [null];
  function Selection(groups, parents) {
    this._groups = groups;
    this._parents = parents;
  }
  function selection() {
    return new Selection([[document.documentElement]], root);
  }
  function selection_selection() {
    return this;
  }
  Selection.prototype = selection.prototype = {
    constructor: Selection,
    select: select_default,
    selectAll: selectAll_default,
    selectChild: selectChild_default,
    selectChildren: selectChildren_default,
    filter: filter_default,
    data: data_default,
    enter: enter_default,
    exit: exit_default,
    join: join_default,
    merge: merge_default,
    selection: selection_selection,
    order: order_default,
    sort: sort_default,
    call: call_default,
    nodes: nodes_default,
    node: node_default,
    size: size_default,
    empty: empty_default,
    each: each_default,
    attr: attr_default,
    style: style_default,
    property: property_default,
    classed: classed_default,
    text: text_default,
    html: html_default,
    raise: raise_default,
    lower: lower_default,
    append: append_default,
    insert: insert_default,
    remove: remove_default,
    clone: clone_default,
    datum: datum_default,
    on: on_default,
    dispatch: dispatch_default2,
    [Symbol.iterator]: iterator_default
  };
  var selection_default = selection;

  // node_modules/d3-selection/src/select.js
  function select_default2(selector) {
    return typeof selector === "string" ? new Selection([[document.querySelector(selector)]], [document.documentElement]) : new Selection([[selector]], root);
  }

  // node_modules/d3-color/src/define.js
  function define_default(constructor, factory, prototype) {
    constructor.prototype = factory.prototype = prototype;
    prototype.constructor = constructor;
  }
  function extend(parent, definition) {
    var prototype = Object.create(parent.prototype);
    for (var key in definition) prototype[key] = definition[key];
    return prototype;
  }

  // node_modules/d3-color/src/color.js
  function Color() {
  }
  var darker = 0.7;
  var brighter = 1 / darker;
  var reI = "\\s*([+-]?\\d+)\\s*";
  var reN = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*";
  var reP = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*";
  var reHex = /^#([0-9a-f]{3,8})$/;
  var reRgbInteger = new RegExp(`^rgb\\(${reI},${reI},${reI}\\)$`);
  var reRgbPercent = new RegExp(`^rgb\\(${reP},${reP},${reP}\\)$`);
  var reRgbaInteger = new RegExp(`^rgba\\(${reI},${reI},${reI},${reN}\\)$`);
  var reRgbaPercent = new RegExp(`^rgba\\(${reP},${reP},${reP},${reN}\\)$`);
  var reHslPercent = new RegExp(`^hsl\\(${reN},${reP},${reP}\\)$`);
  var reHslaPercent = new RegExp(`^hsla\\(${reN},${reP},${reP},${reN}\\)$`);
  var named = {
    aliceblue: 15792383,
    antiquewhite: 16444375,
    aqua: 65535,
    aquamarine: 8388564,
    azure: 15794175,
    beige: 16119260,
    bisque: 16770244,
    black: 0,
    blanchedalmond: 16772045,
    blue: 255,
    blueviolet: 9055202,
    brown: 10824234,
    burlywood: 14596231,
    cadetblue: 6266528,
    chartreuse: 8388352,
    chocolate: 13789470,
    coral: 16744272,
    cornflowerblue: 6591981,
    cornsilk: 16775388,
    crimson: 14423100,
    cyan: 65535,
    darkblue: 139,
    darkcyan: 35723,
    darkgoldenrod: 12092939,
    darkgray: 11119017,
    darkgreen: 25600,
    darkgrey: 11119017,
    darkkhaki: 12433259,
    darkmagenta: 9109643,
    darkolivegreen: 5597999,
    darkorange: 16747520,
    darkorchid: 10040012,
    darkred: 9109504,
    darksalmon: 15308410,
    darkseagreen: 9419919,
    darkslateblue: 4734347,
    darkslategray: 3100495,
    darkslategrey: 3100495,
    darkturquoise: 52945,
    darkviolet: 9699539,
    deeppink: 16716947,
    deepskyblue: 49151,
    dimgray: 6908265,
    dimgrey: 6908265,
    dodgerblue: 2003199,
    firebrick: 11674146,
    floralwhite: 16775920,
    forestgreen: 2263842,
    fuchsia: 16711935,
    gainsboro: 14474460,
    ghostwhite: 16316671,
    gold: 16766720,
    goldenrod: 14329120,
    gray: 8421504,
    green: 32768,
    greenyellow: 11403055,
    grey: 8421504,
    honeydew: 15794160,
    hotpink: 16738740,
    indianred: 13458524,
    indigo: 4915330,
    ivory: 16777200,
    khaki: 15787660,
    lavender: 15132410,
    lavenderblush: 16773365,
    lawngreen: 8190976,
    lemonchiffon: 16775885,
    lightblue: 11393254,
    lightcoral: 15761536,
    lightcyan: 14745599,
    lightgoldenrodyellow: 16448210,
    lightgray: 13882323,
    lightgreen: 9498256,
    lightgrey: 13882323,
    lightpink: 16758465,
    lightsalmon: 16752762,
    lightseagreen: 2142890,
    lightskyblue: 8900346,
    lightslategray: 7833753,
    lightslategrey: 7833753,
    lightsteelblue: 11584734,
    lightyellow: 16777184,
    lime: 65280,
    limegreen: 3329330,
    linen: 16445670,
    magenta: 16711935,
    maroon: 8388608,
    mediumaquamarine: 6737322,
    mediumblue: 205,
    mediumorchid: 12211667,
    mediumpurple: 9662683,
    mediumseagreen: 3978097,
    mediumslateblue: 8087790,
    mediumspringgreen: 64154,
    mediumturquoise: 4772300,
    mediumvioletred: 13047173,
    midnightblue: 1644912,
    mintcream: 16121850,
    mistyrose: 16770273,
    moccasin: 16770229,
    navajowhite: 16768685,
    navy: 128,
    oldlace: 16643558,
    olive: 8421376,
    olivedrab: 7048739,
    orange: 16753920,
    orangered: 16729344,
    orchid: 14315734,
    palegoldenrod: 15657130,
    palegreen: 10025880,
    paleturquoise: 11529966,
    palevioletred: 14381203,
    papayawhip: 16773077,
    peachpuff: 16767673,
    peru: 13468991,
    pink: 16761035,
    plum: 14524637,
    powderblue: 11591910,
    purple: 8388736,
    rebeccapurple: 6697881,
    red: 16711680,
    rosybrown: 12357519,
    royalblue: 4286945,
    saddlebrown: 9127187,
    salmon: 16416882,
    sandybrown: 16032864,
    seagreen: 3050327,
    seashell: 16774638,
    sienna: 10506797,
    silver: 12632256,
    skyblue: 8900331,
    slateblue: 6970061,
    slategray: 7372944,
    slategrey: 7372944,
    snow: 16775930,
    springgreen: 65407,
    steelblue: 4620980,
    tan: 13808780,
    teal: 32896,
    thistle: 14204888,
    tomato: 16737095,
    turquoise: 4251856,
    violet: 15631086,
    wheat: 16113331,
    white: 16777215,
    whitesmoke: 16119285,
    yellow: 16776960,
    yellowgreen: 10145074
  };
  define_default(Color, color, {
    copy(channels) {
      return Object.assign(new this.constructor(), this, channels);
    },
    displayable() {
      return this.rgb().displayable();
    },
    hex: color_formatHex,
    // Deprecated! Use color.formatHex.
    formatHex: color_formatHex,
    formatHex8: color_formatHex8,
    formatHsl: color_formatHsl,
    formatRgb: color_formatRgb,
    toString: color_formatRgb
  });
  function color_formatHex() {
    return this.rgb().formatHex();
  }
  function color_formatHex8() {
    return this.rgb().formatHex8();
  }
  function color_formatHsl() {
    return hslConvert(this).formatHsl();
  }
  function color_formatRgb() {
    return this.rgb().formatRgb();
  }
  function color(format) {
    var m, l;
    format = (format + "").trim().toLowerCase();
    return (m = reHex.exec(format)) ? (l = m[1].length, m = parseInt(m[1], 16), l === 6 ? rgbn(m) : l === 3 ? new Rgb(m >> 8 & 15 | m >> 4 & 240, m >> 4 & 15 | m & 240, (m & 15) << 4 | m & 15, 1) : l === 8 ? rgba(m >> 24 & 255, m >> 16 & 255, m >> 8 & 255, (m & 255) / 255) : l === 4 ? rgba(m >> 12 & 15 | m >> 8 & 240, m >> 8 & 15 | m >> 4 & 240, m >> 4 & 15 | m & 240, ((m & 15) << 4 | m & 15) / 255) : null) : (m = reRgbInteger.exec(format)) ? new Rgb(m[1], m[2], m[3], 1) : (m = reRgbPercent.exec(format)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) : (m = reRgbaInteger.exec(format)) ? rgba(m[1], m[2], m[3], m[4]) : (m = reRgbaPercent.exec(format)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) : (m = reHslPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) : (m = reHslaPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) : named.hasOwnProperty(format) ? rgbn(named[format]) : format === "transparent" ? new Rgb(NaN, NaN, NaN, 0) : null;
  }
  function rgbn(n) {
    return new Rgb(n >> 16 & 255, n >> 8 & 255, n & 255, 1);
  }
  function rgba(r, g, b, a) {
    if (a <= 0) r = g = b = NaN;
    return new Rgb(r, g, b, a);
  }
  function rgbConvert(o) {
    if (!(o instanceof Color)) o = color(o);
    if (!o) return new Rgb();
    o = o.rgb();
    return new Rgb(o.r, o.g, o.b, o.opacity);
  }
  function rgb(r, g, b, opacity) {
    return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
  }
  function Rgb(r, g, b, opacity) {
    this.r = +r;
    this.g = +g;
    this.b = +b;
    this.opacity = +opacity;
  }
  define_default(Rgb, rgb, extend(Color, {
    brighter(k) {
      k = k == null ? brighter : Math.pow(brighter, k);
      return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
    },
    darker(k) {
      k = k == null ? darker : Math.pow(darker, k);
      return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
    },
    rgb() {
      return this;
    },
    clamp() {
      return new Rgb(clampi(this.r), clampi(this.g), clampi(this.b), clampa(this.opacity));
    },
    displayable() {
      return -0.5 <= this.r && this.r < 255.5 && (-0.5 <= this.g && this.g < 255.5) && (-0.5 <= this.b && this.b < 255.5) && (0 <= this.opacity && this.opacity <= 1);
    },
    hex: rgb_formatHex,
    // Deprecated! Use color.formatHex.
    formatHex: rgb_formatHex,
    formatHex8: rgb_formatHex8,
    formatRgb: rgb_formatRgb,
    toString: rgb_formatRgb
  }));
  function rgb_formatHex() {
    return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}`;
  }
  function rgb_formatHex8() {
    return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}${hex((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
  }
  function rgb_formatRgb() {
    const a = clampa(this.opacity);
    return `${a === 1 ? "rgb(" : "rgba("}${clampi(this.r)}, ${clampi(this.g)}, ${clampi(this.b)}${a === 1 ? ")" : `, ${a})`}`;
  }
  function clampa(opacity) {
    return isNaN(opacity) ? 1 : Math.max(0, Math.min(1, opacity));
  }
  function clampi(value2) {
    return Math.max(0, Math.min(255, Math.round(value2) || 0));
  }
  function hex(value2) {
    value2 = clampi(value2);
    return (value2 < 16 ? "0" : "") + value2.toString(16);
  }
  function hsla(h, s, l, a) {
    if (a <= 0) h = s = l = NaN;
    else if (l <= 0 || l >= 1) h = s = NaN;
    else if (s <= 0) h = NaN;
    return new Hsl(h, s, l, a);
  }
  function hslConvert(o) {
    if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
    if (!(o instanceof Color)) o = color(o);
    if (!o) return new Hsl();
    if (o instanceof Hsl) return o;
    o = o.rgb();
    var r = o.r / 255, g = o.g / 255, b = o.b / 255, min3 = Math.min(r, g, b), max3 = Math.max(r, g, b), h = NaN, s = max3 - min3, l = (max3 + min3) / 2;
    if (s) {
      if (r === max3) h = (g - b) / s + (g < b) * 6;
      else if (g === max3) h = (b - r) / s + 2;
      else h = (r - g) / s + 4;
      s /= l < 0.5 ? max3 + min3 : 2 - max3 - min3;
      h *= 60;
    } else {
      s = l > 0 && l < 1 ? 0 : h;
    }
    return new Hsl(h, s, l, o.opacity);
  }
  function hsl(h, s, l, opacity) {
    return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
  }
  function Hsl(h, s, l, opacity) {
    this.h = +h;
    this.s = +s;
    this.l = +l;
    this.opacity = +opacity;
  }
  define_default(Hsl, hsl, extend(Color, {
    brighter(k) {
      k = k == null ? brighter : Math.pow(brighter, k);
      return new Hsl(this.h, this.s, this.l * k, this.opacity);
    },
    darker(k) {
      k = k == null ? darker : Math.pow(darker, k);
      return new Hsl(this.h, this.s, this.l * k, this.opacity);
    },
    rgb() {
      var h = this.h % 360 + (this.h < 0) * 360, s = isNaN(h) || isNaN(this.s) ? 0 : this.s, l = this.l, m2 = l + (l < 0.5 ? l : 1 - l) * s, m1 = 2 * l - m2;
      return new Rgb(
        hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
        hsl2rgb(h, m1, m2),
        hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
        this.opacity
      );
    },
    clamp() {
      return new Hsl(clamph(this.h), clampt(this.s), clampt(this.l), clampa(this.opacity));
    },
    displayable() {
      return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && (0 <= this.l && this.l <= 1) && (0 <= this.opacity && this.opacity <= 1);
    },
    formatHsl() {
      const a = clampa(this.opacity);
      return `${a === 1 ? "hsl(" : "hsla("}${clamph(this.h)}, ${clampt(this.s) * 100}%, ${clampt(this.l) * 100}%${a === 1 ? ")" : `, ${a})`}`;
    }
  }));
  function clamph(value2) {
    value2 = (value2 || 0) % 360;
    return value2 < 0 ? value2 + 360 : value2;
  }
  function clampt(value2) {
    return Math.max(0, Math.min(1, value2 || 0));
  }
  function hsl2rgb(h, m1, m2) {
    return (h < 60 ? m1 + (m2 - m1) * h / 60 : h < 180 ? m2 : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60 : m1) * 255;
  }

  // node_modules/d3-interpolate/src/basis.js
  function basis(t1, v0, v1, v2, v3) {
    var t2 = t1 * t1, t3 = t2 * t1;
    return ((1 - 3 * t1 + 3 * t2 - t3) * v0 + (4 - 6 * t2 + 3 * t3) * v1 + (1 + 3 * t1 + 3 * t2 - 3 * t3) * v2 + t3 * v3) / 6;
  }
  function basis_default(values) {
    var n = values.length - 1;
    return function(t) {
      var i = t <= 0 ? t = 0 : t >= 1 ? (t = 1, n - 1) : Math.floor(t * n), v1 = values[i], v2 = values[i + 1], v0 = i > 0 ? values[i - 1] : 2 * v1 - v2, v3 = i < n - 1 ? values[i + 2] : 2 * v2 - v1;
      return basis((t - i / n) * n, v0, v1, v2, v3);
    };
  }

  // node_modules/d3-interpolate/src/basisClosed.js
  function basisClosed_default(values) {
    var n = values.length;
    return function(t) {
      var i = Math.floor(((t %= 1) < 0 ? ++t : t) * n), v0 = values[(i + n - 1) % n], v1 = values[i % n], v2 = values[(i + 1) % n], v3 = values[(i + 2) % n];
      return basis((t - i / n) * n, v0, v1, v2, v3);
    };
  }

  // node_modules/d3-interpolate/src/constant.js
  var constant_default2 = (x2) => () => x2;

  // node_modules/d3-interpolate/src/color.js
  function linear(a, d) {
    return function(t) {
      return a + t * d;
    };
  }
  function exponential(a, b, y2) {
    return a = Math.pow(a, y2), b = Math.pow(b, y2) - a, y2 = 1 / y2, function(t) {
      return Math.pow(a + t * b, y2);
    };
  }
  function gamma(y2) {
    return (y2 = +y2) === 1 ? nogamma : function(a, b) {
      return b - a ? exponential(a, b, y2) : constant_default2(isNaN(a) ? b : a);
    };
  }
  function nogamma(a, b) {
    var d = b - a;
    return d ? linear(a, d) : constant_default2(isNaN(a) ? b : a);
  }

  // node_modules/d3-interpolate/src/rgb.js
  var rgb_default = (function rgbGamma(y2) {
    var color2 = gamma(y2);
    function rgb2(start2, end) {
      var r = color2((start2 = rgb(start2)).r, (end = rgb(end)).r), g = color2(start2.g, end.g), b = color2(start2.b, end.b), opacity = nogamma(start2.opacity, end.opacity);
      return function(t) {
        start2.r = r(t);
        start2.g = g(t);
        start2.b = b(t);
        start2.opacity = opacity(t);
        return start2 + "";
      };
    }
    rgb2.gamma = rgbGamma;
    return rgb2;
  })(1);
  function rgbSpline(spline) {
    return function(colors) {
      var n = colors.length, r = new Array(n), g = new Array(n), b = new Array(n), i, color2;
      for (i = 0; i < n; ++i) {
        color2 = rgb(colors[i]);
        r[i] = color2.r || 0;
        g[i] = color2.g || 0;
        b[i] = color2.b || 0;
      }
      r = spline(r);
      g = spline(g);
      b = spline(b);
      color2.opacity = 1;
      return function(t) {
        color2.r = r(t);
        color2.g = g(t);
        color2.b = b(t);
        return color2 + "";
      };
    };
  }
  var rgbBasis = rgbSpline(basis_default);
  var rgbBasisClosed = rgbSpline(basisClosed_default);

  // node_modules/d3-interpolate/src/number.js
  function number_default(a, b) {
    return a = +a, b = +b, function(t) {
      return a * (1 - t) + b * t;
    };
  }

  // node_modules/d3-interpolate/src/string.js
  var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g;
  var reB = new RegExp(reA.source, "g");
  function zero(b) {
    return function() {
      return b;
    };
  }
  function one(b) {
    return function(t) {
      return b(t) + "";
    };
  }
  function string_default(a, b) {
    var bi = reA.lastIndex = reB.lastIndex = 0, am, bm, bs, i = -1, s = [], q = [];
    a = a + "", b = b + "";
    while ((am = reA.exec(a)) && (bm = reB.exec(b))) {
      if ((bs = bm.index) > bi) {
        bs = b.slice(bi, bs);
        if (s[i]) s[i] += bs;
        else s[++i] = bs;
      }
      if ((am = am[0]) === (bm = bm[0])) {
        if (s[i]) s[i] += bm;
        else s[++i] = bm;
      } else {
        s[++i] = null;
        q.push({ i, x: number_default(am, bm) });
      }
      bi = reB.lastIndex;
    }
    if (bi < b.length) {
      bs = b.slice(bi);
      if (s[i]) s[i] += bs;
      else s[++i] = bs;
    }
    return s.length < 2 ? q[0] ? one(q[0].x) : zero(b) : (b = q.length, function(t) {
      for (var i2 = 0, o; i2 < b; ++i2) s[(o = q[i2]).i] = o.x(t);
      return s.join("");
    });
  }

  // node_modules/d3-interpolate/src/transform/decompose.js
  var degrees = 180 / Math.PI;
  var identity = {
    translateX: 0,
    translateY: 0,
    rotate: 0,
    skewX: 0,
    scaleX: 1,
    scaleY: 1
  };
  function decompose_default(a, b, c, d, e, f) {
    var scaleX, scaleY, skewX;
    if (scaleX = Math.sqrt(a * a + b * b)) a /= scaleX, b /= scaleX;
    if (skewX = a * c + b * d) c -= a * skewX, d -= b * skewX;
    if (scaleY = Math.sqrt(c * c + d * d)) c /= scaleY, d /= scaleY, skewX /= scaleY;
    if (a * d < b * c) a = -a, b = -b, skewX = -skewX, scaleX = -scaleX;
    return {
      translateX: e,
      translateY: f,
      rotate: Math.atan2(b, a) * degrees,
      skewX: Math.atan(skewX) * degrees,
      scaleX,
      scaleY
    };
  }

  // node_modules/d3-interpolate/src/transform/parse.js
  var svgNode;
  function parseCss(value2) {
    const m = new (typeof DOMMatrix === "function" ? DOMMatrix : WebKitCSSMatrix)(value2 + "");
    return m.isIdentity ? identity : decompose_default(m.a, m.b, m.c, m.d, m.e, m.f);
  }
  function parseSvg(value2) {
    if (value2 == null) return identity;
    if (!svgNode) svgNode = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svgNode.setAttribute("transform", value2);
    if (!(value2 = svgNode.transform.baseVal.consolidate())) return identity;
    value2 = value2.matrix;
    return decompose_default(value2.a, value2.b, value2.c, value2.d, value2.e, value2.f);
  }

  // node_modules/d3-interpolate/src/transform/index.js
  function interpolateTransform(parse, pxComma, pxParen, degParen) {
    function pop(s) {
      return s.length ? s.pop() + " " : "";
    }
    function translate(xa, ya, xb, yb, s, q) {
      if (xa !== xb || ya !== yb) {
        var i = s.push("translate(", null, pxComma, null, pxParen);
        q.push({ i: i - 4, x: number_default(xa, xb) }, { i: i - 2, x: number_default(ya, yb) });
      } else if (xb || yb) {
        s.push("translate(" + xb + pxComma + yb + pxParen);
      }
    }
    function rotate(a, b, s, q) {
      if (a !== b) {
        if (a - b > 180) b += 360;
        else if (b - a > 180) a += 360;
        q.push({ i: s.push(pop(s) + "rotate(", null, degParen) - 2, x: number_default(a, b) });
      } else if (b) {
        s.push(pop(s) + "rotate(" + b + degParen);
      }
    }
    function skewX(a, b, s, q) {
      if (a !== b) {
        q.push({ i: s.push(pop(s) + "skewX(", null, degParen) - 2, x: number_default(a, b) });
      } else if (b) {
        s.push(pop(s) + "skewX(" + b + degParen);
      }
    }
    function scale(xa, ya, xb, yb, s, q) {
      if (xa !== xb || ya !== yb) {
        var i = s.push(pop(s) + "scale(", null, ",", null, ")");
        q.push({ i: i - 4, x: number_default(xa, xb) }, { i: i - 2, x: number_default(ya, yb) });
      } else if (xb !== 1 || yb !== 1) {
        s.push(pop(s) + "scale(" + xb + "," + yb + ")");
      }
    }
    return function(a, b) {
      var s = [], q = [];
      a = parse(a), b = parse(b);
      translate(a.translateX, a.translateY, b.translateX, b.translateY, s, q);
      rotate(a.rotate, b.rotate, s, q);
      skewX(a.skewX, b.skewX, s, q);
      scale(a.scaleX, a.scaleY, b.scaleX, b.scaleY, s, q);
      a = b = null;
      return function(t) {
        var i = -1, n = q.length, o;
        while (++i < n) s[(o = q[i]).i] = o.x(t);
        return s.join("");
      };
    };
  }
  var interpolateTransformCss = interpolateTransform(parseCss, "px, ", "px)", "deg)");
  var interpolateTransformSvg = interpolateTransform(parseSvg, ", ", ")", ")");

  // node_modules/d3-timer/src/timer.js
  var frame = 0;
  var timeout = 0;
  var interval = 0;
  var pokeDelay = 1e3;
  var taskHead;
  var taskTail;
  var clockLast = 0;
  var clockNow = 0;
  var clockSkew = 0;
  var clock = typeof performance === "object" && performance.now ? performance : Date;
  var setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f) {
    setTimeout(f, 17);
  };
  function now() {
    return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
  }
  function clearNow() {
    clockNow = 0;
  }
  function Timer() {
    this._call = this._time = this._next = null;
  }
  Timer.prototype = timer.prototype = {
    constructor: Timer,
    restart: function(callback, delay, time) {
      if (typeof callback !== "function") throw new TypeError("callback is not a function");
      time = (time == null ? now() : +time) + (delay == null ? 0 : +delay);
      if (!this._next && taskTail !== this) {
        if (taskTail) taskTail._next = this;
        else taskHead = this;
        taskTail = this;
      }
      this._call = callback;
      this._time = time;
      sleep();
    },
    stop: function() {
      if (this._call) {
        this._call = null;
        this._time = Infinity;
        sleep();
      }
    }
  };
  function timer(callback, delay, time) {
    var t = new Timer();
    t.restart(callback, delay, time);
    return t;
  }
  function timerFlush() {
    now();
    ++frame;
    var t = taskHead, e;
    while (t) {
      if ((e = clockNow - t._time) >= 0) t._call.call(void 0, e);
      t = t._next;
    }
    --frame;
  }
  function wake() {
    clockNow = (clockLast = clock.now()) + clockSkew;
    frame = timeout = 0;
    try {
      timerFlush();
    } finally {
      frame = 0;
      nap();
      clockNow = 0;
    }
  }
  function poke() {
    var now2 = clock.now(), delay = now2 - clockLast;
    if (delay > pokeDelay) clockSkew -= delay, clockLast = now2;
  }
  function nap() {
    var t0, t1 = taskHead, t2, time = Infinity;
    while (t1) {
      if (t1._call) {
        if (time > t1._time) time = t1._time;
        t0 = t1, t1 = t1._next;
      } else {
        t2 = t1._next, t1._next = null;
        t1 = t0 ? t0._next = t2 : taskHead = t2;
      }
    }
    taskTail = t0;
    sleep(time);
  }
  function sleep(time) {
    if (frame) return;
    if (timeout) timeout = clearTimeout(timeout);
    var delay = time - clockNow;
    if (delay > 24) {
      if (time < Infinity) timeout = setTimeout(wake, time - clock.now() - clockSkew);
      if (interval) interval = clearInterval(interval);
    } else {
      if (!interval) clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
      frame = 1, setFrame(wake);
    }
  }

  // node_modules/d3-timer/src/timeout.js
  function timeout_default(callback, delay, time) {
    var t = new Timer();
    delay = delay == null ? 0 : +delay;
    t.restart((elapsed) => {
      t.stop();
      callback(elapsed + delay);
    }, delay, time);
    return t;
  }

  // node_modules/d3-transition/src/transition/schedule.js
  var emptyOn = dispatch_default("start", "end", "cancel", "interrupt");
  var emptyTween = [];
  var CREATED = 0;
  var SCHEDULED = 1;
  var STARTING = 2;
  var STARTED = 3;
  var RUNNING = 4;
  var ENDING = 5;
  var ENDED = 6;
  function schedule_default(node, name, id2, index2, group, timing) {
    var schedules = node.__transition;
    if (!schedules) node.__transition = {};
    else if (id2 in schedules) return;
    create(node, id2, {
      name,
      index: index2,
      // For context during callback.
      group,
      // For context during callback.
      on: emptyOn,
      tween: emptyTween,
      time: timing.time,
      delay: timing.delay,
      duration: timing.duration,
      ease: timing.ease,
      timer: null,
      state: CREATED
    });
  }
  function init(node, id2) {
    var schedule = get2(node, id2);
    if (schedule.state > CREATED) throw new Error("too late; already scheduled");
    return schedule;
  }
  function set2(node, id2) {
    var schedule = get2(node, id2);
    if (schedule.state > STARTED) throw new Error("too late; already running");
    return schedule;
  }
  function get2(node, id2) {
    var schedule = node.__transition;
    if (!schedule || !(schedule = schedule[id2])) throw new Error("transition not found");
    return schedule;
  }
  function create(node, id2, self) {
    var schedules = node.__transition, tween;
    schedules[id2] = self;
    self.timer = timer(schedule, 0, self.time);
    function schedule(elapsed) {
      self.state = SCHEDULED;
      self.timer.restart(start2, self.delay, self.time);
      if (self.delay <= elapsed) start2(elapsed - self.delay);
    }
    function start2(elapsed) {
      var i, j, n, o;
      if (self.state !== SCHEDULED) return stop();
      for (i in schedules) {
        o = schedules[i];
        if (o.name !== self.name) continue;
        if (o.state === STARTED) return timeout_default(start2);
        if (o.state === RUNNING) {
          o.state = ENDED;
          o.timer.stop();
          o.on.call("interrupt", node, node.__data__, o.index, o.group);
          delete schedules[i];
        } else if (+i < id2) {
          o.state = ENDED;
          o.timer.stop();
          o.on.call("cancel", node, node.__data__, o.index, o.group);
          delete schedules[i];
        }
      }
      timeout_default(function() {
        if (self.state === STARTED) {
          self.state = RUNNING;
          self.timer.restart(tick, self.delay, self.time);
          tick(elapsed);
        }
      });
      self.state = STARTING;
      self.on.call("start", node, node.__data__, self.index, self.group);
      if (self.state !== STARTING) return;
      self.state = STARTED;
      tween = new Array(n = self.tween.length);
      for (i = 0, j = -1; i < n; ++i) {
        if (o = self.tween[i].value.call(node, node.__data__, self.index, self.group)) {
          tween[++j] = o;
        }
      }
      tween.length = j + 1;
    }
    function tick(elapsed) {
      var t = elapsed < self.duration ? self.ease.call(null, elapsed / self.duration) : (self.timer.restart(stop), self.state = ENDING, 1), i = -1, n = tween.length;
      while (++i < n) {
        tween[i].call(node, t);
      }
      if (self.state === ENDING) {
        self.on.call("end", node, node.__data__, self.index, self.group);
        stop();
      }
    }
    function stop() {
      self.state = ENDED;
      self.timer.stop();
      delete schedules[id2];
      for (var i in schedules) return;
      delete node.__transition;
    }
  }

  // node_modules/d3-transition/src/interrupt.js
  function interrupt_default(node, name) {
    var schedules = node.__transition, schedule, active, empty2 = true, i;
    if (!schedules) return;
    name = name == null ? null : name + "";
    for (i in schedules) {
      if ((schedule = schedules[i]).name !== name) {
        empty2 = false;
        continue;
      }
      active = schedule.state > STARTING && schedule.state < ENDING;
      schedule.state = ENDED;
      schedule.timer.stop();
      schedule.on.call(active ? "interrupt" : "cancel", node, node.__data__, schedule.index, schedule.group);
      delete schedules[i];
    }
    if (empty2) delete node.__transition;
  }

  // node_modules/d3-transition/src/selection/interrupt.js
  function interrupt_default2(name) {
    return this.each(function() {
      interrupt_default(this, name);
    });
  }

  // node_modules/d3-transition/src/transition/tween.js
  function tweenRemove(id2, name) {
    var tween0, tween1;
    return function() {
      var schedule = set2(this, id2), tween = schedule.tween;
      if (tween !== tween0) {
        tween1 = tween0 = tween;
        for (var i = 0, n = tween1.length; i < n; ++i) {
          if (tween1[i].name === name) {
            tween1 = tween1.slice();
            tween1.splice(i, 1);
            break;
          }
        }
      }
      schedule.tween = tween1;
    };
  }
  function tweenFunction(id2, name, value2) {
    var tween0, tween1;
    if (typeof value2 !== "function") throw new Error();
    return function() {
      var schedule = set2(this, id2), tween = schedule.tween;
      if (tween !== tween0) {
        tween1 = (tween0 = tween).slice();
        for (var t = { name, value: value2 }, i = 0, n = tween1.length; i < n; ++i) {
          if (tween1[i].name === name) {
            tween1[i] = t;
            break;
          }
        }
        if (i === n) tween1.push(t);
      }
      schedule.tween = tween1;
    };
  }
  function tween_default(name, value2) {
    var id2 = this._id;
    name += "";
    if (arguments.length < 2) {
      var tween = get2(this.node(), id2).tween;
      for (var i = 0, n = tween.length, t; i < n; ++i) {
        if ((t = tween[i]).name === name) {
          return t.value;
        }
      }
      return null;
    }
    return this.each((value2 == null ? tweenRemove : tweenFunction)(id2, name, value2));
  }
  function tweenValue(transition2, name, value2) {
    var id2 = transition2._id;
    transition2.each(function() {
      var schedule = set2(this, id2);
      (schedule.value || (schedule.value = {}))[name] = value2.apply(this, arguments);
    });
    return function(node) {
      return get2(node, id2).value[name];
    };
  }

  // node_modules/d3-transition/src/transition/interpolate.js
  function interpolate_default(a, b) {
    var c;
    return (typeof b === "number" ? number_default : b instanceof color ? rgb_default : (c = color(b)) ? (b = c, rgb_default) : string_default)(a, b);
  }

  // node_modules/d3-transition/src/transition/attr.js
  function attrRemove2(name) {
    return function() {
      this.removeAttribute(name);
    };
  }
  function attrRemoveNS2(fullname) {
    return function() {
      this.removeAttributeNS(fullname.space, fullname.local);
    };
  }
  function attrConstant2(name, interpolate, value1) {
    var string00, string1 = value1 + "", interpolate0;
    return function() {
      var string0 = this.getAttribute(name);
      return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
    };
  }
  function attrConstantNS2(fullname, interpolate, value1) {
    var string00, string1 = value1 + "", interpolate0;
    return function() {
      var string0 = this.getAttributeNS(fullname.space, fullname.local);
      return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
    };
  }
  function attrFunction2(name, interpolate, value2) {
    var string00, string10, interpolate0;
    return function() {
      var string0, value1 = value2(this), string1;
      if (value1 == null) return void this.removeAttribute(name);
      string0 = this.getAttribute(name);
      string1 = value1 + "";
      return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
    };
  }
  function attrFunctionNS2(fullname, interpolate, value2) {
    var string00, string10, interpolate0;
    return function() {
      var string0, value1 = value2(this), string1;
      if (value1 == null) return void this.removeAttributeNS(fullname.space, fullname.local);
      string0 = this.getAttributeNS(fullname.space, fullname.local);
      string1 = value1 + "";
      return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
    };
  }
  function attr_default2(name, value2) {
    var fullname = namespace_default(name), i = fullname === "transform" ? interpolateTransformSvg : interpolate_default;
    return this.attrTween(name, typeof value2 === "function" ? (fullname.local ? attrFunctionNS2 : attrFunction2)(fullname, i, tweenValue(this, "attr." + name, value2)) : value2 == null ? (fullname.local ? attrRemoveNS2 : attrRemove2)(fullname) : (fullname.local ? attrConstantNS2 : attrConstant2)(fullname, i, value2));
  }

  // node_modules/d3-transition/src/transition/attrTween.js
  function attrInterpolate(name, i) {
    return function(t) {
      this.setAttribute(name, i.call(this, t));
    };
  }
  function attrInterpolateNS(fullname, i) {
    return function(t) {
      this.setAttributeNS(fullname.space, fullname.local, i.call(this, t));
    };
  }
  function attrTweenNS(fullname, value2) {
    var t0, i0;
    function tween() {
      var i = value2.apply(this, arguments);
      if (i !== i0) t0 = (i0 = i) && attrInterpolateNS(fullname, i);
      return t0;
    }
    tween._value = value2;
    return tween;
  }
  function attrTween(name, value2) {
    var t0, i0;
    function tween() {
      var i = value2.apply(this, arguments);
      if (i !== i0) t0 = (i0 = i) && attrInterpolate(name, i);
      return t0;
    }
    tween._value = value2;
    return tween;
  }
  function attrTween_default(name, value2) {
    var key = "attr." + name;
    if (arguments.length < 2) return (key = this.tween(key)) && key._value;
    if (value2 == null) return this.tween(key, null);
    if (typeof value2 !== "function") throw new Error();
    var fullname = namespace_default(name);
    return this.tween(key, (fullname.local ? attrTweenNS : attrTween)(fullname, value2));
  }

  // node_modules/d3-transition/src/transition/delay.js
  function delayFunction(id2, value2) {
    return function() {
      init(this, id2).delay = +value2.apply(this, arguments);
    };
  }
  function delayConstant(id2, value2) {
    return value2 = +value2, function() {
      init(this, id2).delay = value2;
    };
  }
  function delay_default(value2) {
    var id2 = this._id;
    return arguments.length ? this.each((typeof value2 === "function" ? delayFunction : delayConstant)(id2, value2)) : get2(this.node(), id2).delay;
  }

  // node_modules/d3-transition/src/transition/duration.js
  function durationFunction(id2, value2) {
    return function() {
      set2(this, id2).duration = +value2.apply(this, arguments);
    };
  }
  function durationConstant(id2, value2) {
    return value2 = +value2, function() {
      set2(this, id2).duration = value2;
    };
  }
  function duration_default(value2) {
    var id2 = this._id;
    return arguments.length ? this.each((typeof value2 === "function" ? durationFunction : durationConstant)(id2, value2)) : get2(this.node(), id2).duration;
  }

  // node_modules/d3-transition/src/transition/ease.js
  function easeConstant(id2, value2) {
    if (typeof value2 !== "function") throw new Error();
    return function() {
      set2(this, id2).ease = value2;
    };
  }
  function ease_default(value2) {
    var id2 = this._id;
    return arguments.length ? this.each(easeConstant(id2, value2)) : get2(this.node(), id2).ease;
  }

  // node_modules/d3-transition/src/transition/easeVarying.js
  function easeVarying(id2, value2) {
    return function() {
      var v = value2.apply(this, arguments);
      if (typeof v !== "function") throw new Error();
      set2(this, id2).ease = v;
    };
  }
  function easeVarying_default(value2) {
    if (typeof value2 !== "function") throw new Error();
    return this.each(easeVarying(this._id, value2));
  }

  // node_modules/d3-transition/src/transition/filter.js
  function filter_default2(match) {
    if (typeof match !== "function") match = matcher_default(match);
    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
        if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
          subgroup.push(node);
        }
      }
    }
    return new Transition(subgroups, this._parents, this._name, this._id);
  }

  // node_modules/d3-transition/src/transition/merge.js
  function merge_default2(transition2) {
    if (transition2._id !== this._id) throw new Error();
    for (var groups0 = this._groups, groups1 = transition2._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
      for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group0[i] || group1[i]) {
          merge[i] = node;
        }
      }
    }
    for (; j < m0; ++j) {
      merges[j] = groups0[j];
    }
    return new Transition(merges, this._parents, this._name, this._id);
  }

  // node_modules/d3-transition/src/transition/on.js
  function start(name) {
    return (name + "").trim().split(/^|\s+/).every(function(t) {
      var i = t.indexOf(".");
      if (i >= 0) t = t.slice(0, i);
      return !t || t === "start";
    });
  }
  function onFunction(id2, name, listener) {
    var on0, on1, sit = start(name) ? init : set2;
    return function() {
      var schedule = sit(this, id2), on2 = schedule.on;
      if (on2 !== on0) (on1 = (on0 = on2).copy()).on(name, listener);
      schedule.on = on1;
    };
  }
  function on_default2(name, listener) {
    var id2 = this._id;
    return arguments.length < 2 ? get2(this.node(), id2).on.on(name) : this.each(onFunction(id2, name, listener));
  }

  // node_modules/d3-transition/src/transition/remove.js
  function removeFunction(id2) {
    return function() {
      var parent = this.parentNode;
      for (var i in this.__transition) if (+i !== id2) return;
      if (parent) parent.removeChild(this);
    };
  }
  function remove_default2() {
    return this.on("end.remove", removeFunction(this._id));
  }

  // node_modules/d3-transition/src/transition/select.js
  function select_default3(select) {
    var name = this._name, id2 = this._id;
    if (typeof select !== "function") select = selector_default(select);
    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
        if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
          if ("__data__" in node) subnode.__data__ = node.__data__;
          subgroup[i] = subnode;
          schedule_default(subgroup[i], name, id2, i, subgroup, get2(node, id2));
        }
      }
    }
    return new Transition(subgroups, this._parents, name, id2);
  }

  // node_modules/d3-transition/src/transition/selectAll.js
  function selectAll_default2(select) {
    var name = this._name, id2 = this._id;
    if (typeof select !== "function") select = selectorAll_default(select);
    for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          for (var children2 = select.call(node, node.__data__, i, group), child, inherit2 = get2(node, id2), k = 0, l = children2.length; k < l; ++k) {
            if (child = children2[k]) {
              schedule_default(child, name, id2, k, children2, inherit2);
            }
          }
          subgroups.push(children2);
          parents.push(node);
        }
      }
    }
    return new Transition(subgroups, parents, name, id2);
  }

  // node_modules/d3-transition/src/transition/selection.js
  var Selection2 = selection_default.prototype.constructor;
  function selection_default2() {
    return new Selection2(this._groups, this._parents);
  }

  // node_modules/d3-transition/src/transition/style.js
  function styleNull(name, interpolate) {
    var string00, string10, interpolate0;
    return function() {
      var string0 = styleValue(this, name), string1 = (this.style.removeProperty(name), styleValue(this, name));
      return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : interpolate0 = interpolate(string00 = string0, string10 = string1);
    };
  }
  function styleRemove2(name) {
    return function() {
      this.style.removeProperty(name);
    };
  }
  function styleConstant2(name, interpolate, value1) {
    var string00, string1 = value1 + "", interpolate0;
    return function() {
      var string0 = styleValue(this, name);
      return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
    };
  }
  function styleFunction2(name, interpolate, value2) {
    var string00, string10, interpolate0;
    return function() {
      var string0 = styleValue(this, name), value1 = value2(this), string1 = value1 + "";
      if (value1 == null) string1 = value1 = (this.style.removeProperty(name), styleValue(this, name));
      return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
    };
  }
  function styleMaybeRemove(id2, name) {
    var on0, on1, listener0, key = "style." + name, event = "end." + key, remove2;
    return function() {
      var schedule = set2(this, id2), on2 = schedule.on, listener = schedule.value[key] == null ? remove2 || (remove2 = styleRemove2(name)) : void 0;
      if (on2 !== on0 || listener0 !== listener) (on1 = (on0 = on2).copy()).on(event, listener0 = listener);
      schedule.on = on1;
    };
  }
  function style_default2(name, value2, priority) {
    var i = (name += "") === "transform" ? interpolateTransformCss : interpolate_default;
    return value2 == null ? this.styleTween(name, styleNull(name, i)).on("end.style." + name, styleRemove2(name)) : typeof value2 === "function" ? this.styleTween(name, styleFunction2(name, i, tweenValue(this, "style." + name, value2))).each(styleMaybeRemove(this._id, name)) : this.styleTween(name, styleConstant2(name, i, value2), priority).on("end.style." + name, null);
  }

  // node_modules/d3-transition/src/transition/styleTween.js
  function styleInterpolate(name, i, priority) {
    return function(t) {
      this.style.setProperty(name, i.call(this, t), priority);
    };
  }
  function styleTween(name, value2, priority) {
    var t, i0;
    function tween() {
      var i = value2.apply(this, arguments);
      if (i !== i0) t = (i0 = i) && styleInterpolate(name, i, priority);
      return t;
    }
    tween._value = value2;
    return tween;
  }
  function styleTween_default(name, value2, priority) {
    var key = "style." + (name += "");
    if (arguments.length < 2) return (key = this.tween(key)) && key._value;
    if (value2 == null) return this.tween(key, null);
    if (typeof value2 !== "function") throw new Error();
    return this.tween(key, styleTween(name, value2, priority == null ? "" : priority));
  }

  // node_modules/d3-transition/src/transition/text.js
  function textConstant2(value2) {
    return function() {
      this.textContent = value2;
    };
  }
  function textFunction2(value2) {
    return function() {
      var value1 = value2(this);
      this.textContent = value1 == null ? "" : value1;
    };
  }
  function text_default2(value2) {
    return this.tween("text", typeof value2 === "function" ? textFunction2(tweenValue(this, "text", value2)) : textConstant2(value2 == null ? "" : value2 + ""));
  }

  // node_modules/d3-transition/src/transition/textTween.js
  function textInterpolate(i) {
    return function(t) {
      this.textContent = i.call(this, t);
    };
  }
  function textTween(value2) {
    var t0, i0;
    function tween() {
      var i = value2.apply(this, arguments);
      if (i !== i0) t0 = (i0 = i) && textInterpolate(i);
      return t0;
    }
    tween._value = value2;
    return tween;
  }
  function textTween_default(value2) {
    var key = "text";
    if (arguments.length < 1) return (key = this.tween(key)) && key._value;
    if (value2 == null) return this.tween(key, null);
    if (typeof value2 !== "function") throw new Error();
    return this.tween(key, textTween(value2));
  }

  // node_modules/d3-transition/src/transition/transition.js
  function transition_default() {
    var name = this._name, id0 = this._id, id1 = newId();
    for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          var inherit2 = get2(node, id0);
          schedule_default(node, name, id1, i, group, {
            time: inherit2.time + inherit2.delay + inherit2.duration,
            delay: 0,
            duration: inherit2.duration,
            ease: inherit2.ease
          });
        }
      }
    }
    return new Transition(groups, this._parents, name, id1);
  }

  // node_modules/d3-transition/src/transition/end.js
  function end_default() {
    var on0, on1, that = this, id2 = that._id, size = that.size();
    return new Promise(function(resolve, reject) {
      var cancel = { value: reject }, end = { value: function() {
        if (--size === 0) resolve();
      } };
      that.each(function() {
        var schedule = set2(this, id2), on2 = schedule.on;
        if (on2 !== on0) {
          on1 = (on0 = on2).copy();
          on1._.cancel.push(cancel);
          on1._.interrupt.push(cancel);
          on1._.end.push(end);
        }
        schedule.on = on1;
      });
      if (size === 0) resolve();
    });
  }

  // node_modules/d3-transition/src/transition/index.js
  var id = 0;
  function Transition(groups, parents, name, id2) {
    this._groups = groups;
    this._parents = parents;
    this._name = name;
    this._id = id2;
  }
  function transition(name) {
    return selection_default().transition(name);
  }
  function newId() {
    return ++id;
  }
  var selection_prototype = selection_default.prototype;
  Transition.prototype = transition.prototype = {
    constructor: Transition,
    select: select_default3,
    selectAll: selectAll_default2,
    selectChild: selection_prototype.selectChild,
    selectChildren: selection_prototype.selectChildren,
    filter: filter_default2,
    merge: merge_default2,
    selection: selection_default2,
    transition: transition_default,
    call: selection_prototype.call,
    nodes: selection_prototype.nodes,
    node: selection_prototype.node,
    size: selection_prototype.size,
    empty: selection_prototype.empty,
    each: selection_prototype.each,
    on: on_default2,
    attr: attr_default2,
    attrTween: attrTween_default,
    style: style_default2,
    styleTween: styleTween_default,
    text: text_default2,
    textTween: textTween_default,
    remove: remove_default2,
    tween: tween_default,
    delay: delay_default,
    duration: duration_default,
    ease: ease_default,
    easeVarying: easeVarying_default,
    end: end_default,
    [Symbol.iterator]: selection_prototype[Symbol.iterator]
  };

  // node_modules/d3-ease/src/cubic.js
  function cubicInOut(t) {
    return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
  }

  // node_modules/d3-transition/src/selection/transition.js
  var defaultTiming = {
    time: null,
    // Set on use.
    delay: 0,
    duration: 250,
    ease: cubicInOut
  };
  function inherit(node, id2) {
    var timing;
    while (!(timing = node.__transition) || !(timing = timing[id2])) {
      if (!(node = node.parentNode)) {
        throw new Error(`transition ${id2} not found`);
      }
    }
    return timing;
  }
  function transition_default2(name) {
    var id2, timing;
    if (name instanceof Transition) {
      id2 = name._id, name = name._name;
    } else {
      id2 = newId(), (timing = defaultTiming).time = now(), name = name == null ? null : name + "";
    }
    for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          schedule_default(node, name, id2, i, group, timing || inherit(node, id2));
        }
      }
    }
    return new Transition(groups, this._parents, name, id2);
  }

  // node_modules/d3-transition/src/selection/index.js
  selection_default.prototype.interrupt = interrupt_default2;
  selection_default.prototype.transition = transition_default2;

  // node_modules/d3-brush/src/brush.js
  var { abs, max, min } = Math;
  function number1(e) {
    return [+e[0], +e[1]];
  }
  function number2(e) {
    return [number1(e[0]), number1(e[1])];
  }
  var X = {
    name: "x",
    handles: ["w", "e"].map(type),
    input: function(x2, e) {
      return x2 == null ? null : [[+x2[0], e[0][1]], [+x2[1], e[1][1]]];
    },
    output: function(xy) {
      return xy && [xy[0][0], xy[1][0]];
    }
  };
  var Y = {
    name: "y",
    handles: ["n", "s"].map(type),
    input: function(y2, e) {
      return y2 == null ? null : [[e[0][0], +y2[0]], [e[1][0], +y2[1]]];
    },
    output: function(xy) {
      return xy && [xy[0][1], xy[1][1]];
    }
  };
  var XY = {
    name: "xy",
    handles: ["n", "w", "e", "s", "nw", "ne", "sw", "se"].map(type),
    input: function(xy) {
      return xy == null ? null : number2(xy);
    },
    output: function(xy) {
      return xy;
    }
  };
  function type(t) {
    return { type: t };
  }

  // node_modules/d3-scale/src/init.js
  function initRange(domain, range) {
    switch (arguments.length) {
      case 0:
        break;
      case 1:
        this.range(domain);
        break;
      default:
        this.range(range).domain(domain);
        break;
    }
    return this;
  }

  // node_modules/d3-scale/src/ordinal.js
  var implicit = /* @__PURE__ */ Symbol("implicit");
  function ordinal() {
    var index2 = new InternMap(), domain = [], range = [], unknown = implicit;
    function scale(d) {
      let i = index2.get(d);
      if (i === void 0) {
        if (unknown !== implicit) return unknown;
        index2.set(d, i = domain.push(d) - 1);
      }
      return range[i % range.length];
    }
    scale.domain = function(_) {
      if (!arguments.length) return domain.slice();
      domain = [], index2 = new InternMap();
      for (const value2 of _) {
        if (index2.has(value2)) continue;
        index2.set(value2, domain.push(value2) - 1);
      }
      return scale;
    };
    scale.range = function(_) {
      return arguments.length ? (range = Array.from(_), scale) : range.slice();
    };
    scale.unknown = function(_) {
      return arguments.length ? (unknown = _, scale) : unknown;
    };
    scale.copy = function() {
      return ordinal(domain, range).unknown(unknown);
    };
    initRange.apply(scale, arguments);
    return scale;
  }

  // node_modules/d3-scale-chromatic/src/colors.js
  function colors_default(specifier) {
    var n = specifier.length / 6 | 0, colors = new Array(n), i = 0;
    while (i < n) colors[i] = "#" + specifier.slice(i * 6, ++i * 6);
    return colors;
  }

  // node_modules/d3-scale-chromatic/src/categorical/category10.js
  var category10_default = colors_default("1f77b4ff7f0e2ca02cd627289467bd8c564be377c27f7f7fbcbd2217becf");

  // node_modules/d3-scale-chromatic/src/categorical/Dark2.js
  var Dark2_default = colors_default("1b9e77d95f027570b3e7298a66a61ee6ab02a6761d666666");

  // node_modules/d3-scale-chromatic/src/categorical/observable10.js
  var observable10_default = colors_default("4269d0efb118ff725c6cc5b03ca951ff8ab7a463f297bbf59c6b4e9498a0");

  // node_modules/d3-scale-chromatic/src/categorical/Set2.js
  var Set2_default = colors_default("66c2a5fc8d628da0cbe78ac3a6d854ffd92fe5c494b3b3b3");

  // node_modules/d3-scale-chromatic/src/categorical/Tableau10.js
  var Tableau10_default = colors_default("4e79a7f28e2ce1575976b7b259a14fedc949af7aa1ff9da79c755fbab0ab");

  // node_modules/d3-zoom/src/transform.js
  function Transform(k, x2, y2) {
    this.k = k;
    this.x = x2;
    this.y = y2;
  }
  Transform.prototype = {
    constructor: Transform,
    scale: function(k) {
      return k === 1 ? this : new Transform(this.k * k, this.x, this.y);
    },
    translate: function(x2, y2) {
      return x2 === 0 & y2 === 0 ? this : new Transform(this.k, this.x + this.k * x2, this.y + this.k * y2);
    },
    apply: function(point) {
      return [point[0] * this.k + this.x, point[1] * this.k + this.y];
    },
    applyX: function(x2) {
      return x2 * this.k + this.x;
    },
    applyY: function(y2) {
      return y2 * this.k + this.y;
    },
    invert: function(location) {
      return [(location[0] - this.x) / this.k, (location[1] - this.y) / this.k];
    },
    invertX: function(x2) {
      return (x2 - this.x) / this.k;
    },
    invertY: function(y2) {
      return (y2 - this.y) / this.k;
    },
    rescaleX: function(x2) {
      return x2.copy().domain(x2.range().map(this.invertX, this).map(x2.invert, x2));
    },
    rescaleY: function(y2) {
      return y2.copy().domain(y2.range().map(this.invertY, this).map(y2.invert, y2));
    },
    toString: function() {
      return "translate(" + this.x + "," + this.y + ") scale(" + this.k + ")";
    }
  };
  var identity2 = new Transform(1, 0, 0);
  transform.prototype = Transform.prototype;
  function transform(node) {
    while (!node.__zoom) if (!(node = node.parentNode)) return identity2;
    return node.__zoom;
  }

  // src/palette.ts
  var PALETTE_ORDER = [
    "observable10",
    "tableau10",
    "category10",
    "set2",
    "dark2"
  ];
  var PALETTE_LABELS = {
    observable10: "Observable 10",
    tableau10: "Tableau 10",
    category10: "Category 10",
    set2: "Set 2",
    dark2: "Dark 2"
  };
  function isPaletteKey(key) {
    return typeof key === "string" && Object.hasOwn(PALETTE_LABELS, key);
  }

  // src/colors.ts
  var PALETTES = {
    observable10: () => observable10_default,
    tableau10: () => Tableau10_default,
    category10: () => category10_default,
    set2: () => Set2_default,
    dark2: () => Dark2_default
  };
  function activePalette(key) {
    return (isPaletteKey(key) ? PALETTES[key] : PALETTES.observable10)();
  }
  function paletteColors(key) {
    return PALETTES[key]();
  }
  function createNodeColorResolver(state) {
    const scale = ordinal(
      state.nodes.map((n) => n.id),
      activePalette(state.settings.palette)
    );
    return (node) => scale(node.id);
  }

  // src/dialog.ts
  var FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  function setupDialog(dialog, signal) {
    let trigger = null;
    function close() {
      if (!dialog.open) return;
      dialog.close();
    }
    dialog.addEventListener(
      "click",
      (event) => {
        if (event.target === dialog) {
          close();
          return;
        }
        if (!(event.target instanceof Element)) return;
        if (event.target.closest('[data-action="close-dialog"]')) close();
      },
      { signal }
    );
    dialog.addEventListener(
      "close",
      () => {
        trigger?.focus();
      },
      { signal }
    );
    function open(el) {
      trigger = el;
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute("open", "");
      }
      const pressed = dialog.querySelector('[aria-pressed="true"]');
      const initial = pressed ?? dialog.querySelector(FOCUSABLE_SELECTOR);
      initial?.focus();
    }
    return { open, close };
  }

  // src/export.ts
  var SVG_NS = "http://www.w3.org/2000/svg";
  function svgViewBoxSize(svg) {
    const values = (svg.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
    if (values.length !== 4 || !values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0) {
      throw new Error("The diagram SVG has no valid viewBox.");
    }
    return { width: values[2], height: values[3] };
  }
  function serializeDiagramSvg(svg, opts) {
    const { width, height } = svgViewBoxSize(svg);
    const clone2 = svg.cloneNode(true);
    clone2.setAttribute("xmlns", SVG_NS);
    clone2.setAttribute("width", String(width));
    clone2.setAttribute("height", String(height));
    for (const el of Array.from(clone2.querySelectorAll('[fill="currentColor"]'))) {
      el.setAttribute("fill", opts.labelColor);
    }
    const background = clone2.ownerDocument.createElementNS(SVG_NS, "rect");
    background.setAttribute("x", "0");
    background.setAttribute("y", "0");
    background.setAttribute("width", String(width));
    background.setAttribute("height", String(height));
    background.setAttribute("fill", opts.background);
    clone2.insertBefore(background, clone2.firstChild);
    const xml = new XMLSerializer().serializeToString(clone2);
    return `<?xml version="1.0" encoding="UTF-8"?>
${xml}`;
  }
  function rasterizeSvg(doc, xml, width, height, scale) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
      const img = doc.createElement("img");
      img.onload = () => {
        try {
          const canvas = doc.createElement("canvas");
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

  // src/aspect-ratio.ts
  var ASPECT_RATIO_OPTIONS = [
    { value: "a-series", label: "A-series", width: 679, height: 480 },
    { value: "3:2", label: "3:2", width: 720, height: 480 },
    { value: "16:9", label: "16:9", width: 853, height: 480 },
    { value: "2:1", label: "2:1", width: 960, height: 480 },
    { value: "3:1", label: "3:1", width: 1440, height: 480 }
  ];
  var OPTIONS_BY_VALUE = new Map(ASPECT_RATIO_OPTIONS.map((option2) => [option2.value, option2]));
  function isAspectRatio(value2) {
    return typeof value2 === "string" && OPTIONS_BY_VALUE.has(value2);
  }
  function aspectRatioOption(value2) {
    return OPTIONS_BY_VALUE.get(value2) ?? ASPECT_RATIO_OPTIONS[3];
  }

  // src/state.ts
  function isComplete(link2) {
    return link2.source !== null && link2.target !== null;
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
        linkColor: "source-target",
        alignment: "justify",
        aspectRatio: "2:1",
        theme: "auto"
      }
    };
  }
  function nextNodeId(state) {
    const maxSuffix = state.nodes.reduce((max3, n) => {
      const match = /^n(\d+)$/.exec(n.id);
      return match ? Math.max(max3, Number(match[1])) : max3;
    }, 0);
    return `n${maxSuffix + 1}`;
  }
  function addNode(state) {
    const id2 = nextNodeId(state);
    state.nodes.push({ id: id2, name: `Node ${id2.slice(1)}` });
  }
  function renameNode(state, id2, name) {
    const node = state.nodes.find((n) => n.id === id2);
    if (node) node.name = name;
  }
  function deleteNode(state, id2) {
    state.nodes = state.nodes.filter((n) => n.id !== id2);
    state.links = state.links.filter((l) => l.source !== id2 && l.target !== id2);
  }
  function updateLink(state, index2, patch) {
    const link2 = state.links[index2];
    if (link2) Object.assign(link2, patch);
  }
  function addLink(state) {
    state.links.push({ source: null, target: null, value: 1 });
  }
  function deleteLink(state, index2) {
    state.links.splice(index2, 1);
  }
  function moveWithin(items, from, to) {
    if (items.length < 2) return;
    const max3 = items.length - 1;
    const src = Math.max(0, Math.min(from, max3));
    const dst = Math.max(0, Math.min(to, max3));
    if (src === dst) return;
    const [moved2] = items.splice(src, 1);
    items.splice(dst, 0, moved2);
  }
  function moveNode(state, from, to) {
    moveWithin(state.nodes, from, to);
  }
  function moveLink(state, from, to) {
    moveWithin(state.links, from, to);
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
    const value2 = Number(trimmed);
    if (!(value2 > 0) || value2 > MAX_LINK_VALUE) return { kind: "invalid" };
    return { kind: "valid", value: value2 };
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
  function validate(state) {
    const nameById = new Map(state.nodes.map((n) => [n.id, n.name]));
    for (const [index2, link2] of state.links.entries()) {
      if (!isComplete(link2)) continue;
      if (link2.source === link2.target) {
        return {
          ok: false,
          error: `A link cannot connect ${nameById.get(link2.source) ?? link2.source} to itself.`
        };
      }
      if (!Number.isFinite(link2.value) || link2.value <= 0) {
        const sourceName = nameById.get(link2.source) ?? link2.source;
        const targetName = nameById.get(link2.target) ?? link2.target;
        return {
          ok: false,
          error: `Link ${index2 + 1} (${sourceName} to ${targetName}) needs a value greater than 0.`
        };
      }
      if (link2.value > MAX_LINK_VALUE) {
        const sourceName = nameById.get(link2.source) ?? link2.source;
        const targetName = nameById.get(link2.target) ?? link2.target;
        return {
          ok: false,
          error: `Link ${index2 + 1} (${sourceName} to ${targetName}) value is too large (maximum ${MAX_LINK_VALUE}).`
        };
      }
    }
    const adjacency = /* @__PURE__ */ new Map();
    for (const link2 of state.links) {
      if (!isComplete(link2)) continue;
      if (!adjacency.has(link2.source)) adjacency.set(link2.source, []);
      adjacency.get(link2.source)?.push(link2.target);
    }
    const visited = /* @__PURE__ */ new Set();
    const path2 = [];
    const pathIndex = /* @__PURE__ */ new Map();
    function visit(id2) {
      path2.push(id2);
      pathIndex.set(id2, path2.length - 1);
      visited.add(id2);
      for (const next of adjacency.get(id2) ?? []) {
        const nextIndex = pathIndex.get(next);
        if (nextIndex !== void 0) {
          return [...path2.slice(nextIndex), next].map((nodeId) => nameById.get(nodeId) ?? nodeId);
        }
        if (!visited.has(next)) {
          const cycle = visit(next);
          if (cycle) return cycle;
        }
      }
      path2.pop();
      pathIndex.delete(id2);
      return null;
    }
    for (const node of state.nodes) {
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
  function isLinkColorMode(value2) {
    return typeof value2 === "string" && LINK_COLOR_MODES.has(value2);
  }
  function isAlignment(value2) {
    return typeof value2 === "string" && ALIGNMENTS.has(value2);
  }
  function isTheme(value2) {
    return typeof value2 === "string" && THEMES.has(value2);
  }
  function normalizeSettings(settings, repairs) {
    const s = settings && typeof settings === "object" ? settings : {};
    let palette = "observable10";
    if (isPaletteKey(s.palette)) palette = s.palette;
    else if (s.palette !== void 0) repairs?.push("settings: unknown palette \u2014 using default");
    if (s.colorMode === "manual") {
      repairs?.push("settings: manual colors are no longer supported \u2014 using the saved palette");
    }
    let linkColor = "source-target";
    if (isLinkColorMode(s.linkColor)) linkColor = s.linkColor;
    else if (s.linkColor !== void 0) repairs?.push("settings: unknown link color \u2014 using default");
    let alignment = "justify";
    if (isAlignment(s.alignment)) alignment = s.alignment;
    else if (s.alignment !== void 0) repairs?.push("settings: unknown alignment \u2014 using default");
    let aspectRatio = "2:1";
    if (isAspectRatio(s.aspectRatio)) aspectRatio = s.aspectRatio;
    else if (s.aspectRatio !== void 0) {
      repairs?.push("settings: unknown aspect ratio \u2014 using 2:1");
    }
    const theme = isTheme(s.theme) ? s.theme : "auto";
    return { palette, linkColor, alignment, aspectRatio, theme };
  }
  function isRawState(value2) {
    if (!value2 || typeof value2 !== "object") return false;
    const v = value2;
    return Array.isArray(v.nodes) && Array.isArray(v.links);
  }
  function isRawNode(value2) {
    if (!value2 || typeof value2 !== "object") return false;
    const v = value2;
    return typeof v.id === "string" && typeof v.name === "string";
  }
  function isRawLink(value2) {
    return Boolean(value2) && typeof value2 === "object";
  }
  function normalizeNodes(rawNodes, repairs) {
    const nodes = [];
    rawNodes.forEach((value2, index2) => {
      if (!isRawNode(value2)) {
        repairs?.push(`node ${index2 + 1}: missing id or name \u2014 dropped`);
        return;
      }
      nodes.push({ id: value2.id, name: value2.name });
    });
    return nodes;
  }
  function normalizeLinks(rawLinks, nodeIds, repairs) {
    const links = [];
    rawLinks.forEach((value2, index2) => {
      if (!isRawLink(value2)) {
        repairs?.push(`link ${index2 + 1}: not an object \u2014 dropped`);
        return;
      }
      const source = normalizeEndpoint(value2.source, nodeIds);
      if (source === null && value2.source != null) {
        repairs?.push(`link ${index2 + 1}: unknown source \u2014 left unassigned`);
      }
      const target = normalizeEndpoint(value2.target, nodeIds);
      if (target === null && value2.target != null) {
        repairs?.push(`link ${index2 + 1}: unknown target \u2014 left unassigned`);
      }
      if (value2.value !== void 0 && !isValidLinkValue(value2.value)) {
        repairs?.push(`link ${index2 + 1}: invalid value \u2014 set to 1`);
      }
      links.push({ source, target, value: normalizeLinkValue(value2.value) });
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
  function normalizeEndpoint(value2, nodeIds) {
    return typeof value2 === "string" && nodeIds.has(value2) ? value2 : null;
  }
  function isValidLinkValue(value2) {
    return typeof value2 === "number" && value2 > 0 && value2 <= MAX_LINK_VALUE;
  }
  function normalizeLinkValue(value2) {
    return isValidLinkValue(value2) ? value2 : 1;
  }
  function loadState(storage) {
    let raw = null;
    try {
      raw = storage.getItem(STORAGE_KEY);
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
  function saveState(storage, state) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  // src/io.ts
  function serializeState(state) {
    const exported = {
      nodes: state.nodes,
      links: state.links.filter(isComplete),
      settings: {
        palette: state.settings.palette,
        linkColor: state.settings.linkColor,
        alignment: state.settings.alignment,
        aspectRatio: state.settings.aspectRatio
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
      linkColor: normalized.linkColor,
      alignment: normalized.alignment,
      aspectRatio: normalized.aspectRatio
    };
    return { ok: true, state: { nodes, links, settings }, repairs };
  }

  // src/io-controls.ts
  var EXPORT_JSON_FILENAME = "sankey.json";
  var EXPORT_SVG_FILENAME = "sankey.svg";
  var EXPORT_PNG_FILENAME = "sankey.png";
  var PNG_EXPORT_SCALE = 2;
  function setupIo(doc, win, state, actions, signal) {
    const exportButton = doc.getElementById("export-button");
    const diagramExportButton = doc.getElementById("diagram-export-button");
    const diagramExportDialogEl = doc.getElementById("diagram-export-dialog");
    const importButton = doc.getElementById("import-button");
    const fileInput = doc.getElementById("import-file");
    if (!(fileInput instanceof HTMLInputElement)) return;
    const diagramExportDialog = diagramExportDialogEl instanceof HTMLDialogElement ? setupDialog(diagramExportDialogEl, signal) : void 0;
    exportButton?.addEventListener(
      "click",
      () => {
        const blob = new Blob([serializeState(state)], { type: "application/json" });
        download(doc, blob, EXPORT_JSON_FILENAME);
        actions.reportExportSuccess(EXPORT_JSON_FILENAME);
      },
      { signal }
    );
    diagramExportButton?.addEventListener(
      "click",
      () => {
        if (diagramExportButton instanceof HTMLElement) {
          diagramExportDialog?.open(diagramExportButton);
        }
      },
      { signal }
    );
    for (const exportSvgButton of Array.from(
      doc.querySelectorAll('[data-action="export-svg"]')
    )) {
      exportSvgButton.addEventListener(
        "click",
        () => {
          const svg = serializeVisibleDiagram(doc, win, actions);
          if (svg) {
            download(doc, new Blob([svg], { type: "image/svg+xml" }), EXPORT_SVG_FILENAME);
            actions.reportExportSuccess(EXPORT_SVG_FILENAME);
          }
          closeContainingDialog(exportSvgButton);
        },
        { signal }
      );
    }
    for (const exportPngButton of Array.from(
      doc.querySelectorAll('[data-action="export-png"]')
    )) {
      exportPngButton.addEventListener(
        "click",
        () => {
          const svg = serializeVisibleDiagram(doc, win, actions);
          if (svg) {
            const svgElement = doc.querySelector("#diagram svg");
            const { width, height } = svgViewBoxSize(svgElement);
            rasterizeSvg(doc, svg, width, height, PNG_EXPORT_SCALE).then((blob) => {
              download(doc, blob, EXPORT_PNG_FILENAME);
              actions.reportExportSuccess(EXPORT_PNG_FILENAME);
            }).catch((err) => {
              console.error(err);
              actions.reportExportError("PNG export failed. Try the SVG export instead.");
            });
          }
          closeContainingDialog(exportPngButton);
        },
        { signal }
      );
    }
    importButton?.addEventListener("click", () => fileInput.click(), { signal });
    fileInput.addEventListener(
      "change",
      async () => {
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
      },
      { signal }
    );
  }
  function closeContainingDialog(control) {
    const dialog = control.closest("dialog");
    if (dialog instanceof HTMLDialogElement && dialog.open) dialog.close();
  }
  function serializeVisibleDiagram(doc, win, actions) {
    const svgEl = doc.querySelector("#diagram svg");
    if (!(svgEl instanceof SVGSVGElement)) {
      actions.reportExportError("Nothing to export \u2014 the diagram is empty.");
      return void 0;
    }
    const labelColor = win.getComputedStyle(svgEl).color;
    const background = win.getComputedStyle(svgEl.parentElement).backgroundColor;
    return serializeDiagramSvg(svgEl, { labelColor, background });
  }
  function download(doc, blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = doc.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  // node_modules/sortablejs/modular/sortable.esm.js
  function _defineProperty(e, r, t) {
    return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
      value: t,
      enumerable: true,
      configurable: true,
      writable: true
    }) : e[r] = t, e;
  }
  function _extends() {
    return _extends = Object.assign ? Object.assign.bind() : function(n) {
      for (var e = 1; e < arguments.length; e++) {
        var t = arguments[e];
        for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
      }
      return n;
    }, _extends.apply(null, arguments);
  }
  function ownKeys(e, r) {
    var t = Object.keys(e);
    if (Object.getOwnPropertySymbols) {
      var o = Object.getOwnPropertySymbols(e);
      r && (o = o.filter(function(r2) {
        return Object.getOwnPropertyDescriptor(e, r2).enumerable;
      })), t.push.apply(t, o);
    }
    return t;
  }
  function _objectSpread2(e) {
    for (var r = 1; r < arguments.length; r++) {
      var t = null != arguments[r] ? arguments[r] : {};
      r % 2 ? ownKeys(Object(t), true).forEach(function(r2) {
        _defineProperty(e, r2, t[r2]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function(r2) {
        Object.defineProperty(e, r2, Object.getOwnPropertyDescriptor(t, r2));
      });
    }
    return e;
  }
  function _objectWithoutProperties(e, t) {
    if (null == e) return {};
    var o, r, i = _objectWithoutPropertiesLoose(e, t);
    if (Object.getOwnPropertySymbols) {
      var n = Object.getOwnPropertySymbols(e);
      for (r = 0; r < n.length; r++) o = n[r], -1 === t.indexOf(o) && {}.propertyIsEnumerable.call(e, o) && (i[o] = e[o]);
    }
    return i;
  }
  function _objectWithoutPropertiesLoose(r, e) {
    if (null == r) return {};
    var t = {};
    for (var n in r) if ({}.hasOwnProperty.call(r, n)) {
      if (-1 !== e.indexOf(n)) continue;
      t[n] = r[n];
    }
    return t;
  }
  function _toPrimitive(t, r) {
    if ("object" != typeof t || !t) return t;
    var e = t[Symbol.toPrimitive];
    if (void 0 !== e) {
      var i = e.call(t, r || "default");
      if ("object" != typeof i) return i;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return ("string" === r ? String : Number)(t);
  }
  function _toPropertyKey(t) {
    var i = _toPrimitive(t, "string");
    return "symbol" == typeof i ? i : i + "";
  }
  function _typeof(o) {
    "@babel/helpers - typeof";
    return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o2) {
      return typeof o2;
    } : function(o2) {
      return o2 && "function" == typeof Symbol && o2.constructor === Symbol && o2 !== Symbol.prototype ? "symbol" : typeof o2;
    }, _typeof(o);
  }
  var version = "1.15.7";
  function userAgent(pattern) {
    if (typeof window !== "undefined" && window.navigator) {
      return !!/* @__PURE__ */ navigator.userAgent.match(pattern);
    }
  }
  var IE11OrLess = userAgent(/(?:Trident.*rv[ :]?11\.|msie|iemobile|Windows Phone)/i);
  var Edge = userAgent(/Edge/i);
  var FireFox = userAgent(/firefox/i);
  var Safari = userAgent(/safari/i) && !userAgent(/chrome/i) && !userAgent(/android/i);
  var IOS = userAgent(/iP(ad|od|hone)/i);
  var ChromeForAndroid = userAgent(/chrome/i) && userAgent(/android/i);
  var captureMode = {
    capture: false,
    passive: false
  };
  function on(el, event, fn) {
    el.addEventListener(event, fn, !IE11OrLess && captureMode);
  }
  function off(el, event, fn) {
    el.removeEventListener(event, fn, !IE11OrLess && captureMode);
  }
  function matches(el, selector) {
    if (!selector) return;
    selector[0] === ">" && (selector = selector.substring(1));
    if (el) {
      try {
        if (el.matches) {
          return el.matches(selector);
        } else if (el.msMatchesSelector) {
          return el.msMatchesSelector(selector);
        } else if (el.webkitMatchesSelector) {
          return el.webkitMatchesSelector(selector);
        }
      } catch (_) {
        return false;
      }
    }
    return false;
  }
  function getParentOrHost(el) {
    return el.host && el !== document && el.host.nodeType && el.host !== el ? el.host : el.parentNode;
  }
  function closest(el, selector, ctx, includeCTX) {
    if (el) {
      ctx = ctx || document;
      do {
        if (selector != null && (selector[0] === ">" ? el.parentNode === ctx && matches(el, selector) : matches(el, selector)) || includeCTX && el === ctx) {
          return el;
        }
        if (el === ctx) break;
      } while (el = getParentOrHost(el));
    }
    return null;
  }
  var R_SPACE = /\s+/g;
  function toggleClass(el, name, state) {
    if (el && name) {
      if (el.classList) {
        el.classList[state ? "add" : "remove"](name);
      } else {
        var className = (" " + el.className + " ").replace(R_SPACE, " ").replace(" " + name + " ", " ");
        el.className = (className + (state ? " " + name : "")).replace(R_SPACE, " ");
      }
    }
  }
  function css(el, prop, val) {
    var style = el && el.style;
    if (style) {
      if (val === void 0) {
        if (document.defaultView && document.defaultView.getComputedStyle) {
          val = document.defaultView.getComputedStyle(el, "");
        } else if (el.currentStyle) {
          val = el.currentStyle;
        }
        return prop === void 0 ? val : val[prop];
      } else {
        if (!(prop in style) && prop.indexOf("webkit") === -1) {
          prop = "-webkit-" + prop;
        }
        style[prop] = val + (typeof val === "string" ? "" : "px");
      }
    }
  }
  function matrix(el, selfOnly) {
    var appliedTransforms = "";
    if (typeof el === "string") {
      appliedTransforms = el;
    } else {
      do {
        var transform2 = css(el, "transform");
        if (transform2 && transform2 !== "none") {
          appliedTransforms = transform2 + " " + appliedTransforms;
        }
      } while (!selfOnly && (el = el.parentNode));
    }
    var matrixFn = window.DOMMatrix || window.WebKitCSSMatrix || window.CSSMatrix || window.MSCSSMatrix;
    return matrixFn && new matrixFn(appliedTransforms);
  }
  function find2(ctx, tagName, iterator) {
    if (ctx) {
      var list = ctx.getElementsByTagName(tagName), i = 0, n = list.length;
      if (iterator) {
        for (; i < n; i++) {
          iterator(list[i], i);
        }
      }
      return list;
    }
    return [];
  }
  function getWindowScrollingElement() {
    var scrollingElement = document.scrollingElement;
    if (scrollingElement) {
      return scrollingElement;
    } else {
      return document.documentElement;
    }
  }
  function getRect(el, relativeToContainingBlock, relativeToNonStaticParent, undoScale, container) {
    if (!el.getBoundingClientRect && el !== window) return;
    var elRect, top, left2, bottom, right2, height, width;
    if (el !== window && el.parentNode && el !== getWindowScrollingElement()) {
      elRect = el.getBoundingClientRect();
      top = elRect.top;
      left2 = elRect.left;
      bottom = elRect.bottom;
      right2 = elRect.right;
      height = elRect.height;
      width = elRect.width;
    } else {
      top = 0;
      left2 = 0;
      bottom = window.innerHeight;
      right2 = window.innerWidth;
      height = window.innerHeight;
      width = window.innerWidth;
    }
    if ((relativeToContainingBlock || relativeToNonStaticParent) && el !== window) {
      container = container || el.parentNode;
      if (!IE11OrLess) {
        do {
          if (container && container.getBoundingClientRect && (css(container, "transform") !== "none" || relativeToNonStaticParent && css(container, "position") !== "static")) {
            var containerRect = container.getBoundingClientRect();
            top -= containerRect.top + parseInt(css(container, "border-top-width"));
            left2 -= containerRect.left + parseInt(css(container, "border-left-width"));
            bottom = top + elRect.height;
            right2 = left2 + elRect.width;
            break;
          }
        } while (container = container.parentNode);
      }
    }
    if (undoScale && el !== window) {
      var elMatrix = matrix(container || el), scaleX = elMatrix && elMatrix.a, scaleY = elMatrix && elMatrix.d;
      if (elMatrix) {
        top /= scaleY;
        left2 /= scaleX;
        width /= scaleX;
        height /= scaleY;
        bottom = top + height;
        right2 = left2 + width;
      }
    }
    return {
      top,
      left: left2,
      bottom,
      right: right2,
      width,
      height
    };
  }
  function isScrolledPast(el, elSide, parentSide) {
    var parent = getParentAutoScrollElement(el, true), elSideVal = getRect(el)[elSide];
    while (parent) {
      var parentSideVal = getRect(parent)[parentSide], visible = void 0;
      if (parentSide === "top" || parentSide === "left") {
        visible = elSideVal >= parentSideVal;
      } else {
        visible = elSideVal <= parentSideVal;
      }
      if (!visible) return parent;
      if (parent === getWindowScrollingElement()) break;
      parent = getParentAutoScrollElement(parent, false);
    }
    return false;
  }
  function getChild(el, childNum, options, includeDragEl) {
    var currentChild = 0, i = 0, children2 = el.children;
    while (i < children2.length) {
      if (children2[i].style.display !== "none" && children2[i] !== Sortable.ghost && (includeDragEl || children2[i] !== Sortable.dragged) && closest(children2[i], options.draggable, el, false)) {
        if (currentChild === childNum) {
          return children2[i];
        }
        currentChild++;
      }
      i++;
    }
    return null;
  }
  function lastChild(el, selector) {
    var last = el.lastElementChild;
    while (last && (last === Sortable.ghost || css(last, "display") === "none" || selector && !matches(last, selector))) {
      last = last.previousElementSibling;
    }
    return last || null;
  }
  function index(el, selector) {
    var index2 = 0;
    if (!el || !el.parentNode) {
      return -1;
    }
    while (el = el.previousElementSibling) {
      if (el.nodeName.toUpperCase() !== "TEMPLATE" && el !== Sortable.clone && (!selector || matches(el, selector))) {
        index2++;
      }
    }
    return index2;
  }
  function getRelativeScrollOffset(el) {
    var offsetLeft = 0, offsetTop = 0, winScroller = getWindowScrollingElement();
    if (el) {
      do {
        var elMatrix = matrix(el), scaleX = elMatrix.a, scaleY = elMatrix.d;
        offsetLeft += el.scrollLeft * scaleX;
        offsetTop += el.scrollTop * scaleY;
      } while (el !== winScroller && (el = el.parentNode));
    }
    return [offsetLeft, offsetTop];
  }
  function indexOfObject(arr, obj) {
    for (var i in arr) {
      if (!arr.hasOwnProperty(i)) continue;
      for (var key in obj) {
        if (obj.hasOwnProperty(key) && obj[key] === arr[i][key]) return Number(i);
      }
    }
    return -1;
  }
  function getParentAutoScrollElement(el, includeSelf) {
    if (!el || !el.getBoundingClientRect) return getWindowScrollingElement();
    var elem = el;
    var gotSelf = false;
    do {
      if (elem.clientWidth < elem.scrollWidth || elem.clientHeight < elem.scrollHeight) {
        var elemCSS = css(elem);
        if (elem.clientWidth < elem.scrollWidth && (elemCSS.overflowX == "auto" || elemCSS.overflowX == "scroll") || elem.clientHeight < elem.scrollHeight && (elemCSS.overflowY == "auto" || elemCSS.overflowY == "scroll")) {
          if (!elem.getBoundingClientRect || elem === document.body) return getWindowScrollingElement();
          if (gotSelf || includeSelf) return elem;
          gotSelf = true;
        }
      }
    } while (elem = elem.parentNode);
    return getWindowScrollingElement();
  }
  function extend2(dst, src) {
    if (dst && src) {
      for (var key in src) {
        if (src.hasOwnProperty(key)) {
          dst[key] = src[key];
        }
      }
    }
    return dst;
  }
  function isRectEqual(rect1, rect2) {
    return Math.round(rect1.top) === Math.round(rect2.top) && Math.round(rect1.left) === Math.round(rect2.left) && Math.round(rect1.height) === Math.round(rect2.height) && Math.round(rect1.width) === Math.round(rect2.width);
  }
  var _throttleTimeout;
  function throttle(callback, ms) {
    return function() {
      if (!_throttleTimeout) {
        var args = arguments, _this = this;
        if (args.length === 1) {
          callback.call(_this, args[0]);
        } else {
          callback.apply(_this, args);
        }
        _throttleTimeout = setTimeout(function() {
          _throttleTimeout = void 0;
        }, ms);
      }
    };
  }
  function cancelThrottle() {
    clearTimeout(_throttleTimeout);
    _throttleTimeout = void 0;
  }
  function scrollBy(el, x2, y2) {
    el.scrollLeft += x2;
    el.scrollTop += y2;
  }
  function clone(el) {
    var Polymer = window.Polymer;
    var $ = window.jQuery || window.Zepto;
    if (Polymer && Polymer.dom) {
      return Polymer.dom(el).cloneNode(true);
    } else if ($) {
      return $(el).clone(true)[0];
    } else {
      return el.cloneNode(true);
    }
  }
  function getChildContainingRectFromElement(container, options, ghostEl2) {
    var rect = {};
    Array.from(container.children).forEach(function(child) {
      var _rect$left, _rect$top, _rect$right, _rect$bottom;
      if (!closest(child, options.draggable, container, false) || child.animated || child === ghostEl2) return;
      var childRect = getRect(child);
      rect.left = Math.min((_rect$left = rect.left) !== null && _rect$left !== void 0 ? _rect$left : Infinity, childRect.left);
      rect.top = Math.min((_rect$top = rect.top) !== null && _rect$top !== void 0 ? _rect$top : Infinity, childRect.top);
      rect.right = Math.max((_rect$right = rect.right) !== null && _rect$right !== void 0 ? _rect$right : -Infinity, childRect.right);
      rect.bottom = Math.max((_rect$bottom = rect.bottom) !== null && _rect$bottom !== void 0 ? _rect$bottom : -Infinity, childRect.bottom);
    });
    rect.width = rect.right - rect.left;
    rect.height = rect.bottom - rect.top;
    rect.x = rect.left;
    rect.y = rect.top;
    return rect;
  }
  var expando = "Sortable" + (/* @__PURE__ */ new Date()).getTime();
  function AnimationStateManager() {
    var animationStates = [], animationCallbackId;
    return {
      captureAnimationState: function captureAnimationState() {
        animationStates = [];
        if (!this.options.animation) return;
        var children2 = [].slice.call(this.el.children);
        children2.forEach(function(child) {
          if (css(child, "display") === "none" || child === Sortable.ghost) return;
          animationStates.push({
            target: child,
            rect: getRect(child)
          });
          var fromRect = _objectSpread2({}, animationStates[animationStates.length - 1].rect);
          if (child.thisAnimationDuration) {
            var childMatrix = matrix(child, true);
            if (childMatrix) {
              fromRect.top -= childMatrix.f;
              fromRect.left -= childMatrix.e;
            }
          }
          child.fromRect = fromRect;
        });
      },
      addAnimationState: function addAnimationState(state) {
        animationStates.push(state);
      },
      removeAnimationState: function removeAnimationState(target) {
        animationStates.splice(indexOfObject(animationStates, {
          target
        }), 1);
      },
      animateAll: function animateAll(callback) {
        var _this = this;
        if (!this.options.animation) {
          clearTimeout(animationCallbackId);
          if (typeof callback === "function") callback();
          return;
        }
        var animating = false, animationTime = 0;
        animationStates.forEach(function(state) {
          var time = 0, target = state.target, fromRect = target.fromRect, toRect = getRect(target), prevFromRect = target.prevFromRect, prevToRect = target.prevToRect, animatingRect = state.rect, targetMatrix = matrix(target, true);
          if (targetMatrix) {
            toRect.top -= targetMatrix.f;
            toRect.left -= targetMatrix.e;
          }
          target.toRect = toRect;
          if (target.thisAnimationDuration) {
            if (isRectEqual(prevFromRect, toRect) && !isRectEqual(fromRect, toRect) && // Make sure animatingRect is on line between toRect & fromRect
            (animatingRect.top - toRect.top) / (animatingRect.left - toRect.left) === (fromRect.top - toRect.top) / (fromRect.left - toRect.left)) {
              time = calculateRealTime(animatingRect, prevFromRect, prevToRect, _this.options);
            }
          }
          if (!isRectEqual(toRect, fromRect)) {
            target.prevFromRect = fromRect;
            target.prevToRect = toRect;
            if (!time) {
              time = _this.options.animation;
            }
            _this.animate(target, animatingRect, toRect, time);
          }
          if (time) {
            animating = true;
            animationTime = Math.max(animationTime, time);
            clearTimeout(target.animationResetTimer);
            target.animationResetTimer = setTimeout(function() {
              target.animationTime = 0;
              target.prevFromRect = null;
              target.fromRect = null;
              target.prevToRect = null;
              target.thisAnimationDuration = null;
            }, time);
            target.thisAnimationDuration = time;
          }
        });
        clearTimeout(animationCallbackId);
        if (!animating) {
          if (typeof callback === "function") callback();
        } else {
          animationCallbackId = setTimeout(function() {
            if (typeof callback === "function") callback();
          }, animationTime);
        }
        animationStates = [];
      },
      animate: function animate(target, currentRect, toRect, duration) {
        if (duration) {
          css(target, "transition", "");
          css(target, "transform", "");
          var elMatrix = matrix(this.el), scaleX = elMatrix && elMatrix.a, scaleY = elMatrix && elMatrix.d, translateX = (currentRect.left - toRect.left) / (scaleX || 1), translateY = (currentRect.top - toRect.top) / (scaleY || 1);
          target.animatingX = !!translateX;
          target.animatingY = !!translateY;
          css(target, "transform", "translate3d(" + translateX + "px," + translateY + "px,0)");
          this.forRepaintDummy = repaint(target);
          css(target, "transition", "transform " + duration + "ms" + (this.options.easing ? " " + this.options.easing : ""));
          css(target, "transform", "translate3d(0,0,0)");
          typeof target.animated === "number" && clearTimeout(target.animated);
          target.animated = setTimeout(function() {
            css(target, "transition", "");
            css(target, "transform", "");
            target.animated = false;
            target.animatingX = false;
            target.animatingY = false;
          }, duration);
        }
      }
    };
  }
  function repaint(target) {
    return target.offsetWidth;
  }
  function calculateRealTime(animatingRect, fromRect, toRect, options) {
    return Math.sqrt(Math.pow(fromRect.top - animatingRect.top, 2) + Math.pow(fromRect.left - animatingRect.left, 2)) / Math.sqrt(Math.pow(fromRect.top - toRect.top, 2) + Math.pow(fromRect.left - toRect.left, 2)) * options.animation;
  }
  var plugins = [];
  var defaults = {
    initializeByDefault: true
  };
  var PluginManager = {
    mount: function mount(plugin) {
      for (var option2 in defaults) {
        if (defaults.hasOwnProperty(option2) && !(option2 in plugin)) {
          plugin[option2] = defaults[option2];
        }
      }
      plugins.forEach(function(p) {
        if (p.pluginName === plugin.pluginName) {
          throw "Sortable: Cannot mount plugin ".concat(plugin.pluginName, " more than once");
        }
      });
      plugins.push(plugin);
    },
    pluginEvent: function pluginEvent(eventName, sortable, evt) {
      var _this = this;
      this.eventCanceled = false;
      evt.cancel = function() {
        _this.eventCanceled = true;
      };
      var eventNameGlobal = eventName + "Global";
      plugins.forEach(function(plugin) {
        if (!sortable[plugin.pluginName]) return;
        if (sortable[plugin.pluginName][eventNameGlobal]) {
          sortable[plugin.pluginName][eventNameGlobal](_objectSpread2({
            sortable
          }, evt));
        }
        if (sortable.options[plugin.pluginName] && sortable[plugin.pluginName][eventName]) {
          sortable[plugin.pluginName][eventName](_objectSpread2({
            sortable
          }, evt));
        }
      });
    },
    initializePlugins: function initializePlugins(sortable, el, defaults2, options) {
      plugins.forEach(function(plugin) {
        var pluginName = plugin.pluginName;
        if (!sortable.options[pluginName] && !plugin.initializeByDefault) return;
        var initialized = new plugin(sortable, el, sortable.options);
        initialized.sortable = sortable;
        initialized.options = sortable.options;
        sortable[pluginName] = initialized;
        _extends(defaults2, initialized.defaults);
      });
      for (var option2 in sortable.options) {
        if (!sortable.options.hasOwnProperty(option2)) continue;
        var modified = this.modifyOption(sortable, option2, sortable.options[option2]);
        if (typeof modified !== "undefined") {
          sortable.options[option2] = modified;
        }
      }
    },
    getEventProperties: function getEventProperties(name, sortable) {
      var eventProperties = {};
      plugins.forEach(function(plugin) {
        if (typeof plugin.eventProperties !== "function") return;
        _extends(eventProperties, plugin.eventProperties.call(sortable[plugin.pluginName], name));
      });
      return eventProperties;
    },
    modifyOption: function modifyOption(sortable, name, value2) {
      var modifiedValue;
      plugins.forEach(function(plugin) {
        if (!sortable[plugin.pluginName]) return;
        if (plugin.optionListeners && typeof plugin.optionListeners[name] === "function") {
          modifiedValue = plugin.optionListeners[name].call(sortable[plugin.pluginName], value2);
        }
      });
      return modifiedValue;
    }
  };
  function dispatchEvent2(_ref) {
    var sortable = _ref.sortable, rootEl2 = _ref.rootEl, name = _ref.name, targetEl = _ref.targetEl, cloneEl2 = _ref.cloneEl, toEl = _ref.toEl, fromEl = _ref.fromEl, oldIndex2 = _ref.oldIndex, newIndex2 = _ref.newIndex, oldDraggableIndex2 = _ref.oldDraggableIndex, newDraggableIndex2 = _ref.newDraggableIndex, originalEvent = _ref.originalEvent, putSortable2 = _ref.putSortable, extraEventProperties = _ref.extraEventProperties;
    sortable = sortable || rootEl2 && rootEl2[expando];
    if (!sortable) return;
    var evt, options = sortable.options, onName = "on" + name.charAt(0).toUpperCase() + name.substr(1);
    if (window.CustomEvent && !IE11OrLess && !Edge) {
      evt = new CustomEvent(name, {
        bubbles: true,
        cancelable: true
      });
    } else {
      evt = document.createEvent("Event");
      evt.initEvent(name, true, true);
    }
    evt.to = toEl || rootEl2;
    evt.from = fromEl || rootEl2;
    evt.item = targetEl || rootEl2;
    evt.clone = cloneEl2;
    evt.oldIndex = oldIndex2;
    evt.newIndex = newIndex2;
    evt.oldDraggableIndex = oldDraggableIndex2;
    evt.newDraggableIndex = newDraggableIndex2;
    evt.originalEvent = originalEvent;
    evt.pullMode = putSortable2 ? putSortable2.lastPutMode : void 0;
    var allEventProperties = _objectSpread2(_objectSpread2({}, extraEventProperties), PluginManager.getEventProperties(name, sortable));
    for (var option2 in allEventProperties) {
      evt[option2] = allEventProperties[option2];
    }
    if (rootEl2) {
      rootEl2.dispatchEvent(evt);
    }
    if (options[onName]) {
      options[onName].call(sortable, evt);
    }
  }
  var _excluded = ["evt"];
  var pluginEvent2 = function pluginEvent3(eventName, sortable) {
    var _ref = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {}, originalEvent = _ref.evt, data = _objectWithoutProperties(_ref, _excluded);
    PluginManager.pluginEvent.bind(Sortable)(eventName, sortable, _objectSpread2({
      dragEl,
      parentEl,
      ghostEl,
      rootEl,
      nextEl,
      lastDownEl,
      cloneEl,
      cloneHidden,
      dragStarted: moved,
      putSortable,
      activeSortable: Sortable.active,
      originalEvent,
      oldIndex,
      oldDraggableIndex,
      newIndex,
      newDraggableIndex,
      hideGhostForTarget: _hideGhostForTarget,
      unhideGhostForTarget: _unhideGhostForTarget,
      cloneNowHidden: function cloneNowHidden() {
        cloneHidden = true;
      },
      cloneNowShown: function cloneNowShown() {
        cloneHidden = false;
      },
      dispatchSortableEvent: function dispatchSortableEvent(name) {
        _dispatchEvent({
          sortable,
          name,
          originalEvent
        });
      }
    }, data));
  };
  function _dispatchEvent(info) {
    dispatchEvent2(_objectSpread2({
      putSortable,
      cloneEl,
      targetEl: dragEl,
      rootEl,
      oldIndex,
      oldDraggableIndex,
      newIndex,
      newDraggableIndex
    }, info));
  }
  var dragEl;
  var parentEl;
  var ghostEl;
  var rootEl;
  var nextEl;
  var lastDownEl;
  var cloneEl;
  var cloneHidden;
  var oldIndex;
  var newIndex;
  var oldDraggableIndex;
  var newDraggableIndex;
  var activeGroup;
  var putSortable;
  var awaitingDragStarted = false;
  var ignoreNextClick = false;
  var sortables = [];
  var tapEvt;
  var touchEvt;
  var lastDx;
  var lastDy;
  var tapDistanceLeft;
  var tapDistanceTop;
  var moved;
  var lastTarget;
  var lastDirection;
  var pastFirstInvertThresh = false;
  var isCircumstantialInvert = false;
  var targetMoveDistance;
  var ghostRelativeParent;
  var ghostRelativeParentInitialScroll = [];
  var _silent = false;
  var savedInputChecked = [];
  var documentExists = typeof document !== "undefined";
  var PositionGhostAbsolutely = IOS;
  var CSSFloatProperty = Edge || IE11OrLess ? "cssFloat" : "float";
  var supportDraggable = documentExists && !ChromeForAndroid && !IOS && "draggable" in document.createElement("div");
  var supportCssPointerEvents = (function() {
    if (!documentExists) return;
    if (IE11OrLess) {
      return false;
    }
    var el = document.createElement("x");
    el.style.cssText = "pointer-events:auto";
    return el.style.pointerEvents === "auto";
  })();
  var _detectDirection = function _detectDirection2(el, options) {
    var elCSS = css(el), elWidth = parseInt(elCSS.width) - parseInt(elCSS.paddingLeft) - parseInt(elCSS.paddingRight) - parseInt(elCSS.borderLeftWidth) - parseInt(elCSS.borderRightWidth), child1 = getChild(el, 0, options), child2 = getChild(el, 1, options), firstChildCSS = child1 && css(child1), secondChildCSS = child2 && css(child2), firstChildWidth = firstChildCSS && parseInt(firstChildCSS.marginLeft) + parseInt(firstChildCSS.marginRight) + getRect(child1).width, secondChildWidth = secondChildCSS && parseInt(secondChildCSS.marginLeft) + parseInt(secondChildCSS.marginRight) + getRect(child2).width;
    if (elCSS.display === "flex") {
      return elCSS.flexDirection === "column" || elCSS.flexDirection === "column-reverse" ? "vertical" : "horizontal";
    }
    if (elCSS.display === "grid") {
      return elCSS.gridTemplateColumns.split(" ").length <= 1 ? "vertical" : "horizontal";
    }
    if (child1 && firstChildCSS["float"] && firstChildCSS["float"] !== "none") {
      var touchingSideChild2 = firstChildCSS["float"] === "left" ? "left" : "right";
      return child2 && (secondChildCSS.clear === "both" || secondChildCSS.clear === touchingSideChild2) ? "vertical" : "horizontal";
    }
    return child1 && (firstChildCSS.display === "block" || firstChildCSS.display === "flex" || firstChildCSS.display === "table" || firstChildCSS.display === "grid" || firstChildWidth >= elWidth && elCSS[CSSFloatProperty] === "none" || child2 && elCSS[CSSFloatProperty] === "none" && firstChildWidth + secondChildWidth > elWidth) ? "vertical" : "horizontal";
  };
  var _dragElInRowColumn = function _dragElInRowColumn2(dragRect, targetRect, vertical) {
    var dragElS1Opp = vertical ? dragRect.left : dragRect.top, dragElS2Opp = vertical ? dragRect.right : dragRect.bottom, dragElOppLength = vertical ? dragRect.width : dragRect.height, targetS1Opp = vertical ? targetRect.left : targetRect.top, targetS2Opp = vertical ? targetRect.right : targetRect.bottom, targetOppLength = vertical ? targetRect.width : targetRect.height;
    return dragElS1Opp === targetS1Opp || dragElS2Opp === targetS2Opp || dragElS1Opp + dragElOppLength / 2 === targetS1Opp + targetOppLength / 2;
  };
  var _detectNearestEmptySortable = function _detectNearestEmptySortable2(x2, y2) {
    var ret;
    sortables.some(function(sortable) {
      var threshold = sortable[expando].options.emptyInsertThreshold;
      if (!threshold || lastChild(sortable)) return;
      var rect = getRect(sortable), insideHorizontally = x2 >= rect.left - threshold && x2 <= rect.right + threshold, insideVertically = y2 >= rect.top - threshold && y2 <= rect.bottom + threshold;
      if (insideHorizontally && insideVertically) {
        return ret = sortable;
      }
    });
    return ret;
  };
  var _prepareGroup = function _prepareGroup2(options) {
    function toFn(value2, pull) {
      return function(to, from, dragEl2, evt) {
        var sameGroup = to.options.group.name && from.options.group.name && to.options.group.name === from.options.group.name;
        if (value2 == null && (pull || sameGroup)) {
          return true;
        } else if (value2 == null || value2 === false) {
          return false;
        } else if (pull && value2 === "clone") {
          return value2;
        } else if (typeof value2 === "function") {
          return toFn(value2(to, from, dragEl2, evt), pull)(to, from, dragEl2, evt);
        } else {
          var otherGroup = (pull ? to : from).options.group.name;
          return value2 === true || typeof value2 === "string" && value2 === otherGroup || value2.join && value2.indexOf(otherGroup) > -1;
        }
      };
    }
    var group = {};
    var originalGroup = options.group;
    if (!originalGroup || _typeof(originalGroup) != "object") {
      originalGroup = {
        name: originalGroup
      };
    }
    group.name = originalGroup.name;
    group.checkPull = toFn(originalGroup.pull, true);
    group.checkPut = toFn(originalGroup.put);
    group.revertClone = originalGroup.revertClone;
    options.group = group;
  };
  var _hideGhostForTarget = function _hideGhostForTarget2() {
    if (!supportCssPointerEvents && ghostEl) {
      css(ghostEl, "display", "none");
    }
  };
  var _unhideGhostForTarget = function _unhideGhostForTarget2() {
    if (!supportCssPointerEvents && ghostEl) {
      css(ghostEl, "display", "");
    }
  };
  if (documentExists && !ChromeForAndroid) {
    document.addEventListener("click", function(evt) {
      if (ignoreNextClick) {
        evt.preventDefault();
        evt.stopPropagation && evt.stopPropagation();
        evt.stopImmediatePropagation && evt.stopImmediatePropagation();
        ignoreNextClick = false;
        return false;
      }
    }, true);
  }
  var nearestEmptyInsertDetectEvent = function nearestEmptyInsertDetectEvent2(evt) {
    if (dragEl) {
      evt = evt.touches ? evt.touches[0] : evt;
      var nearest = _detectNearestEmptySortable(evt.clientX, evt.clientY);
      if (nearest) {
        var event = {};
        for (var i in evt) {
          if (evt.hasOwnProperty(i)) {
            event[i] = evt[i];
          }
        }
        event.target = event.rootEl = nearest;
        event.preventDefault = void 0;
        event.stopPropagation = void 0;
        nearest[expando]._onDragOver(event);
      }
    }
  };
  var _checkOutsideTargetEl = function _checkOutsideTargetEl2(evt) {
    if (dragEl) {
      dragEl.parentNode[expando]._isOutsideThisEl(evt.target);
    }
  };
  function Sortable(el, options) {
    if (!(el && el.nodeType && el.nodeType === 1)) {
      throw "Sortable: `el` must be an HTMLElement, not ".concat({}.toString.call(el));
    }
    this.el = el;
    this.options = options = _extends({}, options);
    el[expando] = this;
    var defaults2 = {
      group: null,
      sort: true,
      disabled: false,
      store: null,
      handle: null,
      draggable: /^[uo]l$/i.test(el.nodeName) ? ">li" : ">*",
      swapThreshold: 1,
      // percentage; 0 <= x <= 1
      invertSwap: false,
      // invert always
      invertedSwapThreshold: null,
      // will be set to same as swapThreshold if default
      removeCloneOnHide: true,
      direction: function direction() {
        return _detectDirection(el, this.options);
      },
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      dragClass: "sortable-drag",
      ignore: "a, img",
      filter: null,
      preventOnFilter: true,
      animation: 0,
      easing: null,
      setData: function setData(dataTransfer, dragEl2) {
        dataTransfer.setData("Text", dragEl2.textContent);
      },
      dropBubble: false,
      dragoverBubble: false,
      dataIdAttr: "data-id",
      delay: 0,
      delayOnTouchOnly: false,
      touchStartThreshold: (Number.parseInt ? Number : window).parseInt(window.devicePixelRatio, 10) || 1,
      forceFallback: false,
      fallbackClass: "sortable-fallback",
      fallbackOnBody: false,
      fallbackTolerance: 0,
      fallbackOffset: {
        x: 0,
        y: 0
      },
      // Disabled on Safari: #1571; Enabled on Safari IOS: #2244
      supportPointer: Sortable.supportPointer !== false && "PointerEvent" in window && (!Safari || IOS),
      emptyInsertThreshold: 5
    };
    PluginManager.initializePlugins(this, el, defaults2);
    for (var name in defaults2) {
      !(name in options) && (options[name] = defaults2[name]);
    }
    _prepareGroup(options);
    for (var fn in this) {
      if (fn.charAt(0) === "_" && typeof this[fn] === "function") {
        this[fn] = this[fn].bind(this);
      }
    }
    this.nativeDraggable = options.forceFallback ? false : supportDraggable;
    if (this.nativeDraggable) {
      this.options.touchStartThreshold = 1;
    }
    if (options.supportPointer) {
      on(el, "pointerdown", this._onTapStart);
    } else {
      on(el, "mousedown", this._onTapStart);
      on(el, "touchstart", this._onTapStart);
    }
    if (this.nativeDraggable) {
      on(el, "dragover", this);
      on(el, "dragenter", this);
    }
    sortables.push(this.el);
    options.store && options.store.get && this.sort(options.store.get(this) || []);
    _extends(this, AnimationStateManager());
  }
  Sortable.prototype = /** @lends Sortable.prototype */
  {
    constructor: Sortable,
    _isOutsideThisEl: function _isOutsideThisEl(target) {
      if (!this.el.contains(target) && target !== this.el) {
        lastTarget = null;
      }
    },
    _getDirection: function _getDirection(evt, target) {
      return typeof this.options.direction === "function" ? this.options.direction.call(this, evt, target, dragEl) : this.options.direction;
    },
    _onTapStart: function _onTapStart(evt) {
      if (!evt.cancelable) return;
      var _this = this, el = this.el, options = this.options, preventOnFilter = options.preventOnFilter, type2 = evt.type, touch = evt.touches && evt.touches[0] || evt.pointerType && evt.pointerType === "touch" && evt, target = (touch || evt).target, originalTarget = evt.target.shadowRoot && (evt.path && evt.path[0] || evt.composedPath && evt.composedPath()[0]) || target, filter2 = options.filter;
      _saveInputCheckedState(el);
      if (dragEl) {
        return;
      }
      if (/mousedown|pointerdown/.test(type2) && evt.button !== 0 || options.disabled) {
        return;
      }
      if (originalTarget.isContentEditable) {
        return;
      }
      if (!this.nativeDraggable && Safari && target && target.tagName.toUpperCase() === "SELECT") {
        return;
      }
      target = closest(target, options.draggable, el, false);
      if (target && target.animated) {
        return;
      }
      if (lastDownEl === target) {
        return;
      }
      oldIndex = index(target);
      oldDraggableIndex = index(target, options.draggable);
      if (typeof filter2 === "function") {
        if (filter2.call(this, evt, target, this)) {
          _dispatchEvent({
            sortable: _this,
            rootEl: originalTarget,
            name: "filter",
            targetEl: target,
            toEl: el,
            fromEl: el
          });
          pluginEvent2("filter", _this, {
            evt
          });
          preventOnFilter && evt.preventDefault();
          return;
        }
      } else if (filter2) {
        filter2 = filter2.split(",").some(function(criteria) {
          criteria = closest(originalTarget, criteria.trim(), el, false);
          if (criteria) {
            _dispatchEvent({
              sortable: _this,
              rootEl: criteria,
              name: "filter",
              targetEl: target,
              fromEl: el,
              toEl: el
            });
            pluginEvent2("filter", _this, {
              evt
            });
            return true;
          }
        });
        if (filter2) {
          preventOnFilter && evt.preventDefault();
          return;
        }
      }
      if (options.handle && !closest(originalTarget, options.handle, el, false)) {
        return;
      }
      this._prepareDragStart(evt, touch, target);
    },
    _prepareDragStart: function _prepareDragStart(evt, touch, target) {
      var _this = this, el = _this.el, options = _this.options, ownerDocument = el.ownerDocument, dragStartFn;
      if (target && !dragEl && target.parentNode === el) {
        var dragRect = getRect(target);
        rootEl = el;
        dragEl = target;
        parentEl = dragEl.parentNode;
        nextEl = dragEl.nextSibling;
        lastDownEl = target;
        activeGroup = options.group;
        Sortable.dragged = dragEl;
        tapEvt = {
          target: dragEl,
          clientX: (touch || evt).clientX,
          clientY: (touch || evt).clientY
        };
        tapDistanceLeft = tapEvt.clientX - dragRect.left;
        tapDistanceTop = tapEvt.clientY - dragRect.top;
        this._lastX = (touch || evt).clientX;
        this._lastY = (touch || evt).clientY;
        dragEl.style["will-change"] = "all";
        dragStartFn = function dragStartFn2() {
          pluginEvent2("delayEnded", _this, {
            evt
          });
          if (Sortable.eventCanceled) {
            _this._onDrop();
            return;
          }
          _this._disableDelayedDragEvents();
          if (!FireFox && _this.nativeDraggable) {
            dragEl.draggable = true;
          }
          _this._triggerDragStart(evt, touch);
          _dispatchEvent({
            sortable: _this,
            name: "choose",
            originalEvent: evt
          });
          toggleClass(dragEl, options.chosenClass, true);
        };
        options.ignore.split(",").forEach(function(criteria) {
          find2(dragEl, criteria.trim(), _disableDraggable);
        });
        on(ownerDocument, "dragover", nearestEmptyInsertDetectEvent);
        on(ownerDocument, "mousemove", nearestEmptyInsertDetectEvent);
        on(ownerDocument, "touchmove", nearestEmptyInsertDetectEvent);
        if (options.supportPointer) {
          on(ownerDocument, "pointerup", _this._onDrop);
          !this.nativeDraggable && on(ownerDocument, "pointercancel", _this._onDrop);
        } else {
          on(ownerDocument, "mouseup", _this._onDrop);
          on(ownerDocument, "touchend", _this._onDrop);
          on(ownerDocument, "touchcancel", _this._onDrop);
        }
        if (FireFox && this.nativeDraggable) {
          this.options.touchStartThreshold = 4;
          dragEl.draggable = true;
        }
        pluginEvent2("delayStart", this, {
          evt
        });
        if (options.delay && (!options.delayOnTouchOnly || touch) && (!this.nativeDraggable || !(Edge || IE11OrLess))) {
          if (Sortable.eventCanceled) {
            this._onDrop();
            return;
          }
          if (options.supportPointer) {
            on(ownerDocument, "pointerup", _this._disableDelayedDrag);
            on(ownerDocument, "pointercancel", _this._disableDelayedDrag);
          } else {
            on(ownerDocument, "mouseup", _this._disableDelayedDrag);
            on(ownerDocument, "touchend", _this._disableDelayedDrag);
            on(ownerDocument, "touchcancel", _this._disableDelayedDrag);
          }
          on(ownerDocument, "mousemove", _this._delayedDragTouchMoveHandler);
          on(ownerDocument, "touchmove", _this._delayedDragTouchMoveHandler);
          options.supportPointer && on(ownerDocument, "pointermove", _this._delayedDragTouchMoveHandler);
          _this._dragStartTimer = setTimeout(dragStartFn, options.delay);
        } else {
          dragStartFn();
        }
      }
    },
    _delayedDragTouchMoveHandler: function _delayedDragTouchMoveHandler(e) {
      var touch = e.touches ? e.touches[0] : e;
      if (Math.max(Math.abs(touch.clientX - this._lastX), Math.abs(touch.clientY - this._lastY)) >= Math.floor(this.options.touchStartThreshold / (this.nativeDraggable && window.devicePixelRatio || 1))) {
        this._disableDelayedDrag();
      }
    },
    _disableDelayedDrag: function _disableDelayedDrag() {
      dragEl && _disableDraggable(dragEl);
      clearTimeout(this._dragStartTimer);
      this._disableDelayedDragEvents();
    },
    _disableDelayedDragEvents: function _disableDelayedDragEvents() {
      var ownerDocument = this.el.ownerDocument;
      off(ownerDocument, "mouseup", this._disableDelayedDrag);
      off(ownerDocument, "touchend", this._disableDelayedDrag);
      off(ownerDocument, "touchcancel", this._disableDelayedDrag);
      off(ownerDocument, "pointerup", this._disableDelayedDrag);
      off(ownerDocument, "pointercancel", this._disableDelayedDrag);
      off(ownerDocument, "mousemove", this._delayedDragTouchMoveHandler);
      off(ownerDocument, "touchmove", this._delayedDragTouchMoveHandler);
      off(ownerDocument, "pointermove", this._delayedDragTouchMoveHandler);
    },
    _triggerDragStart: function _triggerDragStart(evt, touch) {
      touch = touch || evt.pointerType == "touch" && evt;
      if (!this.nativeDraggable || touch) {
        if (this.options.supportPointer) {
          on(document, "pointermove", this._onTouchMove);
        } else if (touch) {
          on(document, "touchmove", this._onTouchMove);
        } else {
          on(document, "mousemove", this._onTouchMove);
        }
      } else {
        on(dragEl, "dragend", this);
        on(rootEl, "dragstart", this._onDragStart);
      }
      try {
        if (document.selection) {
          _nextTick(function() {
            document.selection.empty();
          });
        } else {
          window.getSelection().removeAllRanges();
        }
      } catch (err) {
      }
    },
    _dragStarted: function _dragStarted(fallback, evt) {
      awaitingDragStarted = false;
      if (rootEl && dragEl) {
        pluginEvent2("dragStarted", this, {
          evt
        });
        if (this.nativeDraggable) {
          on(document, "dragover", _checkOutsideTargetEl);
        }
        var options = this.options;
        !fallback && toggleClass(dragEl, options.dragClass, false);
        toggleClass(dragEl, options.ghostClass, true);
        Sortable.active = this;
        fallback && this._appendGhost();
        _dispatchEvent({
          sortable: this,
          name: "start",
          originalEvent: evt
        });
      } else {
        this._nulling();
      }
    },
    _emulateDragOver: function _emulateDragOver() {
      if (touchEvt) {
        this._lastX = touchEvt.clientX;
        this._lastY = touchEvt.clientY;
        _hideGhostForTarget();
        var target = document.elementFromPoint(touchEvt.clientX, touchEvt.clientY);
        var parent = target;
        while (target && target.shadowRoot) {
          target = target.shadowRoot.elementFromPoint(touchEvt.clientX, touchEvt.clientY);
          if (target === parent) break;
          parent = target;
        }
        dragEl.parentNode[expando]._isOutsideThisEl(target);
        if (parent) {
          do {
            if (parent[expando]) {
              var inserted = void 0;
              inserted = parent[expando]._onDragOver({
                clientX: touchEvt.clientX,
                clientY: touchEvt.clientY,
                target,
                rootEl: parent
              });
              if (inserted && !this.options.dragoverBubble) {
                break;
              }
            }
            target = parent;
          } while (parent = getParentOrHost(parent));
        }
        _unhideGhostForTarget();
      }
    },
    _onTouchMove: function _onTouchMove(evt) {
      if (tapEvt) {
        var options = this.options, fallbackTolerance = options.fallbackTolerance, fallbackOffset = options.fallbackOffset, touch = evt.touches ? evt.touches[0] : evt, ghostMatrix = ghostEl && matrix(ghostEl, true), scaleX = ghostEl && ghostMatrix && ghostMatrix.a, scaleY = ghostEl && ghostMatrix && ghostMatrix.d, relativeScrollOffset = PositionGhostAbsolutely && ghostRelativeParent && getRelativeScrollOffset(ghostRelativeParent), dx = (touch.clientX - tapEvt.clientX + fallbackOffset.x) / (scaleX || 1) + (relativeScrollOffset ? relativeScrollOffset[0] - ghostRelativeParentInitialScroll[0] : 0) / (scaleX || 1), dy = (touch.clientY - tapEvt.clientY + fallbackOffset.y) / (scaleY || 1) + (relativeScrollOffset ? relativeScrollOffset[1] - ghostRelativeParentInitialScroll[1] : 0) / (scaleY || 1);
        if (!Sortable.active && !awaitingDragStarted) {
          if (fallbackTolerance && Math.max(Math.abs(touch.clientX - this._lastX), Math.abs(touch.clientY - this._lastY)) < fallbackTolerance) {
            return;
          }
          this._onDragStart(evt, true);
        }
        if (ghostEl) {
          if (ghostMatrix) {
            ghostMatrix.e += dx - (lastDx || 0);
            ghostMatrix.f += dy - (lastDy || 0);
          } else {
            ghostMatrix = {
              a: 1,
              b: 0,
              c: 0,
              d: 1,
              e: dx,
              f: dy
            };
          }
          var cssMatrix = "matrix(".concat(ghostMatrix.a, ",").concat(ghostMatrix.b, ",").concat(ghostMatrix.c, ",").concat(ghostMatrix.d, ",").concat(ghostMatrix.e, ",").concat(ghostMatrix.f, ")");
          css(ghostEl, "webkitTransform", cssMatrix);
          css(ghostEl, "mozTransform", cssMatrix);
          css(ghostEl, "msTransform", cssMatrix);
          css(ghostEl, "transform", cssMatrix);
          lastDx = dx;
          lastDy = dy;
          touchEvt = touch;
        }
        evt.cancelable && evt.preventDefault();
      }
    },
    _appendGhost: function _appendGhost() {
      if (!ghostEl) {
        var container = this.options.fallbackOnBody ? document.body : rootEl, rect = getRect(dragEl, true, PositionGhostAbsolutely, true, container), options = this.options;
        if (PositionGhostAbsolutely) {
          ghostRelativeParent = container;
          while (css(ghostRelativeParent, "position") === "static" && css(ghostRelativeParent, "transform") === "none" && ghostRelativeParent !== document) {
            ghostRelativeParent = ghostRelativeParent.parentNode;
          }
          if (ghostRelativeParent !== document.body && ghostRelativeParent !== document.documentElement) {
            if (ghostRelativeParent === document) ghostRelativeParent = getWindowScrollingElement();
            rect.top += ghostRelativeParent.scrollTop;
            rect.left += ghostRelativeParent.scrollLeft;
          } else {
            ghostRelativeParent = getWindowScrollingElement();
          }
          ghostRelativeParentInitialScroll = getRelativeScrollOffset(ghostRelativeParent);
        }
        ghostEl = dragEl.cloneNode(true);
        toggleClass(ghostEl, options.ghostClass, false);
        toggleClass(ghostEl, options.fallbackClass, true);
        toggleClass(ghostEl, options.dragClass, true);
        css(ghostEl, "transition", "");
        css(ghostEl, "transform", "");
        css(ghostEl, "box-sizing", "border-box");
        css(ghostEl, "margin", 0);
        css(ghostEl, "top", rect.top);
        css(ghostEl, "left", rect.left);
        css(ghostEl, "width", rect.width);
        css(ghostEl, "height", rect.height);
        css(ghostEl, "opacity", "0.8");
        css(ghostEl, "position", PositionGhostAbsolutely ? "absolute" : "fixed");
        css(ghostEl, "zIndex", "100000");
        css(ghostEl, "pointerEvents", "none");
        Sortable.ghost = ghostEl;
        container.appendChild(ghostEl);
        css(ghostEl, "transform-origin", tapDistanceLeft / parseInt(ghostEl.style.width) * 100 + "% " + tapDistanceTop / parseInt(ghostEl.style.height) * 100 + "%");
      }
    },
    _onDragStart: function _onDragStart(evt, fallback) {
      var _this = this;
      var dataTransfer = evt.dataTransfer;
      var options = _this.options;
      pluginEvent2("dragStart", this, {
        evt
      });
      if (Sortable.eventCanceled) {
        this._onDrop();
        return;
      }
      pluginEvent2("setupClone", this);
      if (!Sortable.eventCanceled) {
        cloneEl = clone(dragEl);
        cloneEl.removeAttribute("id");
        cloneEl.draggable = false;
        cloneEl.style["will-change"] = "";
        this._hideClone();
        toggleClass(cloneEl, this.options.chosenClass, false);
        Sortable.clone = cloneEl;
      }
      _this.cloneId = _nextTick(function() {
        pluginEvent2("clone", _this);
        if (Sortable.eventCanceled) return;
        if (!_this.options.removeCloneOnHide) {
          rootEl.insertBefore(cloneEl, dragEl);
        }
        _this._hideClone();
        _dispatchEvent({
          sortable: _this,
          name: "clone"
        });
      });
      !fallback && toggleClass(dragEl, options.dragClass, true);
      if (fallback) {
        ignoreNextClick = true;
        _this._loopId = setInterval(_this._emulateDragOver, 50);
      } else {
        off(document, "mouseup", _this._onDrop);
        off(document, "touchend", _this._onDrop);
        off(document, "touchcancel", _this._onDrop);
        if (dataTransfer) {
          dataTransfer.effectAllowed = "move";
          options.setData && options.setData.call(_this, dataTransfer, dragEl);
        }
        on(document, "drop", _this);
        css(dragEl, "transform", "translateZ(0)");
      }
      awaitingDragStarted = true;
      _this._dragStartId = _nextTick(_this._dragStarted.bind(_this, fallback, evt));
      on(document, "selectstart", _this);
      moved = true;
      window.getSelection().removeAllRanges();
      if (Safari) {
        css(document.body, "user-select", "none");
      }
    },
    // Returns true - if no further action is needed (either inserted or another condition)
    _onDragOver: function _onDragOver(evt) {
      var el = this.el, target = evt.target, dragRect, targetRect, revert, options = this.options, group = options.group, activeSortable = Sortable.active, isOwner = activeGroup === group, canSort = options.sort, fromSortable = putSortable || activeSortable, vertical, _this = this, completedFired = false;
      if (_silent) return;
      function dragOverEvent(name, extra) {
        pluginEvent2(name, _this, _objectSpread2({
          evt,
          isOwner,
          axis: vertical ? "vertical" : "horizontal",
          revert,
          dragRect,
          targetRect,
          canSort,
          fromSortable,
          target,
          completed,
          onMove: function onMove(target2, after2) {
            return _onMove(rootEl, el, dragEl, dragRect, target2, getRect(target2), evt, after2);
          },
          changed
        }, extra));
      }
      function capture() {
        dragOverEvent("dragOverAnimationCapture");
        _this.captureAnimationState();
        if (_this !== fromSortable) {
          fromSortable.captureAnimationState();
        }
      }
      function completed(insertion) {
        dragOverEvent("dragOverCompleted", {
          insertion
        });
        if (insertion) {
          if (isOwner) {
            activeSortable._hideClone();
          } else {
            activeSortable._showClone(_this);
          }
          if (_this !== fromSortable) {
            toggleClass(dragEl, putSortable ? putSortable.options.ghostClass : activeSortable.options.ghostClass, false);
            toggleClass(dragEl, options.ghostClass, true);
          }
          if (putSortable !== _this && _this !== Sortable.active) {
            putSortable = _this;
          } else if (_this === Sortable.active && putSortable) {
            putSortable = null;
          }
          if (fromSortable === _this) {
            _this._ignoreWhileAnimating = target;
          }
          _this.animateAll(function() {
            dragOverEvent("dragOverAnimationComplete");
            _this._ignoreWhileAnimating = null;
          });
          if (_this !== fromSortable) {
            fromSortable.animateAll();
            fromSortable._ignoreWhileAnimating = null;
          }
        }
        if (target === dragEl && !dragEl.animated || target === el && !target.animated) {
          lastTarget = null;
        }
        if (!options.dragoverBubble && !evt.rootEl && target !== document) {
          dragEl.parentNode[expando]._isOutsideThisEl(evt.target);
          !insertion && nearestEmptyInsertDetectEvent(evt);
        }
        !options.dragoverBubble && evt.stopPropagation && evt.stopPropagation();
        return completedFired = true;
      }
      function changed() {
        newIndex = index(dragEl);
        newDraggableIndex = index(dragEl, options.draggable);
        _dispatchEvent({
          sortable: _this,
          name: "change",
          toEl: el,
          newIndex,
          newDraggableIndex,
          originalEvent: evt
        });
      }
      if (evt.preventDefault !== void 0) {
        evt.cancelable && evt.preventDefault();
      }
      target = closest(target, options.draggable, el, true);
      dragOverEvent("dragOver");
      if (Sortable.eventCanceled) return completedFired;
      if (dragEl.contains(evt.target) || target.animated && target.animatingX && target.animatingY || _this._ignoreWhileAnimating === target) {
        return completed(false);
      }
      ignoreNextClick = false;
      if (activeSortable && !options.disabled && (isOwner ? canSort || (revert = parentEl !== rootEl) : putSortable === this || (this.lastPutMode = activeGroup.checkPull(this, activeSortable, dragEl, evt)) && group.checkPut(this, activeSortable, dragEl, evt))) {
        vertical = this._getDirection(evt, target) === "vertical";
        dragRect = getRect(dragEl);
        dragOverEvent("dragOverValid");
        if (Sortable.eventCanceled) return completedFired;
        if (revert) {
          parentEl = rootEl;
          capture();
          this._hideClone();
          dragOverEvent("revert");
          if (!Sortable.eventCanceled) {
            if (nextEl) {
              rootEl.insertBefore(dragEl, nextEl);
            } else {
              rootEl.appendChild(dragEl);
            }
          }
          return completed(true);
        }
        var elLastChild = lastChild(el, options.draggable);
        if (!elLastChild || _ghostIsLast(evt, vertical, this) && !elLastChild.animated) {
          if (elLastChild === dragEl) {
            return completed(false);
          }
          if (elLastChild && el === evt.target) {
            target = elLastChild;
          }
          if (target) {
            targetRect = getRect(target);
          }
          if (_onMove(rootEl, el, dragEl, dragRect, target, targetRect, evt, !!target) !== false) {
            capture();
            if (elLastChild && elLastChild.nextSibling) {
              el.insertBefore(dragEl, elLastChild.nextSibling);
            } else {
              el.appendChild(dragEl);
            }
            parentEl = el;
            changed();
            return completed(true);
          }
        } else if (elLastChild && _ghostIsFirst(evt, vertical, this)) {
          var firstChild = getChild(el, 0, options, true);
          if (firstChild === dragEl) {
            return completed(false);
          }
          target = firstChild;
          targetRect = getRect(target);
          if (_onMove(rootEl, el, dragEl, dragRect, target, targetRect, evt, false) !== false) {
            capture();
            el.insertBefore(dragEl, firstChild);
            parentEl = el;
            changed();
            return completed(true);
          }
        } else if (target.parentNode === el) {
          targetRect = getRect(target);
          var direction = 0, targetBeforeFirstSwap, differentLevel = dragEl.parentNode !== el, differentRowCol = !_dragElInRowColumn(dragEl.animated && dragEl.toRect || dragRect, target.animated && target.toRect || targetRect, vertical), side1 = vertical ? "top" : "left", scrolledPastTop = isScrolledPast(target, "top", "top") || isScrolledPast(dragEl, "top", "top"), scrollBefore = scrolledPastTop ? scrolledPastTop.scrollTop : void 0;
          if (lastTarget !== target) {
            targetBeforeFirstSwap = targetRect[side1];
            pastFirstInvertThresh = false;
            isCircumstantialInvert = !differentRowCol && options.invertSwap || differentLevel;
          }
          direction = _getSwapDirection(evt, target, targetRect, vertical, differentRowCol ? 1 : options.swapThreshold, options.invertedSwapThreshold == null ? options.swapThreshold : options.invertedSwapThreshold, isCircumstantialInvert, lastTarget === target);
          var sibling;
          if (direction !== 0) {
            var dragIndex = index(dragEl);
            do {
              dragIndex -= direction;
              sibling = parentEl.children[dragIndex];
            } while (sibling && (css(sibling, "display") === "none" || sibling === ghostEl));
          }
          if (direction === 0 || sibling === target) {
            return completed(false);
          }
          lastTarget = target;
          lastDirection = direction;
          var nextSibling = target.nextElementSibling, after = false;
          after = direction === 1;
          var moveVector = _onMove(rootEl, el, dragEl, dragRect, target, targetRect, evt, after);
          if (moveVector !== false) {
            if (moveVector === 1 || moveVector === -1) {
              after = moveVector === 1;
            }
            _silent = true;
            setTimeout(_unsilent, 30);
            capture();
            if (after && !nextSibling) {
              el.appendChild(dragEl);
            } else {
              target.parentNode.insertBefore(dragEl, after ? nextSibling : target);
            }
            if (scrolledPastTop) {
              scrollBy(scrolledPastTop, 0, scrollBefore - scrolledPastTop.scrollTop);
            }
            parentEl = dragEl.parentNode;
            if (targetBeforeFirstSwap !== void 0 && !isCircumstantialInvert) {
              targetMoveDistance = Math.abs(targetBeforeFirstSwap - getRect(target)[side1]);
            }
            changed();
            return completed(true);
          }
        }
        if (el.contains(dragEl)) {
          return completed(false);
        }
      }
      return false;
    },
    _ignoreWhileAnimating: null,
    _offMoveEvents: function _offMoveEvents() {
      off(document, "mousemove", this._onTouchMove);
      off(document, "touchmove", this._onTouchMove);
      off(document, "pointermove", this._onTouchMove);
      off(document, "dragover", nearestEmptyInsertDetectEvent);
      off(document, "mousemove", nearestEmptyInsertDetectEvent);
      off(document, "touchmove", nearestEmptyInsertDetectEvent);
    },
    _offUpEvents: function _offUpEvents() {
      var ownerDocument = this.el.ownerDocument;
      off(ownerDocument, "mouseup", this._onDrop);
      off(ownerDocument, "touchend", this._onDrop);
      off(ownerDocument, "pointerup", this._onDrop);
      off(ownerDocument, "pointercancel", this._onDrop);
      off(ownerDocument, "touchcancel", this._onDrop);
      off(document, "selectstart", this);
    },
    _onDrop: function _onDrop(evt) {
      var el = this.el, options = this.options;
      newIndex = index(dragEl);
      newDraggableIndex = index(dragEl, options.draggable);
      pluginEvent2("drop", this, {
        evt
      });
      parentEl = dragEl && dragEl.parentNode;
      newIndex = index(dragEl);
      newDraggableIndex = index(dragEl, options.draggable);
      if (Sortable.eventCanceled) {
        this._nulling();
        return;
      }
      awaitingDragStarted = false;
      isCircumstantialInvert = false;
      pastFirstInvertThresh = false;
      clearInterval(this._loopId);
      clearTimeout(this._dragStartTimer);
      _cancelNextTick(this.cloneId);
      _cancelNextTick(this._dragStartId);
      if (this.nativeDraggable) {
        off(document, "drop", this);
        off(el, "dragstart", this._onDragStart);
      }
      this._offMoveEvents();
      this._offUpEvents();
      if (Safari) {
        css(document.body, "user-select", "");
      }
      css(dragEl, "transform", "");
      if (evt) {
        if (moved) {
          evt.cancelable && evt.preventDefault();
          !options.dropBubble && evt.stopPropagation();
        }
        ghostEl && ghostEl.parentNode && ghostEl.parentNode.removeChild(ghostEl);
        if (rootEl === parentEl || putSortable && putSortable.lastPutMode !== "clone") {
          cloneEl && cloneEl.parentNode && cloneEl.parentNode.removeChild(cloneEl);
        }
        if (dragEl) {
          if (this.nativeDraggable) {
            off(dragEl, "dragend", this);
          }
          _disableDraggable(dragEl);
          dragEl.style["will-change"] = "";
          if (moved && !awaitingDragStarted) {
            toggleClass(dragEl, putSortable ? putSortable.options.ghostClass : this.options.ghostClass, false);
          }
          toggleClass(dragEl, this.options.chosenClass, false);
          _dispatchEvent({
            sortable: this,
            name: "unchoose",
            toEl: parentEl,
            newIndex: null,
            newDraggableIndex: null,
            originalEvent: evt
          });
          if (rootEl !== parentEl) {
            if (newIndex >= 0) {
              _dispatchEvent({
                rootEl: parentEl,
                name: "add",
                toEl: parentEl,
                fromEl: rootEl,
                originalEvent: evt
              });
              _dispatchEvent({
                sortable: this,
                name: "remove",
                toEl: parentEl,
                originalEvent: evt
              });
              _dispatchEvent({
                rootEl: parentEl,
                name: "sort",
                toEl: parentEl,
                fromEl: rootEl,
                originalEvent: evt
              });
              _dispatchEvent({
                sortable: this,
                name: "sort",
                toEl: parentEl,
                originalEvent: evt
              });
            }
            putSortable && putSortable.save();
          } else {
            if (newIndex !== oldIndex) {
              if (newIndex >= 0) {
                _dispatchEvent({
                  sortable: this,
                  name: "update",
                  toEl: parentEl,
                  originalEvent: evt
                });
                _dispatchEvent({
                  sortable: this,
                  name: "sort",
                  toEl: parentEl,
                  originalEvent: evt
                });
              }
            }
          }
          if (Sortable.active) {
            if (newIndex == null || newIndex === -1) {
              newIndex = oldIndex;
              newDraggableIndex = oldDraggableIndex;
            }
            _dispatchEvent({
              sortable: this,
              name: "end",
              toEl: parentEl,
              originalEvent: evt
            });
            this.save();
          }
        }
      }
      this._nulling();
    },
    _nulling: function _nulling() {
      pluginEvent2("nulling", this);
      rootEl = dragEl = parentEl = ghostEl = nextEl = cloneEl = lastDownEl = cloneHidden = tapEvt = touchEvt = moved = newIndex = newDraggableIndex = oldIndex = oldDraggableIndex = lastTarget = lastDirection = putSortable = activeGroup = Sortable.dragged = Sortable.ghost = Sortable.clone = Sortable.active = null;
      var el = this.el;
      savedInputChecked.forEach(function(checkEl) {
        if (el.contains(checkEl)) {
          checkEl.checked = true;
        }
      });
      savedInputChecked.length = lastDx = lastDy = 0;
    },
    handleEvent: function handleEvent(evt) {
      switch (evt.type) {
        case "drop":
        case "dragend":
          this._onDrop(evt);
          break;
        case "dragenter":
        case "dragover":
          if (dragEl) {
            this._onDragOver(evt);
            _globalDragOver(evt);
          }
          break;
        case "selectstart":
          evt.preventDefault();
          break;
      }
    },
    /**
     * Serializes the item into an array of string.
     * @returns {String[]}
     */
    toArray: function toArray() {
      var order = [], el, children2 = this.el.children, i = 0, n = children2.length, options = this.options;
      for (; i < n; i++) {
        el = children2[i];
        if (closest(el, options.draggable, this.el, false)) {
          order.push(el.getAttribute(options.dataIdAttr) || _generateId(el));
        }
      }
      return order;
    },
    /**
     * Sorts the elements according to the array.
     * @param  {String[]}  order  order of the items
     */
    sort: function sort(order, useAnimation) {
      var items = {}, rootEl2 = this.el;
      this.toArray().forEach(function(id2, i) {
        var el = rootEl2.children[i];
        if (closest(el, this.options.draggable, rootEl2, false)) {
          items[id2] = el;
        }
      }, this);
      useAnimation && this.captureAnimationState();
      order.forEach(function(id2) {
        if (items[id2]) {
          rootEl2.removeChild(items[id2]);
          rootEl2.appendChild(items[id2]);
        }
      });
      useAnimation && this.animateAll();
    },
    /**
     * Save the current sorting
     */
    save: function save() {
      var store = this.options.store;
      store && store.set && store.set(this);
    },
    /**
     * For each element in the set, get the first element that matches the selector by testing the element itself and traversing up through its ancestors in the DOM tree.
     * @param   {HTMLElement}  el
     * @param   {String}       [selector]  default: `options.draggable`
     * @returns {HTMLElement|null}
     */
    closest: function closest$1(el, selector) {
      return closest(el, selector || this.options.draggable, this.el, false);
    },
    /**
     * Set/get option
     * @param   {string} name
     * @param   {*}      [value]
     * @returns {*}
     */
    option: function option(name, value2) {
      var options = this.options;
      if (value2 === void 0) {
        return options[name];
      } else {
        var modifiedValue = PluginManager.modifyOption(this, name, value2);
        if (typeof modifiedValue !== "undefined") {
          options[name] = modifiedValue;
        } else {
          options[name] = value2;
        }
        if (name === "group") {
          _prepareGroup(options);
        }
      }
    },
    /**
     * Destroy
     */
    destroy: function destroy() {
      pluginEvent2("destroy", this);
      var el = this.el;
      el[expando] = null;
      off(el, "mousedown", this._onTapStart);
      off(el, "touchstart", this._onTapStart);
      off(el, "pointerdown", this._onTapStart);
      if (this.nativeDraggable) {
        off(el, "dragover", this);
        off(el, "dragenter", this);
      }
      Array.prototype.forEach.call(el.querySelectorAll("[draggable]"), function(el2) {
        el2.removeAttribute("draggable");
      });
      this._onDrop();
      this._disableDelayedDragEvents();
      sortables.splice(sortables.indexOf(this.el), 1);
      this.el = el = null;
    },
    _hideClone: function _hideClone() {
      if (!cloneHidden) {
        pluginEvent2("hideClone", this);
        if (Sortable.eventCanceled) return;
        css(cloneEl, "display", "none");
        if (this.options.removeCloneOnHide && cloneEl.parentNode) {
          cloneEl.parentNode.removeChild(cloneEl);
        }
        cloneHidden = true;
      }
    },
    _showClone: function _showClone(putSortable2) {
      if (putSortable2.lastPutMode !== "clone") {
        this._hideClone();
        return;
      }
      if (cloneHidden) {
        pluginEvent2("showClone", this);
        if (Sortable.eventCanceled) return;
        if (dragEl.parentNode == rootEl && !this.options.group.revertClone) {
          rootEl.insertBefore(cloneEl, dragEl);
        } else if (nextEl) {
          rootEl.insertBefore(cloneEl, nextEl);
        } else {
          rootEl.appendChild(cloneEl);
        }
        if (this.options.group.revertClone) {
          this.animate(dragEl, cloneEl);
        }
        css(cloneEl, "display", "");
        cloneHidden = false;
      }
    }
  };
  function _globalDragOver(evt) {
    if (evt.dataTransfer) {
      evt.dataTransfer.dropEffect = "move";
    }
    evt.cancelable && evt.preventDefault();
  }
  function _onMove(fromEl, toEl, dragEl2, dragRect, targetEl, targetRect, originalEvent, willInsertAfter) {
    var evt, sortable = fromEl[expando], onMoveFn = sortable.options.onMove, retVal;
    if (window.CustomEvent && !IE11OrLess && !Edge) {
      evt = new CustomEvent("move", {
        bubbles: true,
        cancelable: true
      });
    } else {
      evt = document.createEvent("Event");
      evt.initEvent("move", true, true);
    }
    evt.to = toEl;
    evt.from = fromEl;
    evt.dragged = dragEl2;
    evt.draggedRect = dragRect;
    evt.related = targetEl || toEl;
    evt.relatedRect = targetRect || getRect(toEl);
    evt.willInsertAfter = willInsertAfter;
    evt.originalEvent = originalEvent;
    fromEl.dispatchEvent(evt);
    if (onMoveFn) {
      retVal = onMoveFn.call(sortable, evt, originalEvent);
    }
    return retVal;
  }
  function _disableDraggable(el) {
    el.draggable = false;
  }
  function _unsilent() {
    _silent = false;
  }
  function _ghostIsFirst(evt, vertical, sortable) {
    var firstElRect = getRect(getChild(sortable.el, 0, sortable.options, true));
    var childContainingRect = getChildContainingRectFromElement(sortable.el, sortable.options, ghostEl);
    var spacer = 10;
    return vertical ? evt.clientX < childContainingRect.left - spacer || evt.clientY < firstElRect.top && evt.clientX < firstElRect.right : evt.clientY < childContainingRect.top - spacer || evt.clientY < firstElRect.bottom && evt.clientX < firstElRect.left;
  }
  function _ghostIsLast(evt, vertical, sortable) {
    var lastElRect = getRect(lastChild(sortable.el, sortable.options.draggable));
    var childContainingRect = getChildContainingRectFromElement(sortable.el, sortable.options, ghostEl);
    var spacer = 10;
    return vertical ? evt.clientX > childContainingRect.right + spacer || evt.clientY > lastElRect.bottom && evt.clientX > lastElRect.left : evt.clientY > childContainingRect.bottom + spacer || evt.clientX > lastElRect.right && evt.clientY > lastElRect.top;
  }
  function _getSwapDirection(evt, target, targetRect, vertical, swapThreshold, invertedSwapThreshold, invertSwap, isLastTarget) {
    var mouseOnAxis = vertical ? evt.clientY : evt.clientX, targetLength = vertical ? targetRect.height : targetRect.width, targetS1 = vertical ? targetRect.top : targetRect.left, targetS2 = vertical ? targetRect.bottom : targetRect.right, invert = false;
    if (!invertSwap) {
      if (isLastTarget && targetMoveDistance < targetLength * swapThreshold) {
        if (!pastFirstInvertThresh && (lastDirection === 1 ? mouseOnAxis > targetS1 + targetLength * invertedSwapThreshold / 2 : mouseOnAxis < targetS2 - targetLength * invertedSwapThreshold / 2)) {
          pastFirstInvertThresh = true;
        }
        if (!pastFirstInvertThresh) {
          if (lastDirection === 1 ? mouseOnAxis < targetS1 + targetMoveDistance : mouseOnAxis > targetS2 - targetMoveDistance) {
            return -lastDirection;
          }
        } else {
          invert = true;
        }
      } else {
        if (mouseOnAxis > targetS1 + targetLength * (1 - swapThreshold) / 2 && mouseOnAxis < targetS2 - targetLength * (1 - swapThreshold) / 2) {
          return _getInsertDirection(target);
        }
      }
    }
    invert = invert || invertSwap;
    if (invert) {
      if (mouseOnAxis < targetS1 + targetLength * invertedSwapThreshold / 2 || mouseOnAxis > targetS2 - targetLength * invertedSwapThreshold / 2) {
        return mouseOnAxis > targetS1 + targetLength / 2 ? 1 : -1;
      }
    }
    return 0;
  }
  function _getInsertDirection(target) {
    if (index(dragEl) < index(target)) {
      return 1;
    } else {
      return -1;
    }
  }
  function _generateId(el) {
    var str = el.tagName + el.className + el.src + el.href + el.textContent, i = str.length, sum2 = 0;
    while (i--) {
      sum2 += str.charCodeAt(i);
    }
    return sum2.toString(36);
  }
  function _saveInputCheckedState(root2) {
    savedInputChecked.length = 0;
    var inputs = root2.getElementsByTagName("input");
    var idx = inputs.length;
    while (idx--) {
      var el = inputs[idx];
      el.checked && savedInputChecked.push(el);
    }
  }
  function _nextTick(fn) {
    return setTimeout(fn, 0);
  }
  function _cancelNextTick(id2) {
    return clearTimeout(id2);
  }
  if (documentExists) {
    on(document, "touchmove", function(evt) {
      if ((Sortable.active || awaitingDragStarted) && evt.cancelable) {
        evt.preventDefault();
      }
    });
  }
  Sortable.utils = {
    on,
    off,
    css,
    find: find2,
    is: function is(el, selector) {
      return !!closest(el, selector, el, false);
    },
    extend: extend2,
    throttle,
    closest,
    toggleClass,
    clone,
    index,
    nextTick: _nextTick,
    cancelNextTick: _cancelNextTick,
    detectDirection: _detectDirection,
    getChild,
    expando
  };
  Sortable.get = function(element) {
    return element[expando];
  };
  Sortable.mount = function() {
    for (var _len = arguments.length, plugins2 = new Array(_len), _key = 0; _key < _len; _key++) {
      plugins2[_key] = arguments[_key];
    }
    if (plugins2[0].constructor === Array) plugins2 = plugins2[0];
    plugins2.forEach(function(plugin) {
      if (!plugin.prototype || !plugin.prototype.constructor) {
        throw "Sortable: Mounted plugin must be a constructor function, not ".concat({}.toString.call(plugin));
      }
      if (plugin.utils) Sortable.utils = _objectSpread2(_objectSpread2({}, Sortable.utils), plugin.utils);
      PluginManager.mount(plugin);
    });
  };
  Sortable.create = function(el, options) {
    return new Sortable(el, options);
  };
  Sortable.version = version;
  var autoScrolls = [];
  var scrollEl;
  var scrollRootEl;
  var scrolling = false;
  var lastAutoScrollX;
  var lastAutoScrollY;
  var touchEvt$1;
  var pointerElemChangedInterval;
  function AutoScrollPlugin() {
    function AutoScroll() {
      this.defaults = {
        scroll: true,
        forceAutoScrollFallback: false,
        scrollSensitivity: 30,
        scrollSpeed: 10,
        bubbleScroll: true
      };
      for (var fn in this) {
        if (fn.charAt(0) === "_" && typeof this[fn] === "function") {
          this[fn] = this[fn].bind(this);
        }
      }
    }
    AutoScroll.prototype = {
      dragStarted: function dragStarted(_ref) {
        var originalEvent = _ref.originalEvent;
        if (this.sortable.nativeDraggable) {
          on(document, "dragover", this._handleAutoScroll);
        } else {
          if (this.options.supportPointer) {
            on(document, "pointermove", this._handleFallbackAutoScroll);
          } else if (originalEvent.touches) {
            on(document, "touchmove", this._handleFallbackAutoScroll);
          } else {
            on(document, "mousemove", this._handleFallbackAutoScroll);
          }
        }
      },
      dragOverCompleted: function dragOverCompleted(_ref2) {
        var originalEvent = _ref2.originalEvent;
        if (!this.options.dragOverBubble && !originalEvent.rootEl) {
          this._handleAutoScroll(originalEvent);
        }
      },
      drop: function drop3() {
        if (this.sortable.nativeDraggable) {
          off(document, "dragover", this._handleAutoScroll);
        } else {
          off(document, "pointermove", this._handleFallbackAutoScroll);
          off(document, "touchmove", this._handleFallbackAutoScroll);
          off(document, "mousemove", this._handleFallbackAutoScroll);
        }
        clearPointerElemChangedInterval();
        clearAutoScrolls();
        cancelThrottle();
      },
      nulling: function nulling() {
        touchEvt$1 = scrollRootEl = scrollEl = scrolling = pointerElemChangedInterval = lastAutoScrollX = lastAutoScrollY = null;
        autoScrolls.length = 0;
      },
      _handleFallbackAutoScroll: function _handleFallbackAutoScroll(evt) {
        this._handleAutoScroll(evt, true);
      },
      _handleAutoScroll: function _handleAutoScroll(evt, fallback) {
        var _this = this;
        var x2 = (evt.touches ? evt.touches[0] : evt).clientX, y2 = (evt.touches ? evt.touches[0] : evt).clientY, elem = document.elementFromPoint(x2, y2);
        touchEvt$1 = evt;
        if (fallback || this.options.forceAutoScrollFallback || Edge || IE11OrLess || Safari) {
          autoScroll(evt, this.options, elem, fallback);
          var ogElemScroller = getParentAutoScrollElement(elem, true);
          if (scrolling && (!pointerElemChangedInterval || x2 !== lastAutoScrollX || y2 !== lastAutoScrollY)) {
            pointerElemChangedInterval && clearPointerElemChangedInterval();
            pointerElemChangedInterval = setInterval(function() {
              var newElem = getParentAutoScrollElement(document.elementFromPoint(x2, y2), true);
              if (newElem !== ogElemScroller) {
                ogElemScroller = newElem;
                clearAutoScrolls();
              }
              autoScroll(evt, _this.options, newElem, fallback);
            }, 10);
            lastAutoScrollX = x2;
            lastAutoScrollY = y2;
          }
        } else {
          if (!this.options.bubbleScroll || getParentAutoScrollElement(elem, true) === getWindowScrollingElement()) {
            clearAutoScrolls();
            return;
          }
          autoScroll(evt, this.options, getParentAutoScrollElement(elem, false), false);
        }
      }
    };
    return _extends(AutoScroll, {
      pluginName: "scroll",
      initializeByDefault: true
    });
  }
  function clearAutoScrolls() {
    autoScrolls.forEach(function(autoScroll2) {
      clearInterval(autoScroll2.pid);
    });
    autoScrolls = [];
  }
  function clearPointerElemChangedInterval() {
    clearInterval(pointerElemChangedInterval);
  }
  var autoScroll = throttle(function(evt, options, rootEl2, isFallback) {
    if (!options.scroll) return;
    var x2 = (evt.touches ? evt.touches[0] : evt).clientX, y2 = (evt.touches ? evt.touches[0] : evt).clientY, sens = options.scrollSensitivity, speed = options.scrollSpeed, winScroller = getWindowScrollingElement();
    var scrollThisInstance = false, scrollCustomFn;
    if (scrollRootEl !== rootEl2) {
      scrollRootEl = rootEl2;
      clearAutoScrolls();
      scrollEl = options.scroll;
      scrollCustomFn = options.scrollFn;
      if (scrollEl === true) {
        scrollEl = getParentAutoScrollElement(rootEl2, true);
      }
    }
    var layersOut = 0;
    var currentParent = scrollEl;
    do {
      var el = currentParent, rect = getRect(el), top = rect.top, bottom = rect.bottom, left2 = rect.left, right2 = rect.right, width = rect.width, height = rect.height, canScrollX = void 0, canScrollY = void 0, scrollWidth = el.scrollWidth, scrollHeight = el.scrollHeight, elCSS = css(el), scrollPosX = el.scrollLeft, scrollPosY = el.scrollTop;
      if (el === winScroller) {
        canScrollX = width < scrollWidth && (elCSS.overflowX === "auto" || elCSS.overflowX === "scroll" || elCSS.overflowX === "visible");
        canScrollY = height < scrollHeight && (elCSS.overflowY === "auto" || elCSS.overflowY === "scroll" || elCSS.overflowY === "visible");
      } else {
        canScrollX = width < scrollWidth && (elCSS.overflowX === "auto" || elCSS.overflowX === "scroll");
        canScrollY = height < scrollHeight && (elCSS.overflowY === "auto" || elCSS.overflowY === "scroll");
      }
      var vx = canScrollX && (Math.abs(right2 - x2) <= sens && scrollPosX + width < scrollWidth) - (Math.abs(left2 - x2) <= sens && !!scrollPosX);
      var vy = canScrollY && (Math.abs(bottom - y2) <= sens && scrollPosY + height < scrollHeight) - (Math.abs(top - y2) <= sens && !!scrollPosY);
      if (!autoScrolls[layersOut]) {
        for (var i = 0; i <= layersOut; i++) {
          if (!autoScrolls[i]) {
            autoScrolls[i] = {};
          }
        }
      }
      if (autoScrolls[layersOut].vx != vx || autoScrolls[layersOut].vy != vy || autoScrolls[layersOut].el !== el) {
        autoScrolls[layersOut].el = el;
        autoScrolls[layersOut].vx = vx;
        autoScrolls[layersOut].vy = vy;
        clearInterval(autoScrolls[layersOut].pid);
        if (vx != 0 || vy != 0) {
          scrollThisInstance = true;
          autoScrolls[layersOut].pid = setInterval(function() {
            if (isFallback && this.layer === 0) {
              Sortable.active._onTouchMove(touchEvt$1);
            }
            var scrollOffsetY = autoScrolls[this.layer].vy ? autoScrolls[this.layer].vy * speed : 0;
            var scrollOffsetX = autoScrolls[this.layer].vx ? autoScrolls[this.layer].vx * speed : 0;
            if (typeof scrollCustomFn === "function") {
              if (scrollCustomFn.call(Sortable.dragged.parentNode[expando], scrollOffsetX, scrollOffsetY, evt, touchEvt$1, autoScrolls[this.layer].el) !== "continue") {
                return;
              }
            }
            scrollBy(autoScrolls[this.layer].el, scrollOffsetX, scrollOffsetY);
          }.bind({
            layer: layersOut
          }), 24);
        }
      }
      layersOut++;
    } while (options.bubbleScroll && currentParent !== winScroller && (currentParent = getParentAutoScrollElement(currentParent, false)));
    scrolling = scrollThisInstance;
  }, 30);
  var drop = function drop2(_ref) {
    var originalEvent = _ref.originalEvent, putSortable2 = _ref.putSortable, dragEl2 = _ref.dragEl, activeSortable = _ref.activeSortable, dispatchSortableEvent = _ref.dispatchSortableEvent, hideGhostForTarget = _ref.hideGhostForTarget, unhideGhostForTarget = _ref.unhideGhostForTarget;
    if (!originalEvent) return;
    var toSortable = putSortable2 || activeSortable;
    hideGhostForTarget();
    var touch = originalEvent.changedTouches && originalEvent.changedTouches.length ? originalEvent.changedTouches[0] : originalEvent;
    var target = document.elementFromPoint(touch.clientX, touch.clientY);
    unhideGhostForTarget();
    if (toSortable && !toSortable.el.contains(target)) {
      dispatchSortableEvent("spill");
      this.onSpill({
        dragEl: dragEl2,
        putSortable: putSortable2
      });
    }
  };
  function Revert() {
  }
  Revert.prototype = {
    startIndex: null,
    dragStart: function dragStart(_ref2) {
      var oldDraggableIndex2 = _ref2.oldDraggableIndex;
      this.startIndex = oldDraggableIndex2;
    },
    onSpill: function onSpill(_ref3) {
      var dragEl2 = _ref3.dragEl, putSortable2 = _ref3.putSortable;
      this.sortable.captureAnimationState();
      if (putSortable2) {
        putSortable2.captureAnimationState();
      }
      var nextSibling = getChild(this.sortable.el, this.startIndex, this.options);
      if (nextSibling) {
        this.sortable.el.insertBefore(dragEl2, nextSibling);
      } else {
        this.sortable.el.appendChild(dragEl2);
      }
      this.sortable.animateAll();
      if (putSortable2) {
        putSortable2.animateAll();
      }
    },
    drop
  };
  _extends(Revert, {
    pluginName: "revertOnSpill"
  });
  function Remove() {
  }
  Remove.prototype = {
    onSpill: function onSpill2(_ref4) {
      var dragEl2 = _ref4.dragEl, putSortable2 = _ref4.putSortable;
      var parentSortable = putSortable2 || this.sortable;
      parentSortable.captureAnimationState();
      dragEl2.parentNode && dragEl2.parentNode.removeChild(dragEl2);
      parentSortable.animateAll();
    },
    drop
  };
  _extends(Remove, {
    pluginName: "removeOnSpill"
  });
  Sortable.mount(new AutoScrollPlugin());
  Sortable.mount(Remove, Revert);
  var sortable_esm_default = Sortable;

  // src/row-reorder.ts
  function setupRowReorder(doc, config, signal) {
    const root2 = doc.getElementById(config.rootId);
    if (!root2) return;
    const rowSelector = `.${config.rowClass}`;
    const rowOf = (target) => target instanceof Element ? target.closest(rowSelector) : null;
    const rows = () => Array.from(root2.querySelectorAll(rowSelector));
    root2.addEventListener(
      "keydown",
      (event) => {
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
        root2.querySelector(selector)?.focus();
      },
      { signal }
    );
  }
  var TOUCH_HOLD_DELAY_MS = 150;
  var TOUCH_START_THRESHOLD_PX = 4;
  function destroySortable(instance) {
    if (instance && sortable_esm_default.active === instance) {
      sortable_esm_default.ghost?.remove();
      sortable_esm_default.clone?.remove();
    }
    instance?.destroy();
  }
  function attachRowSortable(container, config, previous) {
    destroySortable(previous);
    return new sortable_esm_default(container, {
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
        const { oldIndex: oldIndex2, newIndex: newIndex2 } = event;
        if (oldIndex2 === void 0 || newIndex2 === void 0 || oldIndex2 === newIndex2) return;
        config.move(oldIndex2, newIndex2);
      }
    });
  }

  // src/link-editor.ts
  function linkValueErrorId(index2) {
    return `link-value-error-${index2}`;
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
    const sel = select_default2(selectEl);
    sel.selectAll("option").remove();
    sel.append("option").attr("value", "").attr("selected", selectedId === null ? "" : null).text("\u2014 select \u2014");
    sel.selectAll("option.node-option").data(nodes).join("option").attr("class", "node-option").attr("value", (n) => n.id).attr("disabled", (n) => n.id === excludedId ? "" : null).attr("selected", (n) => n.id === selectedId ? "" : null).text((n) => n.name);
  }
  function renderLinkEditor(doc, state, moveLink2, previousSortable) {
    const root2 = select_default2(doc.getElementById("link-editor"));
    root2.html("");
    root2.append("h3").attr("id", "link-editor-heading").text("Links");
    const rowsContainer = root2.append("div").attr("class", "link-rows");
    const row = rowsContainer.selectAll(".link-row").data(state.links).join("div").attr("class", "link-row");
    row.append("button").attr("type", "button").attr("class", "drag-handle").attr("data-index", (_d, i) => i).attr("aria-label", (_d, i) => `Reorder link ${i + 1}`).text("\u283F");
    row.append("select").attr("class", "link-source").attr("data-action", "update-link-source").attr("data-index", (_d, i) => i).attr("aria-label", (_d, i) => `Source for link ${i + 1}`).each(function(d) {
      renderLinkOptions(this, state.nodes, d.source, d.target);
    });
    row.append("select").attr("class", "link-target").attr("data-action", "update-link-target").attr("data-index", (_d, i) => i).attr("aria-label", (_d, i) => `Target for link ${i + 1}`).each(function(d) {
      renderLinkOptions(this, state.nodes, d.target, d.source);
    });
    row.append("input").attr("type", "text").attr("inputmode", "decimal").attr("class", "link-value").attr("data-action", "update-link-value").attr("data-index", (_d, i) => i).attr("aria-label", (_d, i) => `Value for link ${i + 1}`).attr("aria-describedby", (_d, i) => linkValueErrorId(i)).attr("value", (d) => d.value);
    row.append("button").attr("type", "button").attr("class", "link-delete").attr("data-action", "delete-link").attr("data-index", (_d, i) => i).attr("aria-label", (_d, i) => `Delete link ${i + 1}`).text("Delete");
    row.append("span").attr("class", "field-error").attr("id", (_d, i) => linkValueErrorId(i));
    root2.append("button").attr("type", "button").attr("class", "add-link").attr("data-action", "add-link").text("Add link");
    const container = rowsContainer.node();
    if (!container) return previousSortable;
    return attachRowSortable(container, { rowClass: "link-row", move: moveLink2 }, previousSortable);
  }
  function setLinkValueError(doc, index2, message) {
    const el = doc.getElementById(linkValueErrorId(index2));
    if (el) el.textContent = message;
  }
  function commitLinkValue(doc, target, index2, actions) {
    target.setAttribute("value", target.value);
    const parsed = parseLinkValue(target.value);
    if (parsed.kind === "valid") {
      target.removeAttribute("aria-invalid");
      setLinkValueError(doc, index2, "");
      actions.updateLinkValue(index2, parsed.value);
    } else if (parsed.kind === "empty") {
      target.removeAttribute("aria-invalid");
      setLinkValueError(doc, index2, "");
    } else {
      target.setAttribute("aria-invalid", "true");
      setLinkValueError(doc, index2, linkValueErrorMessage(target.value));
    }
  }
  function setupLinkEditor(doc, actions, state, signal) {
    const root2 = doc.getElementById("link-editor");
    if (!root2) return;
    setupRowReorder(
      doc,
      {
        rootId: "link-editor",
        rowClass: "link-row",
        move: actions.moveLink,
        // Links have no stable id — refocus the handle now at the new index.
        refocusSelector: (_handle, to) => `.drag-handle[data-index="${to}"]`
      },
      signal
    );
    root2.addEventListener(
      "click",
      (event) => {
        if (!(event.target instanceof HTMLElement)) return;
        const { action, index: index2 } = event.target.dataset;
        if (action === "add-link") {
          actions.addLink();
        } else if (action === "delete-link" && index2 !== void 0) {
          actions.deleteLink(Number(index2));
        }
      },
      { signal }
    );
    root2.addEventListener(
      "change",
      (event) => {
        const target = event.target;
        if (target instanceof HTMLSelectElement) {
          const { action: action2, index: index3 } = target.dataset;
          if (index3 === void 0) return;
          if (action2 === "update-link-source") {
            actions.updateLinkSource(Number(index3), target.value || null);
          } else if (action2 === "update-link-target") {
            actions.updateLinkTarget(Number(index3), target.value || null);
          }
          return;
        }
        if (!(target instanceof HTMLInputElement)) return;
        const { action, index: index2 } = target.dataset;
        if (action !== "update-link-value" || index2 === void 0) return;
        const parsed = parseLinkValue(target.value);
        if (parsed.kind !== "valid") {
          target.value = String(state.links[Number(index2)].value);
          target.removeAttribute("aria-invalid");
          setLinkValueError(doc, Number(index2), "");
        }
      },
      { signal }
    );
    root2.addEventListener(
      "beforeinput",
      (event) => {
        if (!(event instanceof InputEvent)) return;
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        const { action, index: index2 } = target.dataset;
        if (action !== "update-link-value" || index2 === void 0) return;
        if (event.data == null) return;
        const start2 = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? target.value.length;
        const prospective = target.value.slice(0, start2) + event.data + target.value.slice(end);
        if (!exceedsFractionDigits(prospective)) return;
        if (event.inputType === "insertText") {
          event.preventDefault();
        } else if (event.inputType === "insertFromPaste" || event.inputType === "insertFromDrop") {
          event.preventDefault();
          const trimmed = truncateFractionDigits(prospective);
          target.value = trimmed;
          const caret = Math.min(start2 + event.data.length, trimmed.length);
          target.setSelectionRange(caret, caret);
          commitLinkValue(doc, target, Number(index2), actions);
        }
      },
      { signal }
    );
    root2.addEventListener(
      "input",
      (event) => {
        if (!(event.target instanceof HTMLInputElement)) return;
        const target = event.target;
        const { action, index: index2 } = target.dataset;
        if (action !== "update-link-value" || index2 === void 0) return;
        commitLinkValue(doc, target, Number(index2), actions);
      },
      { signal }
    );
  }

  // src/node-editor.ts
  function renderNodeEditor(doc, state, nodeColor, moveNode2, previousSortable) {
    const root2 = select_default2(doc.getElementById("node-editor"));
    root2.html("");
    root2.append("h3").attr("id", "node-editor-heading").text("Nodes");
    const rowsContainer = root2.append("div").attr("class", "node-rows");
    const row = rowsContainer.selectAll(".node-row").data(state.nodes, (d) => d.id).join("div").attr("class", "node-row");
    row.append("button").attr("type", "button").attr("class", "drag-handle").attr("data-index", (_d, i) => i).attr("data-id", (d) => d.id).attr("aria-label", (d) => `Reorder ${d.name}`).text("\u283F");
    row.append("span").attr("class", "node-swatch").style("background-color", (d) => nodeColor(d));
    row.append("input").attr("type", "text").attr("class", "node-name").attr("data-action", "rename-node").attr("data-id", (d) => d.id).attr("aria-label", (d) => `Name for ${d.name}`).attr("value", (d) => d.name);
    row.append("button").attr("type", "button").attr("class", "node-delete").attr("data-action", "delete-node").attr("data-id", (d) => d.id).attr("aria-label", (d) => `Delete ${d.name}`).text("Delete");
    root2.append("button").attr("type", "button").attr("class", "add-node").attr("data-action", "add-node").text("Add node");
    const container = rowsContainer.node();
    if (!container) return previousSortable;
    return attachRowSortable(container, { rowClass: "node-row", move: moveNode2 }, previousSortable);
  }
  function setupNodeEditor(doc, actions, signal) {
    const root2 = doc.getElementById("node-editor");
    if (!root2) return;
    setupRowReorder(
      doc,
      {
        rootId: "node-editor",
        rowClass: "node-row",
        move: actions.moveNode,
        // Refocus the same node's handle by its stable id after the rebuild.
        refocusSelector: (handle) => `.drag-handle[data-id="${handle.dataset.id}"]`
      },
      signal
    );
    root2.addEventListener(
      "click",
      (event) => {
        if (!(event.target instanceof HTMLElement)) return;
        const { action, id: id2 } = event.target.dataset;
        if (action === "add-node") {
          actions.addNode();
        } else if (action === "delete-node" && id2 !== void 0) {
          actions.deleteNode(id2);
        }
      },
      { signal }
    );
    root2.addEventListener(
      "input",
      (event) => {
        if (!(event.target instanceof HTMLInputElement)) return;
        const { action, id: id2 } = event.target.dataset;
        if (action === "rename-node" && id2 !== void 0) {
          actions.renameNode(id2, event.target.value);
          event.target.setAttribute("value", event.target.value);
          event.target.setAttribute("aria-label", `Name for ${event.target.value}`);
          const row = event.target.closest(".node-row");
          const deleteButton = row?.querySelector(".node-delete");
          deleteButton?.setAttribute("aria-label", `Delete ${event.target.value}`);
          const handle = row?.querySelector(".drag-handle");
          handle?.setAttribute("aria-label", `Reorder ${event.target.value}`);
        }
      },
      { signal }
    );
  }

  // src/preview-resizer.ts
  var PREVIEW_HEIGHT_STORAGE_KEY = "sankey-builder-preview-height";
  var MIN_PREVIEW_HEIGHT = 240;
  var MAX_PREVIEW_HEIGHT = 720;
  var DEFAULT_PREVIEW_HEIGHT = 360;
  var PREVIEW_HEIGHT_STEP = 40;
  function clampPreviewHeight(value2) {
    if (!Number.isFinite(value2)) return DEFAULT_PREVIEW_HEIGHT;
    return Math.min(MAX_PREVIEW_HEIGHT, Math.max(MIN_PREVIEW_HEIGHT, Math.round(value2)));
  }
  function loadPreviewHeight(storage) {
    try {
      const stored = storage.getItem(PREVIEW_HEIGHT_STORAGE_KEY);
      if (stored === null || stored.trim() === "") return DEFAULT_PREVIEW_HEIGHT;
      const value2 = Number(stored);
      return Number.isFinite(value2) ? clampPreviewHeight(value2) : DEFAULT_PREVIEW_HEIGHT;
    } catch {
      return DEFAULT_PREVIEW_HEIGHT;
    }
  }
  function persistPreviewHeight(storage, value2) {
    try {
      storage.setItem(PREVIEW_HEIGHT_STORAGE_KEY, String(value2));
    } catch {
    }
  }
  function setupPreviewResizer(doc, win, signal) {
    const noopDisposer = () => {
    };
    const diagram = doc.getElementById("diagram");
    const controls = doc.querySelector(".preview-resizer");
    const splitter = doc.getElementById("preview-splitter");
    if (!diagram || !controls || !splitter) return noopDisposer;
    let height = loadPreviewHeight(win.localStorage);
    let dragStartY = null;
    let dragStartHeight = height;
    let dragPointerId = null;
    const apply = (next, persist = true) => {
      height = clampPreviewHeight(next);
      diagram.style.setProperty("--diagram-preview-height", `${height}px`);
      splitter.setAttribute("aria-valuenow", String(height));
      splitter.setAttribute("aria-valuetext", `${height} pixels`);
      if (persist) persistPreviewHeight(win.localStorage, height);
    };
    splitter.setAttribute("aria-valuemin", String(MIN_PREVIEW_HEIGHT));
    splitter.setAttribute("aria-valuemax", String(MAX_PREVIEW_HEIGHT));
    apply(height, false);
    controls.addEventListener(
      "click",
      (event) => {
        if (!(event.target instanceof Element)) return;
        const action = event.target.closest("[data-action]")?.dataset.action;
        if (action === "preview-smaller") apply(height - PREVIEW_HEIGHT_STEP);
        else if (action === "preview-larger") apply(height + PREVIEW_HEIGHT_STEP);
        else if (action === "preview-reset") apply(DEFAULT_PREVIEW_HEIGHT);
      },
      { signal }
    );
    splitter.addEventListener(
      "keydown",
      (event) => {
        let next;
        if (event.key === "ArrowUp") next = height - PREVIEW_HEIGHT_STEP;
        else if (event.key === "ArrowDown") next = height + PREVIEW_HEIGHT_STEP;
        else if (event.key === "Home") next = MIN_PREVIEW_HEIGHT;
        else if (event.key === "End") next = MAX_PREVIEW_HEIGHT;
        if (next === void 0) return;
        event.preventDefault();
        apply(next);
      },
      { signal }
    );
    splitter.addEventListener(
      "pointerdown",
      (event) => {
        dragStartY = event.clientY;
        dragStartHeight = height;
        dragPointerId = event.pointerId;
        splitter.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      },
      { signal }
    );
    win.addEventListener(
      "pointermove",
      (event) => {
        if (dragStartY === null) return;
        apply(dragStartHeight + event.clientY - dragStartY);
      },
      { signal }
    );
    win.addEventListener(
      "pointerup",
      (event) => {
        if (dragStartY === null) return;
        dragStartY = null;
        dragPointerId = null;
        splitter.releasePointerCapture?.(event.pointerId);
      },
      { signal }
    );
    return function cancelDrag() {
      if (dragStartY === null) return;
      if (dragPointerId !== null) splitter.releasePointerCapture?.(dragPointerId);
      dragStartY = null;
      dragPointerId = null;
    };
  }

  // node_modules/d3-sankey/node_modules/d3-array/src/max.js
  function max2(values, valueof) {
    let max3;
    if (valueof === void 0) {
      for (const value2 of values) {
        if (value2 != null && (max3 < value2 || max3 === void 0 && value2 >= value2)) {
          max3 = value2;
        }
      }
    } else {
      let index2 = -1;
      for (let value2 of values) {
        if ((value2 = valueof(value2, ++index2, values)) != null && (max3 < value2 || max3 === void 0 && value2 >= value2)) {
          max3 = value2;
        }
      }
    }
    return max3;
  }

  // node_modules/d3-sankey/node_modules/d3-array/src/min.js
  function min2(values, valueof) {
    let min3;
    if (valueof === void 0) {
      for (const value2 of values) {
        if (value2 != null && (min3 > value2 || min3 === void 0 && value2 >= value2)) {
          min3 = value2;
        }
      }
    } else {
      let index2 = -1;
      for (let value2 of values) {
        if ((value2 = valueof(value2, ++index2, values)) != null && (min3 > value2 || min3 === void 0 && value2 >= value2)) {
          min3 = value2;
        }
      }
    }
    return min3;
  }

  // node_modules/d3-sankey/node_modules/d3-array/src/sum.js
  function sum(values, valueof) {
    let sum2 = 0;
    if (valueof === void 0) {
      for (let value2 of values) {
        if (value2 = +value2) {
          sum2 += value2;
        }
      }
    } else {
      let index2 = -1;
      for (let value2 of values) {
        if (value2 = +valueof(value2, ++index2, values)) {
          sum2 += value2;
        }
      }
    }
    return sum2;
  }

  // node_modules/d3-sankey/src/align.js
  function targetDepth(d) {
    return d.target.depth;
  }
  function left(node) {
    return node.depth;
  }
  function right(node, n) {
    return n - 1 - node.height;
  }
  function justify(node, n) {
    return node.sourceLinks.length ? node.depth : n - 1;
  }
  function center(node) {
    return node.targetLinks.length ? node.depth : node.sourceLinks.length ? min2(node.sourceLinks, targetDepth) - 1 : 0;
  }

  // node_modules/d3-sankey/src/constant.js
  function constant(x2) {
    return function() {
      return x2;
    };
  }

  // node_modules/d3-sankey/src/sankey.js
  function ascendingSourceBreadth(a, b) {
    return ascendingBreadth(a.source, b.source) || a.index - b.index;
  }
  function ascendingTargetBreadth(a, b) {
    return ascendingBreadth(a.target, b.target) || a.index - b.index;
  }
  function ascendingBreadth(a, b) {
    return a.y0 - b.y0;
  }
  function value(d) {
    return d.value;
  }
  function defaultId(d) {
    return d.index;
  }
  function defaultNodes(graph) {
    return graph.nodes;
  }
  function defaultLinks(graph) {
    return graph.links;
  }
  function find3(nodeById, id2) {
    const node = nodeById.get(id2);
    if (!node) throw new Error("missing: " + id2);
    return node;
  }
  function computeLinkBreadths({ nodes }) {
    for (const node of nodes) {
      let y0 = node.y0;
      let y1 = y0;
      for (const link2 of node.sourceLinks) {
        link2.y0 = y0 + link2.width / 2;
        y0 += link2.width;
      }
      for (const link2 of node.targetLinks) {
        link2.y1 = y1 + link2.width / 2;
        y1 += link2.width;
      }
    }
  }
  function Sankey() {
    let x0 = 0, y0 = 0, x1 = 1, y1 = 1;
    let dx = 24;
    let dy = 8, py;
    let id2 = defaultId;
    let align = justify;
    let sort2;
    let linkSort;
    let nodes = defaultNodes;
    let links = defaultLinks;
    let iterations = 6;
    function sankey() {
      const graph = { nodes: nodes.apply(null, arguments), links: links.apply(null, arguments) };
      computeNodeLinks(graph);
      computeNodeValues(graph);
      computeNodeDepths(graph);
      computeNodeHeights(graph);
      computeNodeBreadths(graph);
      computeLinkBreadths(graph);
      return graph;
    }
    sankey.update = function(graph) {
      computeLinkBreadths(graph);
      return graph;
    };
    sankey.nodeId = function(_) {
      return arguments.length ? (id2 = typeof _ === "function" ? _ : constant(_), sankey) : id2;
    };
    sankey.nodeAlign = function(_) {
      return arguments.length ? (align = typeof _ === "function" ? _ : constant(_), sankey) : align;
    };
    sankey.nodeSort = function(_) {
      return arguments.length ? (sort2 = _, sankey) : sort2;
    };
    sankey.nodeWidth = function(_) {
      return arguments.length ? (dx = +_, sankey) : dx;
    };
    sankey.nodePadding = function(_) {
      return arguments.length ? (dy = py = +_, sankey) : dy;
    };
    sankey.nodes = function(_) {
      return arguments.length ? (nodes = typeof _ === "function" ? _ : constant(_), sankey) : nodes;
    };
    sankey.links = function(_) {
      return arguments.length ? (links = typeof _ === "function" ? _ : constant(_), sankey) : links;
    };
    sankey.linkSort = function(_) {
      return arguments.length ? (linkSort = _, sankey) : linkSort;
    };
    sankey.size = function(_) {
      return arguments.length ? (x0 = y0 = 0, x1 = +_[0], y1 = +_[1], sankey) : [x1 - x0, y1 - y0];
    };
    sankey.extent = function(_) {
      return arguments.length ? (x0 = +_[0][0], x1 = +_[1][0], y0 = +_[0][1], y1 = +_[1][1], sankey) : [[x0, y0], [x1, y1]];
    };
    sankey.iterations = function(_) {
      return arguments.length ? (iterations = +_, sankey) : iterations;
    };
    function computeNodeLinks({ nodes: nodes2, links: links2 }) {
      for (const [i, node] of nodes2.entries()) {
        node.index = i;
        node.sourceLinks = [];
        node.targetLinks = [];
      }
      const nodeById = new Map(nodes2.map((d, i) => [id2(d, i, nodes2), d]));
      for (const [i, link2] of links2.entries()) {
        link2.index = i;
        let { source, target } = link2;
        if (typeof source !== "object") source = link2.source = find3(nodeById, source);
        if (typeof target !== "object") target = link2.target = find3(nodeById, target);
        source.sourceLinks.push(link2);
        target.targetLinks.push(link2);
      }
      if (linkSort != null) {
        for (const { sourceLinks, targetLinks } of nodes2) {
          sourceLinks.sort(linkSort);
          targetLinks.sort(linkSort);
        }
      }
    }
    function computeNodeValues({ nodes: nodes2 }) {
      for (const node of nodes2) {
        node.value = node.fixedValue === void 0 ? Math.max(sum(node.sourceLinks, value), sum(node.targetLinks, value)) : node.fixedValue;
      }
    }
    function computeNodeDepths({ nodes: nodes2 }) {
      const n = nodes2.length;
      let current = new Set(nodes2);
      let next = /* @__PURE__ */ new Set();
      let x2 = 0;
      while (current.size) {
        for (const node of current) {
          node.depth = x2;
          for (const { target } of node.sourceLinks) {
            next.add(target);
          }
        }
        if (++x2 > n) throw new Error("circular link");
        current = next;
        next = /* @__PURE__ */ new Set();
      }
    }
    function computeNodeHeights({ nodes: nodes2 }) {
      const n = nodes2.length;
      let current = new Set(nodes2);
      let next = /* @__PURE__ */ new Set();
      let x2 = 0;
      while (current.size) {
        for (const node of current) {
          node.height = x2;
          for (const { source } of node.targetLinks) {
            next.add(source);
          }
        }
        if (++x2 > n) throw new Error("circular link");
        current = next;
        next = /* @__PURE__ */ new Set();
      }
    }
    function computeNodeLayers({ nodes: nodes2 }) {
      const x2 = max2(nodes2, (d) => d.depth) + 1;
      const kx = (x1 - x0 - dx) / (x2 - 1);
      const columns = new Array(x2);
      for (const node of nodes2) {
        const i = Math.max(0, Math.min(x2 - 1, Math.floor(align.call(null, node, x2))));
        node.layer = i;
        node.x0 = x0 + i * kx;
        node.x1 = node.x0 + dx;
        if (columns[i]) columns[i].push(node);
        else columns[i] = [node];
      }
      if (sort2) for (const column of columns) {
        column.sort(sort2);
      }
      return columns;
    }
    function initializeNodeBreadths(columns) {
      const ky = min2(columns, (c) => (y1 - y0 - (c.length - 1) * py) / sum(c, value));
      for (const nodes2 of columns) {
        let y2 = y0;
        for (const node of nodes2) {
          node.y0 = y2;
          node.y1 = y2 + node.value * ky;
          y2 = node.y1 + py;
          for (const link2 of node.sourceLinks) {
            link2.width = link2.value * ky;
          }
        }
        y2 = (y1 - y2 + py) / (nodes2.length + 1);
        for (let i = 0; i < nodes2.length; ++i) {
          const node = nodes2[i];
          node.y0 += y2 * (i + 1);
          node.y1 += y2 * (i + 1);
        }
        reorderLinks(nodes2);
      }
    }
    function computeNodeBreadths(graph) {
      const columns = computeNodeLayers(graph);
      py = Math.min(dy, (y1 - y0) / (max2(columns, (c) => c.length) - 1));
      initializeNodeBreadths(columns);
      for (let i = 0; i < iterations; ++i) {
        const alpha = Math.pow(0.99, i);
        const beta = Math.max(1 - alpha, (i + 1) / iterations);
        relaxRightToLeft(columns, alpha, beta);
        relaxLeftToRight(columns, alpha, beta);
      }
    }
    function relaxLeftToRight(columns, alpha, beta) {
      for (let i = 1, n = columns.length; i < n; ++i) {
        const column = columns[i];
        for (const target of column) {
          let y2 = 0;
          let w = 0;
          for (const { source, value: value2 } of target.targetLinks) {
            let v = value2 * (target.layer - source.layer);
            y2 += targetTop(source, target) * v;
            w += v;
          }
          if (!(w > 0)) continue;
          let dy2 = (y2 / w - target.y0) * alpha;
          target.y0 += dy2;
          target.y1 += dy2;
          reorderNodeLinks(target);
        }
        if (sort2 === void 0) column.sort(ascendingBreadth);
        resolveCollisions(column, beta);
      }
    }
    function relaxRightToLeft(columns, alpha, beta) {
      for (let n = columns.length, i = n - 2; i >= 0; --i) {
        const column = columns[i];
        for (const source of column) {
          let y2 = 0;
          let w = 0;
          for (const { target, value: value2 } of source.sourceLinks) {
            let v = value2 * (target.layer - source.layer);
            y2 += sourceTop(source, target) * v;
            w += v;
          }
          if (!(w > 0)) continue;
          let dy2 = (y2 / w - source.y0) * alpha;
          source.y0 += dy2;
          source.y1 += dy2;
          reorderNodeLinks(source);
        }
        if (sort2 === void 0) column.sort(ascendingBreadth);
        resolveCollisions(column, beta);
      }
    }
    function resolveCollisions(nodes2, alpha) {
      const i = nodes2.length >> 1;
      const subject = nodes2[i];
      resolveCollisionsBottomToTop(nodes2, subject.y0 - py, i - 1, alpha);
      resolveCollisionsTopToBottom(nodes2, subject.y1 + py, i + 1, alpha);
      resolveCollisionsBottomToTop(nodes2, y1, nodes2.length - 1, alpha);
      resolveCollisionsTopToBottom(nodes2, y0, 0, alpha);
    }
    function resolveCollisionsTopToBottom(nodes2, y2, i, alpha) {
      for (; i < nodes2.length; ++i) {
        const node = nodes2[i];
        const dy2 = (y2 - node.y0) * alpha;
        if (dy2 > 1e-6) node.y0 += dy2, node.y1 += dy2;
        y2 = node.y1 + py;
      }
    }
    function resolveCollisionsBottomToTop(nodes2, y2, i, alpha) {
      for (; i >= 0; --i) {
        const node = nodes2[i];
        const dy2 = (node.y1 - y2) * alpha;
        if (dy2 > 1e-6) node.y0 -= dy2, node.y1 -= dy2;
        y2 = node.y0 - py;
      }
    }
    function reorderNodeLinks({ sourceLinks, targetLinks }) {
      if (linkSort === void 0) {
        for (const { source: { sourceLinks: sourceLinks2 } } of targetLinks) {
          sourceLinks2.sort(ascendingTargetBreadth);
        }
        for (const { target: { targetLinks: targetLinks2 } } of sourceLinks) {
          targetLinks2.sort(ascendingSourceBreadth);
        }
      }
    }
    function reorderLinks(nodes2) {
      if (linkSort === void 0) {
        for (const { sourceLinks, targetLinks } of nodes2) {
          sourceLinks.sort(ascendingTargetBreadth);
          targetLinks.sort(ascendingSourceBreadth);
        }
      }
    }
    function targetTop(source, target) {
      let y2 = source.y0 - (source.sourceLinks.length - 1) * py / 2;
      for (const { target: node, width } of source.sourceLinks) {
        if (node === target) break;
        y2 += width + py;
      }
      for (const { source: node, width } of target.targetLinks) {
        if (node === source) break;
        y2 -= width;
      }
      return y2;
    }
    function sourceTop(source, target) {
      let y2 = target.y0 - (target.targetLinks.length - 1) * py / 2;
      for (const { source: node, width } of target.targetLinks) {
        if (node === source) break;
        y2 += width + py;
      }
      for (const { target: node, width } of source.sourceLinks) {
        if (node === target) break;
        y2 -= width;
      }
      return y2;
    }
    return sankey;
  }

  // node_modules/d3-sankey/node_modules/d3-shape/node_modules/d3-path/src/path.js
  var pi = Math.PI;
  var tau = 2 * pi;
  var epsilon = 1e-6;
  var tauEpsilon = tau - epsilon;
  function Path() {
    this._x0 = this._y0 = // start of current subpath
    this._x1 = this._y1 = null;
    this._ = "";
  }
  function path() {
    return new Path();
  }
  Path.prototype = path.prototype = {
    constructor: Path,
    moveTo: function(x2, y2) {
      this._ += "M" + (this._x0 = this._x1 = +x2) + "," + (this._y0 = this._y1 = +y2);
    },
    closePath: function() {
      if (this._x1 !== null) {
        this._x1 = this._x0, this._y1 = this._y0;
        this._ += "Z";
      }
    },
    lineTo: function(x2, y2) {
      this._ += "L" + (this._x1 = +x2) + "," + (this._y1 = +y2);
    },
    quadraticCurveTo: function(x1, y1, x2, y2) {
      this._ += "Q" + +x1 + "," + +y1 + "," + (this._x1 = +x2) + "," + (this._y1 = +y2);
    },
    bezierCurveTo: function(x1, y1, x2, y2, x3, y3) {
      this._ += "C" + +x1 + "," + +y1 + "," + +x2 + "," + +y2 + "," + (this._x1 = +x3) + "," + (this._y1 = +y3);
    },
    arcTo: function(x1, y1, x2, y2, r) {
      x1 = +x1, y1 = +y1, x2 = +x2, y2 = +y2, r = +r;
      var x0 = this._x1, y0 = this._y1, x21 = x2 - x1, y21 = y2 - y1, x01 = x0 - x1, y01 = y0 - y1, l01_2 = x01 * x01 + y01 * y01;
      if (r < 0) throw new Error("negative radius: " + r);
      if (this._x1 === null) {
        this._ += "M" + (this._x1 = x1) + "," + (this._y1 = y1);
      } else if (!(l01_2 > epsilon)) ;
      else if (!(Math.abs(y01 * x21 - y21 * x01) > epsilon) || !r) {
        this._ += "L" + (this._x1 = x1) + "," + (this._y1 = y1);
      } else {
        var x20 = x2 - x0, y20 = y2 - y0, l21_2 = x21 * x21 + y21 * y21, l20_2 = x20 * x20 + y20 * y20, l21 = Math.sqrt(l21_2), l01 = Math.sqrt(l01_2), l = r * Math.tan((pi - Math.acos((l21_2 + l01_2 - l20_2) / (2 * l21 * l01))) / 2), t01 = l / l01, t21 = l / l21;
        if (Math.abs(t01 - 1) > epsilon) {
          this._ += "L" + (x1 + t01 * x01) + "," + (y1 + t01 * y01);
        }
        this._ += "A" + r + "," + r + ",0,0," + +(y01 * x20 > x01 * y20) + "," + (this._x1 = x1 + t21 * x21) + "," + (this._y1 = y1 + t21 * y21);
      }
    },
    arc: function(x2, y2, r, a0, a1, ccw) {
      x2 = +x2, y2 = +y2, r = +r, ccw = !!ccw;
      var dx = r * Math.cos(a0), dy = r * Math.sin(a0), x0 = x2 + dx, y0 = y2 + dy, cw = 1 ^ ccw, da = ccw ? a0 - a1 : a1 - a0;
      if (r < 0) throw new Error("negative radius: " + r);
      if (this._x1 === null) {
        this._ += "M" + x0 + "," + y0;
      } else if (Math.abs(this._x1 - x0) > epsilon || Math.abs(this._y1 - y0) > epsilon) {
        this._ += "L" + x0 + "," + y0;
      }
      if (!r) return;
      if (da < 0) da = da % tau + tau;
      if (da > tauEpsilon) {
        this._ += "A" + r + "," + r + ",0,1," + cw + "," + (x2 - dx) + "," + (y2 - dy) + "A" + r + "," + r + ",0,1," + cw + "," + (this._x1 = x0) + "," + (this._y1 = y0);
      } else if (da > epsilon) {
        this._ += "A" + r + "," + r + ",0," + +(da >= pi) + "," + cw + "," + (this._x1 = x2 + r * Math.cos(a1)) + "," + (this._y1 = y2 + r * Math.sin(a1));
      }
    },
    rect: function(x2, y2, w, h) {
      this._ += "M" + (this._x0 = this._x1 = +x2) + "," + (this._y0 = this._y1 = +y2) + "h" + +w + "v" + +h + "h" + -w + "Z";
    },
    toString: function() {
      return this._;
    }
  };
  var path_default = path;

  // node_modules/d3-sankey/node_modules/d3-shape/src/constant.js
  function constant_default5(x2) {
    return function constant2() {
      return x2;
    };
  }

  // node_modules/d3-sankey/node_modules/d3-shape/src/point.js
  function x(p) {
    return p[0];
  }
  function y(p) {
    return p[1];
  }

  // node_modules/d3-sankey/node_modules/d3-shape/src/array.js
  var slice = Array.prototype.slice;

  // node_modules/d3-sankey/node_modules/d3-shape/src/link/index.js
  function linkSource(d) {
    return d.source;
  }
  function linkTarget(d) {
    return d.target;
  }
  function link(curve) {
    var source = linkSource, target = linkTarget, x2 = x, y2 = y, context = null;
    function link2() {
      var buffer, argv = slice.call(arguments), s = source.apply(this, argv), t = target.apply(this, argv);
      if (!context) context = buffer = path_default();
      curve(context, +x2.apply(this, (argv[0] = s, argv)), +y2.apply(this, argv), +x2.apply(this, (argv[0] = t, argv)), +y2.apply(this, argv));
      if (buffer) return context = null, buffer + "" || null;
    }
    link2.source = function(_) {
      return arguments.length ? (source = _, link2) : source;
    };
    link2.target = function(_) {
      return arguments.length ? (target = _, link2) : target;
    };
    link2.x = function(_) {
      return arguments.length ? (x2 = typeof _ === "function" ? _ : constant_default5(+_), link2) : x2;
    };
    link2.y = function(_) {
      return arguments.length ? (y2 = typeof _ === "function" ? _ : constant_default5(+_), link2) : y2;
    };
    link2.context = function(_) {
      return arguments.length ? (context = _ == null ? null : _, link2) : context;
    };
    return link2;
  }
  function curveHorizontal(context, x0, y0, x1, y1) {
    context.moveTo(x0, y0);
    context.bezierCurveTo(x0 = (x0 + x1) / 2, y0, x0, y1, x1, y1);
  }
  function linkHorizontal() {
    return link(curveHorizontal);
  }

  // node_modules/d3-sankey/src/sankeyLinkHorizontal.js
  function horizontalSource(d) {
    return [d.source.x1, d.y0];
  }
  function horizontalTarget(d) {
    return [d.target.x0, d.y1];
  }
  function sankeyLinkHorizontal_default() {
    return linkHorizontal().source(horizontalSource).target(horizontalTarget);
  }

  // src/render.ts
  var ALIGN_FNS = {
    left,
    right,
    center
  };
  function alignFn(name) {
    return ALIGN_FNS[name] ?? justify;
  }
  function layout(state, sourceLinks, width, height) {
    const { nodes, links } = structuredClone({ nodes: state.nodes, links: sourceLinks });
    const graph = Sankey().nodeId((d) => d.id).nodeAlign(alignFn(state.settings.alignment)).nodeWidth(15).nodePadding(10).extent([
      [1, 5],
      [width - 1, height - 5]
    ])({ nodes, links });
    return graph;
  }
  function linkStroke(mode, nodeColor) {
    if (mode === "source") return (d) => nodeColor(d.source);
    if (mode === "target") return (d) => nodeColor(d.target);
    if (mode === "static") return () => "#aaa";
    return (d) => `url(#link-grad-${d.index})`;
  }
  function renderDiagram(doc, state, nodeColor) {
    const container = select_default2(doc.getElementById("diagram"));
    container.html("");
    if (state.nodes.length === 0) return;
    const completeLinks = state.links.filter(isComplete);
    if (completeLinks.length === 0) return;
    const { width, height } = aspectRatioOption(state.settings.aspectRatio);
    const { nodes, links } = layout(state, completeLinks, width, height);
    const svg = container.append("svg").attr("viewBox", `0 0 ${width} ${height}`);
    const linkGroup = svg.append("g").attr("fill", "none").attr("stroke-opacity", 0.5).selectAll("g").data(links).join("g");
    if (state.settings.linkColor === "source-target") {
      linkGroup.append("linearGradient").attr("id", (d) => `link-grad-${d.index}`).attr("gradientUnits", "userSpaceOnUse").attr("x1", (d) => d.source.x1).attr("x2", (d) => d.target.x0).call(
        (g) => g.append("stop").attr("offset", "0%").attr("stop-color", (d) => nodeColor(d.source))
      ).call(
        (g) => g.append("stop").attr("offset", "100%").attr("stop-color", (d) => nodeColor(d.target))
      );
    }
    linkGroup.append("path").attr("d", sankeyLinkHorizontal_default()).attr("stroke", linkStroke(state.settings.linkColor, nodeColor)).attr("stroke-width", (d) => Math.max(1, d.width));
    svg.append("g").selectAll("rect").data(nodes).join("rect").attr("x", (d) => d.x0).attr("y", (d) => d.y0).attr("width", (d) => d.x1 - d.x0).attr("height", (d) => Math.max(1, d.y1 - d.y0)).attr("fill", (d) => nodeColor(d));
    svg.append("g").attr("font-family", "system-ui, sans-serif").attr("font-size", 10).selectAll("text").data(nodes).join("text").attr("x", (d) => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6).attr("y", (d) => (d.y0 + d.y1) / 2).attr("dy", "0.35em").attr("text-anchor", (d) => d.x0 < width / 2 ? "start" : "end").attr("fill", "currentColor").text((d) => d.name);
  }

  // src/theme.ts
  function applyTheme(doc, theme) {
    if (theme === "auto") {
      doc.documentElement.removeAttribute("data-theme");
    } else {
      doc.documentElement.setAttribute("data-theme", theme);
    }
  }

  // src/theme-control.ts
  var THEME_OPTIONS = {
    auto: { label: "System", iconId: "icon-theme-system" },
    light: { label: "Light", iconId: "icon-theme-light" },
    dark: { label: "Dark", iconId: "icon-theme-dark" }
  };
  function isThemeKey(value2) {
    return typeof value2 === "string" && Object.hasOwn(THEME_OPTIONS, value2);
  }
  function syncThemeControl(doc, state) {
    const theme = state.settings.theme;
    const { label, iconId } = THEME_OPTIONS[theme];
    const button = doc.getElementById("theme-button");
    if (button) {
      const use = button.querySelector("use");
      use?.setAttribute("href", `#${iconId}`);
      button.setAttribute("aria-label", `Theme: ${label}`);
    }
    const options = Array.from(doc.querySelectorAll('[data-action="set-theme"]'));
    for (const option2 of options) {
      option2.setAttribute("aria-pressed", option2.dataset.value === theme ? "true" : "false");
    }
  }
  function setupThemeControl(doc, state, actions, signal) {
    const button = doc.getElementById("theme-button");
    const dialogEl = doc.getElementById("theme-dialog");
    if (!button || !(dialogEl instanceof HTMLDialogElement)) return;
    const dialog = setupDialog(dialogEl, signal);
    function handleClick(event) {
      if (!(event.target instanceof Element)) return;
      const trigger = event.target.closest("[data-action]");
      if (!trigger) return;
      const { action, value: value2 } = trigger.dataset;
      if (action === "open-theme-dialog") {
        dialog.open(trigger);
      } else if (action === "set-theme" && isThemeKey(value2)) {
        actions.setTheme(value2);
        syncThemeControl(doc, state);
        dialog.close();
      }
    }
    button.addEventListener("click", handleClick, { signal });
    dialogEl.addEventListener("click", handleClick, { signal });
  }

  // src/toolbar.ts
  var SWATCH_COUNT = 5;
  var LINK_COLOR_OPTIONS = {
    source: { label: "Source", iconId: "icon-link-source" },
    "source-target": { label: "Source to target (gradient)", iconId: "icon-link-gradient" },
    target: { label: "Target", iconId: "icon-link-target" },
    static: { label: "Neutral", iconId: "icon-link-neutral" }
  };
  function isLinkColorKey(value2) {
    return typeof value2 === "string" && Object.hasOwn(LINK_COLOR_OPTIONS, value2);
  }
  var ALIGNMENT_VALUES = {
    left: true,
    center: true,
    right: true,
    justify: true
  };
  function isAlignmentKey(value2) {
    return typeof value2 === "string" && Object.hasOwn(ALIGNMENT_VALUES, value2);
  }
  function buildSwatchStrip(doc, strip, palette) {
    strip.replaceChildren();
    for (const color2 of paletteColors(palette).slice(0, SWATCH_COUNT)) {
      const swatch = doc.createElement("span");
      swatch.className = "swatch";
      swatch.style.backgroundColor = color2;
      strip.appendChild(swatch);
    }
  }
  function syncToolbar(doc, state) {
    const panel = doc.querySelector(".diagram-panel");
    if (!panel) return;
    const palette = state.settings.palette;
    const preview = panel.querySelector("#palette-preview");
    if (preview) {
      const strip = preview.querySelector(".swatch-strip");
      if (strip) buildSwatchStrip(doc, strip, palette);
      preview.setAttribute("aria-label", `Palette: ${PALETTE_LABELS[palette]}`);
    }
    const options = Array.from(
      panel.querySelectorAll('[data-action="set-palette"]')
    );
    for (const option2 of options) {
      const value2 = option2.dataset.value;
      if (!isPaletteKey(value2)) continue;
      option2.setAttribute("aria-pressed", value2 === palette ? "true" : "false");
      const strip = option2.querySelector(".swatch-strip");
      if (strip) buildSwatchStrip(doc, strip, value2);
    }
    const linkColor = state.settings.linkColor;
    const { label, iconId } = LINK_COLOR_OPTIONS[linkColor];
    const linksButton = panel.querySelector("#links-button");
    if (linksButton) {
      const use = linksButton.querySelector("use");
      use?.setAttribute("href", `#${iconId}`);
      linksButton.setAttribute("aria-label", `Links: ${label}`);
    }
    const linkColorOptions = Array.from(
      doc.querySelectorAll('[data-action="set-link-color"]')
    );
    for (const option2 of linkColorOptions) {
      option2.setAttribute("aria-pressed", option2.dataset.value === linkColor ? "true" : "false");
    }
    const alignment = state.settings.alignment;
    const alignmentOptions = Array.from(
      doc.querySelectorAll('[data-action="set-alignment"]')
    );
    for (const option2 of alignmentOptions) {
      option2.setAttribute("aria-pressed", option2.dataset.value === alignment ? "true" : "false");
    }
    const aspectRatio = state.settings.aspectRatio;
    const ratioButton = panel.querySelector("#aspect-ratio-button");
    if (ratioButton) {
      ratioButton.querySelector(".aspect-ratio-current")?.replaceChildren(`Aspect ${aspectRatioOption(aspectRatio).label}`);
      ratioButton.setAttribute("aria-label", `Aspect ratio: ${aspectRatioOption(aspectRatio).label}`);
    }
    for (const option2 of Array.from(
      doc.querySelectorAll('[data-action="set-aspect-ratio"]')
    )) {
      option2.setAttribute("aria-pressed", option2.dataset.value === aspectRatio ? "true" : "false");
    }
    const diagram = doc.getElementById("diagram");
    const ratio = aspectRatioOption(aspectRatio);
    diagram?.style.setProperty("--diagram-aspect-ratio", `${ratio.width} / ${ratio.height}`);
    diagram?.style.setProperty("--diagram-aspect-number", String(ratio.width / ratio.height));
  }
  function setupToolbar(doc, state, actions, signal) {
    const panel = doc.querySelector(".diagram-panel");
    if (!panel) return;
    const dialogEl = panel.querySelector("#palette-dialog");
    const dialog = dialogEl ? setupDialog(dialogEl, signal) : null;
    const linksDialogEl = panel.querySelector("#links-dialog");
    const linksDialog = linksDialogEl ? setupDialog(linksDialogEl, signal) : null;
    const aspectDialogEl = panel.querySelector("#aspect-ratio-dialog");
    const aspectDialog = aspectDialogEl ? setupDialog(aspectDialogEl, signal) : null;
    const displayDialogEl = panel.querySelector("#display-dialog");
    const displayDialog = displayDialogEl ? setupDialog(displayDialogEl, signal) : null;
    panel.addEventListener(
      "click",
      (event) => {
        if (!(event.target instanceof Element)) return;
        const trigger = event.target.closest("[data-action]");
        if (!trigger) return;
        const { action, value: value2 } = trigger.dataset;
        if (action === "palette-prev" || action === "palette-next") {
          const current = PALETTE_ORDER.indexOf(state.settings.palette);
          const step = action === "palette-prev" ? -1 : 1;
          const next = (current + step + PALETTE_ORDER.length) % PALETTE_ORDER.length;
          actions.setPalette(PALETTE_ORDER[next]);
          syncToolbar(doc, state);
        } else if (action === "open-palette-dialog") {
          dialog?.open(trigger);
        } else if (action === "set-palette" && isPaletteKey(value2)) {
          actions.setPalette(value2);
          syncToolbar(doc, state);
          dialog?.close();
        } else if (action === "open-links-dialog") {
          linksDialog?.open(trigger);
        } else if (action === "open-aspect-ratio-dialog") {
          aspectDialog?.open(trigger);
        } else if (action === "open-display-dialog") {
          displayDialog?.open(trigger);
        } else if (action === "set-link-color" && isLinkColorKey(value2)) {
          actions.setLinkColor(value2);
          syncToolbar(doc, state);
          if (trigger.closest("dialog") === linksDialogEl) linksDialog?.close();
        } else if (action === "set-alignment" && isAlignmentKey(value2)) {
          actions.setAlignment(value2);
          syncToolbar(doc, state);
        } else if (action === "set-aspect-ratio" && isAspectRatio(value2)) {
          actions.setAspectRatio(value2);
          syncToolbar(doc, state);
          if (trigger.closest("dialog") === aspectDialogEl) aspectDialog?.close();
        }
      },
      { signal }
    );
  }

  // src/app.ts
  var STORAGE_NOTICE = "Changes can't be saved in this browser right now (storage may be full or unavailable). The diagram keeps working, but edits won't survive closing or reloading this tab \u2014 try freeing up space or leaving private/incognito mode.";
  function startApp(doc = globalThis.document) {
    const view = doc.defaultView;
    if (!view) throw new Error("startApp: document has no defaultView/window to bind to");
    const win = view;
    const controller = new AbortController();
    const { signal } = controller;
    let destroyed = false;
    const state = loadState(win.localStorage);
    let nodeRowSortable = null;
    let linkRowSortable = null;
    applyTheme(doc, state.settings.theme);
    function refresh({ rebuildNodes = true, rebuildLinks = true } = {}) {
      const nodeColor = createNodeColorResolver(state);
      const result = validate(state);
      select_default2(doc.getElementById("error")).text(result.ok ? "" : result.error ?? "");
      select_default2(doc.getElementById("io-notice")).text("");
      const saved = saveState(win.localStorage, state);
      select_default2(doc.getElementById("storage-notice")).text(saved ? "" : STORAGE_NOTICE);
      if (rebuildNodes) {
        nodeRowSortable = renderNodeEditor(
          doc,
          state,
          nodeColor,
          nodeEditorActions.moveNode,
          nodeRowSortable
        );
      }
      if (rebuildLinks) {
        linkRowSortable = renderLinkEditor(doc, state, linkEditorActions.moveLink, linkRowSortable);
      }
      if (!result.ok) return;
      renderDiagram(doc, state, nodeColor);
    }
    const nodeEditorActions = {
      addNode() {
        addNode(state);
        refresh();
      },
      deleteNode(id2) {
        deleteNode(state, id2);
        refresh();
      },
      renameNode(id2, name) {
        renameNode(state, id2, name);
        refresh({ rebuildNodes: false });
      },
      moveNode(from, to) {
        moveNode(state, from, to);
        refresh();
      }
    };
    const linkEditorActions = {
      addLink() {
        addLink(state);
        refresh();
      },
      deleteLink(index2) {
        deleteLink(state, index2);
        refresh();
      },
      updateLinkSource(index2, id2) {
        updateLink(state, index2, { source: id2 });
        refresh();
      },
      updateLinkTarget(index2, id2) {
        updateLink(state, index2, { target: id2 });
        refresh();
      },
      updateLinkValue(index2, value2) {
        updateLink(state, index2, { value: value2 });
        refresh({ rebuildNodes: false, rebuildLinks: false });
      },
      moveLink(from, to) {
        moveLink(state, from, to);
        refresh({ rebuildNodes: false });
      }
    };
    const ioActions = {
      importDiagram(imported, repairs) {
        state.nodes.length = 0;
        state.nodes.push(...imported.nodes);
        state.links.length = 0;
        state.links.push(...imported.links);
        state.settings.palette = imported.settings.palette;
        state.settings.linkColor = imported.settings.linkColor;
        state.settings.alignment = imported.settings.alignment;
        state.settings.aspectRatio = imported.settings.aspectRatio;
        syncToolbar(doc, state);
        refresh();
        let message = `Imported ${state.nodes.length} nodes, ${state.links.length} links.`;
        if (repairs.length > 0) message += ` Adjustments: ${repairs.join("; ")}.`;
        select_default2(doc.getElementById("io-notice")).text(message);
      },
      reportImportError(message) {
        select_default2(doc.getElementById("io-notice")).text(message);
      },
      reportExportError(message) {
        select_default2(doc.getElementById("io-notice")).text(message);
      },
      reportExportSuccess(filename) {
        select_default2(doc.getElementById("io-notice")).text(`Exported ${filename}.`);
      }
    };
    const themeControlActions = {
      setTheme(value2) {
        state.settings.theme = value2;
        applyTheme(doc, value2);
        refresh({ rebuildNodes: false, rebuildLinks: false });
      }
    };
    const toolbarActions = {
      setPalette(value2) {
        state.settings.palette = value2;
        refresh();
      },
      setLinkColor(value2) {
        state.settings.linkColor = value2;
        refresh();
      },
      setAlignment(value2) {
        state.settings.alignment = value2;
        refresh();
      },
      setAspectRatio(value2) {
        state.settings.aspectRatio = value2;
        refresh();
      }
    };
    setupNodeEditor(doc, nodeEditorActions, signal);
    setupLinkEditor(doc, linkEditorActions, state, signal);
    setupThemeControl(doc, state, themeControlActions, signal);
    setupToolbar(doc, state, toolbarActions, signal);
    const cancelPreviewDrag = setupPreviewResizer(doc, win, signal);
    setupIo(doc, win, state, ioActions, signal);
    refresh();
    syncToolbar(doc, state);
    syncThemeControl(doc, state);
    function destroy2() {
      if (destroyed) return;
      destroyed = true;
      controller.abort();
      cancelPreviewDrag();
      destroySortable(linkRowSortable);
      destroySortable(nodeRowSortable);
    }
    return { destroy: destroy2 };
  }

  // src/main.ts
  startApp();
})();
/*! Bundled license information:

sortablejs/modular/sortable.esm.js:
  (**!
   * Sortable 1.15.7
   * @author	RubaXa   <trash@rubaxa.org>
   * @author	owenm    <owen23355@gmail.com>
   * @license MIT
   *)
*/
