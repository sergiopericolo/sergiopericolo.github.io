/*
 * survival — three survival laws side by side: constant force of mortality,
 * De Moivre and Gompertz–Makeham. Left: survivors l_x (l_0 = 100 000);
 * right: the force of mortality μ_x.
 *   ```wimark-survival {"x": 40, "omega": 105, "k": 0.0125, "alpha": 0.0005, "beta": 0.00003, "c": 1.1}
 *   ```
 * Sliders move the age x, the limiting age ω of De Moivre, the constant force
 * k and the ageing factor c of Gompertz–Makeham. Readouts: the curtate life
 * expectancy e_x of each law; the highlight is Gompertz–Makeham, the
 * realistic one.
 */
WiMark.register('survival', {
  title: 'Survival laws',
  description: 'Survivors and force of mortality under constant force, De Moivre and Gompertz–Makeham, with life expectancy.',
  example: { opts: { x: 40, omega: 105, k: 0.0125, alpha: 0.0005, beta: 0.00003, c: 1.1 } },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var P = { x: W.num(v.x, 40), omega: W.num(v.omega, 105), k: W.num(v.k, 0.0125), c: W.num(v.c, 1.1) };
    var alpha = W.num(v.alpha, 0.0005), beta = W.num(v.beta, 0.00003);
    if (!(P.omega > 0) || !(P.k > 0) || !(P.c > 1) || alpha < 0 || !(beta > 0)) throw new Error('survival: need omega > 0, k > 0, c > 1, alpha ≥ 0, beta > 0');
    var A = 120;
    var fix = function (x, d) { return W.fmt(x, { minimumFractionDigits: d, maximumFractionDigits: d }); };
    var names = [say({ en: 'constant force', it: 'forza costante' }), 'De Moivre', 'Gompertz–Makeham'];
    var laws = [
      { l: function (x) { return 1e5 * Math.exp(-P.k * x); }, mu: function () { return P.k; } },
      { l: function (x) { return x < P.omega ? 1e5 * (P.omega - x) / P.omega : 0; }, mu: function (x) { return x < P.omega ? 1 / (P.omega - x) : NaN; } },
      { l: function (x) { return 1e5 * Math.exp(-alpha * x - beta / Math.log(P.c) * (Math.pow(P.c, x) - 1)); }, mu: function (x) { return alpha + beta * Math.pow(P.c, x); } }
    ];
    function ex(law, x) {
      var lx = law.l(x), s = 0;
      if (!(lx > 0)) return NaN;
      for (var t = 1; t < 2000; t++) { var q = law.l(x + t); if (!(q > 1e-9)) break; s += q; }
      return s / lx;
    }

    var pane = W.pane(el, { title: say({ en: 'Survival laws', it: 'Leggi di sopravvivenza' }), tag: say({ en: 'interactive', it: 'interattivo' }) });
    var charts = pane.body.appendChild(h('div', { class: 'wm-grid', style: { '--cols': 2 } }));
    var left = charts.appendChild(h('div')), right = charts.appendChild(h('div'));
    pane.body.appendChild(W.legend(names.map(function (n, k) { return { label: n, i: k }; }), 'line'));
    W.controls(pane.section(), P, [
      { key: 'x', label: say({ en: 'age x', it: 'età x' }), min: 0, max: 100, step: 1, format: function (x) { return String(x); } },
      { key: 'omega', label: say({ en: 'De Moivre ω', it: 'ω di De Moivre' }), min: 80, max: 120, step: 1, format: function (x) { return String(x); } },
      { key: 'k', label: say({ en: 'constant force k', it: 'forza costante k' }), min: 0.002, max: 0.05, step: 0.0005, format: function (x) { return fix(x, 4); } },
      { key: 'c', label: say({ en: 'Gompertz c', it: 'Gompertz c' }), min: 1.05, max: 1.15, step: 0.002, format: function (x) { return fix(x, 3); } }
    ], update);
    var set = W.stats(pane.section('wm-flush'), [
      { key: 'e0', label: 'e_x · ' + names[0] },
      { key: 'e1', label: 'e_x · ' + names[1] },
      { key: 'e2', label: 'e_x · ' + names[2], hl: true }
    ]);

    function update() {
      left.textContent = '';
      var a = W.chart(left, { width: 420, height: 280, margin: { left: 54, right: 14 }, title: say({ en: 'survivors l_x', it: 'sopravviventi l_x' }), xTitle: say({ en: 'age x', it: 'età x' }), yTitle: 'l_x' });
      var xa = W.scale.linear([0, A], [0, a.w]), ya = W.scale.linear([0, 1e5], [a.h, 0]);
      a.axisY(ya, { ticks: 5, format: function (t) { return W.compact(t); } });
      a.axisXLinear(xa, { ticks: 6, format: function (t) { return fix(t, 0); } });
      a.add(svg('line', { x1: xa(P.x), x2: xa(P.x), y1: 0, y2: a.h, class: 'wm-guide' }));
      laws.forEach(function (law, k) { a.clipped(svg('path', { d: W.plotPath(law.l, 0, A, xa, ya, 240), class: 'wm-line ' + W.series(k) })); });
      laws.forEach(function (law, k) { var l = law.l(P.x); if (l > 0) a.dot(xa(P.x), ya(l), k === 2 ? 'wm-hl' : W.series(k), k === 2 ? 4.5 : 3.5); });
      a.label(xa(P.x), a.h - 8, 'x = ' + fix(P.x, 0), { at: 'e' });

      right.textContent = '';
      var b = W.chart(right, { width: 420, height: 280, margin: { left: 54, right: 14 }, title: say({ en: 'force of mortality μ_x', it: 'forza di mortalità μ_x' }), xTitle: say({ en: 'age x', it: 'età x' }), yTitle: 'μ_x' });
      var xb = W.scale.linear([0, A], [0, b.w]), yb = W.scale.linear([0, 0.2], [b.h, 0]);
      b.axisY(yb, { ticks: 4, format: function (t) { return fix(t, 2); } });
      b.axisXLinear(xb, { ticks: 6, format: function (t) { return fix(t, 0); } });
      b.add(svg('line', { x1: xb(P.x), x2: xb(P.x), y1: 0, y2: b.h, class: 'wm-guide' }));
      laws.forEach(function (law, k) { b.clipped(svg('path', { d: W.plotPath(law.mu, 0, k === 1 ? P.omega - 0.01 : A, xb, yb, 240), class: 'wm-line ' + W.series(k) })); });

      laws.forEach(function (law, k) {
        var e = ex(law, P.x);
        set('e' + k, isFinite(e) ? fix(e, 1) + ' ' + say({ en: 'yrs', it: 'anni' }) : '—');
      });
    }
    update();
  }
});
