/*
 * fmb — Fama–MacBeth two-step regressions on simulated portfolios with one
 * priced factor: step 1 estimates each portfolio's beta in the time series,
 * step 2 regresses returns on those betas in every month; the average slope
 * is the risk premium λ, its t-statistic uses the spread of the monthly λ_t.
 * λ hat tracks the factor's sample mean, the premium realised in the sample.
 *   ```wimark-fmb {"N": 25, "T": 276, "lambda": 0.006, "noise": 0.04}
 *   ```
 * The highlight is λ hat: the mean of the monthly slopes.
 */
WiMark.register('fmb', {
  title: 'Fama–MacBeth regressions',
  description: 'Two-step cross-sectional test: betas, monthly lambdas, average risk premium.',
  example: { opts: { N: 25, T: 276, lambda: 0.006, noise: 0.04 } },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var P = { N: Math.round(W.num(v.N, 25)), T: Math.round(W.num(v.T, 276)), lambda: W.num(v.lambda, 0.006), noise: W.num(v.noise, 0.04) };
    var SF = 0.045, seed = 20;
    var fix = function (x, d) { return W.fmt(x, { minimumFractionDigits: d, maximumFractionDigits: d }); };
    var pct = function (x, d) { return fix(x * 100, d === undefined ? 2 : d) + '%'; };
    var int = function (x) { return String(x); };
    function rng(s) {
      return function () {
        s |= 0; s = s + 0x6D2B79F5 | 0;
        var t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    function ols(x, y) {
      var n = x.length, mx = W.sum(x) / n, my = W.sum(y) / n, sxy = 0, sxx = 0;
      for (var i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) * (x[i] - mx); }
      var b = sxy / sxx;
      return { a: my - b * mx, b: b };
    }

    var pane = W.pane(el, { title: say({ en: 'Fama–MacBeth two-step regressions', it: 'Regressioni in due passi di Fama–MacBeth' }), tag: say({ en: 'simulation', it: 'simulazione' }) });
    var charts = pane.body.appendChild(h('div', { class: 'wm-grid', style: { '--cols': 2 } }));
    var left = charts.appendChild(h('div')), right = charts.appendChild(h('div'));
    pane.body.appendChild(W.legend([
      { label: say({ en: 'estimated λ₀ + λ̂β', it: 'stimata λ₀ + λ̂β' }), i: 0 },
      { label: say({ en: 'true λβ', it: 'vera λβ' }), cls: 'wm-s-other' }
    ], 'line'));
    var sec = pane.section();
    W.controls(sec, P, [
      { key: 'lambda', label: say({ en: 'true premium λ', it: 'premio vero λ' }), min: -0.01, max: 0.015, step: 0.0005, format: pct },
      { key: 'noise', label: say({ en: 'idiosyncratic σ_ε', it: 'σ_ε idiosincratica' }), min: 0.005, max: 0.1, step: 0.005, format: pct },
      { key: 'T', label: say({ en: 'months T', it: 'mesi T' }), min: 24, max: 600, step: 12, format: int },
      { key: 'N', label: say({ en: 'portfolios N', it: 'portafogli N' }), min: 5, max: 100, step: 1, format: int }
    ], update);
    var again = h('button', { type: 'button', class: 'wm-btn', text: say({ en: 'new sample', it: 'nuovo campione' }) });
    again.addEventListener('click', function () { seed++; update(); });
    sec.appendChild(h('div', { class: 'wm-toolbar', style: { marginTop: '0.5rem' } }, again));
    var set = W.stats(pane.section('wm-flush'), [
      { key: 'l', label: 'λ̂', hl: true },
      { key: 't', label: say({ en: 'Fama–MacBeth t', it: 't di Fama–MacBeth' }) },
      { key: 'f', label: say({ en: 'factor sample mean', it: 'media campionaria fattore' }) },
      { key: 's', label: say({ en: 'sd of monthly λ_t', it: 'dev. std. dei λ_t' }) }
    ]);

    function update() {
      var r = rng(seed);
      var n01 = function () { return Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r()); };
      var N = P.N, T = P.T, n, t;
      var beta = [], f = [], R = [];
      for (n = 0; n < N; n++) beta.push(0.5 + 1.2 * n / Math.max(1, N - 1));
      for (t = 0; t < T; t++) f.push(P.lambda + SF * n01());
      for (n = 0; n < N; n++) {
        var row = [];
        for (t = 0; t < T; t++) row.push(beta[n] * (f[t] - P.lambda) + beta[n] * P.lambda + P.noise * n01());
        R.push(row);
      }
      // Step 1: time-series betas.
      var bhat = R.map(function (row) { return ols(f, row).b; });
      // Step 2: one cross-section per month.
      var lt = [], l0 = [];
      for (t = 0; t < T; t++) {
        var fit = ols(bhat, R.map(function (row) { return row[t]; }));
        lt.push(fit.b);
        l0.push(fit.a);
      }
      var lbar = W.sum(lt) / T, l0bar = W.sum(l0) / T, sd = 0;
      lt.forEach(function (q) { sd += (q - lbar) * (q - lbar); });
      sd = Math.sqrt(sd / (T - 1));
      var avg = R.map(function (row) { return W.sum(row) / T; });

      left.textContent = '';
      var a = W.chart(left, { width: 340, height: 260, margin: { left: 48, right: 14 }, title: say({ en: 'average return against estimated beta', it: 'rendimento medio rispetto al beta stimato' }), xTitle: 'β̂', yTitle: say({ en: 'mean return', it: 'rend. medio' }) });
      var be = W.extent(bhat), ae = W.extent(avg.concat([0]));
      var x0 = Math.min(0, be[0]), x1 = be[1] * 1.05;
      var xa = W.scale.linear([x0, x1], [0, a.w]), ya = W.scale.linear(ae, [a.h, 0], true);
      a.axisY(ya, { ticks: 5, format: function (q) { return pct(q, 1); } });
      a.axisXLinear(xa, { ticks: 5, format: function (q) { return fix(q, 1); } });
      a.clipped(svg('line', { x1: xa(x0), y1: ya(P.lambda * x0), x2: xa(x1), y2: ya(P.lambda * x1), class: 'wm-line wm-s-other' }));
      a.clipped(svg('line', { x1: xa(x0), y1: ya(l0bar + lbar * x0), x2: xa(x1), y2: ya(l0bar + lbar * x1), class: 'wm-line ' + W.series(0) }));
      var dots = svg('g');
      bhat.forEach(function (b, k) { dots.appendChild(svg('circle', { cx: xa(b), cy: ya(avg[k]), r: 3, class: 'wm-dot ' + W.series(2) })); });
      a.clipped(dots);

      right.textContent = '';
      var bins = 24, le = W.extent(lt), width = (le[1] - le[0]) / bins || 1e-6, counts = [];
      for (var k = 0; k < bins; k++) counts.push(0);
      lt.forEach(function (q) { counts[Math.min(bins - 1, Math.floor((q - le[0]) / width))]++; });
      var b2 = W.chart(right, { width: 340, height: 260, margin: { left: 40, right: 14 }, title: say({ en: 'monthly slopes λ_t, mean = λ̂', it: 'pendenze mensili λ_t, media = λ̂' }), xTitle: 'λ_t', yTitle: say({ en: 'months', it: 'mesi' }) });
      var xb = W.scale.linear(le, [0, b2.w]), yb = W.scale.linear([0, Math.max.apply(null, counts) * 1.1], [b2.h, 0]);
      b2.axisY(yb, { ticks: 4, format: function (q) { return String(Math.round(q)); } });
      b2.axisXLinear(xb, { ticks: 4, format: function (q) { return pct(q, 0); } });
      counts.forEach(function (cnt, j) {
        b2.add(svg('rect', { x: xb(le[0] + j * width), y: yb(cnt), width: Math.max(1, xb(le[0] + width) - xb(le[0]) - 1), height: b2.h - yb(cnt), class: 'wm-mark ' + W.series(2) }));
      });
      if (le[0] < 0 && le[1] > 0) b2.add(svg('line', { x1: xb(0), x2: xb(0), y1: 0, y2: b2.h, class: 'wm-guide' }));
      b2.add(svg('line', { x1: xb(lbar), x2: xb(lbar), y1: 0, y2: b2.h, class: 'wm-line wm-hl' }));
      b2.label(xb(lbar), 0, 'λ̂', { at: 'se', cls: 'wm-strong' });

      set('l', pct(lbar));
      set('t', fix(lbar / (sd / Math.sqrt(T)), 2));
      set('f', pct(W.sum(f) / T));
      set('s', pct(sd));
    }
    update();
  }
});
