/*
 * frontier2 — the two-risky-asset frontier: σp(w) as the correlation ρ moves,
 * the global minimum variance portfolio and, with a riskless rate, the
 * tangency portfolio T and the Capital Market Line.
 *   ```wimark-frontier2 {"mua": 0.06, "sa": 0.12, "mub": 0.12, "sb": 0.25, "rho": 0.2, "rf": 0.02}
 *   ```
 * Leave rf out to hide the CML. Weights run from −50% to 150% (short sales
 * allowed); the dotted guides are the ρ = −1 and ρ = +1 frontiers. The
 * highlight is T (or the GMV without rf): the portfolio the reader looks for.
 */
WiMark.register('frontier2', {
  title: 'Two-asset efficient frontier',
  description: 'Frontier, GMV, tangency portfolio and CML for two risky assets.',
  example: { opts: { mua: 0.06, sa: 0.12, mub: 0.12, sb: 0.25, rho: 0.2, rf: 0.02 } },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var P = {
      mua: W.num(v.mua, 0.06), sa: W.num(v.sa, 0.12), mub: W.num(v.mub, 0.12), sb: W.num(v.sb, 0.25),
      rho: W.num(v.rho, 0.2), rf: v.rf === undefined || v.rf === null ? null : W.num(v.rf, 0.02)
    };
    if (!(P.sa > 0 && P.sb > 0)) throw new Error('sa and sb must be positive');
    var hasRf = P.rf !== null;
    var fix = function (x, d) { return W.fmt(x, { minimumFractionDigits: d, maximumFractionDigits: d }); };
    var pct = function (x, d) { return fix(x * 100, d === undefined ? 1 : d) + '%'; };
    var tick = function (x) { return pct(x, 0); };
    var W0 = -0.5, W1 = 1.5;
    function mu(w) { return w * P.mua + (1 - w) * P.mub; }
    function sd(w, r) {
      var q = w * w * P.sa * P.sa + (1 - w) * (1 - w) * P.sb * P.sb + 2 * w * (1 - w) * r * P.sa * P.sb;
      return Math.sqrt(Math.max(q, 0));
    }
    function gmv() {
      var c = P.rho * P.sa * P.sb, d = P.sa * P.sa + P.sb * P.sb - 2 * c;
      return Math.abs(d) < 1e-12 ? null : (P.sb * P.sb - c) / d;
    }
    function tangency() {
      var c = P.rho * P.sa * P.sb, ea = P.mua - P.rf, eb = P.mub - P.rf;
      var za = P.sb * P.sb * ea - c * eb, zb = P.sa * P.sa * eb - c * ea;
      return za + zb <= 1e-12 ? null : za / (za + zb);
    }
    function frontier(r, x, y) {
      var d = '';
      for (var i = 0; i <= 200; i++) {
        var w = W0 + (W1 - W0) * i / 200;
        d += (i ? 'L' : 'M') + x(sd(w, r)).toFixed(1) + ',' + y(mu(w)).toFixed(1);
      }
      return d;
    }

    var pane = W.pane(el, { title: say({ en: 'Two-asset efficient frontier', it: 'Frontiera efficiente con due titoli' }), tag: say({ en: 'interactive', it: 'interattivo' }) });
    var charts = pane.body.appendChild(h('div', { class: 'wm-grid', style: { '--cols': 2 } }));
    var left = charts.appendChild(h('div')), right = charts.appendChild(h('div'));
    pane.body.appendChild(W.legend([
      { label: say({ en: 'frontier at ρ', it: 'frontiera a ρ' }), i: 0 },
      { label: 'ρ = ±1', cls: 'wm-s-other' }
    ].concat(hasRf ? [{ label: say({ en: 'CML through T', it: 'CML per T' }), cls: 'wm-hl' }] : []), 'line'));
    W.controls(pane.section(), P, [
      { key: 'rho', label: say({ en: 'correlation ρ', it: 'correlazione ρ' }), min: -1, max: 1, step: 0.05, format: function (x) { return fix(x, 2); } },
      { key: 'sa', label: say({ en: 'volatility σ_A', it: 'volatilità σ_A' }), min: 0.02, max: 0.5, step: 0.01, format: pct },
      { key: 'sb', label: say({ en: 'volatility σ_B', it: 'volatilità σ_B' }), min: 0.02, max: 0.5, step: 0.01, format: pct }
    ].concat(hasRf ? [{ key: 'rf', label: say({ en: 'risk-free r_f', it: 'tasso risk-free r_f' }), min: 0, max: 0.1, step: 0.0025, format: pct }] : []), update);
    var set = W.stats(pane.section('wm-flush'), [
      { key: 'w', label: say({ en: 'GMV weight in A', it: 'peso GMV in A' }) },
      { key: 's', label: say({ en: 'GMV volatility', it: 'volatilità GMV' }), hl: !hasRf },
      { key: 'm', label: say({ en: 'GMV mean', it: 'media GMV' }) }
    ].concat(hasRf ? [{ key: 't', label: say({ en: 'Sharpe ratio of T', it: 'Sharpe di T' }), hl: true }] : []));

    function update() {
      var g = gmv(), t = hasRf ? tangency() : null;
      var smax = 0;
      for (var i = 0; i <= 40; i++) {
        var w = W0 + (W1 - W0) * i / 40;
        smax = Math.max(smax, sd(w, 1), sd(w, -1), sd(w, P.rho));
      }
      smax *= 1.05;
      var mlo = Math.min(mu(W0), mu(W1), hasRf ? P.rf : Infinity, 0), mhi = Math.max(mu(W0), mu(W1)) * 1.05;

      // Left: the (σ, μ) plane.
      left.textContent = '';
      var a = W.chart(left, { width: 340, height: 270, margin: { left: 44, right: 14 }, title: say({ en: 'mean–volatility plane, w_A from −50% to 150%', it: 'piano media–volatilità, w_A da −50% a 150%' }), xTitle: 'σₚ', yTitle: 'μₚ' });
      var xa = W.scale.linear([0, smax], [0, a.w]), ya = W.scale.linear([mlo, mhi], [a.h, 0]);
      a.axisY(ya, { ticks: 5, format: tick });
      a.axisXLinear(xa, { ticks: 5, format: tick });
      a.clipped(svg('path', { d: frontier(-1, xa, ya), class: 'wm-line wm-s-other' }));
      a.clipped(svg('path', { d: frontier(1, xa, ya), class: 'wm-line wm-s-other' }));
      a.clipped(svg('path', { d: frontier(P.rho, xa, ya), class: 'wm-line ' + W.series(0) }));
      if (t !== null) {
        var slope = (mu(t) - P.rf) / sd(t, P.rho);
        a.clipped(svg('line', { x1: xa(0), y1: ya(P.rf), x2: xa(smax), y2: ya(P.rf + slope * smax), class: 'wm-line wm-hl' }));
      }
      if (hasRf) a.dot(xa(0), ya(P.rf), W.series(1), 3);
      [1, 0].forEach(function (w) { a.dot(xa(sd(w, P.rho)), ya(mu(w)), W.series(1), 3.5); });
      if (g !== null) a.dot(xa(sd(g, P.rho)), ya(mu(g)), hasRf ? W.series(0) : 'wm-hl', 4.5);
      if (t !== null) a.dot(xa(sd(t, P.rho)), ya(mu(t)), 'wm-hl', 5);
      // Labels last, the important ones first: they get the best spots.
      if (t !== null) a.label(xa(sd(t, P.rho)), ya(mu(t)), 'T', { at: 'nw', cls: 'wm-strong' });
      if (g !== null) a.label(xa(sd(g, P.rho)), ya(mu(g)), 'GMV', { at: 'w', cls: 'wm-strong' });
      [[1, 'A'], [0, 'B']].forEach(function (p) { a.label(xa(sd(p[0], P.rho)), ya(mu(p[0])), p[1], { at: 'e' }); });
      if (hasRf) a.label(xa(0), ya(P.rf), 'r_f', { at: 'se' });

      // Right: σp as a function of the weight in A.
      right.textContent = '';
      var b = W.chart(right, { width: 340, height: 270, margin: { left: 44, right: 14 }, title: say({ en: 'portfolio risk against the weight in A', it: 'rischio del portafoglio rispetto al peso in A' }), xTitle: say({ en: 'weight in A', it: 'peso in A' }), yTitle: 'σₚ' });
      var xb = W.scale.linear([W0, W1], [0, b.w]), yb = W.scale.linear([0, smax], [b.h, 0]);
      b.axisY(yb, { ticks: 5, format: tick });
      b.axisXLinear(xb, { ticks: 4, format: tick });
      b.clipped(svg('path', { d: W.plotPath(function (w) { return sd(w, P.rho); }, W0, W1, xb, yb, 200), class: 'wm-line ' + W.series(0) }));
      if (g !== null && g >= W0 && g <= W1) {
        b.add(svg('line', { x1: xb(g), x2: xb(g), y1: yb(sd(g, P.rho)), y2: b.h, class: 'wm-guide' }));
        b.dot(xb(g), yb(sd(g, P.rho)), W.series(0), 4.5);
        b.label(xb(g), yb(sd(g, P.rho)), 'GMV', { at: 'n', cls: 'wm-strong' });
      }

      set('w', g === null ? say({ en: 'any', it: 'qualsiasi' }) : pct(g));
      set('s', g === null ? pct(P.sa) : pct(sd(g, P.rho)));
      set('m', g === null ? '—' : pct(mu(g)));
      if (hasRf) set('t', t === null ? 'r_f ≥ μ_GMV' : fix((mu(t) - P.rf) / sd(t, P.rho), 3));
    }
    update();
  }
});
