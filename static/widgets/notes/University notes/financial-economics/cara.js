/*
 * cara — a CARA investor: the optimal risky weight w* = (μ − r_f) / (c σ²)
 * and the mean–variance objective O(w) = 1 + r_f + w(μ − r_f) − ½ c w² σ².
 *   ```wimark-cara {"mu": 0.08, "rf": 0.02, "sigma": 0.2, "c": 3}
 *   ```
 * Sliders move c, μ, r_f and σ; both panels follow. The highlight is w*.
 */
WiMark.register('cara', {
  title: 'CARA portfolio choice',
  description: 'Optimal risky weight and mean–variance objective under CARA utility.',
  example: { opts: { mu: 0.08, rf: 0.02, sigma: 0.2, c: 3 } },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var P = { mu: W.num(v.mu, 0.08), rf: W.num(v.rf, 0.02), sigma: W.num(v.sigma, 0.2), c: W.num(v.c, 3) };
    var fix = function (x, d) { return W.fmt(x, { minimumFractionDigits: d, maximumFractionDigits: d }); };
    var pct = function (x, d) { return fix(x * 100, d === undefined ? 1 : d) + '%'; };
    var wstar = function (c) { return (P.mu - P.rf) / (c * P.sigma * P.sigma); };
    var O = function (w) { return 1 + P.rf + w * (P.mu - P.rf) - 0.5 * P.c * w * w * P.sigma * P.sigma; };

    var pane = W.pane(el, { title: say({ en: 'Portfolio choice with CARA utility', it: 'Scelta di portafoglio con utilità CARA' }), tag: say({ en: 'interactive', it: 'interattivo' }) });
    var charts = pane.body.appendChild(h('div', { class: 'wm-grid', style: { '--cols': 2 } }));
    var left = charts.appendChild(h('div')), right = charts.appendChild(h('div'));
    W.controls(pane.section(), P, [
      { key: 'c', label: say({ en: 'risk aversion c', it: 'avversione al rischio c' }), min: 0.5, max: 10, step: 0.1, format: function (x) { return fix(x, 1); } },
      { key: 'mu', label: say({ en: 'expected return μ', it: 'rendimento atteso μ' }), min: 0, max: 0.2, step: 0.005, format: pct },
      { key: 'rf', label: say({ en: 'risk-free r_f', it: 'tasso risk-free r_f' }), min: 0, max: 0.1, step: 0.005, format: pct },
      { key: 'sigma', label: say({ en: 'volatility σ', it: 'volatilità σ' }), min: 0.05, max: 0.5, step: 0.01, format: pct }
    ], update);
    var set = W.stats(pane.section('wm-flush'), [
      { key: 'w', label: say({ en: 'w* (risky)', it: 'w* (rischioso)' }), hl: true },
      { key: 'f', label: say({ en: '1 − w* (riskless)', it: '1 − w* (non rischioso)' }) },
      { key: 'o', label: 'O(w*)' }
    ]);

    function update() {
      var ws = wstar(P.c);

      // Left: O(w) on w ∈ [−1, 3], maximum at w*.
      left.textContent = '';
      var a = W.chart(left, { width: 340, height: 260, margin: { left: 50, right: 14 }, title: say({ en: 'objective O(w), highest at w*', it: 'obiettivo O(w), massimo in w*' }), xTitle: 'w', yTitle: 'O(w)' });
      var wmin = -1, wmax = 3, omin = Infinity;
      for (var i = 0; i <= 120; i++) omin = Math.min(omin, O(wmin + (wmax - wmin) * i / 120));
      var omax = Math.max(O(Math.min(wmax, Math.max(wmin, ws))), omin + 1e-6);
      var pad = (omax - omin) * 0.12;
      var xa = W.scale.linear([wmin, wmax], [0, a.w]), ya = W.scale.linear([omin, omax + pad], [a.h, 0]);
      a.axisY(ya, { ticks: 4, format: function (t) { return fix(t, 3); } });
      a.axisXLinear(xa, { ticks: 4, format: function (t) { return pct(t, 0); } });
      a.clipped(svg('path', { d: W.plotPath(O, wmin, wmax, xa, ya, 200), class: 'wm-line ' + W.series(0) }));
      if (ws >= wmin && ws <= wmax) {
        a.add(svg('line', { x1: xa(ws), x2: xa(ws), y1: ya(O(ws)), y2: a.h, class: 'wm-guide' }));
        a.dot(xa(ws), ya(O(ws)), 'wm-hl', 5);
        a.label(xa(ws), ya(O(ws)), 'w*', { at: 'n', cls: 'wm-strong' });
      }

      // Right: w*(c) on c ∈ [0.5, 10]; the dashed line is w = 1 (all in the risky asset).
      right.textContent = '';
      var b = W.chart(right, { width: 340, height: 260, margin: { left: 50, right: 14 }, title: say({ en: 'w* against risk aversion c', it: 'w* rispetto all’avversione c' }), xTitle: 'c', yTitle: 'w*' });
      var cmin = 0.5, cmax = 10;
      var top = Math.max(1.1, wstar(cmin)), bot = Math.min(0, wstar(cmin));
      var xb = W.scale.linear([cmin, cmax], [0, b.w]), yb = W.scale.linear([bot, Math.min(top, 4)], [b.h, 0]);
      b.axisY(yb, { ticks: 4, format: function (t) { return pct(t, 0); } });
      b.axisXLinear(xb, { ticks: 5, format: function (t) { return fix(t, 0); } });
      b.add(svg('line', { x1: 0, x2: b.w, y1: yb(1), y2: yb(1), class: 'wm-guide' }));
      b.clipped(svg('path', { d: W.plotPath(wstar, cmin, cmax, xb, yb, 200), class: 'wm-line ' + W.series(0) }));
      if (ws <= Math.min(top, 4)) b.dot(xb(P.c), yb(ws), 'wm-hl', 5);
      b.label(b.w, yb(1), say({ en: 'w = 1, all risky', it: 'w = 1, tutto rischioso' }), { at: 'nw' });
      if (ws <= Math.min(top, 4)) b.label(xb(P.c), yb(ws), 'w*', { at: 'ne', cls: 'wm-strong' });

      set('w', pct(ws));
      set('f', pct(1 - ws));
      set('o', fix(O(ws), 4));
    }
    update();
  }
});
