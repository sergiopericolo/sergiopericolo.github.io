/*
 * GoMark — widgets.js: the WiMark runtime.
 *
 * A WiMark is registered once and mounted on every block that names it:
 *
 *   ```wimark-<name> {"inline": "JSON options"}
 *   body: JSON, or plain text for text WiMarks
 *   ```
 *
 *   WiMark.register(name, { title, description, input, defaults, example, choices, dependencies, mount })
 *   mount(el, v) builds the widget inside el. v merges, in order: defaults,
 *   the fence options, the body (see values). example is { opts, body }.
 *
 * Rules every WiMark follows (checked by the engine's tests):
 *   - no colors and no fonts in JavaScript: elements get classes, and the theme
 *     (static/themes/*.css) colors them through the --wm-* tokens;
 *   - series use WiMark.series(i), states use WiMark.state(name): identity is
 *     never color alone (labels, icons, dashes, textures);
 *   - text goes in with textContent (WiMark.h) or WiMark.inline, never as HTML.
 *
 * Yellow, the one warm touch. The theme is monochrome plus one yellow, and a
 * WiMark spends it only where the reader's eye must land — one or two things
 * at most: the mark that matters (the optimum, the equilibrium, the current
 * choice) with the class wm-hl, which works like a series class on a dot, a
 * line or a bar; a soft region of a chart with wm-hl-zone; the key readout
 * with { hl: true } in stats(); one number in text with wm-hl-text; a real
 * warning with the state 'warn'. Never a whole series, never text drawn in
 * yellow, never backgrounds, borders or decoration. When nothing deserves the
 * eye, use no yellow.
 *
 * An interactive WiMark sits in a pane(): charts in its body, sliders from
 * controls(), readouts from stats(), a verdict from note(). Chart labels go
 * through c.label() (a halo, no overlaps), curves through c.clipped() (they
 * never leave the plot). Strings follow the page language with say().
 */
(function (global) {
  'use strict';

  var G = global.GOMARK || {};
  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* ─── Strings ─────────────────────────────────────────────────────────── */
  var EN = {
    data: 'data', search: 'search', noData: 'no data', other: 'other', total: 'total',
    copy: 'copy', copied: 'copied', show: 'show', hide: 'hide', reset: 'reset', all: 'all'
  };
  function t(key) { return (G.i18n && G.i18n[key]) || EN[key] || key; }

  /* ─── DOM ─────────────────────────────────────────────────────────────── */
  function append(node, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(node, c); }); return; }
    node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  function setProps(node, props, svg) {
    if (props === null || props === undefined) return;
    if (typeof props === 'string') { node.setAttribute('class', props); return; }
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') node.setAttribute('class', v);
      else if (k === 'text') node.textContent = String(v);
      else if (k === 'on') Object.keys(v).forEach(function (ev) { node.addEventListener(ev, v[ev]); });
      else if (k === 'style') Object.keys(v).forEach(function (s) { // geometry only, never colors or fonts
        if (s.indexOf('--') === 0) node.style.setProperty(s, v[s]); else node.style[s] = v[s];
      });
      else if (k === 'data') Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
      else if (!svg && k in node && typeof v !== 'string') node[k] = v;
      else node.setAttribute(k, v === true ? '' : String(v));
    });
  }

  // h(tag, props, ...children): props is a class name or { class, text, on, style, data, attr… }.
  function h(tag, props) {
    var node = document.createElement(tag);
    setProps(node, props, false);
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }

  function svg(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    setProps(node, attrs, true);
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }

  // url keeps http(s), mailto, tel, in-page and relative links; anything else is dropped.
  function url(u) {
    u = String(u || '').trim();
    if (!u) return '';
    if (/^(https?:|mailto:|tel:)/i.test(u) || /^[#?./]/.test(u) || !/^[a-z][a-z0-9+.-]*:/i.test(u)) return u;
    return '';
  }

  // asset resolves a site path (media/x.png) against the site root.
  function asset(src) {
    src = url(src);
    if (!src || /^([a-z]+:|\/|#|\.\.?\/)/i.test(src)) return src;
    return (G.root || './') + src;
  }

  // tex wraps LaTeX for MathJax: inline \( \) or display \[ \].
  function tex(src, display) {
    return h('span', 'math math-' + (display ? 'display' : 'inline'), (display ? '\\[' : '\\(') + src + (display ? '\\]' : '\\)'));
  }

  // inline renders $math$, **bold**, *em*, `code`, ~~del~~ and [text](url) as nodes.
  var INLINE = /(\$([^$\n]+)\$|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|~~([^~]+)~~|\[([^\]]+)\]\(([^)\s]+)\))/;
  function inline(text) {
    var frag = document.createDocumentFragment();
    var rest = String(text === undefined || text === null ? '' : text);
    var m;
    while ((m = INLINE.exec(rest))) {
      if (m.index) frag.appendChild(document.createTextNode(rest.slice(0, m.index)));
      if (m[2] !== undefined) frag.appendChild(tex(m[2]));
      else if (m[3] !== undefined) frag.appendChild(h('strong', null, inline(m[3])));
      else if (m[4] !== undefined) frag.appendChild(h('em', null, inline(m[4])));
      else if (m[5] !== undefined) frag.appendChild(h('code', null, m[5]));
      else if (m[6] !== undefined) frag.appendChild(h('del', null, inline(m[6])));
      else {
        var href = url(m[8]);
        frag.appendChild(href ? h('a', { href: href }, inline(m[7])) : document.createTextNode(m[7]));
      }
      rest = rest.slice(m.index + m[0].length);
    }
    if (rest) frag.appendChild(document.createTextNode(rest));
    return frag;
  }

  // paras splits text (or a list) on blank lines into <p> elements with inline markup.
  function paras(text, cls) {
    var frag = document.createDocumentFragment();
    var parts = Array.isArray(text) ? text : String(text === undefined || text === null ? '' : text).split(/\n\s*\n/);
    parts.forEach(function (p) { if (String(p).trim()) frag.appendChild(h('p', cls || 'wm-text', inline(String(p).trim()))); });
    return frag;
  }

  // prose renders a text body: paragraphs split by blank lines, "- " and
  // "1. " lists, $$…$$ display math; inline markup inside.
  function prose(text, cls) {
    var frag = document.createDocumentFragment();
    String(text === undefined || text === null ? '' : text).split(/\n\s*\n/).forEach(function (block) {
      var b = block.trim();
      if (!b) return;
      var ls = b.split('\n');
      if (/^\$\$[\s\S]*\$\$$/.test(b)) frag.appendChild(h('div', 'wm-display', tex(b.slice(2, -2).trim(), true)));
      else if (ls.every(function (l) { return /^\s*[-*] /.test(l); })) {
        frag.appendChild(h('ul', 'wm-list', ls.map(function (l) { return h('li', null, inline(l.replace(/^\s*[-*] /, ''))); })));
      } else if (ls.every(function (l) { return /^\s*\d+[.)] /.test(l); })) {
        frag.appendChild(h('ol', 'wm-list wm-olist', ls.map(function (l) { return h('li', null, inline(l.replace(/^\s*\d+[.)] /, ''))); })));
      } else frag.appendChild(h('p', cls || 'wm-text', inline(ls.map(function (l) { return l.trim(); }).join(' '))));
    });
    return frag;
  }

  var uidN = 0;
  function uid(prefix) { uidN += 1; return (prefix || 'wm') + '-' + uidN; }

  /* ─── Values ──────────────────────────────────────────────────────────── */
  function list(x) {
    if (Array.isArray(x)) return x;
    if (x === null || x === undefined || x === '') return [];
    if (typeof x === 'object') return Object.keys(x).map(function (k) { return { key: k, value: x[k] }; });
    return [x];
  }
  function num(x, def) {
    var n = typeof x === 'number' ? x : parseFloat(x);
    return isFinite(n) ? n : (def === undefined ? 0 : def);
  }
  function fmt(n, opts) {
    if (typeof n !== 'number' || !isFinite(n)) return n === undefined || n === null ? '' : String(n);
    try { return new Intl.NumberFormat(G.lang || undefined, opts || { maximumFractionDigits: 2 }).format(n); }
    catch (e) { return String(n); }
  }
  function compact(n) { return fmt(n, { notation: 'compact', maximumFractionDigits: 1 }); }
  function date(s) {
    if (s instanceof Date) return s;
    var d = new Date(typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T00:00:00' : s);
    return isNaN(d) ? null : d;
  }
  function fmtDate(s, opts) {
    var d = date(s);
    if (!d) return s === undefined ? '' : String(s);
    try { return d.toLocaleDateString(G.lang || undefined, opts || { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch (e) { return d.toISOString().slice(0, 10); }
  }
  function extent(values) {
    var lo = Infinity, hi = -Infinity;
    values.forEach(function (v) { if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
    if (lo === Infinity) return [0, 1];
    if (lo === hi) { lo -= 1; hi += 1; }
    return [lo, hi];
  }
  function sum(values) { return values.reduce(function (a, b) { return a + num(b); }, 0); }

  // rows normalizes a list of entries: a tuple ["a", 1] gets the names in
  // keys (extra slots in .rest), an object stays, a bare value fills keys[0].
  // An object instead of a list gives one { key, value } entry per key.
  function rows(items, keys) {
    return list(items).map(function (it) {
      var o = {};
      if (Array.isArray(it)) {
        keys.forEach(function (k, i) { if (i < it.length) o[k] = it[i]; });
        o.rest = it.slice(keys.length);
        return o;
      }
      if (it && typeof it === 'object') {
        if ('key' in it && 'value' in it && Object.keys(it).length === 2 && keys[0] !== 'key') {
          o[keys[0]] = it.key;
          if (Array.isArray(it.value)) keys.slice(1).forEach(function (k, i) { o[k] = it.value[i]; });
          else o[keys[1]] = it.value;
          return o;
        }
        return it;
      }
      o[keys[0]] = it;
      return o;
    });
  }

  // lines splits a text body into its non-empty lines (right-trimmed).
  function lines(text) {
    return String(text || '').split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).filter(Boolean);
  }

  // sections splits a text body on "=== title" lines → [{ title, text }];
  // text before the first marker is a section without a title.
  function sections(text) {
    var out = [], cur = null;
    String(text || '').split('\n').forEach(function (ln) {
      var m = /^===(?:\s+(.*))?\s*$/.exec(ln);
      if (m) { cur = { title: (m[1] || '').trim(), lines: [] }; out.push(cur); return; }
      if (!cur) { cur = { title: '', lines: [] }; out.push(cur); }
      cur.lines.push(ln);
    });
    return out.map(function (s) { return { title: s.title, text: s.lines.join('\n').replace(/^\s*\n/, '').replace(/\s+$/, '') }; })
      .filter(function (s) { return s.title || s.text; });
  }

  // json writes a value the way a WiMark block reads best: on one line when
  // short, otherwise one entry per line with every entry on one line.
  function inlineJSON(v) {
    if (Array.isArray(v)) return '[' + v.map(inlineJSON).join(', ') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).map(function (k) { return JSON.stringify(k) + ': ' + inlineJSON(v[k]); }).join(', ') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  function json(v) {
    var one = inlineJSON(v);
    if (one.length <= 72 || !v || typeof v !== 'object') return one;
    if (Array.isArray(v)) return '[\n  ' + v.map(inlineJSON).join(',\n  ') + '\n]';
    return '{\n  ' + Object.keys(v).map(function (k) { return JSON.stringify(k) + ': ' + inlineJSON(v[k]); }).join(',\n  ') + '\n}';
  }

  /* ─── Tabular data ────────────────────────────────────────────────────── */
  // tabular accepts { columns, rows } (rows as arrays or objects), an array of
  // objects, or an array of arrays whose first row is the header. Columns may
  // be names or { key, label, align, format }. Numeric columns align right.
  function tabular(data) {
    var cols, rows;
    if (data && !Array.isArray(data) && typeof data === 'object' && data.rows) { cols = list(data.columns); rows = list(data.rows); }
    else { rows = list(data); cols = []; }
    if (!cols.length && rows.length) {
      if (Array.isArray(rows[0])) { cols = rows[0]; rows = rows.slice(1); }
      else cols = Object.keys(rows[0]);
    }
    cols = cols.map(function (c) {
      return c && typeof c === 'object' ? { key: c.key || c.label, label: c.label || c.key, align: c.align, format: c.format } : { key: c, label: c };
    });
    rows = rows.map(function (r) { return Array.isArray(r) ? r : cols.map(function (c) { return r ? r[c.key] : ''; }); });
    cols.forEach(function (c, i) {
      var vals = rows.map(function (r) { return r[i]; }).filter(function (v) { return v !== null && v !== undefined && v !== ''; });
      if (!c.align && vals.length && vals.every(function (v) { return typeof v === 'number'; })) c.align = 'right';
    });
    return { cols: cols, rows: rows };
  }

  // seriesData accepts { labels, series: [{ name, values }] }, Chart.js-style
  // { labels, datasets: [{ label, data }] }, [{ label, value }] or { values }.
  function seriesData(data) {
    data = data || {};
    var labels = list(data.labels), series = [];
    var src = data.series || data.datasets;
    if (src) {
      series = list(src).map(function (s, i) {
        return { name: s.name || s.label || 'series ' + (i + 1), values: list(s.values || s.data).map(function (v) { return num(v, NaN); }) };
      });
    } else if (Array.isArray(data)) {
      labels = data.map(function (d) { return d.label; });
      series = [{ name: '', values: data.map(function (d) { return num(d.value, NaN); }) }];
    } else if (data.values) {
      series = [{ name: data.name || '', values: list(data.values).map(function (v) { return num(v, NaN); }) }];
    }
    var n = Math.max.apply(null, series.map(function (s) { return s.values.length; }).concat([labels.length]));
    while (labels.length < n) labels.push(String(labels.length + 1));
    return { labels: labels, series: series };
  }

  // cell renders one value: booleans as ✓ / ✕, numbers in the page language,
  // formats "percent", "currency:EUR", "date"; text with inline markup.
  function cell(v, col) {
    var f = col && col.format;
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') {
      return h('span', { class: 'wm-bool wm-' + (v ? 'pos' : 'neg'), title: v ? 'yes' : 'no' }, v ? '✓' : '✕');
    }
    if (f === 'percent') return fmt(num(v), { style: 'percent', maximumFractionDigits: 1 });
    if (f && f.indexOf('currency:') === 0) return fmt(num(v), { style: 'currency', currency: f.slice(9) });
    if (f === 'date') return fmtDate(v);
    if (typeof v === 'number') return fmt(v);
    return inline(v);
  }

  /* ─── Theme ───────────────────────────────────────────────────────────── */
  // series(i) is the class of series i (0-based); past the 8th they fold into "other".
  function series(i) { return i >= 0 && i < 8 ? 'wm-s' + (i + 1) : 'wm-s-other'; }

  var STATES = {
    pos: 'pos', ok: 'pos', success: 'pos', good: 'pos', done: 'pos', up: 'pos', yes: 'pos', tip: 'pos',
    neg: 'neg', error: 'neg', danger: 'neg', bad: 'neg', critical: 'neg', fail: 'neg', down: 'neg', no: 'neg',
    warn: 'warn', warning: 'warn', caution: 'warn', degraded: 'warn', pending: 'warn',
    info: 'info', note: 'info', neutral: 'info', todo: 'info'
  };
  var ICONS = { pos: '✓', neg: '✕', warn: '!', info: 'i' };
  function state(name) { return STATES[String(name || '').toLowerCase()] || 'info'; }
  function icon(name) { return ICONS[state(name)]; }

  // token and font read the active theme, for canvas drawing only.
  function token(name) { return getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim(); }
  function font(kind) { return token(kind === 'sans' ? 'sans' : 'mono') || 'monospace'; }

  // textures defines the hatch patterns the --wm-fill-* tokens may point to.
  function textures() {
    if (document.getElementById('wm-defs')) return;
    var defs = svg('defs');
    for (var i = 1; i <= 8; i++) {
      defs.appendChild(svg('pattern', {
        id: 'wm-tex-' + i, patternUnits: 'userSpaceOnUse', width: 6, height: 6,
        patternTransform: 'rotate(' + (i % 2 ? 135 : 45) + ')', class: 'wm-s' + i
      }, svg('rect', { width: 6, height: 6, class: 'wm-tex-gap' }), svg('rect', { width: 2.5, height: 6, class: 'wm-tex-ink' })));
    }
    defs.appendChild(svg('marker', {
      id: 'wm-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse'
    }, svg('path', { d: 'M0,0 L10,5 L0,10 z', class: 'wm-arrow' })));
    var root = svg('svg', { id: 'wm-defs', width: 0, height: 0, 'aria-hidden': 'true', focusable: 'false' }, defs);
    root.style.position = 'absolute';
    document.body.appendChild(root);
  }

  /* ─── Storage (per page, best effort) ─────────────────────────────────── */
  function store(key, value) {
    var k = 'wimark:' + location.pathname + ':' + key;
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(k) || 'null');
      localStorage.setItem(k, JSON.stringify(value));
    } catch (e) { return null; }
    return value;
  }

  function copy(text, btn) {
    var done = function () {
      if (!btn) return;
      var label = btn.textContent;
      btn.textContent = t('copied');
      setTimeout(function () { btn.textContent = label; }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
  }

  /* ─── Scales ──────────────────────────────────────────────────────────── */
  function ticks(lo, hi, count) {
    count = count || 5;
    var span = hi - lo;
    if (!(span > 0)) return [lo];
    var step = Math.pow(10, Math.floor(Math.log10(span / count)));
    var err = (count * step) / span;
    if (err <= 0.15) step *= 10; else if (err <= 0.35) step *= 5; else if (err <= 0.75) step *= 2;
    var out = [];
    for (var v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toFixed(12) || 0);
    return out;
  }

  // linear([d0, d1], [r0, r1], nice): a function with .ticks(n) and .invert(r).
  function linear(domain, range, nice) {
    var d0 = domain[0], d1 = domain[1];
    if (nice) {
      var tk = ticks(d0, d1, 5), step = tk.length > 1 ? tk[1] - tk[0] : 1;
      d0 = Math.floor(d0 / step) * step;
      d1 = Math.ceil(d1 / step) * step;
    }
    var f = function (v) { return range[0] + ((v - d0) / (d1 - d0 || 1)) * (range[1] - range[0]); };
    f.domain = [d0, d1];
    f.ticks = function (n) { return ticks(d0, d1, n); };
    f.invert = function (r) { return d0 + ((r - range[0]) / (range[1] - range[0] || 1)) * (d1 - d0); };
    return f;
  }

  // band(keys, [r0, r1], pad): f(key) → { x, w } slots of equal width.
  function band(keys, range, pad) {
    pad = pad === undefined ? 0.2 : pad;
    var step = (range[1] - range[0]) / Math.max(keys.length, 1);
    var f = function (k) {
      var i = typeof k === 'number' ? k : keys.indexOf(k);
      return { x: range[0] + i * step + (step * pad) / 2, w: step * (1 - pad) };
    };
    f.step = step;
    return f;
  }

  /* ─── Chart frame ─────────────────────────────────────────────────────── */
  // chart(el, opts) → an SVG with a plot area. opts: width, height, margin,
  // label, title, xTitle and yTitle (axis names; the margins make room).
  // The returned c has w, h (plot size) and: add(node); clipped(node), cut to
  // the plot; axisY(y, {ticks, format}), axisX(labels, x), axisXLinear(x,
  // {ticks, format}); dot(x, y, cls, r), a point labels avoid; label(x, y,
  // text, {at, cls}), text with a halo at the first free spot; avoid(x, y, w, h).
  function chart(el, opts) {
    opts = opts || {};
    textures();
    var W = opts.width || 640, H = opts.height || 300;
    var m = Object.assign({ top: opts.yTitle ? 26 : 16, right: 16, bottom: opts.xTitle ? 46 : 32, left: 48 }, opts.margin || {});
    var root = svg('svg', { class: 'wm-chart', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opts.label || '' });
    var plot = svg('g', { transform: 'translate(' + m.left + ',' + m.top + ')' });
    var clipId = uid('wm-clip');
    root.appendChild(svg('defs', null, svg('clipPath', { id: clipId },
      svg('rect', { x: -1, y: -1, width: W - m.left - m.right + 2, height: H - m.top - m.bottom + 2 }))));
    root.appendChild(plot);
    var inner = svg('g', { 'clip-path': 'url(#' + clipId + ')' });
    var tags = svg('g', 'wm-tags');
    plot.appendChild(inner);
    var placed = [];
    var figure = h('figure', 'wm-figure');
    if (opts.title) figure.appendChild(h('figcaption', 'wm-figure-title', inline(opts.title)));
    figure.appendChild(root);
    el.appendChild(figure);
    var c = {
      svg: root, plot: plot, figure: figure, width: W, height: H, margin: m,
      w: W - m.left - m.right, h: H - m.top - m.bottom,
      add: function (node) { plot.insertBefore(node, tags.parentNode ? tags : null); return node; },
      // clipped adds a node cut to the plot area: curves and lines that run off it.
      clipped: function (node) { inner.appendChild(node); return node; },
      // dot draws a point (class: a series or wm-hl) and keeps labels off it.
      dot: function (x, y, cls, r) {
        r = r || 4;
        placed.push({ x: x - r, y: y - r, w: 2 * r, h: 2 * r });
        return c.add(svg('circle', { cx: x, cy: y, r: r, class: 'wm-dot ' + (cls || series(0)) }));
      },
      // avoid keeps labels off a box (plot coordinates).
      avoid: function (x, y, w, hh) { placed.push({ x: x, y: y, w: w, h: hh }); },
      // label writes text near (x, y) with a halo, at the first spot that
      // overlaps no other label or dot and stays inside the plot. opts.at
      // picks the first spot tried: 'ne' (default), 'se', 'nw', 'sw', 'n', 's',
      // 'e', 'w'; opts.cls adds a class (wm-strong: ink, bold).
      label: function (x, y, text, opts2) {
        opts2 = opts2 || {};
        var str = String(text), tw = textWidth(str, 11), th = 12, gap = opts2.gap || 7;
        var spots = { ne: [gap, -gap, 'start'], se: [gap, gap + 9, 'start'], nw: [-gap, -gap, 'end'], sw: [-gap, gap + 9, 'end'],
          n: [0, -gap - 3, 'middle'], s: [0, gap + 12, 'middle'], e: [gap + 2, 4, 'start'], w: [-gap - 2, 4, 'end'] };
        var order = ['ne', 'se', 'nw', 'sw', 'n', 's', 'e', 'w'];
        if (opts2.at && spots[opts2.at]) order = [opts2.at].concat(order.filter(function (k) { return k !== opts2.at; }));
        function box(k) {
          var sp = spots[k], bx = x + sp[0] - (sp[2] === 'end' ? tw : sp[2] === 'middle' ? tw / 2 : 0);
          return { x: bx - 1, y: y + sp[1] - th + 3, w: tw + 2, h: th - 1, sp: sp };
        }
        function free(b) {
          if (b.x < -m.left + 2 || b.x + b.w > c.w + m.right - 2 || b.y < -m.top + 2 || b.y + b.h > c.h - 2) return false;
          return placed.every(function (o) { return b.x + b.w <= o.x || o.x + o.w <= b.x || b.y + b.h <= o.y || o.y + o.h <= b.y; });
        }
        var best = null;
        for (var i = 0; i < order.length && !best; i++) { var b = box(order[i]); if (free(b)) best = b; }
        best = best || box(order[0]);
        placed.push(best);
        return tags.appendChild(svg('text', { x: x + best.sp[0], y: y + best.sp[1], 'text-anchor': best.sp[2],
          class: 'wm-tag-text' + (opts2.cls ? ' ' + opts2.cls : ''), text: str }));
      },
      // gridY draws horizontal gridlines and y labels for scale y.
      axisY: function (y, opts2) {
        opts2 = opts2 || {};
        var g = svg('g', 'wm-axis wm-axis-y');
        y.ticks(opts2.ticks || 5).forEach(function (v) {
          var py = y(v);
          g.appendChild(svg('line', { x1: 0, x2: c.w, y1: py, y2: py, class: v === 0 ? 'wm-baseline' : 'wm-gridline' }));
          g.appendChild(svg('text', { x: -8, y: py, dy: '0.32em', 'text-anchor': 'end', text: (opts2.format || compact)(v) }));
        });
        plot.insertBefore(g, plot.firstChild);
        return g;
      },
      axisX: function (labels, x, opts2) {
        opts2 = opts2 || {};
        var g = svg('g', 'wm-axis wm-axis-x');
        var every = Math.max(1, Math.ceil(labels.length / (opts2.max || 12)));
        labels.forEach(function (lab, i) {
          if (i % every) return;
          var px = typeof x === 'function' ? x(i) : x[i];
          g.appendChild(svg('text', { x: px, y: c.h + 18, 'text-anchor': 'middle', text: lab }));
        });
        g.appendChild(svg('line', { x1: 0, x2: c.w, y1: c.h, y2: c.h, class: 'wm-baseline' }));
        plot.appendChild(g);
        return g;
      },
      // axisXLinear labels a continuous x scale.
      axisXLinear: function (x, opts2) {
        opts2 = opts2 || {};
        var g = svg('g', 'wm-axis wm-axis-x');
        x.ticks(opts2.ticks || 6).forEach(function (v) {
          var px = x(v);
          g.appendChild(svg('line', { x1: px, x2: px, y1: 0, y2: c.h, class: v === 0 ? 'wm-baseline' : 'wm-gridline' }));
          g.appendChild(svg('text', { x: px, y: c.h + 18, 'text-anchor': 'middle', text: (opts2.format || compact)(v) }));
        });
        plot.insertBefore(g, plot.firstChild);
        return g;
      }
    };
    plot.appendChild(tags);
    if (opts.xTitle) plot.appendChild(svg('text', { x: c.w, y: c.h + 38, 'text-anchor': 'end', class: 'wm-axis-title', text: opts.xTitle }));
    if (opts.yTitle) plot.appendChild(svg('text', { x: -m.left + 4, y: -12, class: 'wm-axis-title', text: opts.yTitle }));
    return c;
  }

  // legend(items): [{ label, i }] → swatches with labels; i is the series index.
  // kind 'line' draws a short stroke with the series dash instead of a box.
  function legend(items, kind) {
    textures();
    var ul = h('ul', 'wm-legend');
    items.forEach(function (it) {
      var cls = it.cls || series(it.i);
      var sw = kind === 'line'
        ? svg('svg', { class: 'wm-swatch-line ' + cls, viewBox: '0 0 24 12', 'aria-hidden': 'true' },
            svg('line', { x1: 1, x2: 23, y1: 6, y2: 6, class: 'wm-line' }))
        : svg('svg', { class: 'wm-swatch ' + cls, viewBox: '0 0 12 12', 'aria-hidden': 'true' },
            svg('rect', { width: 12, height: 12, rx: 3, class: 'wm-swatch-fill' }));
      ul.appendChild(h('li', null, sw, h('span', null, inline(it.label))));
    });
    return ul;
  }

  // highlight colors a code element with highlight.js when the page has it.
  function highlight(code, lang) {
    if (lang) code.className = 'language-' + lang;
    if (global.hljs && lang && global.hljs.getLanguage && global.hljs.getLanguage(lang)) {
      try { global.hljs.highlightElement(code); } catch (e) { /* plain text is fine */ }
    }
    return code;
  }

  // table(head, rows, opts) → <table class="wm-table">; cells may be nodes.
  function table(head, rows, opts) {
    opts = opts || {};
    var tbl = h('table', 'wm-table' + (opts.cls ? ' ' + opts.cls : ''));
    if (opts.caption) tbl.appendChild(h('caption', null, inline(opts.caption)));
    if (head && head.length) {
      var tr = h('tr');
      head.forEach(function (c, i) {
        tr.appendChild(h('th', { scope: 'col', class: opts.align && opts.align[i] ? 'wm-' + opts.align[i] : null }, c instanceof Node ? c : inline(c)));
      });
      tbl.appendChild(h('thead', null, tr));
    }
    var body = h('tbody');
    rows.forEach(function (row) {
      var r = h('tr');
      list(row).forEach(function (c, i) {
        var cell = h(opts.rowHeader && i === 0 ? 'th' : 'td', {
          scope: opts.rowHeader && i === 0 ? 'row' : null,
          class: opts.align && opts.align[i] ? 'wm-' + opts.align[i] : (typeof c === 'number' ? 'wm-right' : null)
        });
        append(cell, c instanceof Node ? c : (typeof c === 'number' ? fmt(c) : inline(c)));
        r.appendChild(cell);
      });
      body.appendChild(r);
    });
    tbl.appendChild(body);
    return h('div', 'wm-table-wrap', tbl);
  }

  // dataTable appends a collapsed table with the numbers behind a chart.
  function dataTable(el, head, rows) {
    el.appendChild(h('details', 'wm-data', h('summary', null, t('data')), table(head, rows)));
  }

  /* ─── Language ────────────────────────────────────────────────────────── */
  // lang is the page language; say picks { en, it, … }[lang], else en, else
  // the first entry. A plain string passes through.
  function lang() { return String(G.lang || document.documentElement.lang || 'en').slice(0, 2).toLowerCase(); }
  function say(map) {
    if (!map || typeof map !== 'object') return map === undefined || map === null ? '' : String(map);
    var l = lang();
    return map[l] !== undefined ? map[l] : map.en !== undefined ? map.en : map[Object.keys(map)[0]];
  }

  /* ─── Panes: the frame of an interactive WiMark ───────────────────────── */
  // pane(el, { title, tag }) → { root, body, section() }: a hairline frame
  // with a mono head, like a code block's tab. body holds the charts;
  // section() adds a band below it (controls, readouts, notes).
  function pane(el, opts) {
    opts = opts || {};
    var root = h('div', 'wm-pane');
    if (opts.title || opts.tag) {
      root.appendChild(h('div', 'wm-pane-head', h('span', 'wm-pane-title', inline(say(opts.title))),
        opts.tag ? h('span', 'wm-pane-tag', say(opts.tag)) : null));
    }
    var body = h('div', 'wm-pane-body');
    root.appendChild(body);
    el.appendChild(root);
    return {
      root: root, body: body,
      section: function (cls) { return root.appendChild(h('div', 'wm-pane-section' + (cls ? ' ' + cls : ''))); }
    };
  }

  // controls(host, P, specs, onChange, cols): one slider per spec
  // { key, label, min, max, step, format }, in a grid of cols columns
  // (default 2). A slider writes Number(value) into P[key], then calls onChange.
  function controls(host, P, specs, onChange, cols) {
    var grid = h('div', { class: 'wm-controls', style: { '--cols': cols || 2 } });
    specs.forEach(function (sp) {
      var f = sp.format || function (x) { return fmt(x); };
      var label = String(say(sp.label));
      var input = h('input', { type: 'range', class: 'wm-range', min: sp.min, max: sp.max, step: sp.step || 'any', value: P[sp.key], 'aria-label': label });
      var out = h('output', null, f(P[sp.key]));
      input.addEventListener('input', function () {
        P[sp.key] = Number(input.value);
        out.textContent = f(P[sp.key]);
        onChange(sp.key);
      });
      grid.appendChild(h('label', 'wm-slider', h('span', 'wm-slider-label', inline(label.replace(/ /g, '\u00a0').replace(/-/g, '\u2011'))), input, out));
    });
    host.appendChild(grid);
    return grid;
  }

  // stats(host, specs) → set(key, text): readouts in a row of hairline cells.
  // spec { key, label, hl }: hl marks the one readout that matters (yellow dot).
  function stats(host, specs) {
    var row = h('div', 'wm-stats'), outs = {};
    specs.forEach(function (sp) {
      outs[sp.key] = h('div', 'wm-stat-value', '—');
      row.appendChild(h('div', 'wm-stat' + (sp.hl ? ' wm-hl' : ''), h('div', 'wm-stat-label', inline(say(sp.label))), outs[sp.key]));
    });
    host.appendChild(row);
    return function (key, text) { if (outs[key]) outs[key].textContent = text; };
  }

  // note(host) → set(state, text): a one-line verdict with the state's icon.
  function note(host) {
    var box = h('div', 'wm-note');
    host.appendChild(box);
    return function (st, text) {
      st = state(st);
      box.className = 'wm-note wm-' + st;
      box.textContent = '';
      box.appendChild(h('span', 'wm-icon', h('span', null, ICONS[st])));
      box.appendChild(h('span', 'wm-note-text', inline(text)));
    };
  }

  /* ─── Tooltips: any element with data-tip ─────────────────────────────── */
  var tipEl = null;
  function tipShow(e) {
    var target = e.target.closest && e.target.closest('[data-tip]');
    if (!target) { if (tipEl) tipEl.hidden = true; return; }
    if (!tipEl) { tipEl = h('div', { class: 'wm-tip', role: 'tooltip' }); document.body.appendChild(tipEl); }
    tipEl.textContent = target.getAttribute('data-tip');
    tipEl.hidden = false;
    var x = e.clientX + 14, y = e.clientY + 14;
    var r = tipEl.getBoundingClientRect();
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14;
    tipEl.style.left = x + 'px';
    tipEl.style.top = y + 'px';
  }
  document.addEventListener('pointermove', tipShow, { passive: true });
  document.addEventListener('scroll', function () { if (tipEl) tipEl.hidden = true; }, { passive: true, capture: true });

  /* ─── Math: a small, safe expression compiler (no eval) ───────────────── */
  var FUNCS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
    exp: Math.exp, ln: Math.log, log: Math.log10, log2: Math.log2, floor: Math.floor, ceil: Math.ceil,
    round: Math.round, sign: Math.sign, min: Math.min, max: Math.max, pow: Math.pow, hypot: Math.hypot
  };
  var CONSTS = { pi: Math.PI, e: Math.E, tau: 2 * Math.PI, phi: (1 + Math.sqrt(5)) / 2 };

  // compile("sin(x)^2 + 2x", ["x"]) → function (x) → number. Throws on bad input.
  function compile(src, vars) {
    vars = vars || ['x'];
    var toks = String(src).match(/\d*\.?\d+(?:e[+-]?\d+)?|[A-Za-z_]\w*|\*\*|[-+*/^%(),]/g) || [];
    if (toks.join('').length !== String(src).replace(/\s+/g, '').length) throw new Error('unexpected character in ' + src);
    var pos = 0;
    function peek() { return toks[pos]; }
    function next() { return toks[pos++]; }
    function expect(tk) { if (next() !== tk) throw new Error('expected ' + tk); }
    function expr() {
      var left = term();
      while (peek() === '+' || peek() === '-') {
        var op = next(), a = left, b = term();
        left = op === '+' ? function (s) { return a(s) + b(s); } : function (s) { return a(s) - b(s); };
      }
      return left;
    }
    function term() {
      var left = unary();
      for (;;) {
        var p = peek();
        if (p === '*' || p === '/' || p === '%') {
          next();
          var a = left, b = unary();
          left = p === '*' ? function (s) { return a(s) * b(s); } : p === '/' ? function (s) { return a(s) / b(s); } : function (s) { return a(s) % b(s); };
        } else if (p !== undefined && (/^[\d.A-Za-z_]/.test(p) || p === '(')) {
          var a2 = left, b2 = power(); // implicit product: 2x, 3(x+1)
          left = function (s) { return a2(s) * b2(s); };
        } else return left;
      }
    }
    function unary() {
      if (peek() === '-') { next(); var a = unary(); return function (s) { return -a(s); }; }
      if (peek() === '+') { next(); return unary(); }
      return power();
    }
    function power() {
      var base = primary();
      if (peek() === '^' || peek() === '**') { next(); var ex = unary(); return function (s) { return Math.pow(base(s), ex(s)); }; }
      return base;
    }
    function primary() {
      var tk = next();
      if (tk === undefined) throw new Error('unexpected end of ' + src);
      if (tk === '(') { var e = expr(); expect(')'); return e; }
      if (/^[\d.]/.test(tk)) { var n = parseFloat(tk); return function () { return n; }; }
      if (/^[A-Za-z_]/.test(tk)) {
        var name = tk.toLowerCase();
        if (FUNCS.hasOwnProperty(name)) {
          expect('(');
          var args = [];
          if (peek() !== ')') { args.push(expr()); while (peek() === ',') { next(); args.push(expr()); } }
          expect(')');
          var fn = FUNCS[name];
          return function (s) { return fn.apply(null, args.map(function (a) { return a(s); })); };
        }
        var vi = vars.indexOf(tk);
        if (vi >= 0) return function (s) { return s[vi]; };
        if (CONSTS.hasOwnProperty(name)) { var c = CONSTS[name]; return function () { return c; }; }
        throw new Error('unknown name ' + tk);
      }
      throw new Error('unexpected ' + tk);
    }
    var root = expr();
    if (pos < toks.length) throw new Error('unexpected ' + toks[pos]);
    return function () { return root(arguments); };
  }

  // value reads a number or a constant expression ("2pi", "pi/4", "1e3").
  function value(x, def) {
    if (typeof x === 'number') return x;
    if (x === undefined || x === null || x === '') return def;
    try { var n = compile(String(x), [])(); return isFinite(n) ? n : def; } catch (e) { return def; }
  }

  // plotPath samples f over [x0, x1] into an SVG path for scales sx, sy,
  // lifting the pen at gaps and jumps (tan, 1/x) instead of joining them.
  function plotPath(f, x0, x1, sx, sy, n) {
    n = n || 400;
    var d = '', pen = false, prev = NaN, H = Math.abs(sy.invert ? sy(sy.domain[0]) - sy(sy.domain[1]) : 300);
    for (var i = 0; i <= n; i++) {
      var xv = x0 + ((x1 - x0) * i) / n, yv = f(xv), py = sy(yv);
      var ok = isFinite(yv) && !(isFinite(prev) && Math.abs(py - prev) > H * 1.5);
      if (ok) { d += (pen ? ' L' : ' M') + sx(xv).toFixed(2) + ',' + Math.max(-H, Math.min(2 * H, py)).toFixed(2); pen = true; }
      else pen = false;
      prev = isFinite(yv) ? py : NaN;
    }
    return d;
  }

  // grid renders a table with optional sorting, filtering and a totals row:
  // shared by table, csv and query. opts: caption, align, sort, filter, total, zebra.
  function grid(el, head, rows, opts) {
    opts = opts || {};
    var align = (opts.align || []).slice();
    var n = Math.max(head.length, Math.max.apply(null, rows.map(function (r) { return r.length; }).concat([0])));
    for (var i = 0; i < n; i++) if (!align[i] && rows.length && rows.every(function (r) { return typeof r[i] === 'number' || r[i] === undefined || r[i] === null; })) align[i] = 'right';
    var dir = {}, sortCol = -1, query = '', wrap = h('div');
    var text = function (x) { return x instanceof Node ? x.textContent : x; };
    function draw() {
      var shown = rows.filter(function (r) { return !query || r.map(text).join(' ').toLowerCase().indexOf(query) >= 0; });
      if (sortCol >= 0) shown = shown.slice().sort(function (a, b) {
        var x = text(a[sortCol]), y = text(b[sortCol]);
        return dir[sortCol] * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true }));
      });
      var heads = head.map(function (c, i) {
        if (!opts.sort) return c;
        var b = h('button', { type: 'button', class: 'wm-sort' + (sortCol === i ? ' on' : '') }, inline(c), sortCol === i ? (dir[i] > 0 ? ' ▲' : ' ▼') : '');
        b.addEventListener('click', function () { dir[i] = sortCol === i ? -dir[i] : 1; sortCol = i; draw(); });
        return b;
      });
      var body = shown.map(function (r) { return r.map(function (x) { return x instanceof Node ? x.cloneNode(true) : cell(x); }); });
      if (opts.total) {
        body.push(head.map(function (c, i) {
          var nums = shown.map(function (r) { return r[i]; }).filter(function (x) { return typeof x === 'number'; });
          return i === 0 ? h('strong', null, t('total')) : nums.length ? h('strong', null, fmt(sum(nums))) : '';
        }));
      }
      wrap.textContent = '';
      wrap.appendChild(table(heads, body, { caption: opts.caption, align: align, cls: (opts.zebra ? 'wm-zebra' : '') + (opts.total ? ' wm-has-total' : '') }));
    }
    if (opts.filter) {
      var input = h('input', { type: 'search', class: 'wm-input wm-table-filter', placeholder: t('search'), 'aria-label': t('search') });
      input.addEventListener('input', function () { query = input.value.trim().toLowerCase(); draw(); });
      el.appendChild(input);
    }
    el.appendChild(wrap);
    draw();
  }

  // parseCSV splits CSV/TSV text (quoted fields; separator guessed when
  // omitted) into rows; numeric cells become numbers, except in the header.
  function parseCSV(text, sep) {
    text = String(text || '');
    var first = text.split('\n')[0];
    sep = sep || ['\t', ';', ',', '|'].reduce(function (b, s) { return first.split(s).length > first.split(b).length ? s : b; }, ',');
    var rows = [], row = [], cur = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (ch !== '\r') cur += ch;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.map(function (r, k) { return k === 0 ? r : r.map(function (c) { var s2 = c.trim(); return s2 !== '' && isFinite(s2) ? Number(s2) : c; }); });
  }

  // aligns maps "lcr" letters to the align classes of table().
  function aligns(spec) {
    return String(spec || '').split('').map(function (c) { return { l: 'left', c: 'center', r: 'right' }[c] || null; });
  }

  /* ─── Parts of a whole ────────────────────────────────────────────────── */
  // parts draws a pie (config.hole = 0) or a donut: shared by both WiMarks.
  function parts(el, data, config) {
    var items = list(data).map(function (d) { return { label: d.label, value: Math.max(0, num(d.value)) }; }).filter(function (d) { return d.value > 0; });
    if (config.sort !== false) items.sort(function (a, b) { return b.value - a.value; });
    if (items.length > 8) {
      var rest = items.splice(7);
      items.push({ label: t('other'), value: sum(rest.map(function (r) { return r.value; })), other: true });
    }
    var total = sum(items.map(function (d) { return d.value; })) || 1;
    var c = chart(el, { width: 420, height: 300, margin: { top: 10, right: 10, bottom: 10, left: 10 }, label: 'parts of a whole' });
    c.svg.style.maxWidth = '420px';
    var cx = c.w / 2, cy = c.h / 2, R = Math.min(cx, cy) - 4, r = config.hole === 0 ? 0 : R * 0.58, a = -Math.PI / 2;
    items.forEach(function (it, i) {
      var a1 = a + (2 * Math.PI * it.value) / total, large = a1 - a > Math.PI ? 1 : 0;
      var p = function (rad, ang) { return (cx + rad * Math.cos(ang)) + ',' + (cy + rad * Math.sin(ang)); };
      var dd = items.length === 1
        ? 'M' + p(R, 0) + ' A' + R + ',' + R + ' 0 1 1 ' + p(R, Math.PI) + ' A' + R + ',' + R + ' 0 1 1 ' + p(R, 0) + (r ? ' M' + p(r, 0) + ' A' + r + ',' + r + ' 0 1 0 ' + p(r, Math.PI) + ' A' + r + ',' + r + ' 0 1 0 ' + p(r, 0) : '') + ' Z'
        : 'M' + p(R, a) + ' A' + R + ',' + R + ' 0 ' + large + ' 1 ' + p(R, a1) + (r ? ' L' + p(r, a1) + ' A' + r + ',' + r + ' 0 ' + large + ' 0 ' + p(r, a) : ' L' + cx + ',' + cy) + ' Z';
      var pct = Math.round((100 * it.value) / total);
      c.add(svg('path', { d: dd, class: 'wm-mark ' + (it.other ? 'wm-s-other' : series(i)), 'fill-rule': 'evenodd', 'data-tip': it.label + ': ' + fmt(it.value) + ' (' + pct + '%)' }));
      if (config.labels !== 'none' && pct >= 6) {
        var mid = (a + a1) / 2, lr = r ? (R + r) / 2 : R * 0.62;
        c.add(svg('text', { x: cx + lr * Math.cos(mid), y: cy + lr * Math.sin(mid) + 4, 'text-anchor': 'middle', class: 'wm-on ' + (it.other ? 'wm-s-other' : series(i)), text: config.labels === 'value' ? compact(it.value) : pct + '%' }));
      }
      a = a1;
    });
    if (r) {
      c.add(svg('text', { x: cx, y: cy + 2, 'text-anchor': 'middle', class: 'wm-title wm-donut-total', text: config.center && config.center !== 'total' ? config.center : compact(total) }));
      if (!config.center || config.center === 'total') c.add(svg('text', { x: cx, y: cy + 20, 'text-anchor': 'middle', text: t('total') }));
    }
    el.appendChild(legend(items.map(function (it, i) { return { label: it.label + ' · ' + Math.round((100 * it.value) / total) + '%', cls: it.other ? 'wm-s-other' : series(i) }; })));
    dataTable(el, ['', '', '%'], items.map(function (it) { return [it.label, it.value, Math.round((1000 * it.value) / total) / 10]; }));
  }

  /* ─── Diagrams ────────────────────────────────────────────────────────── */
  // textWidth estimates the width of a monospace label at size px.
  function textWidth(str, size) { return String(str === undefined ? '' : str).length * (size || 12) * 0.62; }

  // layers ranks a directed graph for a layered drawing: every node gets the
  // length of the longest path reaching it (back edges of cycles are ignored),
  // then each layer is ordered by the mean position of its parents.
  function layers(ids, edges) {
    var out = {}, inc = {}, seen = {}, stack = {}, back = {};
    ids.forEach(function (id) { out[id] = []; inc[id] = []; });
    edges.forEach(function (e, k) { if (out[e.from] && out[e.to]) out[e.from].push({ to: e.to, k: k }); });
    function dfs(id) {
      seen[id] = stack[id] = true;
      out[id].forEach(function (x) {
        if (stack[x.to]) back[x.k] = true; else if (!seen[x.to]) dfs(x.to);
      });
      stack[id] = false;
    }
    ids.forEach(function (id) { if (!seen[id]) dfs(id); });
    edges.forEach(function (e, k) { if (!back[k] && inc[e.to] && out[e.from]) inc[e.to].push(e.from); });
    var rank = {};
    function r(id, guard) {
      if (rank[id] !== undefined) return rank[id];
      if (guard > ids.length) return 0;
      rank[id] = 0;
      var v = 0;
      inc[id].forEach(function (p) { v = Math.max(v, r(p, guard + 1) + 1); });
      rank[id] = v;
      return v;
    }
    ids.forEach(function (id) { r(id, 0); });
    var order = [];
    ids.forEach(function (id) { (order[rank[id]] = order[rank[id]] || []).push(id); });
    for (var L = 1; L < order.length; L++) {
      var prev = order[L - 1] || [];
      order[L] = (order[L] || []).map(function (id, i) {
        var ps = inc[id].map(function (p) { return prev.indexOf(p); }).filter(function (x) { return x >= 0; });
        return { id: id, w: ps.length ? sum(ps) / ps.length : i };
      }).sort(function (a, b) { return a.w - b.w; }).map(function (x) { return x.id; });
    }
    return { rank: rank, order: order.map(function (l) { return l || []; }), back: back };
  }

  // box draws a compartment box (title + sections of text rows) at x, y with
  // width w into parent, and returns its rectangle { x, y, w, h }.
  function box(parent, x, y, w, title, sections, opts) {
    opts = opts || {};
    var lh = 18, head = 26, hgt = head;
    sections = (sections || []).filter(function (sec) { return sec && sec.length; });
    sections.forEach(function (sec) { hgt += 8 + sec.length * lh; });
    var g = svg('g', 'wm-box');
    g.appendChild(svg('rect', { x: x, y: y, width: w, height: hgt, rx: 4, class: 'wm-node' }));
    g.appendChild(svg('rect', { x: x, y: y, width: w, height: head, rx: 4, class: 'wm-node-accent' }));
    g.appendChild(svg('rect', { x: x, y: y + head - 4, width: w, height: 4, class: 'wm-node-accent' }));
    g.appendChild(svg('text', { x: x + w / 2, y: y + 17, 'text-anchor': 'middle', class: 'wm-node-accent-text', text: title }));
    var cy = y + head;
    sections.forEach(function (sec, si) {
      if (si) g.appendChild(svg('line', { x1: x, x2: x + w, y1: cy, y2: cy, class: 'wm-edge' }));
      cy += 4;
      sec.forEach(function (row) {
        var t = svg('text', { x: x + 10, y: cy + 13, class: 'wm-node-text' });
        t.textContent = typeof row === 'string' ? row : row.text;
        if (row.right) t.appendChild(svg('tspan', { x: x + w - 10, 'text-anchor': 'end', class: 'wm-edge-text', text: row.right }));
        g.appendChild(t);
        cy += lh;
      });
      cy += 4;
    });
    parent.appendChild(g);
    return { x: x, y: y, w: w, h: hgt, cx: x + w / 2, cy: y + hgt / 2 };
  }

  // link joins two rectangles edge to edge (the nearest sides) with an
  // optional arrow, dash and label; returns the path.
  function link(parent, a, b, opts) {
    opts = opts || {};
    var dx = b.cx - a.cx, dy = b.cy - a.cy, p1, p2, d;
    if (Math.abs(dx) * (a.h + b.h) > Math.abs(dy) * (a.w + b.w)) {
      p1 = { x: dx > 0 ? a.x + a.w : a.x, y: a.cy };
      p2 = { x: dx > 0 ? b.x : b.x + b.w, y: b.cy };
      var mx = (p1.x + p2.x) / 2;
      d = 'M' + p1.x + ',' + p1.y + ' C' + mx + ',' + p1.y + ' ' + mx + ',' + p2.y + ' ' + p2.x + ',' + p2.y;
    } else {
      p1 = { x: a.cx, y: dy > 0 ? a.y + a.h : a.y };
      p2 = { x: b.cx, y: dy > 0 ? b.y : b.y + b.h };
      var my = (p1.y + p2.y) / 2;
      d = 'M' + p1.x + ',' + p1.y + ' C' + p1.x + ',' + my + ' ' + p2.x + ',' + my + ' ' + p2.x + ',' + p2.y;
    }
    var path = svg('path', { d: d, class: 'wm-edge' + (opts.dashed ? ' wm-edge-dash' : '') + (opts.arrow === false ? '' : ' wm-edge-arrow') + (opts.cls ? ' ' + opts.cls : '') });
    parent.appendChild(path);
    var mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    if (opts.label) label(parent, mid.x, mid.y, opts.label);
    if (opts.from) parent.appendChild(svg('text', { x: p1.x + (p2.x > p1.x ? 6 : p2.x < p1.x ? -6 : 6), y: p1.y + (p2.y > p1.y ? 14 : p2.y < p1.y ? -6 : -6), class: 'wm-edge-text', 'text-anchor': p2.x < p1.x ? 'end' : 'start', text: opts.from }));
    if (opts.to) parent.appendChild(svg('text', { x: p2.x + (p1.x > p2.x ? 6 : p1.x < p2.x ? -6 : 6), y: p2.y + (p1.y > p2.y ? 14 : p1.y < p2.y ? -6 : -6), class: 'wm-edge-text', 'text-anchor': p1.x < p2.x ? 'end' : 'start', text: opts.to }));
    return path;
  }

  // label writes text on a small surface plate so it stays readable over lines.
  function label(parent, x, y, text) {
    var w = textWidth(text, 10.5) + 8;
    parent.appendChild(svg('rect', { x: x - w / 2, y: y - 8, width: w, height: 16, rx: 3, class: 'wm-plate' }));
    parent.appendChild(svg('text', { x: x, y: y + 3.5, 'text-anchor': 'middle', class: 'wm-edge-text', text: text }));
  }

  /* ─── Code blocks ─────────────────────────────────────────────────────── */
  // codeBlock(code, opts) → a code panel. opts: lang, title, numbers, start,
  // marks (line numbers to highlight), copy (default true), wrap.
  function codeBlock(code, opts) {
    opts = opts || {};
    code = String(code === undefined || code === null ? '' : code).replace(/\n$/, '');
    var start = num(opts.start, 1), marks = list(opts.marks).map(Number);
    var el = h('code', opts.lang ? 'hljs language-' + opts.lang : null);
    var hl = null;
    if (global.hljs && opts.lang && global.hljs.getLanguage && global.hljs.getLanguage(opts.lang)) {
      try { hl = global.hljs.highlight(code, { language: opts.lang, ignoreIllegals: true }).value; } catch (e) { hl = null; }
    }
    // Highlighted HTML comes from highlight.js on escaped source; split it per line.
    var lines = hl !== null ? splitHighlighted(hl) : code.split('\n');
    lines.forEach(function (ln, i) {
      var n = start + i;
      var row = h('span', 'wm-code-line' + (marks.indexOf(n) >= 0 ? ' wm-mark-line' : ''));
      if (opts.numbers) row.appendChild(h('span', { class: 'wm-ln', 'aria-hidden': 'true' }, String(n)));
      var body = h('span');
      if (hl !== null) body.innerHTML = ln; else body.textContent = ln;
      row.appendChild(body);
      el.appendChild(row);
    });
    var pre = h('pre', opts.wrap ? 'wm-wrap' : null, el);
    var head = null;
    if (opts.title !== false) {
      var btn = null;
      if (opts.copy !== false) {
        btn = h('button', { type: 'button', class: 'wm-btn' }, t('copy'));
        btn.addEventListener('click', function () { copy(code, btn); });
      }
      head = h('div', 'wm-code-head', h('span', null, opts.title || opts.lang || 'text'), btn);
    }
    return h('div', 'wm-code', head, pre);
  }

  // splitHighlighted splits highlight.js HTML into lines, reopening the spans
  // that cross a line break so every line is well formed.
  function splitHighlighted(html) {
    var out = [], open = [], cur = '';
    var re = /(<span[^>]*>)|(<\/span>)|(\n)|([^<\n]+|<)/g, m;
    while ((m = re.exec(html))) {
      if (m[1]) { open.push(m[1]); cur += m[1]; }
      else if (m[2]) { open.pop(); cur += m[2]; }
      else if (m[3]) { cur += open.map(function () { return '</span>'; }).join(''); out.push(cur); cur = open.join(''); }
      else cur += m[4];
    }
    out.push(cur);
    return out;
  }

  /* ─── Scripts: widget dependencies and MathJax ────────────────────────── */
  var scripts = {};
  function loadScript(src) {
    if (!scripts[src]) {
      scripts[src] = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = resolve;
        s.onerror = function () { reject(new Error('failed to load ' + src)); };
        document.head.appendChild(s);
      });
    }
    return scripts[src];
  }

  // load resolves once the dependencies of widget name are available.
  function load(name) {
    var def = registry[name];
    return (def && def.dependencies || []).reduce(function (p, dep) {
      return p.then(function () { return global[dep.name] ? null : loadScript(dep.url); });
    }, Promise.resolve());
  }

  // typeset renders \( \) and \[ \] math inside el (the page when omitted).
  function typeset(el) {
    if (!(global.MathJax && global.MathJax.typesetPromise)) {
      global.MathJax = global.MathJax || {
        tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']] },
        options: { enableMenu: false },
        startup: { typeset: false }
      };
      return loadScript('https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js').then(function () { return typeset(el); });
    }
    return global.MathJax.typesetPromise(el ? [el] : undefined).catch(function (e) { console.error('[wimark] MathJax:', e); });
  }

  /* ─── Registry and mounting ───────────────────────────────────────────── */
  var registry = {};

  function register(name, def) {
    def.name = name;
    registry[name] = def;
  }

  function parseJSON(src, what) {
    try { return JSON.parse(src); } catch (e) { throw new Error(what + ': invalid JSON (' + e.message + ')'); }
  }

  // values merges what a block says into one object: the WiMark's defaults,
  // the fence options (a JSON object), then the body. A text WiMark
  // (input: 'text') gets the body as v.text; otherwise the body is JSON: an
  // object adds its keys, an array becomes v.items, a single value v.value.
  function values(def, opts, body) {
    var v = Object.assign({}, def.defaults || {});
    if (typeof opts === 'string') opts = opts.trim() ? parseJSON(opts, 'options') : {};
    if (!opts || typeof opts !== 'object' || Array.isArray(opts)) throw new Error('the options must be a JSON object: {"key": value}');
    Object.assign(v, opts);
    body = String(body === undefined || body === null ? '' : body).replace(/^\s*\n/, '').replace(/\s+$/, '');
    if (!body.trim()) return v;
    if (def.input === 'text') { v.text = body; return v; }
    var b = parseJSON(body, 'body');
    if (Array.isArray(b)) v.items = b;
    else if (b && typeof b === 'object') Object.assign(v, b);
    else v.value = b;
    return v;
  }

  // example is the WiMark's example as block source: { opts, body } strings.
  function example(def) {
    var ex = def.example || {};
    return {
      opts: ex.opts && Object.keys(ex.opts).length ? inlineJSON(ex.opts) : '',
      body: ex.body === undefined ? '' : typeof ex.body === 'string' ? ex.body : json(ex.body)
    };
  }

  // source writes a block as Markdown.
  function source(name, opts, body) {
    return '```wimark-' + name + (opts ? ' ' + opts : '') + '\n' + (body ? body + '\n' : '') + '```';
  }

  // mount builds WiMark name inside host from the fence options and the body
  // (strings, as written in the page); an empty block shows the example.
  function mount(host, name, opts, body) {
    var def = registry[name];
    host.textContent = '';
    host.className = 'widget wm wm-w-' + name;
    if (!def) { host.appendChild(h('div', 'wm-error', '// wimark-' + name + ': unknown WiMark')); return false; }
    try {
      if (!String(opts || '').trim() && !String(body || '').trim()) {
        var ex = example(def);
        opts = ex.opts;
        body = ex.body;
      }
      def.mount(host, values(def, opts, body));
      return true;
    } catch (err) {
      host.textContent = '';
      host.appendChild(h('div', 'wm-error', '// wimark-' + name + ': ' + err.message));
      if (global.console) console.error('[wimark] ' + name + ':', err);
      return false;
    }
  }

  var WiMark = {
    register: register, mount: mount, values: values, example: example, source: source, json: json, inlineJSON: inlineJSON,
    get: function (name) { return registry[name] || null; },
    names: function () { return Object.keys(registry); },
    t: t, lang: lang, say: say, pane: pane, controls: controls, stats: stats, note: note, h: h, svg: svg, tex: tex, inline: inline, paras: paras, prose: prose, url: url, asset: asset, uid: uid,
    list: list, rows: rows, lines: lines, sections: sections, tabular: tabular, cell: cell, seriesData: seriesData, num: num, fmt: fmt, compact: compact, date: date, fmtDate: fmtDate, extent: extent, sum: sum,
    series: series, state: state, icon: icon, token: token, font: font, textures: textures,
    store: store, copy: copy,
    ticks: ticks, scale: { linear: linear, band: band },
    chart: chart, parts: parts, legend: legend, table: table, grid: grid, parseCSV: parseCSV, aligns: aligns, dataTable: dataTable, highlight: highlight, codeBlock: codeBlock,
    plotPath: plotPath, math: { compile: compile, value: value }, load: load, typeset: typeset,
    diagram: { textWidth: textWidth, layers: layers, box: box, link: link, label: label }
  };

  global.WiMark = WiMark;
})(window);
