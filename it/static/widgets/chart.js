/*
 * chart — bars or lines from labels and one or more series.
 *   ```wimark-chart {"type": "bar", "horizontal": true, "title": "Odds", "hl": ["Jackpot"]}
 *   {"labels": ["a", "b"], "series": [{"name": "n", "values": [3, -1]}]}
 *   ```
 * type: "bar" (default) or "line". horizontal: bars as rows, for long labels.
 * title names the chart in its head; unit labels the value axis, x the
 * category axis. hl lists the categories to highlight (one or two at most):
 * the bars or points the text talks about. Chart.js-style
 * {"labels", "datasets": [{"label", "data"}]} works too.
 */
WiMark.register('chart', {
  title: 'Chart',
  description: 'Bars or lines from labels and series; negative values grow from zero.',
  example: {
    opts: { type: 'line', title: 'Total and marginal utility', x: 'units consumed' },
    body: {
      labels: ['1', '2', '3', '4', '5', '6'],
      series: [{ name: 'total', values: [50, 94, 132, 165, 194, 219] }, { name: 'marginal', values: [50, 44, 38, 33, 29, 25] }]
    }
  },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var data = W.seriesData(v);
    var labels = data.labels, series = data.series;
    if (!series.length) throw new Error('no series: give "series": [{"name", "values"}]');
    var line = v.type === 'line';
    var horizontal = !line && v.horizontal === true;
    var hl = W.list(v.hl).map(String);
    var isHl = function (i) { return hl.indexOf(String(labels[i])) >= 0; };
    var values = [];
    series.forEach(function (s) { s.values.forEach(function (x) { if (isFinite(x)) values.push(x); }); });
    var lo = Math.min(0, Math.min.apply(null, values)), hi = Math.max(0, Math.max.apply(null, values));
    var fmt = function (x) { return W.fmt(x, { maximumFractionDigits: 3 }); };
    var tip = function (i, s) { return labels[i] + (s.name ? ' · ' + s.name : '') + ': ' + fmt(s.values[i]); };
    var cls = function (i, k) { return isHl(i) && series.length === 1 ? 'wm-hl' : W.series(k); };

    var pane = W.pane(el, { title: v.title ? say(v.title) : '', tag: say({ en: 'data', it: 'dati' }) });

    if (horizontal) {
      var longest = Math.max.apply(null, labels.map(function (l) { return W.diagram.textWidth(l, 11); }));
      var rowH = series.length * 14 + 12;
      var c = W.chart(pane.body, { width: 680, height: labels.length * rowH + 52, margin: { left: Math.min(220, longest + 18), right: 56 }, label: v.unit || '', xTitle: v.unit ? say(v.unit) : '' });
      var x = W.scale.linear([lo, hi], [0, c.w], true);
      var y = W.scale.band(labels, [0, c.h], 0.3);
      c.axisXLinear(x, { ticks: 6, format: W.compact });
      labels.forEach(function (lab, i) {
        c.add(svg('text', { x: -10, y: y(i).x + y(i).w / 2, dy: '0.32em', 'text-anchor': 'end', class: isHl(i) ? 'wm-value' : null, text: lab }));
        series.forEach(function (s, k) {
          var val = s.values[i];
          if (!isFinite(val)) return;
          var bh = y(i).w / series.length, by = y(i).x + k * bh;
          var x0 = x(Math.min(0, val)), x1 = x(Math.max(0, val));
          c.add(svg('rect', { x: x0, y: by, width: Math.max(1, x1 - x0), height: Math.max(1, bh - 1), class: 'wm-mark ' + cls(i, k) },
            svg('title', { text: tip(i, s) })));
          c.add(svg('text', { x: val < 0 ? x0 - 6 : x1 + 6, y: by + bh / 2, dy: '0.32em', 'text-anchor': val < 0 ? 'end' : 'start', class: 'wm-tag-text', text: fmt(val) }));
        });
      });
    } else {
      var c2 = W.chart(pane.body, { width: 680, height: W.num(v.height, 300), margin: { left: 52, right: 20 }, label: v.unit || '', xTitle: v.x ? say(v.x) : '', yTitle: v.unit ? say(v.unit) : '' });
      var y2 = W.scale.linear([lo, hi], [c2.h, 0], true);
      c2.axisY(y2, { ticks: 5, format: W.compact });
      if (line) {
        var x2 = function (i) { return labels.length < 2 ? c2.w / 2 : (i / (labels.length - 1)) * c2.w; };
        c2.axisX(labels, x2);
        series.forEach(function (s, k) {
          var d = '';
          s.values.forEach(function (val, i) { if (isFinite(val)) d += (d ? 'L' : 'M') + x2(i).toFixed(1) + ',' + y2(val).toFixed(1); });
          c2.clipped(svg('path', { d: d, class: 'wm-line ' + W.series(k) }));
        });
        series.forEach(function (s, k) {
          s.values.forEach(function (val, i) {
            if (!isFinite(val)) return;
            c2.dot(x2(i), y2(val), isHl(i) ? 'wm-hl' : W.series(k), isHl(i) ? 5 : 3.5).appendChild(svg('title', { text: tip(i, s) }));
          });
        });
      } else {
        var band = W.scale.band(labels, [0, c2.w], 0.3);
        c2.axisX(labels, function (i) { return band(i).x + band(i).w / 2; });
        labels.forEach(function (lab, i) {
          series.forEach(function (s, k) {
            var val = s.values[i];
            if (!isFinite(val)) return;
            var bw = band(i).w / series.length;
            var y0 = y2(Math.max(0, val)), y1 = y2(Math.min(0, val));
            c2.add(svg('rect', { x: band(i).x + k * bw + 1, y: y0, width: Math.max(1, bw - 2), height: Math.max(1, y1 - y0), class: 'wm-mark ' + cls(i, k) },
              svg('title', { text: tip(i, s) })));
          });
        });
      }
    }

    if (series.length > 1) pane.body.appendChild(W.legend(series.map(function (s, k) { return { label: s.name, i: k }; }), line ? 'line' : undefined));
    W.dataTable(pane.section(), [''].concat(series.map(function (s) { return s.name; })), labels.map(function (lab, i) {
      return [lab].concat(series.map(function (s) { return isFinite(s.values[i]) ? fmt(s.values[i]) : ''; }));
    }));
  }
});
