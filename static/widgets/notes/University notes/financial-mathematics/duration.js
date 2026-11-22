/*
 * duration — the price–yield curve of a coupon bond (face 100, annual
 * coupons) and its tangent, the duration approximation
 * ΔP/P ≈ −D/(1+i) · Δi.
 *   ```wimark-duration {"coupon": 0.05, "m": 10, "i": 0.04, "di": 0.02}
 *   ```
 * Sliders: coupon rate, maturity m, current yield i, rate shock Δi. The
 * highlight is the current point (i, P(i)); the readouts compare the exact
 * price change with the duration estimate.
 */
WiMark.register('duration', {
  title: 'Duration',
  description: 'Bond price against yield, Macaulay and modified duration, and the first-order price change.',
  example: { opts: { coupon: 0.05, m: 10, i: 0.04, di: 0.02 } },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var P = { coupon: W.num(v.coupon, 0.05), m: Math.round(W.num(v.m, 10)), i: W.num(v.i, 0.04), di: W.num(v.di, 0.02) };
    if (!(P.m >= 1) || P.coupon < 0) throw new Error('duration: need m ≥ 1 and coupon ≥ 0');
    var fix = function (x, d) { return W.fmt(x, { minimumFractionDigits: d, maximumFractionDigits: d }); };
    var pct = function (x) { return fix(x * 100, 2) + '%'; };
    var signed = function (x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + fix(Math.abs(x) * 100, 2) + '%'; };
    var I0 = 0, I1 = 0.15;
    function price(i) { var s = 0; for (var t = 1; t <= P.m; t++) s += (100 * P.coupon + (t === P.m ? 100 : 0)) * Math.pow(1 + i, -t); return s; }
    function dur(i) { var s = 0; for (var t = 1; t <= P.m; t++) s += t * (100 * P.coupon + (t === P.m ? 100 : 0)) * Math.pow(1 + i, -t); return s / price(i); }

    var pane = W.pane(el, { title: say({ en: 'Duration and price risk', it: 'Duration e rischio di prezzo' }), tag: say({ en: 'interactive', it: 'interattivo' }) });
    var plot = pane.body.appendChild(h('div'));
    pane.body.appendChild(W.legend([
      { label: say({ en: 'price P(i)', it: 'prezzo P(i)' }), i: 0 },
      { label: say({ en: 'duration tangent', it: 'tangente (duration)' }), i: 1 }
    ], 'line'));
    W.controls(pane.section(), P, [
      { key: 'coupon', label: say({ en: 'coupon rate', it: 'tasso cedolare' }), min: 0, max: 0.12, step: 0.005, format: pct },
      { key: 'm', label: say({ en: 'maturity m', it: 'scadenza m' }), min: 1, max: 30, step: 1, format: function (x) { return String(x); } },
      { key: 'i', label: say({ en: 'yield i', it: 'tasso i' }), min: 0.005, max: 0.1, step: 0.0025, format: pct },
      { key: 'di', label: say({ en: 'rate shock Δi', it: 'shock Δi' }), min: -0.04, max: 0.04, step: 0.0025, format: signed }
    ], update);
    var set = W.stats(pane.section('wm-flush'), [
      { key: 'p', label: 'P(i)' },
      { key: 'd', label: say({ en: 'duration D', it: 'duration D' }), hl: true },
      { key: 'ds', label: 'D* = D/(1+i)' },
      { key: 'ex', label: say({ en: 'exact ΔP/P', it: 'ΔP/P esatto' }) },
      { key: 'ap', label: say({ en: 'estimate −D*Δi', it: 'stima −D*Δi' }) }
    ]);

    function update() {
      var p0 = price(P.i), D = dur(P.i), Ds = D / (1 + P.i), slope = -Ds * p0;
      var i2 = Math.min(Math.max(P.i + P.di, I0), I1), p2 = price(i2);
      var hi = price(I0) * 1.05, lo = Math.min(price(I1), p0 + slope * (I1 - P.i)) * 0.95;
      plot.textContent = '';
      var c = W.chart(plot, { width: 680, height: 290, margin: { left: 50, right: 20 }, title: say({ en: 'bond price against yield (face 100)', it: 'prezzo del titolo rispetto al tasso (nominale 100)' }), xTitle: 'i', yTitle: 'P' });
      var x = W.scale.linear([I0, I1], [0, c.w]), y = W.scale.linear([Math.max(lo, 0), hi], [c.h, 0]);
      c.axisY(y, { ticks: 5, format: function (t) { return fix(t, 0); } });
      c.axisXLinear(x, { ticks: 6, format: function (t) { return fix(t * 100, 0) + '%'; } });
      c.clipped(svg('path', { d: W.plotPath(price, I0, I1, x, y, 240), class: 'wm-line ' + W.series(0) }));
      c.clipped(svg('line', { x1: x(I0), y1: y(p0 + slope * (I0 - P.i)), x2: x(I1), y2: y(p0 + slope * (I1 - P.i)), class: 'wm-line ' + W.series(1) }));
      if (P.di !== 0) {
        var pa = p0 + slope * (i2 - P.i);
        c.add(svg('line', { x1: x(i2), x2: x(i2), y1: y(Math.max(p2, pa)), y2: y(Math.min(p2, pa)), class: 'wm-guide' }));
        c.dot(x(i2), y(p2), W.series(0), 3.5);
        c.dot(x(i2), y(pa), W.series(1), 3.5);
        c.label(x(i2), y(pa), say({ en: 'estimate', it: 'stima' }), { at: 'sw' });
        c.label(x(i2), y(p2), say({ en: 'exact', it: 'esatto' }), { at: 'ne' });
      }
      c.dot(x(P.i), y(p0), 'wm-hl', 5);
      c.label(x(P.i), y(p0), 'P = ' + fix(p0, 2), { at: 'ne', cls: 'wm-strong' });

      set('p', fix(p0, 2));
      set('d', fix(D, 3) + ' ' + say({ en: 'yrs', it: 'anni' }));
      set('ds', fix(Ds, 3));
      set('ex', signed((p2 - p0) / p0));
      set('ap', signed(-Ds * (i2 - P.i)));
    }
    update();
  }
});
