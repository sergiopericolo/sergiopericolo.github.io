/*
 * npv — the net present value W(i) of a cash-flow vector as a function of
 * the rate i, with its internal rates of return and Norström's test.
 *   ```wimark-npv {"i": 0.05}
 *   [-1000, 300, 400, 500, 200]
 *   ```
 * The body lists the flows X_0, X_1, … at yearly dates 0, 1, …. The slider
 * moves the valuation rate. The highlight is the IRR, where the curve crosses
 * zero; with several crossings each one is marked.
 */
WiMark.register('npv', {
  title: 'NPV and IRR',
  description: 'Net present value against the rate, internal rates of return and the cumulative-sum test.',
  example: { opts: { i: 0.05 }, body: '[-1000, 300, 400, 500, 200]' },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var X = W.list(v.items).map(Number);
    if (X.length < 2 || X.some(function (x) { return !isFinite(x); })) throw new Error('npv: the body is a list of at least two numbers, the flows at dates 0, 1, 2, …');
    var P = { i: W.num(v.i, 0.05) };
    var I1 = W.num(v.max, 0.4);
    var fix = function (x, d) { return W.fmt(x, { minimumFractionDigits: d, maximumFractionDigits: d }); };
    var pct = function (x) { return fix(x * 100, 2) + '%'; };
    function npv(i) { var s = 0; for (var k = 0; k < X.length; k++) s += X[k] * Math.pow(1 + i, -k); return s; }
    function roots() {
      var out = [], n = 2000, a = 0, fa = npv(a);
      for (var s = 1; s <= n; s++) {
        var b = I1 * s / n, fb = npv(b);
        if (fa === 0) out.push(a);
        else if (fa * fb < 0) {
          var lo = a, hi = b;
          for (var t = 0; t < 60; t++) { var mid = (lo + hi) / 2; if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid; }
          out.push((lo + hi) / 2);
        }
        a = b; fa = fb;
      }
      return out;
    }
    var cum = [], run = 0;
    X.forEach(function (x) { run += x; cum.push(run); });
    var changes = 0, last = 0;
    cum.forEach(function (s) { var sg = s > 0 ? 1 : s < 0 ? -1 : 0; if (sg && last && sg !== last) changes++; if (sg) last = sg; });
    var irr = roots();

    var pane = W.pane(el, { title: say({ en: 'Net present value and IRR', it: 'REA e TIR' }), tag: say({ en: 'interactive', it: 'interattivo' }) });
    var plot = pane.body.appendChild(h('div'));
    W.controls(pane.section(), P, [
      { key: 'i', label: say({ en: 'valuation rate i', it: 'tasso di valutazione i' }), min: 0, max: I1, step: 0.0025, format: pct }
    ], update, 1);
    var set = W.stats(pane.section('wm-flush'), [
      { key: 'v', label: 'NPV(i)' },
      { key: 'r', label: say({ en: 'IRR i*', it: 'TIR i*' }), hl: true },
      { key: 's', label: say({ en: 'sign changes of S_k', it: 'cambi di segno di S_k' }) }
    ]);
    var note = W.note(pane.section('wm-flush'));

    function update() {
      var ys = [];
      for (var k = 0; k <= 80; k++) ys.push(npv(I1 * k / 80));
      var y0 = Math.min.apply(null, ys.concat([0])), y1 = Math.max.apply(null, ys.concat([0])), pad = (y1 - y0) * 0.1 || 1;
      plot.textContent = '';
      var c = W.chart(plot, { width: 680, height: 280, margin: { left: 56, right: 20 }, title: say({ en: 'NPV as a function of the rate', it: 'REA in funzione del tasso' }), xTitle: 'i', yTitle: 'NPV' });
      var x = W.scale.linear([0, I1], [0, c.w]), y = W.scale.linear([y0 - pad, y1 + pad], [c.h, 0]);
      c.axisY(y, { ticks: 5, format: function (t) { return W.compact(t); } });
      c.axisXLinear(x, { ticks: 8, format: function (t) { return fix(t * 100, 0) + '%'; } });
      c.add(svg('line', { x1: 0, x2: c.w, y1: y(0), y2: y(0), class: 'wm-baseline' }));
      c.clipped(svg('path', { d: W.plotPath(npv, 0, I1, x, y, 300), class: 'wm-line ' + W.series(0) }));
      var cur = npv(P.i);
      c.add(svg('line', { x1: x(P.i), x2: x(P.i), y1: y(0), y2: y(cur), class: 'wm-guide' }));
      c.dot(x(P.i), y(cur), W.series(1), 4);
      irr.forEach(function (r) { c.dot(x(r), y(0), 'wm-hl', 5); });
      irr.forEach(function (r) { c.label(x(r), y(0), 'i* = ' + pct(r), { at: 'ne', cls: 'wm-strong' }); });
      c.label(x(P.i), y(cur), 'NPV = ' + fix(cur, 2), { at: cur >= 0 ? 'ne' : 'se' });

      set('v', fix(cur, 2));
      set('r', irr.length ? irr.map(pct).join(', ') : say({ en: 'none in range', it: 'nessuno' }));
      set('s', String(changes));
      var sums = ' S_k: ' + cum.map(function (s) { return W.compact(s); }).join(' · ') + '.';
      if (irr.length > 1) note('warn', say({ en: 'Several IRRs: the IRR rule is ambiguous. The cumulative sums change sign ', it: 'Più TIR: il criterio è ambiguo. Le somme cumulate cambiano segno ' }) + changes + say({ en: ' times.', it: ' volte.' }) + sums);
      else if (changes === 1) note('pos', say({ en: "Norström: the cumulative sums change sign once, so the IRR is unique. ", it: 'Norström: le somme cumulate cambiano segno una volta, il TIR è unico. ' }) + (cur > 0 ? say({ en: 'At this rate NPV > 0: accept.', it: 'A questo tasso REA > 0: conveniente.' }) : say({ en: 'At this rate NPV ≤ 0: reject.', it: 'A questo tasso REA ≤ 0: non conveniente.' })) + sums);
      else note('info', say({ en: "Norström's condition does not hold (", it: 'La condizione di Norström non vale (' }) + changes + say({ en: ' sign changes); it is only sufficient.', it: ' cambi di segno); è solo sufficiente.' }) + sums);
    }
    update();
  }
});
