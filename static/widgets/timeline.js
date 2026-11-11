/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  GOTOMARK WIDGET — timeline
 *  Diagramma tecnico a blocchi scalari (stile Gantt/Process).
 *
 *  Payload atteso (blocco ```widget-timeline):
 *  {
 *    "data":   [ { "period", "title", "description"?, "tags"?[] } ],
 *    "config": { "orientation": "vertical" }
 *  }
 * ─────────────────────────────────────────────────────────────────────────────
 */
(function (global) {
  'use strict';

  var Widgets = global.Widgets;
  var h = Widgets.dom.h;

  Widgets.register('timeline', {
    dependencies: [],
    mount: function (el, data, config) {
      var items = Array.isArray(data) ? data : [];
      if (!items.length) {
        el.textContent = '// timeline: no data';
        return;
      }

      var orientation = (config && config.orientation) || 'vertical';
      var list = h('ol', 'w-timeline w-timeline-' + orientation);

      items.forEach(function (t) {
        var li = h('li', 'w-timeline-item');
        li.appendChild(h('div', 'w-timeline-period', t.period || ''));
        li.appendChild(h('div', 'w-timeline-title', t.title || ''));
        if (t.description) li.appendChild(h('div', 'w-timeline-desc', t.description));

        if (Array.isArray(t.tags) && t.tags.length) {
          var tags = h('div', 'w-timeline-tags');
          t.tags.forEach(function (tag) { tags.appendChild(h('span', 'w-tag', tag)); });
          li.appendChild(tags);
        }

        list.appendChild(li);
      });

      el.appendChild(list);
    }
  });
})(window);
