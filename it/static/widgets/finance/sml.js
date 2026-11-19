/*
 * sml — the Security Market Line E[r] = r_f + β (E[r_M] − r_f), with assets
 * as points: the vertical gap to the line is the CAPM alpha.
 *   ```wimark-sml {"rf": 0.02, "mrp": 0.06}
 *   [["A", 0.5, 0.06], ["B", 1.3, 0.09]]
 *   ```
 * Each item is [label, beta, expected return]. Sliders move r_f and the
 * market risk premium. The highlight is the market portfolio M on the line.
 */
WiMark.register('sml', {
  title: 'Security Market Line',
  description: 'Expected return against beta; points above the line have positive alpha.',
  example: { opts: { rf: 0.02, mrp: 0.06 }, body: '[["defensive", 0.5, 0.06], ["market", 1, 0.08], ["aggressive", 1.5, 0.095], ["hedge", -0.3, 0.005]]' },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var P = { rf: W.num(v.rf, 0.02), mrp: W.num(v.mrp, 0.06) };
    var pts = W.rows(W.list(v.items), ['label', 'beta', 'ret']).map(function (r) {
      var b = Number(r.beta), e = Number(r.ret);
      if (!isFinite(b) || !isFinite(e)) throw new Error('sml: each item is [label, beta, expected return]');
      return { label: String(r.label), beta: b, ret: e };
    });
    var fix = function (x, d) { return W.fmt(x, { minimumFractionDigits: d, maximumFractionDigits: d }); };
    var pct = function (x, d) { return fix(x * 100, d === undefined ? 1 : d) + '%'; };

    var pane = W.pane(el, { title: say({ en: 'Security Market Line', it: 'Security Market Line' }), tag: say({ en: 'interactive', it: 'interattivo' }) });
    var plot = pane.body.appendChild(h('div'));
    W.controls(pane.section(), P, [
      { key: 'rf', label: say({ en: 'risk-free r_f', it: 'tasso risk-free r_f' }), min: 0, max: 0.08, step: 0.0025, format: pct },
      { key: 'mrp', label: say({ en: 'market premium', it: 'premio di mercato' }), min: 0, max: 0.12, step: 0.0025, format: pct }
    ], update);
    var table = pane.section();

    function update() {
      var sml = function (b) { return P.rf + b * P.mrp; };
      var bs = pts.map(function (p) { return p.beta; }).concat([0, 1]);
      var b0 = Math.min.apply(null, bs) - 0.25, b1 = Math.max.apply(null, bs) + 0.25;
      var ys = pts.map(function (p) { return p.ret; }).concat([sml(b0), sml(b1), 0]);
      var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), pad = (y1 - y0) * 0.1 || 0.01;
      plot.textContent = '';
      var c = W.chart(plot, { width: 680, height: 300, margin: { left: 50, right: 20 }, title: say({ en: 'expected return against market beta', it: 'rendimento atteso rispetto al beta di mercato' }), xTitle: 'β', yTitle: 'E[r]' });
      var x = W.scale.linear([b0, b1], [0, c.w]), y = W.scale.linear([y0 - pad, y1 + pad], [c.h, 0]);
      c.axisY(y, { ticks: 5, format: function (t) { return pct(t, 0); } });
      c.axisXLinear(x, { ticks: 6, format: function (t) { return fix(t, 1); } });
      c.clipped(svg('line', { x1: x(b0), y1: y(sml(b0)), x2: x(b1), y2: y(sml(b1)), class: 'wm-line ' + W.series(0) }));
      pts.forEach(function (p) {
        c.add(svg('line', { x1: x(p.beta), x2: x(p.beta), y1: y(p.ret), y2: y(sml(p.beta)), class: 'wm-guide' }));
      });
      c.dot(x(0), y(P.rf), W.series(1), 3.5);
      pts.forEach(function (p) { c.dot(x(p.beta), y(p.ret), W.series(2), 4.5); });
      c.dot(x(1), y(sml(1)), 'wm-hl', 5);
      c.label(x(1), y(sml(1)), 'M', { at: 'se', cls: 'wm-strong' });
      c.label(x(0), y(P.rf), 'r_f', { at: 'se' });
      pts.forEach(function (p) { c.label(x(p.beta), y(p.ret), p.label, { at: 'nw' }); });

      var rows = pts.map(function (p) {
        var a = p.ret - sml(p.beta), zero = Math.abs(a) < 0.0005;
        var st = W.state(zero ? 'info' : a > 0 ? 'pos' : 'neg');
        return [p.label, fix(p.beta, 2), pct(p.ret), pct(sml(p.beta)),
          h('span', { class: 'wm-row wm-' + st, style: { justifyContent: 'flex-end' } }, h('span', 'wm-icon', zero ? '=' : a > 0 ? '+' : '−'), pct(a))];
      });
      table.textContent = '';
      table.appendChild(W.table([say({ en: 'asset', it: 'titolo' }), 'β', 'E[r]', 'CAPM', 'α'], rows, { align: W.aligns('lrrrr') }));
    }
    update();
  }
});
