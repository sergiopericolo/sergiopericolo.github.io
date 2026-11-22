/*
 * lifeins — net single premiums of the basic life contracts from one
 * Gompertz–Makeham table (μ_x = α + β c^x) and the commutation symbols
 * D_x, N_x, C_x, M_x.
 *   ```wimark-lifeins {"x": 40, "m": 20, "i": 0.03}
 *   ```
 * Sliders: age x, term m, rate i. The bars are the pure endowments
 * hE_x = v^h · hp_x for h = 1, 2, …: their sum is the life annuity a_x; the
 * dashed line is v^h alone. The highlight is the bar at h = m, the pure
 * endowment of the contract. Optional: "alpha", "beta", "c" for the table.
 */
WiMark.register('lifeins', {
  title: 'Life insurance premiums',
  description: 'Pure endowment, life annuities, death covers and endowment insurance from a Gompertz–Makeham table.',
  example: { opts: { x: 40, m: 20, i: 0.03 } },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var P = { x: Math.round(W.num(v.x, 40)), m: Math.round(W.num(v.m, 20)), i: W.num(v.i, 0.03) };
    var alpha = W.num(v.alpha, 0.0005), beta = W.num(v.beta, 0.00003), cc = W.num(v.c, 1.1);
    if (!(cc > 1) || !(beta > 0) || alpha < 0) throw new Error('lifeins: need c > 1, beta > 0, alpha ≥ 0');
    var fix = function (x, d) { return W.fmt(x, { minimumFractionDigits: d, maximumFractionDigits: d }); };
    var pct = function (x) { return fix(x * 100, 1) + '%'; };
    // The life table: l_0 = 100 000, ω is the first age with fewer than one survivor.
    var l = [];
    for (var a = 0; a < 200; a++) {
      var la = 1e5 * Math.exp(-alpha * a - beta / Math.log(cc) * (Math.pow(cc, a) - 1));
      if (la < 1) break;
      l.push(la);
    }
    var omega = l.length;
    l.push(0);

    var pane = W.pane(el, { title: say({ en: 'Net single premiums', it: 'Premi unici puri' }), tag: say({ en: 'interactive', it: 'interattivo' }) });
    var plot = pane.body.appendChild(h('div'));
    pane.body.appendChild(W.legend([
      { label: say({ en: 'hE_x, h ≤ m', it: 'hE_x, h ≤ m' }), i: 0 },
      { label: say({ en: 'hE_x, h > m', it: 'hE_x, h > m' }), i: 1 },
      { label: say({ en: 'v^h only (dashed)', it: 'solo v^h (tratteggio)' }), i: 2, cls: 'wm-s-other' }
    ]));
    W.controls(pane.section(), P, [
      { key: 'x', label: say({ en: 'age x', it: 'età x' }), min: 20, max: 70, step: 1, format: function (x) { return String(x); } },
      { key: 'm', label: say({ en: 'term m', it: 'durata m' }), min: 1, max: 40, step: 1, format: function (x) { return String(x); } },
      { key: 'i', label: say({ en: 'rate i', it: 'tasso i' }), min: 0.005, max: 0.08, step: 0.0025, format: pct }
    ], update);
    var set = W.stats(pane.section('wm-flush'), [
      { key: 'E', label: 'ₘEₓ = D(x+m)/D(x)' },
      { key: 'a', label: 'aₓ = N(x+1)/D(x)' },
      { key: 'A', label: 'Aₓ = M(x)/D(x)' },
      { key: 'T', label: say({ en: 'term m years', it: 'temporanea m anni' }) },
      { key: 'X', label: say({ en: 'endowment', it: 'mista' }), hl: true }
    ]);
    var note = W.note(pane.section('wm-flush'));

    function update() {
      var vv = 1 / (1 + P.i);
      var D = [], C = [], N = [], M = [], t;
      for (t = 0; t <= omega; t++) { D.push(Math.pow(vv, t) * l[t]); C.push(t < omega ? Math.pow(vv, t + 1) * (l[t] - l[t + 1]) : 0); }
      N[omega] = 0; M[omega] = 0;
      for (t = omega - 1; t >= 0; t--) { N[t] = N[t + 1] + D[t]; M[t] = M[t + 1] + C[t]; }
      var x = P.x, m = Math.min(P.m, omega - x - 1);
      var at = function (arr, k) { return k <= omega ? arr[k] : 0; };
      var E = at(D, x + m) / D[x], ax = N[x + 1] / D[x], Ax = M[x] / D[x];
      var term = (M[x] - at(M, x + m)) / D[x], endow = E + term;

      var H = omega - x - 1, keys = [];
      for (t = 1; t <= H; t++) keys.push(String(t));
      plot.textContent = '';
      var c = W.chart(plot, { width: 680, height: 260, margin: { left: 48, right: 16 }, title: say({ en: 'pure endowments hE_x by year h (sum = aₓ)', it: 'capitali differiti hE_x per anno h (somma = aₓ)' }), xTitle: say({ en: 'years from now h', it: 'anni da oggi h' }), yTitle: 'hEₓ' });
      var xs = W.scale.band(keys, [0, c.w], 0.15), y = W.scale.linear([0, 1], [c.h, 0]);
      c.axisY(y, { ticks: 4, format: function (t) { return fix(t, 2); } });
      c.axisX(keys, keys.map(function (k) { var s = xs(k); return s.x + s.w / 2; }), { max: 14 });
      keys.forEach(function (k, n) {
        var hh = n + 1, val = D[x + hh] / D[x], s = xs(k);
        var cls = hh === m ? 'wm-hl' : W.series(hh <= m ? 0 : 1);
        c.add(svg('rect', { x: s.x, y: y(val), width: s.w, height: c.h - y(val), class: 'wm-mark ' + cls }));
      });
      var mid = function (hh) { var s = xs(String(hh)); return s.x + s.w / 2; };
      c.add(svg('path', { d: keys.map(function (k, n) { return (n ? 'L' : 'M') + mid(n + 1).toFixed(1) + ',' + y(Math.pow(vv, n + 1)).toFixed(1); }).join(''), class: 'wm-line wm-trend wm-s-other' }));
      c.label(mid(m), y(E), 'ₘEₓ = ' + fix(E, 3), { at: 'ne', cls: 'wm-strong' });

      set('E', fix(E, 4));
      set('a', fix(ax, 3));
      set('A', fix(Ax, 4));
      set('T', fix(term, 4));
      set('X', fix(endow, 4));
      note('info', say({ en: 'Age ', it: 'Età ' }) + x + ', ω = ' + omega + ': v^m = ' + fix(Math.pow(vv, m), 4) + say({ en: ', survival cuts it to ', it: ', la sopravvivenza lo riduce a ' }) + fix(E, 4) + '. ' + say({ en: 'Life annuity in advance äₓ = 1 + aₓ = ', it: 'Rendita anticipata äₓ = 1 + aₓ = ' }) + fix(1 + ax, 3) + '.');
    }
    update();
  }
});
