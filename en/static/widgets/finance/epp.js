/*
 * epp — the equity premium puzzle under the CCAPM with CRRA utility and
 * log-normal consumption growth:
 *   ln r_f   = −ln β + γ μ − ½ γ² σ²
 *   ln E[r]  = −ln β + γ μ + ½ (2γ − γ²) σ²
 *   ERP      = γ σ²
 * against the data (ERP and r_f of the fence options).
 *   ```wimark-epp {"gamma": 10, "beta": 0.99, "mu": 0.0203, "sigma": 0.0294, "erp": 0.0848, "rf": 0.0011}
 *   ```
 * The highlight is the γ that matches the data premium: where the model
 * premium meets the data line.
 */
WiMark.register('epp', {
  title: 'Equity premium puzzle',
  description: 'Model-implied risk-free rate, equity return and premium against risk aversion.',
  example: { opts: { gamma: 10, beta: 0.99, mu: 0.0203, sigma: 0.0294, erp: 0.0848, rf: 0.0011 } },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var P = { gamma: W.num(v.gamma, 10), beta: W.num(v.beta, 0.99), mu: W.num(v.mu, 0.0203), sigma: W.num(v.sigma, 0.0294) };
    var D = { erp: W.num(v.erp, 0.0848), rf: W.num(v.rf, 0.0011) };
    var GMAX = 120;
    var fix = function (x, d) { return W.fmt(x, { minimumFractionDigits: d, maximumFractionDigits: d }); };
    var pct = function (x, d) { return fix(x * 100, d === undefined ? 2 : d) + '%'; };
    var tick = function (q) { return pct(q, 0); };
    function rf(g) { return -Math.log(P.beta) + g * P.mu - 0.5 * g * g * P.sigma * P.sigma; }
    function er(g) { return -Math.log(P.beta) + g * P.mu + 0.5 * (2 * g - g * g) * P.sigma * P.sigma; }
    function erp(g) { return g * P.sigma * P.sigma; }

    var pane = W.pane(el, { title: say({ en: 'The equity premium puzzle', it: 'Il puzzle del premio azionario' }), tag: say({ en: 'interactive', it: 'interattivo' }) });
    var charts = pane.body.appendChild(h('div', { class: 'wm-grid', style: { '--cols': 2 } }));
    var left = charts.appendChild(h('div')), right = charts.appendChild(h('div'));
    pane.body.appendChild(W.legend([
      { label: say({ en: 'risk-free rate', it: 'tasso risk-free' }), i: 0 },
      { label: say({ en: 'equity return', it: 'rendimento azionario' }), i: 1 },
      { label: say({ en: 'premium γσ²', it: 'premio γσ²' }), i: 3 },
      { label: say({ en: 'data', it: 'dati' }), cls: 'wm-s-other' }
    ], 'line'));
    W.controls(pane.section(), P, [
      { key: 'gamma', label: say({ en: 'risk aversion γ', it: 'avversione al rischio γ' }), min: 0, max: GMAX, step: 0.5, format: function (x) { return fix(x, 1); } },
      { key: 'sigma', label: say({ en: 'consumption vol σ', it: 'volatilità consumi σ' }), min: 0.005, max: 0.06, step: 0.0005, format: pct },
      { key: 'mu', label: say({ en: 'consumption growth μ', it: 'crescita consumi μ' }), min: 0, max: 0.04, step: 0.0005, format: pct },
      { key: 'beta', label: say({ en: 'discount factor β', it: 'fattore di sconto β' }), min: 0.9, max: 1, step: 0.005, format: function (x) { return fix(x, 3); } }
    ], update);
    var set = W.stats(pane.section('wm-flush'), [
      { key: 'rf', label: say({ en: 'model risk-free', it: 'risk-free modello' }) },
      { key: 'er', label: say({ en: 'model equity', it: 'azioni modello' }) },
      { key: 'p', label: say({ en: 'model premium', it: 'premio modello' }) },
      { key: 'g', label: say({ en: 'γ to match data', it: 'γ per i dati' }), hl: true }
    ]);

    function update() {
      var vals = [];
      for (var i = 0; i <= 60; i++) { var g = GMAX * i / 60; vals.push(rf(g), er(g)); }
      var lo = Math.max(Math.min(0, Math.min.apply(null, vals)), -0.3), hi = Math.min(Math.max(0.2, Math.max.apply(null, vals)), 0.4);
      var gStar = D.erp / (P.sigma * P.sigma);

      // Left: r_f and E[r] against γ, cut to −30%…40%.
      left.textContent = '';
      var a = W.chart(left, { width: 340, height: 260, margin: { left: 44, right: 14 }, title: say({ en: 'r_f and E[r] against γ', it: 'r_f ed E[r] rispetto a γ' }), xTitle: 'γ', yTitle: say({ en: 'return', it: 'rendimento' }) });
      var xa = W.scale.linear([0, GMAX], [0, a.w]), ya = W.scale.linear([lo, hi], [a.h, 0]);
      a.axisY(ya, { ticks: 5, format: tick });
      a.axisXLinear(xa, { ticks: 6, format: function (q) { return fix(q, 0); } });
      a.add(svg('line', { x1: 0, x2: a.w, y1: ya(D.rf), y2: ya(D.rf), class: 'wm-line wm-s-other' }));
      a.clipped(svg('path', { d: W.plotPath(rf, 0, GMAX, xa, ya, 300), class: 'wm-line ' + W.series(0) }));
      a.clipped(svg('path', { d: W.plotPath(er, 0, GMAX, xa, ya, 300), class: 'wm-line ' + W.series(1) }));
      a.add(svg('line', { x1: xa(P.gamma), x2: xa(P.gamma), y1: 0, y2: a.h, class: 'wm-guide' }));
      if (rf(P.gamma) >= lo && rf(P.gamma) <= hi) a.dot(xa(P.gamma), ya(rf(P.gamma)), W.series(0), 3.5);
      if (er(P.gamma) >= lo && er(P.gamma) <= hi) a.dot(xa(P.gamma), ya(er(P.gamma)), W.series(1), 3.5);
      a.label(a.w, ya(D.rf), say({ en: 'data r_f ', it: 'r_f dati ' }) + pct(D.rf), { at: 'nw' });

      // Right: the premium γσ² against γ, and the γ that matches the data.
      right.textContent = '';
      var top = Math.max(D.erp, erp(GMAX)) * 1.12;
      var b = W.chart(right, { width: 340, height: 260, margin: { left: 44, right: 14 }, title: say({ en: 'equity premium γσ² against γ', it: 'premio azionario γσ² rispetto a γ' }), xTitle: 'γ', yTitle: 'ERP' });
      var xb = W.scale.linear([0, GMAX], [0, b.w]), yb = W.scale.linear([0, top], [b.h, 0]);
      b.axisY(yb, { ticks: 5, format: tick });
      b.axisXLinear(xb, { ticks: 6, format: function (q) { return fix(q, 0); } });
      b.add(svg('line', { x1: 0, x2: b.w, y1: yb(D.erp), y2: yb(D.erp), class: 'wm-line wm-s-other' }));
      b.clipped(svg('path', { d: W.plotPath(erp, 0, GMAX, xb, yb, 100), class: 'wm-line ' + W.series(3) }));
      b.dot(xb(P.gamma), yb(erp(P.gamma)), W.series(3), 4);
      if (gStar <= GMAX) {
        b.add(svg('line', { x1: xb(gStar), x2: xb(gStar), y1: yb(D.erp), y2: b.h, class: 'wm-guide' }));
        b.dot(xb(gStar), yb(D.erp), 'wm-hl', 5);
        b.label(xb(gStar), yb(D.erp), 'γ ≈ ' + fix(gStar, 0), { at: 'nw', cls: 'wm-strong' });
      }
      b.label(0, yb(D.erp), say({ en: 'data ', it: 'dati ' }) + pct(D.erp), { at: 'ne' });

      set('rf', pct(rf(P.gamma)));
      set('er', pct(er(P.gamma)));
      set('p', pct(erp(P.gamma)));
      set('g', fix(gStar, 1));
    }
    update();
  }
});
