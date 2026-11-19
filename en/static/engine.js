/*
 * GoMark — engine.js
 * Mounts ```wimark-<name> {options} blocks: the Go renderer leaves them as
 * <code data-wimark="name" data-opts="{…}">body</code>. Loads each WiMark's
 * dependencies, then WiMark.mount(host, name, options, body); an empty block
 * shows the WiMark's example. Typesets math only when the page has some.
 */
(function (global) {
  'use strict';

  async function boot() {
    var W = global.WiMark;
    if (!W) return;
    var blocks = Array.from(document.querySelectorAll('pre code[data-wimark]'))
      .map(function (code) { return { code: code, name: code.dataset.wimark.toLowerCase() }; });

    var names = Array.from(new Set(blocks.map(function (b) { return b.name; })));
    await Promise.all(names.map(function (name) {
      return W.load(name).catch(function (err) { console.error('[wimark] ' + name + ':', err); });
    }));

    blocks.forEach(function (b) {
      var host = document.createElement('div');
      var pre = b.code.closest('pre') || b.code;
      pre.parentNode.replaceChild(host, pre);
      W.mount(host, b.name, b.code.dataset.opts || '', b.code.textContent);
    });

    if (document.querySelector('.math')) await W.typeset();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
