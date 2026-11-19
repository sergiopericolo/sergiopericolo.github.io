/*
 * diversification — the risk of an equally weighted portfolio of N assets
 * with the same variance σ² and average correlation ρ:
 * σp² = σ²/N + (1 − 1/N) ρ σ². The idiosyncratic part dies with N, the
 * systematic part ρσ² stays.
 *   ```wimark-diversification {"sigma": 0.3, "rho": 0.2, "max": 50}
 *   ```
 * The highlight is the systematic floor: the risk diversification cannot remove.
 */
WiMark.register('diversification', {
  title: 'Diversification and the number of assets',
  description: 'Portfolio volatility against N: idiosyncratic risk vanishes, systematic risk stays.',
  example: { opts: { sigma: 0.3, rho: 0.2, max: 50 } },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var P = { sigma: W.num(v.sigma, 0.3), rho: W.num(v.rho, 0.2), n: 10 };
    var NMAX = Math.max(5, Math.round(W.num(v.max, 50)));
    var fix = function (x, d) { return W.fmt(x, { minimumFractionDigits: d, maximumFractionDigits: d }); };
    var pct = function (x, d) { return fix(x * 100, d === undefined ? 1 : d) + '%'; };
    function sdp(n) { return Math.sqrt(P.sigma * P.sigma / n + (1 - 1 / n) * P.rho * P.sigma * P.sigma); }

    var pane = W.pane(el, { title: say({ en: 'Diversification and the number of assets', it: 'Diversificazione e numero di titoli' }), tag: say({ en: 'interactive', it: 'interattivo' }) });
    var plot = pane.body.appendChild(h('div'));
    pane.body.appendChild(W.legend([
      { label: 'σₚ(N)', i: 0 },
      { label: say({ en: 'systematic floor √ρ σ', it: 'soglia sistematica √ρ σ' }), cls: 'wm-hl' }
    ], 'line'));
    W.controls(pane.section(), P, [
      { key: 'sigma', label: say({ en: 'asset volatility σ', it: 'volatilità del titolo σ' }), min: 0.05, max: 0.6, step: 0.01, format: pct },
      { key: 'rho', label: say({ en: 'average correlation ρ', it: 'correlazione media ρ' }), min: 0, max: 1, step: 0.01, format: function (x) { return fix(x, 2); } },
      { key: 'n', label: say({ en: 'assets N', it: 'titoli N' }), min: 1, max: NMAX, step: 1, format: function (x) { return String(x); } }
    ], update);
    var set = W.stats(pane.section('wm-flush'), [
      { key: 's', label: say({ en: 'volatility at N', it: 'volatilità con N' }) },
      { key: 'sys', label: say({ en: 'systematic floor', it: 'soglia sistematica' }), hl: true },
      { key: 'cut', label: say({ en: 'risk removed', it: 'rischio eliminato' }) }
    ]);

    function update() {
      plot.textContent = '';
      var c = W.chart(plot, { width: 680, height: 260, margin: { left: 50, right: 20 }, title: say({ en: 'portfolio volatility against the number of assets', it: 'volatilità del portafoglio rispetto al numero di titoli' }), xTitle: 'N', yTitle: 'σₚ' });
      var x = W.scale.linear([1, NMAX], [0, c.w]), y = W.scale.linear([0, P.sigma * 1.05], [c.h, 0]);
      c.axisY(y, { ticks: 5, format: function (t) { return pct(t, 0); } });
      c.axisXLinear(x, { ticks: 6, format: function (t) { return String(Math.round(t)); } });
      var floor = Math.sqrt(P.rho) * P.sigma;
      c.add(svg('line', { x1: 0, x2: c.w, y1: y(floor), y2: y(floor), class: 'wm-line wm-hl' }));
      c.clipped(svg('path', { d: W.plotPath(sdp, 1, NMAX, x, y, 300), class: 'wm-line ' + W.series(0) }));
      c.add(svg('line', { x1: x(P.n), x2: x(P.n), y1: y(sdp(P.n)), y2: c.h, class: 'wm-guide' }));
      c.dot(x(P.n), y(sdp(P.n)), W.series(0), 4.5);
      c.label(x(P.n), y(sdp(P.n)), 'N = ' + P.n, { at: 'ne', cls: 'wm-strong' });
      set('s', pct(sdp(P.n)));
      set('sys', pct(floor));
      set('cut', pct(1 - sdp(P.n) / P.sigma));
    }
    update();
  }
});
