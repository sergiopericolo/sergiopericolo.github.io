/*
 * GoMark — search.js
 * Site search in memory. The build writes search-index.js (one entry per
 * page: url, title, section, headings with where their part of the text
 * starts, text, and where the code blocks are); this script loads it once,
 * while the browser is idle, and folds it to lowercase without accents.
 * Each keystroke is then a scan over that folded text: no network, no
 * debounce, no library.
 *
 * Query, as on GitHub:
 *   word "exact phrase" /regex/     every one must match
 *   a OR b                          either
 *   -word  -section:notes           must not match
 *   section:notes  s:notes          site section (id or title)
 *   title:x  heading:x  text:x  code:x  path:x
 *                                   x in that part; heading:x also limits
 *                                   the other terms to the part under the
 *                                   headings that match x
 *   in:title,heading,text,code,path where the plain terms look
 *   lang:go                         a code block in that language; with
 *                                   code: only those blocks
 *   has:code|math|table|image|link|quote|task|widget
 *   widget:name  is:fallback  is:original
 * A list after a qualifier (has:math,table) matches any of its items.
 *
 * Keys: ⌘K, Ctrl+K or / open; ↑ ↓ move; ↵ opens; tab completes; esc closes.
 */
(function () {
  'use strict';

  var G = window.GOMARK || { i18n: {} };
  var T = G.i18n || {};
  var MAX = 30; // results shown
  var dialog = document.querySelector('[data-search]');
  if (!dialog) return;
  var input = dialog.querySelector('.search-input');
  var list = dialog.querySelector('.search-results');
  var docs = null, loading = false, waiting = [];
  var active = 0;

  var KEYS = {
    section: 'section', s: 'section', title: 'title', t: 'title', heading: 'heading', h: 'heading',
    text: 'text', code: 'code', c: 'code', path: 'path', p: 'path', lang: 'lang', language: 'lang',
    'in': 'in', has: 'has', is: 'is', widget: 'widget', w: 'widget'
  };
  var FIELDS = ['title', 'heading', 'text', 'code', 'path'];
  var FEATURES = ['code', 'math', 'table', 'image', 'link', 'quote', 'task', 'widget'];

  function fold(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function uniq(a) { return a.filter(function (v, i) { return v && a.indexOf(v) === i; }); }

  /* ─── Index ─────────────────────────────────────────────────────────── */
  // prep turns an entry into a document. Entries of earlier versions have
  // five fields and headings without offsets: they search as before.
  function prep(d) {
    var m = d[5] || {}, text = d[4] || '';
    var heads = d[3].map(function (h) {
      return { id: h[0], text: h[1], level: h[2] || 2, at: h[3] == null ? -1 : h[3], f: fold(h[1]) };
    });
    heads.forEach(function (h, j) {
      h.end = text.length;
      for (var k = j + 1; k < heads.length; k++) {
        if (heads[k].at >= 0 && heads[k].level <= h.level) { h.end = heads[k].at; break; }
      }
    });
    var code = (m.k || []).map(function (k) { return { from: k[0], to: k[1], lang: k[2] || '' }; });
    var path = m.p || d[0].replace(/\/index\.html$/, '');
    return {
      url: d[0], title: d[1], section: d[2], sid: m.s || '', path: path, text: text, heads: heads, code: code,
      langs: uniq(code.map(function (c) { return c.lang; })), feats: m.f || [], widgets: m.w || [], fallback: m.g || '',
      t: fold(d[1]), s: fold(d[2]), p: fold(path), x: fold(text)
    };
  }

  function load(then) {
    if (docs) { if (then) then(); return; }
    if (then) waiting.push(then);
    if (loading) return;
    loading = true;
    var s = document.createElement('script');
    s.src = (G.root || '') + 'search-index.js';
    s.async = true;
    s.onload = function () {
      docs = (window.GOMARK_SEARCH || []).map(prep);
      window.GOMARK_SEARCH = null;
      waiting.splice(0).forEach(function (f) { f(); });
    };
    s.onerror = function () { docs = []; waiting.splice(0).forEach(function (f) { f(); }); };
    document.head.appendChild(s);
  }

  /* ─── Query ─────────────────────────────────────────────────────────── */
  // A matcher finds one value, a folded word or phrase or a regex, in
  // folded text: next(s, from) is the next [start, end], or null.
  function matcher(value, regex) {
    if (regex) {
      try {
        var re = new RegExp(value.normalize('NFD').replace(/[̀-ͯ]/g, ''), 'gi');
        return {
          next: function (s, from) {
            re.lastIndex = from;
            var r = re.exec(s);
            if (!r) return null;
            return [r.index, r.index + Math.max(r[0].length, 1)];
          }
        };
      } catch (e) { /* not a valid regex: search it as text */ }
    }
    var v = fold(value);
    return {
      value: v,
      next: function (s, from) {
        var i = v ? s.indexOf(v, from) : -1;
        return i < 0 ? null : [i, i + v.length];
      }
    };
  }

  // parse reads the query into tokens {neg, key, value, quoted, m} grouped
  // into clauses: a clause holds the alternatives joined by OR.
  function parse(q) {
    var toks = [], i = 0, n = q.length;
    while (i < n) {
      while (i < n && /\s/.test(q[i])) i++;
      if (i >= n) break;
      var t = { neg: false, key: '', value: '', quoted: false, regex: false };
      if (q[i] === '-' && i + 1 < n && !/\s/.test(q[i + 1])) { t.neg = true; i++; }
      var k = /^([a-zA-Z]+):/.exec(q.slice(i));
      if (k && KEYS[k[1].toLowerCase()]) { t.key = KEYS[k[1].toLowerCase()]; i += k[0].length; }
      var j;
      if (q[i] === '"') {
        j = q.indexOf('"', i + 1);
        if (j < 0) j = n;
        t.value = q.slice(i + 1, j); t.quoted = true; i = j + 1;
      } else if (q[i] === '/' && (j = closing(q, i)) > i + 1) {
        t.value = q.slice(i + 1, j); t.regex = true; i = j + 1;
      } else {
        j = i;
        while (j < n && !/\s/.test(q[j])) j++;
        t.value = q.slice(i, j); i = j;
      }
      if (!t.value && !t.key) continue;
      toks.push(t);
    }
    var clauses = [], join = false;
    toks.forEach(function (t) {
      if (!t.key && !t.neg && !t.quoted && !t.regex && t.value === 'OR') { join = clauses.length > 0; return; }
      t.m = matcher(t.value, t.regex);
      t.list = t.quoted ? [fold(t.value)] : fold(t.value).split(',').filter(Boolean);
      if (join && !t.neg) clauses[clauses.length - 1].push(t);
      else clauses.push([t]);
      join = false;
    });
    return clauses;
  }

  // closing is the index of the "/" that ends a regex opened at i, or -1.
  function closing(q, i) {
    for (var j = i + 1; j < q.length; j++) {
      if (q[j] === '\\') j++;
      else if (q[j] === '/') return j;
    }
    return -1;
  }

  /* ─── Ranges: parts of a document's text, as sorted [from, to] ──────── */
  function cut(a, b) { // a ∩ b
    var out = [];
    for (var i = 0, j = 0; i < a.length && j < b.length;) {
      var from = Math.max(a[i][0], b[j][0]), to = Math.min(a[i][1], b[j][1]);
      if (from < to) out.push([from, to]);
      if (a[i][1] < b[j][1]) i++; else j++;
    }
    return out;
  }
  function minus(a, b) { // a − b
    var out = [];
    a.forEach(function (r) {
      var from = r[0];
      b.forEach(function (x) {
        if (x[1] <= from || x[0] >= r[1]) return;
        if (x[0] > from) out.push([from, x[0]]);
        from = Math.max(from, x[1]);
      });
      if (from < r[1]) out.push([from, r[1]]);
    });
    return out;
  }
  function union(a) {
    a = a.slice().sort(function (x, y) { return x[0] - y[0]; });
    var out = [];
    a.forEach(function (r) {
      var last = out[out.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else out.push([r[0], r[1]]);
    });
    return out;
  }

  // find returns the first match of m in s inside ranges, and how many
  // there are (counted up to 8).
  function find(m, s, ranges) {
    var first = -1, count = 0;
    for (var r = 0; r < ranges.length && count < 8; r++) {
      for (var at = ranges[r][0], hit; count < 8 && (hit = m.next(s, at)) && hit[0] < ranges[r][1];) {
        if (hit[1] <= ranges[r][1]) {
          if (first < 0) first = hit[0];
          count++;
        }
        at = Math.max(hit[1], hit[0] + 1);
      }
    }
    return { at: first, count: count };
  }

  // isTitle: heading j is the page's own "# Title", which the title stands for.
  function isTitle(d, j) { return j === 0 && d.heads[0].level <= 2 && d.heads[0].text === d.title; }

  function wordStart(s, i) { return i <= 0 || !/[a-z0-9]/.test(s.charAt(i - 1)); }
  function prefixOf(list, v) { return list.some(function (x) { return x === v || x.indexOf(v) === 0; }); }

  /* ─── Matching ──────────────────────────────────────────────────────── */
  // test is how one token fares on a document: a hit {score, at, head} or
  // null. ctx holds the parts of the document the plain terms look in.
  function test(t, d, ctx) {
    var v = t.list, hit;
    switch (t.key) {
      case 'section':
        return v.some(function (x) { return d.sid.indexOf(x) === 0 || d.s.indexOf(x) === 0; }) ? { score: 0 } : null;
      case 'lang':
        return v.some(function (x) { return prefixOf(d.langs, x); }) ? { score: 0 } : null;
      case 'has':
        return v.some(function (x) { return prefixOf(d.feats, x) || (x === 'heading' && d.heads.length > 1); }) ? { score: 0 } : null;
      case 'widget':
        return v.some(function (x) { return prefixOf(d.widgets, x); }) ? { score: 0 } : null;
      case 'is':
        return v.some(function (x) { return x === 'fallback' || x === 'translated' ? !!d.fallback : x === 'original' && !d.fallback; }) ? { score: 0 } : null;
      case 'in':
        return { score: 0 };
      case 'path':
        return (hit = t.m.next(d.p, 0)) ? { score: 4 } : null;
      case 'title':
        return field(t, d, ['title'], ctx);
      case 'heading':
        return field(t, d, ['heading'], ctx);
      case 'text':
        return field(t, d, ['text'], ctx);
      case 'code':
        return field(t, d, ['code'], ctx);
    }
    return field(t, d, ctx.fields, ctx);
  }

  // field looks for t.m in the given parts of d. A match in the title weighs
  // most, at the start of a word more than inside one; then the headings,
  // then the text and code, a little more for each further match.
  function field(t, d, fields, ctx) {
    var score = 0, at = -1, head = -1, i, r;
    if (fields.indexOf('title') >= 0 && !ctx.scoped && (r = t.m.next(d.t, 0))) {
      i = r[0];
      score += i === 0 ? 120 : wordStart(d.t, i) ? 70 : 30;
    }
    if (fields.indexOf('heading') >= 0) {
      for (var j = 0; j < d.heads.length; j++) {
        if (ctx.heads && ctx.heads.indexOf(j) < 0) continue;
        if (isTitle(d, j)) continue;
        if ((r = t.m.next(d.heads[j].f, 0))) { score += wordStart(d.heads[j].f, r[0]) ? 24 : 10; head = j; break; }
      }
    }
    var text = fields.indexOf('text') >= 0, code = fields.indexOf('code') >= 0;
    if (text || code) {
      var ranges = text && code ? ctx.scope : text ? minus(ctx.scope, ctx.code) : cut(ctx.scope, ctx.code);
      var f = find(t.m, d.x, ranges);
      if (f.count) {
        score += (wordStart(d.x, f.at) ? 6 : 2) + f.count - 1;
        at = f.at;
      }
    }
    if (fields.indexOf('path') >= 0 && !ctx.scoped && t.m.next(d.p, 0)) score += 4;
    return score ? { score: score, at: at, head: head } : null;
  }

  // context works out, for one document, where the plain terms look: the
  // fields of in:, the part under the headings of heading:, the blocks of
  // lang:. It is null when a heading: names no heading of the page.
  function context(d, clauses) {
    var ctx = { fields: ['title', 'heading', 'text', 'code'], scope: [[0, d.x.length]], scoped: false, heads: null };
    var langs = [];
    clauses.forEach(function (c) {
      var t = c[0];
      if (c.length > 1 || t.neg) return;
      if (t.key === 'in') {
        var f = t.list.filter(function (x) { return FIELDS.indexOf(x) >= 0; });
        if (f.length) ctx.fields = f;
      }
      if (t.key === 'lang') langs = langs.concat(t.list);
    });
    var code = d.code.filter(function (b) { return !langs.length || langs.some(function (x) { return b.lang.indexOf(x) === 0; }); });
    ctx.code = code.map(function (b) { return [b.from, b.to]; });
    for (var n = 0; n < clauses.length; n++) {
      var t = clauses[n][0];
      if (clauses[n].length > 1 || t.neg || t.key !== 'heading') continue;
      var picked = [], parts = [];
      d.heads.forEach(function (h, j) {
        if (isTitle(d, j) || !t.m.next(h.f, 0)) return;
        parts.push(h.at >= 0 ? [h.at, h.end] : [0, d.x.length]);
        d.heads.forEach(function (s, k) { // the heading and those under it
          if (k === j || (h.at >= 0 && s.at >= h.at && s.at < h.end)) picked.push(k);
        });
      });
      if (!parts.length) return null;
      ctx.scope = cut(ctx.scope, union(parts));
      ctx.heads = ctx.heads ? ctx.heads.filter(function (k) { return picked.indexOf(k) >= 0; }) : picked;
      ctx.scoped = true;
    }
    return ctx;
  }

  function search(clauses) {
    var out = [];
    var plain = clauses.some(function (c) { return c.some(function (t) { return !t.neg && !/^(section|lang|has|widget|is|in)$/.test(t.key); }); });
    // Several plain words that make up the title together weigh more.
    var words = clauses.filter(function (c) { return c.length === 1 && !c[0].neg && !c[0].key && !c[0].regex; });
    var phrase = words.length > 1 ? words.map(function (c) { return c[0].m.value; }).join(' ') : '';
    for (var n = 0; n < docs.length; n++) {
      var d = docs[n], ctx = context(d, clauses);
      if (!ctx) continue;
      var score = 0, at = -1, head = -1, ok = true;
      for (var c = 0; c < clauses.length && ok; c++) {
        var best = null;
        for (var a = 0; a < clauses[c].length; a++) {
          var t = clauses[c][a], r = test(t, d, ctx);
          if (t.neg) { if (r) { ok = false; break; } r = { score: 0 }; }
          if (r && (!best || r.score > best.score)) best = r;
        }
        if (!ok || !best) { ok = false; break; }
        score += best.score;
        if (best.at >= 0 && (at < 0 || best.at < at)) at = best.at;
        if (best.head >= 0 && head < 0) head = best.head;
      }
      if (!ok) continue;
      if (phrase && d.t.indexOf(phrase) >= 0) score += 80;
      // The link goes to the heading over the first match in the text.
      if (at >= 0) {
        for (var j = d.heads.length - 1; j >= 0; j--) {
          if (d.heads[j].at >= 0 && d.heads[j].at <= at) { head = j; break; }
        }
      } else if (head < 0 && ctx.heads && ctx.heads.length) head = ctx.heads[0];
      if (isTitle(d, head)) head = -1;
      out.push({ d: d, score: plain ? score : 1, at: at, head: head });
    }
    out.sort(function (a, b) {
      return b.score - a.score || (plain ? a.d.title.length - b.d.title.length : a.d.path < b.d.path ? -1 : 1);
    });
    return { total: out.length, items: out.slice(0, MAX) };
  }

  /* ─── Rendering ─────────────────────────────────────────────────────── */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  // mark appends text to node with every match wrapped in <mark>. Folding
  // keeps one character per character for composed text; when it does not,
  // the text goes in unmarked.
  function mark(node, text, ms) {
    var f = fold(text);
    if (f.length !== text.length) { node.appendChild(document.createTextNode(text)); return node; }
    var ranges = [];
    ms.forEach(function (m) {
      for (var r, at = 0; (r = m.next(f, at)) && r[1] > r[0]; at = r[1]) ranges.push(r);
    });
    ranges = union(ranges);
    var at = 0;
    ranges.forEach(function (r) {
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

  function inCode(d, at) {
    return d.code.some(function (b) { return at >= b.from && at < b.to; });
  }

  // item is one row of the list; complete, when given, is the query that
  // choosing it writes into the box instead of following a link.
  function item(cls, i, complete) {
    var a = el('a', 'search-result' + (cls ? ' ' + cls : ''));
    a.setAttribute('role', 'option');
    a.id = 'search-r' + i;
    if (complete != null) { a.href = '#'; a.dataset.complete = complete; }
    a.addEventListener('mousemove', function () { if (active !== i) select(i); });
    return a;
  }

  /* ─── Suggestions ───────────────────────────────────────────────────── */
  var HELP = [
    ['section:', 'notes', 'qSection'], ['heading:', '"setup" npm', 'qHeading'], ['title:', 'deploy', 'qTitle'],
    ['code:', 'fmt lang:go', 'qCode'], ['in:', 'title,heading', 'qIn'], ['has:', 'math', 'qHas'],
    ['path:', 'notes/2024', 'qPath'], ['"', 'exact phrase"', 'qPhrase'], ['-', 'word', 'qNot'],
    ['', 'a OR b', 'qOr'], ['/', 'regex/', 'qRegex']
  ];

  // values lists what may follow a qualifier.
  function values(key) {
    var all = [];
    switch (key) {
      case 'section': docs.forEach(function (d) { all.push(d.sid || fold(d.section)); }); break;
      case 'lang': docs.forEach(function (d) { all = all.concat(d.langs); }); break;
      case 'widget': docs.forEach(function (d) { all = all.concat(d.widgets); }); break;
      case 'has': all = FEATURES.slice(); break;
      case 'is': all = ['fallback', 'original']; break;
      case 'in': all = FIELDS.slice(); break;
    }
    return uniq(all).sort();
  }

  // suggest offers values for the qualifier being typed at the end of q.
  function suggest(q) {
    var m = /(^|\s)(-?)([a-zA-Z]+):([^\s"]*)$/.exec(q);
    if (!m || !KEYS[m[3].toLowerCase()]) return [];
    var key = KEYS[m[3].toLowerCase()];
    var typed = m[4].split(','), last = fold(typed.pop()), done = typed.map(fold);
    var head = q.slice(0, q.length - m[4].length) + (typed.length ? typed.join(',') + ',' : '');
    return values(key).filter(function (v) {
      return v.indexOf(last) === 0 && v !== last && done.indexOf(v) < 0;
    }).slice(0, 8).map(function (v) { return { label: m[3] + ':' + v, complete: head + v + ' ' }; });
  }

  function help() {
    var frag = document.createDocumentFragment();
    frag.appendChild(el('li', 'search-group', T.searchFilters || 'Filters'));
    HELP.forEach(function (h, i) {
      var a = item('search-tip', i, h[0] || h[1]);
      var code = el('span', 'search-tip-q');
      code.appendChild(el('b', null, h[0]));
      code.appendChild(document.createTextNode(h[1]));
      a.appendChild(code);
      a.appendChild(el('span', 'search-tip-d', T[h[2]] || ''));
      var li = el('li');
      li.appendChild(a);
      frag.appendChild(li);
    });
    list.appendChild(frag);
  }

  function render() {
    var q = input.value;
    var clauses = parse(q);
    active = 0;
    list.textContent = '';
    if (!q.trim()) { help(); select(0); return; }
    var frag = document.createDocumentFragment(), n = 0;
    suggest(q).forEach(function (s) {
      var a = item('search-tip search-complete', n++, s.complete);
      a.appendChild(el('span', 'search-tip-q', s.label));
      a.appendChild(el('span', 'search-tip-d', T.searchTab ? '⇥ ' + T.searchTab : '⇥'));
      var li = el('li');
      li.appendChild(a);
      frag.appendChild(li);
    });
    var res = clauses.length ? search(clauses) : { total: 0, items: [] };
    var ms = [];
    clauses.forEach(function (c) {
      c.forEach(function (t) { if (!t.neg && /^(|title|heading|text|code)$/.test(t.key)) ms.push(t.m); });
    });
    res.items.forEach(function (r) {
      var d = r.d;
      var a = item('', n++);
      a.href = (G.root || '') + d.url + (r.head >= 0 ? '#' + d.heads[r.head].id : '');
      var line = el('span', 'search-line');
      line.appendChild(mark(el('span', 'search-title'), d.title, ms));
      line.appendChild(el('span', 'search-section', d.section));
      a.appendChild(line);
      if (r.head >= 0) a.appendChild(mark(el('span', 'search-heading', '§ '), d.heads[r.head].text, ms));
      if (d.text) {
        var code = r.at >= 0 && inCode(d, r.at);
        a.appendChild(mark(el('span', 'search-snippet' + (code ? ' search-code' : '')), snippet(d.text, r.at), ms));
      }
      var li = el('li');
      li.appendChild(a);
      frag.appendChild(li);
    });
    if (!res.items.length) frag.appendChild(el('li', 'search-empty', T.noResults || 'No results'));
    else if (res.total > res.items.length) frag.appendChild(el('li', 'search-more', res.items.length + ' / ' + res.total));
    list.appendChild(frag);
    select(0);
  }

  function select(i) {
    var links = list.querySelectorAll('.search-result');
    if (!links.length) { input.removeAttribute('aria-activedescendant'); return; }
    active = (i + links.length) % links.length;
    Array.prototype.forEach.call(links, function (a, n) { a.classList.toggle('active', n === active); });
    links[active].scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', links[active].id);
  }

  // choose follows a result, or writes a suggestion into the box.
  function choose(a) {
    if (a.dataset.complete != null) {
      input.value = a.dataset.complete;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      load(render);
      return;
    }
    close();
    location.href = a.href;
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
    var links = list.querySelectorAll('.search-result');
    if (e.key === 'ArrowDown') { e.preventDefault(); select(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); select(active - 1); }
    else if (e.key === 'Enter') {
      if (links[active]) { e.preventDefault(); choose(links[active]); }
    } else if (e.key === 'Tab' && !e.shiftKey) {
      var tip = links[active] && links[active].dataset.complete != null ? links[active] : list.querySelector('[data-complete]');
      if (tip) { e.preventDefault(); choose(tip); }
    }
  });
  dialog.addEventListener('mousedown', function (e) { if (e.target === dialog) close(); });
  list.addEventListener('click', function (e) {
    var a = e.target.closest('.search-result');
    if (!a) return;
    if (a.dataset.complete != null) { e.preventDefault(); choose(a); }
    else close();
  });

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

  // For tests: the query engine on a given index.
  window.GOMARK_SEARCH_ENGINE = function (index, q) {
    docs = index.map(prep);
    return search(parse(q));
  };
})();
