/*
 * bl — Black–Litterman with one view: equilibrium returns Π = γ Σ w_mkt by
 * reverse optimisation, one view P μ = q with confidence c, where
 * Ω = (1 − c)/c · P τΣ P'. Posterior μ̄ = Π + τΣP'(PτΣP' + Ω)⁻¹(q − PΠ) and
 * weights w = (γΣ)⁻¹ μ̄ against the market weights.
 *   ```wimark-bl {"assets": ["A", "B", "C"], "vol": [0.15, 0.2, 0.25], "rho": 0.4, "w": [0.5, 0.3, 0.2], "gamma": 2.5, "tau": 0.05, "view": [1, 0, -1], "q": 0.04}
 *   ```
 * view is the pick row (sum 0 = relative, sum 1 = absolute); q its return.
 * The highlight is the posterior value of the view: where the blend lands.
 */
WiMark.register('bl', {
  title: 'Black–Litterman',
  description: 'Equilibrium returns, one investor view and the Bayesian posterior returns and weights.',
  example: { opts: { assets: ['A', 'B', 'C'], vol: [0.15, 0.2, 0.25], rho: 0.4, w: [0.5, 0.3, 0.2], gamma: 2.5, tau: 0.05, view: [1, 0, -1], q: 0.04 } },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var names = W.list(v.assets || ['A', 'B', 'C']).map(String), N = names.length;
    var vol = W.list(v.vol || [0.15, 0.2, 0.25]).map(Number);
    var wm = W.list(v.w || [0.5, 0.3, 0.2]).map(Number);
    var p = W.list(v.view || [1, 0, -1]).map(Number);
    if (vol.length !== N || wm.length !== N || p.length !== N) throw new Error('bl: assets, vol, w and view need the same length');
    var rho = W.num(v.rho, 0.4), gamma = W.num(v.gamma, 2.5), tau = W.num(v.tau, 0.05);
    var P = { q: W.num(v.q, 0.04), conf: 0.5 };
    var fix = function (x, d) { return W.fmt(x, { minimumFractionDigits: d, maximumFractionDigits: d }); };
    var pct = function (x, d) { return fix(x * 100, d === undefined ? 2 : d) + '%'; };
    var S = [], i, j;
    for (i = 0; i < N; i++) { S.push([]); for (j = 0; j < N; j++) S[i].push((i === j ? 1 : rho) * vol[i] * vol[j]); }
    function mv(M, x) { return M.map(function (row) { return row.reduce(function (s, m, k) { return s + m * x[k]; }, 0); }); }
    function dot(a, b) { return a.reduce(function (s, x, k) { return s + x * b[k]; }, 0); }
    function solve(M, b) {
      var A = M.map(function (row, k) { return row.slice().concat([b[k]]); }), n = A.length;
      for (var c = 0; c < n; c++) {
        var piv = c;
        for (var r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
        var tmp = A[c]; A[c] = A[piv]; A[piv] = tmp;
        if (Math.abs(A[c][c]) < 1e-14) throw new Error('bl: covariance matrix is singular');
        for (r = 0; r < n; r++) {
          if (r === c) continue;
          var f = A[r][c] / A[c][c];
          for (var k = c; k <= n; k++) A[r][k] -= f * A[c][k];
        }
      }
      return A.map(function (row, k) { return row[n] / row[k]; });
    }
    var Pi = mv(S, wm).map(function (x) { return gamma * x; });
    var relative = Math.abs(W.sum(p)) < 1e-9;
    var viewText = p.map(function (x, k) { return x ? (x > 0 && k ? '+ ' : x < 0 ? '− ' : '') + (Math.abs(x) === 1 ? '' : Math.abs(x) + '·') + names[k] : ''; }).filter(Boolean).join(' ');

    var pane = W.pane(el, { title: say({ en: 'Black–Litterman with one view', it: 'Black–Litterman con una view' }), tag: say({ en: 'interactive', it: 'interattivo' }) });
    var charts = pane.body.appendChild(h('div', { class: 'wm-grid', style: { '--cols': 2 } }));
    var left = charts.appendChild(h('div')), right = charts.appendChild(h('div'));
    pane.body.appendChild(W.legend([
      { label: say({ en: 'equilibrium / market', it: 'equilibrio / mercato' }), i: 2 },
      { label: 'Black–Litterman', i: 0 }
    ]));
    W.controls(pane.section(), P, [
      { key: 'q', label: say({ en: 'view return q', it: 'rendimento della view q' }), min: -0.1, max: 0.15, step: 0.0025, format: pct },
      { key: 'conf', label: say({ en: 'confidence', it: 'fiducia' }), min: 0.01, max: 0.99, step: 0.01, format: function (x) { return Math.round(x * 100) + '%'; } }
    ], update);
    var set = W.stats(pane.section('wm-flush'), [
      { key: 'v', label: relative ? say({ en: 'relative view', it: 'view relativa' }) : say({ en: 'absolute view', it: 'view assoluta' }) },
      { key: 'e', label: say({ en: 'equilibrium value', it: 'valore di equilibrio' }) },
      { key: 'post', label: say({ en: 'posterior value', it: 'valore a posteriori' }), hl: true }
    ]);

    function bars(host, title, groups, yTitle) {
      var all = [0];
      groups.forEach(function (g) { all = all.concat(g); });
      var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), pad = (hi - lo) * 0.1 || 0.01;
      var c = W.chart(host, { width: 340, height: 250, margin: { left: 44, right: 14 }, title: title, yTitle: yTitle });
      var x = W.scale.band(names, [0, c.w], 0.3), y = W.scale.linear([lo - (lo < 0 ? pad : 0), hi + pad], [c.h, 0], true);
      c.axisY(y, { ticks: 5, format: function (q) { return pct(q, 0); } });
      c.axisX(names, names.map(function (n) { return x(n).x + x(n).w / 2; }));
      names.forEach(function (n, k) {
        var slot = x(n), bw = slot.w / groups.length;
        groups.forEach(function (g, s) {
          var y0 = y(0), y1 = y(g[k]);
          c.add(svg('rect', { x: slot.x + s * bw + 1, y: Math.min(y0, y1), width: Math.max(1, bw - 2), height: Math.max(1, Math.abs(y1 - y0)), class: 'wm-mark ' + W.series(s ? 0 : 2) },
            svg('title', { text: n + ': ' + pct(g[k]) })));
        });
      });
    }

    function update() {
      var tS = S.map(function (row) { return row.map(function (x) { return tau * x; }); });
      var tSp = mv(tS, p), var1 = dot(p, tSp);
      var omega = (1 - P.conf) / P.conf * var1;
      var gap = P.q - dot(p, Pi);
      var mu = Pi.map(function (x, k) { return x + tSp[k] * gap / (var1 + omega); });
      var w = solve(S.map(function (row) { return row.map(function (x) { return gamma * x; }); }), mu);
      left.textContent = '';
      bars(left, say({ en: 'expected excess returns: Π and μ̄', it: 'extra-rendimenti attesi: Π e μ̄' }), [Pi, mu], say({ en: 'return', it: 'rendimento' }));
      right.textContent = '';
      bars(right, say({ en: 'portfolio weights', it: 'pesi del portafoglio' }), [wm, w], say({ en: 'weight', it: 'peso' }));
      set('v', viewText + ' = ' + pct(P.q));
      set('e', pct(dot(p, Pi)));
      set('post', pct(dot(p, mu)));
    }
    update();
  }
});
