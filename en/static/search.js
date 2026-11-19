/*
 * GoMark — search.js
 * Site search in memory. The build writes search-index.js (one entry per
 * page: url, title, section, headings, text); this script loads it once,
 * while the browser is idle, and folds it to lowercase without accents.
 * Each keystroke is then a scan with indexOf over that folded text: no
 * network, no debounce, no library.
 *
 * Keys: ⌘K, Ctrl+K or / open; ↑ ↓ move; ↵ opens; esc closes.
 */
(function () {
  'use strict';

  var G = window.GOMARK || { i18n: {} };
  var MAX = 24; // results shown
  var dialog = document.querySelector('[data-search]');
  if (!dialog) return;
  var input = dialog.querySelector('.search-input');
  var list = dialog.querySelector('.search-results');
  var docs = null, loading = false, waiting = [];
  var shown = [], active = 0;

  function fold(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  /* ─── Index ─────────────────────────────────────────────────────────── */
  function load(then) {
    if (docs) { if (then) then(); return; }
    if (then) waiting.push(then);
    if (loading) return;
    loading = true;
    var s = document.createElement('script');
    s.src = (G.root || '') + 'search-index.js';
    s.async = true;
    s.onload = function () {
      docs = (window.GOMARK_SEARCH || []).map(function (d) {
        return {
          url: d[0], title: d[1], section: d[2], heads: d[3], text: d[4],
          t: fold(d[1]), h: d[3].map(function (x) { return fold(x[1]); }), x: fold(d[4])
        };
      });
      window.GOMARK_SEARCH = null;
      waiting.splice(0).forEach(function (f) { f(); });
    };
    s.onerror = function () { docs = []; waiting.splice(0).forEach(function (f) { f(); }); };
    document.head.appendChild(s);
  }

  /* ─── Matching ──────────────────────────────────────────────────────── */
  function wordStart(s, i) { return i === 0 || !/[a-z0-9]/.test(s.charAt(i - 1)); }

  // Every term must appear in the title, a heading or the text. A match in
  // the title weighs most, at the start of a word more than inside one.
  function search(q) {
    var phrase = fold(q.trim());
    var terms = phrase.split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    var out = [];
    for (var n = 0; n < docs.length; n++) {
      var d = docs[n], score = 0, head = -1, hit = -1;
      for (var k = 0; k < terms.length; k++) {
        var term = terms[k], s = 0, i;
        if ((i = d.t.indexOf(term)) >= 0) s += i === 0 ? 120 : wordStart(d.t, i) ? 70 : 30;
        for (var j = 0; j < d.h.length; j++) {
          if ((i = d.h[j].indexOf(term)) >= 0) {
            s += wordStart(d.h[j], i) ? 24 : 10;
            if (head < 0) head = j;
            break;
          }
        }
        if ((i = d.x.indexOf(term)) >= 0) {
          s += wordStart(d.x, i) ? 6 : 2;
          if (hit < 0) hit = i;
        }
        if (!s) { score = 0; break; }
        score += s;
      }
      if (!score) continue;
      if (terms.length > 1 && d.t.indexOf(phrase) >= 0) score += 80;
      out.push({ d: d, score: score, head: head, hit: hit });
    }
    out.sort(function (a, b) { return b.score - a.score || a.d.title.length - b.d.title.length; });
    return out.slice(0, MAX);
  }

  /* ─── Rendering ─────────────────────────────────────────────────────── */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  // mark appends text to node with every term wrapped in <mark>. Folding
  // keeps one character per character for composed text; when it does not,
  // the text goes in unmarked.
  function mark(node, text, terms) {
    var f = fold(text);
    if (f.length !== text.length) { node.appendChild(document.createTextNode(text)); return node; }
    var ranges = [];
    terms.forEach(function (term) {
      for (var i = f.indexOf(term); i >= 0; i = f.indexOf(term, i + term.length)) ranges.push([i, i + term.length]);
    });
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    var at = 0;
    ranges.forEach(function (r) {
      if (r[0] < at) return;
      node.appendChild(document.createTextNode(text.slice(at, r[0])));
      node.appendChild(el('mark', null, text.slice(r[0], r[1])));
      at = r[1];
    });
    node.appendChild(document.createTextNode(text.slice(at)));
    return node;
  }

  // snippet cuts the text around the first match, on word boundaries.
  function snippet(text, at) {
    if (at < 0) return text.slice(0, 160);
    var from = Math.max(0, at - 50), to = Math.min(text.length, at + 130);
    if (from > 0) from = text.indexOf(' ', from) + 1 || from;
    var end = text.lastIndexOf(' ', to);
    if (to < text.length && end > at) to = end;
    return (from > 0 ? '… ' : '') + text.slice(from, to) + (to < text.length ? ' …' : '');
  }

  function render() {
    var q = input.value;
    var terms = fold(q.trim()).split(/\s+/).filter(Boolean);
    shown = search(q);
    active = 0;
    list.textContent = '';
    if (!terms.length) return;
    if (!shown.length) {
      list.appendChild(el('li', 'search-empty', G.i18n.noResults || 'No results'));
      return;
    }
    var frag = document.createDocumentFragment();
    shown.forEach(function (r, i) {
      var d = r.d;
      var a = el('a', 'search-result');
      a.href = (G.root || '') + d.url + (r.head >= 0 ? '#' + d.heads[r.head][0] : '');
      a.setAttribute('role', 'option');
      a.id = 'search-r' + i;
      var line = el('span', 'search-line');
      line.appendChild(mark(el('span', 'search-title'), d.title, terms));
      line.appendChild(el('span', 'search-section', d.section));
      a.appendChild(line);
      if (r.head >= 0) a.appendChild(mark(el('span', 'search-heading', '§ '), d.heads[r.head][1], terms));
      if (d.text) a.appendChild(mark(el('span', 'search-snippet'), snippet(d.text, r.hit), terms));
      a.addEventListener('mousemove', function () { if (active !== i) select(i); });
      var li = el('li');
      li.appendChild(a);
      frag.appendChild(li);
    });
    list.appendChild(frag);
    select(0);
  }

  function select(i) {
    var links = list.querySelectorAll('.search-result');
    if (!links.length) return;
    active = (i + links.length) % links.length;
    Array.prototype.forEach.call(links, function (a, n) { a.classList.toggle('active', n === active); });
    links[active].scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', links[active].id);
  }

  /* ─── Dialog ────────────────────────────────────────────────────────── */
  function open() {
    if (!dialog.hidden) return;
    dialog.hidden = false;
    input.focus();
    input.select();
    load(render);
  }

  function close() {
    dialog.hidden = true;
  }

  input.addEventListener('input', function () { load(render); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); select(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); select(active - 1); }
    else if (e.key === 'Enter') {
      var a = list.querySelectorAll('.search-result')[active];
      if (a) { e.preventDefault(); close(); location.href = a.href; }
    }
  });
  dialog.addEventListener('mousedown', function (e) { if (e.target === dialog) close(); });
  list.addEventListener('click', function (e) { if (e.target.closest('.search-result')) close(); });

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (dialog.hidden) open(); else close();
      return;
    }
    if (e.key === 'Escape' && !dialog.hidden) { close(); return; }
    var t = e.target;
    var typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (e.key === '/' && !typing && dialog.hidden) { e.preventDefault(); open(); }
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-search-open]'), function (b) {
    b.addEventListener('click', open);
    b.addEventListener('pointerenter', function () { load(); });
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) {
      var k = b.querySelector('kbd');
      if (k) k.textContent = 'Ctrl K';
    }
  });

  // Load the index once the page is idle, so the first search is instant.
  (window.requestIdleCallback || function (f) { setTimeout(f, 1200); })(function () { load(); });
})();
