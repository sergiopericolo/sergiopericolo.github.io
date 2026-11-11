/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  GOTOMARK WIDGET — kpi
 *  Card metriche con barre di avanzamento in scala di grigi.
 *
 *  Payload atteso (blocco ```widget-kpi):
 *  {
 *    "data":   [ { "label", "value", "unit"?, "target"?, "note"? } ],
 *    "config": { "columns": 2 }
 *  }
 * ─────────────────────────────────────────────────────────────────────────────
 */
(function (global) {
  'use strict';

  var Widgets = global.Widgets;
  var h = Widgets.dom.h;

  Widgets.register('kpi', {
    dependencies: [],
    mount: function (el, data, config) {
      var items = Array.isArray(data) ? data : [];
      if (!items.length) {
        el.textContent = '// kpi: no data';
        return;
      }

      var cols = (config && config.columns) || Math.min(items.length, 3);
      var grid = h('div', 'w-kpi');
      grid.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';

      items.forEach(function (k) {
        var card = h('div', 'w-kpi-card');
        card.appendChild(h('div', 'w-kpi-label', k.label || ''));

        var value = h('div', 'w-kpi-value');
        value.appendChild(h('span', 'w-kpi-num', k.value));
        if (k.unit) value.appendChild(h('span', 'w-kpi-unit', k.unit));
        card.appendChild(value);

        if (k.target) {
          var bar = h('div', 'w-kpi-bar');
          var fill = h('div', 'w-kpi-fill');
          fill.style.width = Widgets.clampPct(k.value, k.target) + '%';
          bar.appendChild(fill);
          card.appendChild(bar);
        }

        if (k.note) card.appendChild(h('div', 'w-kpi-note', k.note));
        grid.appendChild(card);
      });

      el.appendChild(grid);
    }
  });
})(window);
