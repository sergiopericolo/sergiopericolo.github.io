/*
 * GoMark — ui.js
 * Folder tree, code copy, reading time, outline scroll-spy, status bar.
 */
(function () {
  'use strict';

  var G = window.GOMARK || { i18n: {} };
  var t = function (k, fallback) { return (G.i18n && G.i18n[k]) || fallback; };

  function store(key, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(key) || 'null');
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { return null; }
  }

  /* ─── Folder tree ───────────────────────────────────────────────────── */
  function initTree() {
    var nodes = document.querySelectorAll('.tree-node.has-children');
    if (!nodes.length) return;
    var key = 'gomark-tree:' + (G.section || '');
    var saved = store(key) || {};

    function setOpen(li, open) {
      li.classList.toggle('open', open);
      var btn = li.querySelector(':scope > .tree-row > .tree-toggle');
      if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    Array.prototype.forEach.call(nodes, function (li) {
      var path = li.getAttribute('data-path');
      var onBranch = !!li.querySelector('.tree-folder.active');
      // The branch of the current folder always stays open.
      if (!onBranch && Object.prototype.hasOwnProperty.call(saved, path)) setOpen(li, !!saved[path]);

      var btn = li.querySelector(':scope > .tree-row > .tree-toggle');
      if (!btn) return;
      btn.addEventListener('click', function () {
        var open = !li.classList.contains('open');
        setOpen(li, open);
        saved[path] = open;
        store(key, saved);
      });
    });
  }

  /* ─── Content ───────────────────────────────────────────────────────── */
  function initContent() {
    var title = document.querySelector('.page-title');
    var first = document.querySelector('.page-body > h1:first-child');
    if (title && first && first.textContent.trim() === title.textContent.trim()) first.hidden = true;

    Array.prototype.forEach.call(document.querySelectorAll('.page-body table'), function (tbl) {
      if (tbl.closest('.wm')) return; // widgets lay out their own tables
      var wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      tbl.parentNode.insertBefore(wrap, tbl);
      wrap.appendChild(tbl);
    });
  }

  /* ─── Code blocks ───────────────────────────────────────────────────── */
  function initCode() {
    Array.prototype.forEach.call(document.querySelectorAll('.page-body pre > code'), function (code) {
      if (code.hasAttribute('data-wimark') || code.closest('.wm')) return; // WiMarks draw their own
      var pre = code.parentNode;
      var m = /language-([\w+#-]+)/.exec(code.className);
      var lang = m ? m[1] : 'text';

      var block = document.createElement('div');
      block.className = 'code-block';
      var head = document.createElement('div');
      head.className = 'code-head';
      var label = document.createElement('span');
      label.className = 'code-lang';
      label.textContent = lang;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy';
      btn.textContent = t('copy', 'copy');
      btn.addEventListener('click', function () {
        var done = function () {
          btn.textContent = t('copied', 'copied');
          btn.classList.add('done');
          setTimeout(function () { btn.textContent = t('copy', 'copy'); btn.classList.remove('done'); }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code.innerText).then(done, function () {});
        }
      });
      head.appendChild(label);
      head.appendChild(btn);

      // Line numbers in a gutter beside the code, never inside it: copy
      // and selection take only the code.
      var lines = code.textContent.replace(/\n$/, '').split('\n').length;
      if (lines > 1) {
        var nums = [];
        for (var i = 1; i <= lines; i++) nums.push(i);
        var gutter = document.createElement('span');
        gutter.className = 'code-gutter';
        gutter.setAttribute('aria-hidden', 'true');
        gutter.textContent = nums.join('\n');
        pre.insertBefore(gutter, code);
        pre.classList.add('has-gutter');
      }

      pre.parentNode.insertBefore(block, pre);
      block.appendChild(head);
      block.appendChild(pre);
    });
  }

  /* ─── Meta: words and reading time ──────────────────────────────────── */
  function initMeta() {
    var meta = document.querySelector('[data-page-meta]');
    var body = document.querySelector('.page-body');
    if (!meta || !body) return;
    var words = (body.innerText || '').split(/\s+/).filter(Boolean).length;
    var mins = Math.max(1, Math.round(words / 220));
    var a = document.createElement('span');
    a.textContent = words.toLocaleString(G.lang || undefined) + ' ' + t('words', 'words');
    var b = document.createElement('span');
    b.textContent = mins + ' ' + t('minRead', 'min read');
    meta.appendChild(a);
    meta.appendChild(b);
  }

  /* ─── Outline scroll-spy + status bar position ──────────────────────── */
  function initScroll() {
    var scroller = document.querySelector('.col-content .content-scroll');
    if (!scroller) return;
    var pos = document.querySelector('[data-scroll-pos]');
    var links = Array.prototype.slice.call(document.querySelectorAll('.toc-tree a[href^="#"]'));
    var targets = links.map(function (a) {
      return document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
    });

    function update() {
      // On narrow screens the window scrolls, not the column.
      var winScroll = scroller.scrollHeight <= scroller.clientHeight + 1;
      var top = winScroll ? window.scrollY : scroller.scrollTop;
      var max = winScroll ? document.documentElement.scrollHeight - window.innerHeight : scroller.scrollHeight - scroller.clientHeight;

      if (pos) {
        if (max <= 0) pos.textContent = 'all';
        else if (top <= 2) pos.textContent = 'top';
        else if (top >= max - 2) pos.textContent = 'bot';
        else pos.textContent = Math.round((top / max) * 100) + '%';
      }

      if (!links.length) return;
      var line = (winScroll ? 0 : scroller.getBoundingClientRect().top) + 96;
      var current = 0;
      targets.forEach(function (el, i) { if (el && el.getBoundingClientRect().top <= line) current = i; });
      links.forEach(function (a, i) { a.classList.toggle('active', i === current); });
    }

    scroller.addEventListener('scroll', update, { passive: true });
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  function boot() {
    initTree();
    initContent();
    initCode();
    initMeta();
    initScroll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
