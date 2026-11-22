/*
 * termstructure — spot rates h(0, t) and one-period forward rates
 * h(0, t−1, t) from a list of zero-coupon prices, and a coupon bond priced
 * on that curve with its yield to maturity.
 *   ```wimark-termstructure {"coupon": 0.04}
 *   [0.9804, 0.9573, 0.9316, 0.9036, 0.8742, 0.8438]
 *   ```
 * The body lists v(0, 1), v(0, 2), … (strictly decreasing, between 0 and 1).
 * The slider sets the annual coupon of a bond with face 100 maturing at the
 * last date. The highlight is the bond's yield, a single flat rate.
 */
WiMark.register('termstructure', {
  title: 'Term structure',
  description: 'Spot and forward rates from zero-coupon prices, and the yield of a coupon bond on the curve.',
  example: { opts: { coupon: 0.04 }, body: '[0.9804, 0.9573, 0.9316, 0.9036, 0.8742, 0.8438]' },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var V = W.list(v.items).map(Number);
    if (V.length < 2) throw new Error('termstructure: give at least two zero-coupon prices');
    V.forEach(function (p, k) {
      if (!(p > 0 && p < 1)) throw new Error('termstructure: prices must be between 0 and 1');
      if (k && !(p < V[k - 1])) throw new Error('termstructure: prices must fall with maturity (no-arbitrage)');
    });
    var P = { coupon: W.num(v.coupon, 0.04) };
    var n = V.length;
    var fix = function (x, d) { return W.fmt(x, { minimumFractionDigits: d, maximumFractionDigits: d }); };
    var pct = function (x) { return fix(x * 100, 2) + '%'; };
    var spot = V.map(function (p, k) { return Math.pow(1 / p, 1 / (k + 1)) - 1; });
    var fwd = V.map(function (p, k) { return (k ? V[k - 1] : 1) / p - 1; });

    var pane = W.pane(el, { title: say({ en: 'Term structure of interest rates', it: 'Struttura per scadenza dei tassi' }), tag: say({ en: 'interactive', it: 'interattivo' }) });
    var plot = pane.body.appendChild(h('div'));
    pane.body.appendChild(W.legend([
      { label: say({ en: 'spot rate h(0, t)', it: 'tasso a pronti h(0, t)' }), i: 0 },
      { label: say({ en: 'forward rate h(0, t−1, t)', it: 'tasso a termine h(0, t−1, t)' }), i: 1 },
      { label: say({ en: 'bond yield i*', it: 'TIR del titolo i*' }), cls: 'wm-hl' }
    ], 'line'));
    W.controls(pane.section(), P, [
      { key: 'coupon', label: say({ en: 'annual coupon rate', it: 'tasso cedolare annuo' }), min: 0, max: 0.12, step: 0.0025, format: function (x) { return fix(x * 100, 2) + '%'; } }
    ], update, 1);
    var set = W.stats(pane.section('wm-flush'), [
      { key: 'p', label: say({ en: 'bond price Σ X_h v(0, t_h)', it: 'prezzo Σ X_h v(0, t_h)' }) },
      { key: 'y', label: say({ en: 'yield to maturity', it: 'TIR' }), hl: true },
      { key: 'r', label: say({ en: 'spot range', it: 'intervallo spot' }) }
    ]);
    var data = pane.section();

    function yieldOf(price, flows) {
      var lo = -0.5, hi = 1;
      for (var t = 0; t < 100; t++) {
        var mid = (lo + hi) / 2, s = 0;
        flows.forEach(function (f, k) { s += f * Math.pow(1 + mid, -(k + 1)); });
        if (s > price) lo = mid; else hi = mid;
      }
      return (lo + hi) / 2;
    }
    function update() {
      var flows = V.map(function (_, k) { return 100 * P.coupon + (k === n - 1 ? 100 : 0); });
      var price = flows.reduce(function (a, f, k) { return a + f * V[k]; }, 0);
      var y = yieldOf(price, flows);
      var all = spot.concat(fwd, [y]);
      var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), pad = (hi - lo) * 0.15 || 0.005;
      plot.textContent = '';
      var c = W.chart(plot, { width: 680, height: 270, margin: { left: 54, right: 20 }, title: say({ en: 'rates by maturity', it: 'tassi per scadenza' }), xTitle: say({ en: 'maturity t (years)', it: 'scadenza t (anni)' }), yTitle: say({ en: 'rate', it: 'tasso' }) });
      var x = W.scale.linear([0.5, n + 0.5], [0, c.w]), yy = W.scale.linear([Math.max(lo - pad, -0.05), hi + pad], [c.h, 0]);
      c.axisY(yy, { ticks: 5, format: function (t) { return fix(t * 100, 1) + '%'; } });
      c.axisXLinear(x, { ticks: Math.min(n, 10), format: function (t) { return fix(t, 0); } });
      c.clipped(svg('line', { x1: 0, x2: c.w, y1: yy(y), y2: yy(y), class: 'wm-line wm-hl' }));
      [spot, fwd].forEach(function (s, k) {
        c.clipped(svg('path', { d: s.map(function (r, t) { return (t ? 'L' : 'M') + x(t + 1).toFixed(1) + ',' + yy(r).toFixed(1); }).join(''), class: 'wm-line ' + W.series(k) }));
        s.forEach(function (r, t) { c.dot(x(t + 1), yy(r), W.series(k), 3); });
      });
      c.label(x(0.5), yy(y), 'i* = ' + pct(y), { at: 'ne', cls: 'wm-strong' });

      set('p', fix(price, 3));
      set('y', pct(y));
      set('r', pct(Math.min.apply(null, spot)) + ' – ' + pct(Math.max.apply(null, spot)));
      data.textContent = '';
      W.dataTable(data, ['t', 'v(0, t)', 'h(0, t)', 'h(0, t−1, t)'], V.map(function (p, k) { return [String(k + 1), fix(p, 4), pct(spot[k]), pct(fwd[k])]; }));
    }
    update();
  }
});
