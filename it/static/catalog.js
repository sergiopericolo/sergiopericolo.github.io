/*
 * GoMark — catalog.js
 * The WiMark catalog: every WiMark in one list, live, each with an editor
 * (a form for its inline options, the block source as you would write it,
 * copy as Markdown) and a theme switch to check every theme.
 */
(function (global) {
  'use strict';

  var W = global.WiMark, h = W.h;
  var C = global.WIMARK_CATALOG || { widgets: [], themes: [] };
  // ?theme=<name> picks the theme, ?only=a,b shows those WiMarks, ?q=… searches.
  var params = new URLSearchParams(location.search);
  if (params.get('only')) {
    var only = params.get('only').split(',');
    C.widgets = C.widgets.filter(function (w) { return only.indexOf(w.name) >= 0; });
  }

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem('wimark-catalog:' + key);
      localStorage.setItem('wimark-catalog:' + key, value);
    } catch (e) { return null; }
    return value;
  }

  /* ─── Theme switch ──────────────────────────────────────────────────── */
  function initThemes() {
    var select = document.getElementById('cat-theme');
    var link = document.getElementById('cat-theme-css');
    var groups = {};
    C.themes.forEach(function (t) {
      var cls = t.class || 'other';
      if (!groups[cls]) { groups[cls] = h('optgroup', { label: cls }); select.appendChild(groups[cls]); }
      groups[cls].appendChild(h('option', { value: t.name }, t.name));
    });
    function apply(name) {
      var t = C.themes.filter(function (x) { return x.name === name; })[0];
      if (!t) return;
      select.value = name;
      link.href = 'static/themes/' + name + '.css';
      document.body.dataset.theme = name;
      document.body.dataset.themeClass = t.class;
      // Canvas widgets and the palette read the theme when they draw.
      link.onload = function () { remountLive(); };
    }
    select.addEventListener('change', function () { store('theme', select.value); apply(select.value); });
    apply(params.get('theme') || store('theme') || C.theme);
  }

  /* ─── Editor ────────────────────────────────────────────────────────── */
  var items = [];

  // parse reads the block source back: the fence line with its options, the body.
  function parse(src) {
    var m = /^```wimark-([\w-]+)[ \t]*(.*)\n([\s\S]*?)\n?```\s*$/.exec(src.trim());
    if (!m) throw new Error('write the block as ```wimark-<name> {options} … ```');
    return { name: m[1], opts: m[2].trim(), body: m[3] };
  }

  // field builds one form control for an inline option, from its example value.
  function field(item, key, value, choices) {
    var id = W.uid('cfg'), input;
    if (choices) {
      input = h('select', { id: id, class: 'wm-input' }, choices.map(function (c) { return h('option', { value: String(c) }, String(c)); }));
      input.value = String(value);
    } else if (typeof value === 'boolean') {
      input = h('input', { id: id, type: 'checkbox', checked: value });
    } else if (typeof value === 'number') {
      input = h('input', { id: id, type: 'number', class: 'wm-input', value: String(value), step: 'any' });
    } else if (typeof value === 'string') {
      input = h('input', { id: id, type: 'text', class: 'wm-input', value: value });
    } else return null;
    input.addEventListener(input.type === 'checkbox' || input.tagName === 'SELECT' ? 'change' : 'input', function () {
      var v = input.type === 'checkbox' ? input.checked : input.type === 'number' ? parseFloat(input.value) : input.value;
      if (choices && typeof value === 'number') v = parseFloat(v);
      if (input.type === 'number' && !isFinite(v)) return;
      var opts = item.opts ? JSON.parse(item.opts) : {};
      opts[key] = v;
      item.opts = W.inlineJSON(opts);
      item.src.value = W.source(item.name, item.opts, item.body);
      render(item);
    });
    return h('label', { class: 'cat-field', for: id }, h('span', 'cat-field-key', key), input);
  }

  function buildForm(item) {
    item.form.textContent = '';
    var choices = W.get(item.name).choices || {}, opts = {};
    try { opts = item.opts ? JSON.parse(item.opts) : {}; } catch (e) { opts = {}; }
    Object.keys(opts).forEach(function (k) {
      var f = field(item, k, opts[k], choices[k]);
      if (f) item.form.appendChild(f);
    });
    item.form.hidden = !item.form.children.length;
  }

  function render(item) {
    var ok = W.mount(item.host, item.name, item.opts, item.body);
    item.error.textContent = ok ? '' : 'the WiMark reported an error — see the preview';
    if (item.host.querySelector('.math')) W.typeset(item.host);
  }

  function reset(item) {
    var ex = W.example(W.get(item.name));
    item.opts = ex.opts;
    item.body = ex.body;
    item.src.value = W.source(item.name, item.opts, item.body);
    buildForm(item);
  }

  function makeItem(w) {
    var def = W.get(w.name);
    var art = h('article', { class: 'cat-item', id: 'wm-' + w.name });
    if (!def) {
      art.appendChild(h('div', 'wm-error', w.name + ': the script did not register a WiMark named "' + w.name + '"'));
      return { el: art, name: w.name, text: w.name };
    }
    var item = {
      name: w.name, el: art,
      text: (w.name + ' ' + (def.title || '') + ' ' + (def.description || '')).toLowerCase(),
      host: h('div', 'widget wm wm-w-' + w.name),
      form: h('div', 'cat-form'),
      src: h('textarea', { class: 'wm-input cat-json', spellcheck: 'false', rows: '10', 'aria-label': w.name + ' block' }),
      error: h('div', { class: 'cat-error', role: 'status' })
    };
    reset(item);
    item.src.rows = Math.min(18, Math.max(4, item.src.value.split('\n').length + 1));
    var timer;
    item.src.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        try {
          var b = parse(item.src.value);
          if (b.name !== item.name) throw new Error('this editor is for wimark-' + item.name);
          if (b.opts) JSON.parse(b.opts);
          item.opts = b.opts;
          item.body = b.body;
          buildForm(item);
          render(item);
        } catch (e) { item.error.textContent = e.message; }
      }, 300);
    });
    var copy = h('button', { type: 'button', class: 'wm-btn' }, 'copy markdown');
    copy.addEventListener('click', function () { W.copy(item.src.value, copy); });
    var again = h('button', { type: 'button', class: 'wm-btn' }, 'reset');
    again.addEventListener('click', function () { reset(item); render(item); });

    art.appendChild(h('header', 'cat-item-head',
      h('div', 'cat-item-name', h('code', null, 'wimark-' + w.name), def.input === 'text' ? h('span', 'wm-tag', 'text body') : null),
      h('div', 'cat-item-title', def.title || w.name),
      def.description ? h('p', 'cat-item-desc', def.description) : null));
    art.appendChild(h('div', 'cat-preview page-body', item.host));
    art.appendChild(h('details', 'cat-edit', h('summary', null, 'source'),
      item.form, item.src, h('div', 'wm-row', copy, again, h('span', 'wm-muted wm-small', 'static/' + w.path)), item.error));
    buildForm(item);
    items.push(item);
    return item;
  }

  function remountLive() {
    items.forEach(function (item) { if (item.host && item.host.querySelector('canvas, .wm-palette')) render(item); });
  }

  /* ─── Page ──────────────────────────────────────────────────────────── */
  function init() {
    initThemes();
    var nav = document.getElementById('cat-nav'), list = document.getElementById('cat-list');
    var links = h('ul');
    nav.appendChild(h('div', 'cat-nav-group', h('div', 'wm-label', 'WiMark · ' + C.widgets.length), links));
    var all = C.widgets.map(function (w) {
      var item = makeItem(w);
      item.link = h('li', null, h('a', { href: '#wm-' + w.name }, w.name));
      links.appendChild(item.link);
      list.appendChild(item.el);
      return item;
    });
    var count = document.getElementById('cat-count'), total = all.length;
    count.textContent = total + ' WiMarks';
    if (!total) {
      list.appendChild(h('div', 'wm-card wm-text', W.inline('No WiMarks yet: create one with `gomark widget new <name>` or `gomark ai widget <name> "<description>"`.')));
    }

    // Mount in order, after each WiMark's dependencies.
    all.reduce(function (p, item) {
      return item.host ? p.then(function () { return W.load(item.name).catch(function () {}); }).then(function () { render(item); }) : p;
    }, Promise.resolve());

    var search = document.getElementById('cat-search');
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase(), shown = 0;
      all.forEach(function (item) {
        var hit = !q || item.text.indexOf(q) >= 0;
        item.el.hidden = !hit;
        if (item.link) item.link.hidden = !hit;
        if (hit) shown++;
      });
      count.textContent = q ? shown + ' / ' + total + ' WiMarks' : total + ' WiMarks';
    });
    if (params.get('q')) { search.value = params.get('q'); search.dispatchEvent(new Event('input')); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
