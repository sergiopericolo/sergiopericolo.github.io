/*
 * rolling — rolling-window beta: a simulated stock whose true beta jumps
 * during a crisis, estimated by OLS on a moving window. Short windows react
 * fast but are noisy; long windows are smooth but slow.
 *   ```wimark-rolling {"window": 40, "T": 276}
 *   ```
 * The highlight is the crisis, a soft zone between its start and end.
 */
WiMark.register('rolling', {
  title: 'Rolling-window beta',
  description: 'True time-varying beta against its rolling OLS estimate for a chosen window.',
  example: { opts: { window: 40, T: 276 } },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var T = Math.max(120, Math.round(W.num(v.T, 276)));
    var P = { win: Math.round(W.num(v.window, 40)), noise: 0.04 };
    var fix = function (x, d) { return W.fmt(x, { minimumFractionDigits: d, maximumFractionDigits: d }); };
    function rng(s) {
      return function () {
        s |= 0; s = s + 0x6D2B79F5 | 0;
        var t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    var r = rng(11);
    function n01() { return Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r()); }
    var c1 = Math.round(T * 0.36), c2 = Math.round(T * 0.44), c3 = Math.round(T * 0.7);
    var trueB = [], zm = [], eps = [];
    for (var t = 0; t < T; t++) {
      trueB.push(t < c1 ? 1.1 : t < c2 ? 2.2 : t < c3 ? 1.3 : 1.0 + 0.4 * (t - c3) / (T - c3));
      zm.push(0.006 + 0.045 * n01());
      eps.push(n01());
    }

    var pane = W.pane(el, { title: say({ en: 'Rolling-window beta', it: 'Beta a finestra mobile' }), tag: say({ en: 'simulation', it: 'simulazione' }) });
    var plot = pane.body.appendChild(h('div'));
    pane.body.appendChild(W.legend([
      { label: say({ en: 'true β_t', it: 'β_t vero' }), cls: 'wm-s-other' },
      { label: say({ en: 'rolling estimate', it: 'stima mobile' }), i: 0 }
    ], 'line'));
    W.controls(pane.section(), P, [
      { key: 'win', label: say({ en: 'window (months)', it: 'finestra (mesi)' }), min: 12, max: 120, step: 1, format: function (x) { return String(x); } },
      { key: 'noise', label: say({ en: 'idiosyncratic σ_ε', it: 'σ_ε idiosincratica' }), min: 0.005, max: 0.1, step: 0.005, format: function (x) { return fix(x * 100, 1) + '%'; } }
    ], update);

    function update() {
      var zi = zm.map(function (m, k) { return trueB[k] * m + P.noise * eps[k]; });
      var est = [];
      for (var end = P.win; end <= T; end++) {
        var mm = 0, mi = 0, k;
        for (k = end - P.win; k < end; k++) { mm += zm[k]; mi += zi[k]; }
        mm /= P.win; mi /= P.win;
        var sxy = 0, sxx = 0;
        for (k = end - P.win; k < end; k++) { sxy += (zm[k] - mm) * (zi[k] - mi); sxx += (zm[k] - mm) * (zm[k] - mm); }
        est.push([end - 1, sxy / sxx]);
      }
      var lo = Math.min(0, Math.min.apply(null, est.map(function (e) { return e[1]; })));
      var hi = Math.max(2.5, Math.max.apply(null, est.map(function (e) { return e[1]; })));
      plot.textContent = '';
      var c = W.chart(plot, { width: 680, height: 280, margin: { left: 44, right: 20 }, title: say({ en: 'beta over time', it: 'beta nel tempo' }), xTitle: say({ en: 'month', it: 'mese' }), yTitle: 'β' });
      var x = W.scale.linear([0, T - 1], [0, c.w]), y = W.scale.linear([lo, hi], [c.h, 0], true);
      c.add(svg('rect', { x: x(c1), y: 0, width: x(c2) - x(c1), height: c.h, class: 'wm-hl-zone' }));
      c.axisY(y, { ticks: 5, format: function (q) { return fix(q, 1); } });
      c.axisXLinear(x, { ticks: 6, format: function (q) { return String(Math.round(q)); } });
      var d = '';
      trueB.forEach(function (b, k) { d += (k ? 'L' : 'M') + x(k).toFixed(1) + ',' + y(b).toFixed(1); });
      c.clipped(svg('path', { d: d, class: 'wm-line wm-s-other' }));
      d = '';
      est.forEach(function (e, k) { d += (k ? 'L' : 'M') + x(e[0]).toFixed(1) + ',' + y(e[1]).toFixed(1); });
      c.clipped(svg('path', { d: d, class: 'wm-line ' + W.series(0) }));
      c.avoid(x(c1), y(2.2) - 2, x(c2) - x(c1), 4);
      c.label((x(c1) + x(c2)) / 2, 0, say({ en: 'crisis', it: 'crisi' }), { at: 's' });
    }
    update();
  }
});
