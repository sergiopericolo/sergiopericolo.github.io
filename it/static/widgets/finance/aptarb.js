/*
 * aptarb — no-arbitrage in a one-factor APT: two well-diversified portfolios
 * A and B. Mixing them with αβ_A + (1 − α)β_B = 0 gives a riskless portfolio,
 * which must earn r_f; if it does not, borrowing (or lending) at r_f against
 * it is a costless, riskless arbitrage.
 *   ```wimark-aptarb {"rf": 0.03, "ba": 0.8, "ma": 0.07, "bb": 1.5, "mb": 0.12}
 *   ```
 * The highlight is the zero-beta mix: on r_f when there is no arbitrage, off
 * it (a warning) when there is.
 */
WiMark.register('aptarb', {
  title: 'APT arbitrage',
  description: 'Zero-beta portfolio of two diversified portfolios and the arbitrage it offers.',
  example: { opts: { rf: 0.03, ba: 0.8, ma: 0.07, bb: 1.5, mb: 0.12 } },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var P = { rf: W.num(v.rf, 0.03), ba: W.num(v.ba, 0.8), ma: W.num(v.ma, 0.07), bb: W.num(v.bb, 1.5), mb: W.num(v.mb, 0.12) };
    var fix = function (x, d) { return W.fmt(x, { minimumFractionDigits: d, maximumFractionDigits: d }); };
    var pct = function (x, d) { return fix(x * 100, d === undefined ? 2 : d) + '%'; };
    var b2 = function (x) { return fix(x, 2); };

    var pane = W.pane(el, { title: say({ en: 'Arbitrage in a one-factor APT', it: 'Arbitraggio in un APT a un fattore' }), tag: say({ en: 'interactive', it: 'interattivo' }) });
    var plot = pane.body.appendChild(h('div'));
    pane.body.appendChild(W.legend([
      { label: say({ en: 'line through A', it: 'retta per A' }), i: 0 },
      { label: say({ en: 'line through B', it: 'retta per B' }), i: 3 }
    ], 'line'));
    W.controls(pane.section(), P, [
      { key: 'ma', label: say({ en: 'E[r] of A', it: 'E[r] di A' }), min: 0, max: 0.2, step: 0.0025, format: pct },
      { key: 'mb', label: say({ en: 'E[r] of B', it: 'E[r] di B' }), min: 0, max: 0.2, step: 0.0025, format: pct },
      { key: 'ba', label: say({ en: 'beta of A', it: 'beta di A' }), min: 0.1, max: 2, step: 0.05, format: b2 },
      { key: 'bb', label: say({ en: 'beta of B', it: 'beta di B' }), min: 0.1, max: 2.5, step: 0.05, format: b2 }
    ], update);
    var set = W.stats(pane.section('wm-flush'), [
      { key: 'wa', label: say({ en: 'weight in A', it: 'peso in A' }) },
      { key: 'wb', label: say({ en: 'weight in B', it: 'peso in B' }) },
      { key: 'z', label: say({ en: 'zero-beta return', it: 'rendimento a beta zero' }) },
      { key: 'p', label: say({ en: 'arbitrage profit', it: 'profitto di arbitraggio' }), hl: true }
    ]);
    var verdict = W.note(pane.root);

    function update() {
      var same = Math.abs(P.bb - P.ba) < 1e-9;
      var a = same ? NaN : P.bb / (P.bb - P.ba);
      var z = a * P.ma + (1 - a) * P.mb, profit = z - P.rf;
      var lamA = (P.ma - P.rf) / P.ba, lamB = (P.mb - P.rf) / P.bb;
      var ok = !isFinite(z) || Math.abs(profit) < 0.0005;

      plot.textContent = '';
      var c = W.chart(plot, { width: 680, height: 280, margin: { left: 50, right: 20 }, title: say({ en: 'expected return against factor beta, slope = price of risk λ', it: 'rendimento atteso rispetto al beta del fattore, pendenza = prezzo del rischio λ' }), xTitle: 'β', yTitle: 'E[r]' });
      var bmax = Math.max(P.ba, P.bb) * 1.15;
      var ys = [P.ma, P.mb, P.rf, 0].concat(isFinite(z) ? [z] : []);
      var ymin = Math.min.apply(null, ys), ymax = Math.max.apply(null, ys) * 1.15;
      var x = W.scale.linear([0, bmax], [0, c.w]), y = W.scale.linear([ymin, ymax], [c.h, 0], true);
      c.axisY(y, { ticks: 5, format: function (q) { return pct(q, 0); } });
      c.axisXLinear(x, { ticks: 5, format: b2 });
      c.clipped(svg('line', { x1: x(0), y1: y(P.rf), x2: x(bmax), y2: y(P.rf + lamA * bmax), class: 'wm-line ' + W.series(0) }));
      c.clipped(svg('line', { x1: x(0), y1: y(P.rf), x2: x(bmax), y2: y(P.rf + lamB * bmax), class: 'wm-line ' + W.series(3) }));
      c.dot(x(P.ba), y(P.ma), W.series(0), 4.5);
      c.dot(x(P.bb), y(P.mb), W.series(0), 4.5);
      c.dot(x(0), y(P.rf), W.series(1), 3.5);
      if (isFinite(z)) {
        if (!ok) c.add(svg('line', { x1: x(0), x2: x(0), y1: y(P.rf), y2: y(z), class: 'wm-line wm-hl' }));
        c.dot(x(0), y(z), 'wm-hl', 5);
        c.label(x(0), y(z), say({ en: 'zero-beta mix', it: 'mix a beta zero' }), { at: 'e', cls: 'wm-strong' });
      }
      c.label(x(P.ba), y(P.ma), 'A', { at: 'nw', cls: 'wm-strong' });
      c.label(x(P.bb), y(P.mb), 'B', { at: 'nw', cls: 'wm-strong' });
      c.label(x(0), y(P.rf), 'r_f', { at: 'se' });

      set('wa', isFinite(a) ? pct(a, 1) : '—');
      set('wb', isFinite(a) ? pct(1 - a, 1) : '—');
      set('z', isFinite(z) ? pct(z) : '—');
      set('p', isFinite(z) ? pct(Math.abs(profit)) : '—');
      verdict(ok ? (isFinite(z) ? 'pos' : 'info') : 'warn', !isFinite(z)
        ? say({ en: 'Same beta: A and B cannot be combined into a zero-beta portfolio.', it: 'Stesso beta: A e B non si possono combinare in un portafoglio a beta zero.' })
        : ok ? say({ en: 'No arbitrage: both portfolios lie on one APT line, λ_A = λ_B = ', it: 'Nessun arbitraggio: i due portafogli stanno su una sola retta APT, λ_A = λ_B = ' }) + pct(lamA) + say({ en: ' per unit of beta.', it: ' per unità di beta.' })
        : profit > 0 ? say({ en: 'Arbitrage: borrow at r_f, buy the zero-beta mix. Costless, riskless, earns ', it: 'Arbitraggio: prendi a prestito a r_f, compra il mix a beta zero. Senza costo e senza rischio, rende ' }) + pct(profit) + say({ en: ' per unit.', it: ' per unità.' })
        : say({ en: 'Arbitrage: short the zero-beta mix, lend at r_f. Costless, riskless, earns ', it: 'Arbitraggio: vendi allo scoperto il mix a beta zero, presta a r_f. Senza costo e senza rischio, rende ' }) + pct(-profit) + say({ en: ' per unit.', it: ' per unità.' }));
    }
    update();
  }
});
