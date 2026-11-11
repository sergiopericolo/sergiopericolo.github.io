/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  GOTOMARK ENGINE — static/widgets.js
 *  Registro dei Widget + helper condivisi.
 *
 *  API PUBBLICA (window.Widgets)
 *   - register(name, definition)  registra un widget;
 *   - get(name)                   restituisce la definizione (o null);
 *   - names()                     elenca i widget registrati;
 *   - colors()                    palette letta dalle CSS variables del tema;
 *   - dom.h(tag, cls, text)       crea un elemento DOM;
 *   - hexToRgba(hex, alpha)       converte #RRGGBB in rgba();
 *   - clampPct(value, target)     percentuale 0–100 per le barre.
 *
 *  I widget concreti vivono in static/widgets/<nome>.js e si registrano qui:
 *  per aggiungerne uno NON serve ricompilare il motore Go — basta creare il
 *  file e aggiungere il relativo <script> in templates/layout.html.
 * ─────────────────────────────────────────────────────────────────────────────
 */
(function (global) {
  'use strict';

  /* ─── DOM helper ──────────────────────────────────────────────────────── */
  function h(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
  }

  /* ─── Utility cromatiche e numeriche ──────────────────────────────────── */
  function hexToRgba(hex, alpha) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return hex;
    var n = parseInt(m[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }

  function clampPct(value, target) {
    if (!target) return 100;
    var pct = (Number(value) / Number(target)) * 100;
    if (!isFinite(pct)) return 0;
    return Math.max(0, Math.min(100, pct));
  }

  /* ─── Palette dal tema attivo ─────────────────────────────────────────── */
  function colors() {
    var style = getComputedStyle(document.documentElement);
    var read = function (name, fallback) {
      var value = style.getPropertyValue(name).trim();
      return value || fallback;
    };
    return {
      ink:      read('--ink',       '#1F2125'),
      gray:     read('--gray',      '#4D576A'),
      graySoft: read('--gray-soft', '#6C7689'),
      surface:  read('--surface',   '#CED3DE'),
      bgAlt:    read('--bg-alt',    '#CED3DE'),
      line:     read('--line',      '#969FB0'),
      lineDash: read('--line-dash', '#969FB0')
    };
  }

  /* ─── Registro ────────────────────────────────────────────────────────── */
  var registry = {};

  var Widgets = {
    register: function (name, definition) {
      registry[name] = definition;
    },
    get: function (name) {
      return registry[name] || null;
    },
    names: function () {
      return Object.keys(registry);
    },
    colors: colors,
    dom: { h: h },
    hexToRgba: hexToRgba,
    clampPct: clampPct
  };

  global.Widgets = Widgets;
})(window);
