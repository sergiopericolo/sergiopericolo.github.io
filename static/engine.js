/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  GOTOMARK ENGINE — static/engine.js
 *  Dispatcher universale dei Widget con Lazy Loader CDN.
 *
 *  ARCHITETTURA DEL MODULO
 *  Al DOMContentLoaded il dispatcher:
 *   1. cerca tutti i <pre><code class="language-widget-*"> generati da Goldmark
 *      (il motore Go NON interpreta i blocchi: li lascia come code fence);
 *   2. legge window.Widgets (registro esposto da widgets.js) e per ogni widget
 *      presente nella pagina carica da CDN le dipendenze dichiarate in
 *      WidgetClass.dependencies, solo se non già disponibili su window;
 *   3. per ogni blocco: estrae il testo del <code>, lo parsa come JSON con
 *      chiavi radice "data" e "config", sostituisce il <pre> con un host
 *      <div class="widget widget-*"> e chiama WidgetClass.mount(host, data, config).
 *  Questo design permette di aggiungere widget senza ricompilare il motore Go:
 *  basta registrare la classe in widgets.js e usare ```widget-<nome>.
 * ─────────────────────────────────────────────────────────────────────────────
 */
(function (global) {
  'use strict';

  var WIDGET_PREFIX = 'language-widget-';

  function widgetName(className) {
    var classes = String(className || '').split(/\s+/);
    for (var i = 0; i < classes.length; i++) {
      if (classes[i].indexOf(WIDGET_PREFIX) === 0) {
        return classes[i].slice(WIDGET_PREFIX.length).toLowerCase();
      }
    }
    return null;
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('failed to load ' + url)); };
      document.head.appendChild(s);
    });
  }

  async function loadDependencies(cls) {
    var deps = (cls && cls.dependencies) || [];
    for (var i = 0; i < deps.length; i++) {
      if (global[deps[i].name]) continue;   // già presente su window
      await loadScript(deps[i].url);
    }
  }

  function parsePayload(text) {
    try {
      var p = JSON.parse(text);
      if (!p || typeof p !== 'object') return null;
      return { data: p.data, config: p.config };
    } catch (e) {
      return null;
    }
  }

  function hasMath() {
    return document.querySelectorAll('.math').length > 0;
  }

  async function ensureMath() {
    if (!hasMath()) return;
    if (global.MathJax && global.MathJax.typesetPromise) {
      try { await global.MathJax.typesetPromise(); } catch (e) { console.error('[engine] MathJax:', e); }
      return;
    }
    global.MathJax = {
      tex: {
        inlineMath: [['\\(', '\\)']],
        displayMath: [['\\[', '\\]']]
      },
      options: { enableMenu: false },
      startup: { typeset: false }
    };
    await loadScript('https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js');
    try { await global.MathJax.typesetPromise(); } catch (e) { console.error('[engine] MathJax:', e); }
  }

  async function boot() {
    var registry = global.Widgets || {};
    var blocks = Array.prototype.slice.call(
      document.querySelectorAll('pre code[class*="' + WIDGET_PREFIX + '"]')
    );

    // 1) Widget: carica SOLO le dipendenze dei widget presenti e montali.
    if (blocks.length) {
      var wanted = {};
      blocks.forEach(function (block) {
        var name = widgetName(block.className);
        var cls = typeof registry.get === 'function' ? registry.get(name) : registry[name];
        if (name && cls) wanted[name] = cls;
      });

      await Promise.all(Object.keys(wanted).map(function (name) {
        return loadDependencies(wanted[name]).catch(function (err) {
          console.error('[engine] dependency error for widget-' + name + ':', err);
        });
      }));

      blocks.forEach(function (block) {
        var name = widgetName(block.className);
        var cls = typeof registry.get === 'function' ? registry.get(name) : registry[name];
        if (!cls) return;

        var payload = parsePayload(block.textContent);
        var host = document.createElement('div');
        host.className = 'widget widget-' + name;

        var pre = block.closest('pre');
        var container = pre || block;
        container.parentNode.replaceChild(host, container);

        try {
          cls.mount(host, payload ? payload.data : {}, payload ? payload.config : {});
        } catch (err) {
          host.textContent = '// widget-' + name + ' error: ' + err.message;
          console.error('[engine] widget-' + name + ':', err);
        }
      });
    }

    // 2) Matematica: carica MathJax solo se la pagina contiene nodi .math.
    await ensureMath();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
