/*
 * capmreg — the time-series CAPM regression z_i = α + β z_M + ε on simulated
 * monthly excess returns: OLS estimates, t-statistic of alpha (appraisal
 * ratio) and R². "new sample" draws again with the same true parameters.
 *   ```wimark-capmreg {"alpha": 0.002, "beta": 0.8, "noise": 0.05, "T": 276}
 *   ```
 * The highlight is the t-statistic of alpha, the number the test reads; a
 * significant alpha is flagged as a warning.
 */
WiMark.register('capmreg', {
  title: 'CAPM time-series regression',
  description: 'Simulated excess returns, OLS alpha and beta, t-test of alpha.',
  example: { opts: { alpha: 0.002, beta: 0.8, noise: 0.05, T: 276 } },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var P = { alpha: W.num(v.alpha, 0.002), beta: W.num(v.beta, 0.8), noise: W.num(v.noise, 0.05), T: Math.round(W.num(v.T, 276)) };
    var MU = 0.006, SM = 0.045, seed = 7;
    var fix = function (x, d) { return W.fmt(x, { minimumFractionDigits: d, maximumFractionDigits: d }); };
    var pct = function (x, d) { return fix(x * 100, d === undefined ? 2 : d) + '%'; };
    function rng(s) {
      return function () {
        s |= 0; s = s + 0x6D2B79F5 | 0;
        var t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    function normals(r, n) {
      var out = [];
      while (out.length < n) out.push(Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r()));
      return out;
    }

    var pane = W.pane(el, { title: say({ en: 'CAPM time-series regression', it: 'Regressione CAPM in serie storica' }), tag: say({ en: 'simulation', it: 'simulazione' }) });
    var plot = pane.body.appendChild(h('div'));
    pane.body.appendChild(W.legend([
      { label: say({ en: 'OLS fit', it: 'retta OLS' }), i: 0 },
      { label: say({ en: 'true line', it: 'retta vera' }), cls: 'wm-s-other' },
      { label: say({ en: 'months', it: 'mesi' }), i: 2 }
    ], 'line'));
    var sec = pane.section();
    W.controls(sec, P, [
      { key: 'alpha', label: say({ en: 'true alpha (monthly)', it: 'alfa vero (mensile)' }), min: -0.01, max: 0.01, step: 0.0005, format: pct },
      { key: 'beta', label: say({ en: 'true beta', it: 'beta vero' }), min: -0.5, max: 2, step: 0.05, format: function (x) { return fix(x, 2); } },
      { key: 'noise', label: say({ en: 'idiosyncratic σ_ε', it: 'σ_ε idiosincratica' }), min: 0.005, max: 0.12, step: 0.005, format: pct },
      { key: 'T', label: say({ en: 'months T', it: 'mesi T' }), min: 24, max: 600, step: 12, format: function (x) { return String(x); } }
    ], update);
    var again = h('button', { type: 'button', class: 'wm-btn', text: say({ en: 'new sample', it: 'nuovo campione' }) });
    again.addEventListener('click', function () { seed++; update(); });
    sec.appendChild(h('div', { class: 'wm-toolbar', style: { marginTop: '0.5rem' } }, again));
    var set = W.stats(pane.section('wm-flush'), [
      { key: 'a', label: 'α̂' },
      { key: 't', label: say({ en: 't-stat of α', it: 't-stat di α' }), hl: true },
      { key: 'b', label: 'β̂' },
      { key: 'r', label: 'R²' }
    ]);
    var verdict = W.note(pane.root);

    function update() {
      var r = rng(seed), em = normals(r, P.T), ee = normals(r, P.T);
      var zm = em.map(function (e) { return MU + SM * e; });
      var zi = zm.map(function (m, t) { return P.alpha + P.beta * m + P.noise * ee[t]; });
      var T = P.T, mm = W.sum(zm) / T, mi = W.sum(zi) / T, sxy = 0, sxx = 0, t;
      for (t = 0; t < T; t++) { sxy += (zm[t] - mm) * (zi[t] - mi); sxx += (zm[t] - mm) * (zm[t] - mm); }
      var b = sxy / sxx, a = mi - b * mm, sse = 0, sst = 0;
      for (t = 0; t < T; t++) {
        var e = zi[t] - a - b * zm[t];
        sse += e * e;
        sst += (zi[t] - mi) * (zi[t] - mi);
      }
      var s2 = sse / (T - 2), varM = sxx / T;
      var ta = a / Math.sqrt(s2 / T * (1 + mm * mm / varM)), r2 = 1 - sse / sst;

      plot.textContent = '';
      var c = W.chart(plot, { width: 680, height: 300, margin: { left: 50, right: 20 }, title: say({ en: 'stock against market, monthly excess returns', it: 'titolo rispetto al mercato, extra-rendimenti mensili' }), xTitle: 'z_M', yTitle: 'z_i' });
      var xe = W.extent(zm), ye = W.extent(zi);
      var x = W.scale.linear(xe, [0, c.w], true), y = W.scale.linear([Math.min(ye[0], 0), Math.max(ye[1], 0)], [c.h, 0], true);
      c.axisY(y, { ticks: 5, format: function (q) { return pct(q, 0); } });
      c.axisXLinear(x, { ticks: 6, format: function (q) { return pct(q, 0); } });
      var dots = svg('g');
      for (t = 0; t < T; t++) dots.appendChild(svg('circle', { cx: x(zm[t]), cy: y(zi[t]), r: 2.2, class: 'wm-dot ' + W.series(2) }));
      c.clipped(dots);
      var d0 = x.domain[0], d1 = x.domain[1];
      c.clipped(svg('line', { x1: x(d0), y1: y(P.alpha + P.beta * d0), x2: x(d1), y2: y(P.alpha + P.beta * d1), class: 'wm-line wm-s-other' }));
      c.clipped(svg('line', { x1: x(d0), y1: y(a + b * d0), x2: x(d1), y2: y(a + b * d1), class: 'wm-line ' + W.series(0) }));

      set('a', pct(a));
      set('t', fix(ta, 2));
      set('b', fix(b, 3));
      set('r', fix(r2, 3));
      var rej = Math.abs(ta) > 1.97;
      verdict(rej ? 'warn' : 'pos', rej
        ? say({ en: 'Reject H₀: α = 0 at 5% (|t| > 1.97): the CAPM leaves a significant alpha.', it: 'Si rifiuta H₀: α = 0 al 5% (|t| > 1,97): il CAPM lascia un alfa significativo.' })
        : say({ en: 'Do not reject H₀: α = 0 at 5% (|t| ≤ 1.97): consistent with the CAPM.', it: 'Non si rifiuta H₀: α = 0 al 5% (|t| ≤ 1,97): coerente con il CAPM.' }));
    }
    update();
  }
});
