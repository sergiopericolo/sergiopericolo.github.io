/*
 * utility — a 50/50 lottery on a utility curve: expected utility, certainty
 * equivalent, the maximum risk premium π*, and U(E[W] − π) against E[U]
 * as the premium π moves.
 *   ```wimark-utility {"u": "sqrt", "low": 0, "high": 20}
 *   ```
 * u: "sqrt" (W^½, risk-averse), "linear" (W, risk-neutral) or "square"
 * (W², risk-loving). The buttons switch it. The highlight is the certainty
 * equivalent; the shaded zone holds the premiums worth paying.
 */
WiMark.register('utility', {
  title: 'Utility and risk premium',
  description: 'Lottery, certainty equivalent and risk premium on a utility curve.',
  example: { opts: { u: 'sqrt', low: 0, high: 20 } },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var U = {
      sqrt: { label: 'U = W^½', f: Math.sqrt, inv: function (u) { return u * u; } },
      linear: { label: 'U = W', f: function (w) { return w; }, inv: function (u) { return u; } },
      square: { label: 'U = W²', f: function (w) { return w * w; }, inv: Math.sqrt }
    };
    var lo = W.num(v.low, 0), hi = W.num(v.high, 20);
    if (!(hi > lo) || lo < 0) throw new Error('need 0 ≤ low < high');
    var kind = U[v.u] ? v.u : 'sqrt';
    var EW = (lo + hi) / 2;
    var P = { pi: 0 };
    var pmin = -(hi - EW), pmax = EW - lo;
    var fix = function (x, d) { return W.fmt(x, { minimumFractionDigits: d, maximumFractionDigits: d }); };
    var tick = function (x) { return W.fmt(x, { maximumFractionDigits: 1 }); };

    var pane = W.pane(el, { title: say({ en: 'Utility, certainty equivalent and risk premium', it: 'Utilità, equivalente certo e premio per il rischio' }), tag: say({ en: 'interactive', it: 'interattivo' }) });
    var charts = pane.body.appendChild(h('div', { class: 'wm-grid', style: { '--cols': 2 } }));
    var left = charts.appendChild(h('div')), right = charts.appendChild(h('div'));
    var bar = pane.section();
    var buttons = Object.keys(U).map(function (k) {
      var b = h('button', { type: 'button', class: 'wm-btn', text: U[k].label });
      b.addEventListener('click', function () { kind = k; update(); });
      b.dataset.kind = k;
      return b;
    });
    bar.appendChild(h('div', 'wm-toolbar', buttons));
    W.controls(bar, P, [{ key: 'pi', label: say({ en: 'premium π', it: 'premio π' }), min: pmin, max: pmax, step: 0.1, format: function (x) { return fix(x, 1); } }], update, 1);
    var set = W.stats(pane.section('wm-flush'), [
      { key: 'eu', label: 'E[U(W)]' },
      { key: 'ue', label: 'U(E[W])' },
      { key: 'ce', label: say({ en: 'certainty equiv.', it: 'equivalente certo' }), hl: true },
      { key: 'max', label: say({ en: 'max premium π*', it: 'premio max π*' }) }
    ]);
    var verdict = W.note(pane.root);

    function update() {
      var u = U[kind];
      var EU = (u.f(lo) + u.f(hi)) / 2, CE = u.inv(EU), piMax = EW - CE, top = u.f(hi);
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.kind === kind ? 'true' : 'false'); });

      // Left: the curve, the chord of the lottery and the certainty equivalent.
      left.textContent = '';
      var a = W.chart(left, { width: 340, height: 270, margin: { left: 40, right: 14 }, title: u.label + ' · ' + say({ en: 'lottery', it: 'lotteria' }) + ' ' + lo + ' / ' + hi, xTitle: 'W', yTitle: 'U' });
      var xa = W.scale.linear([lo, hi], [0, a.w]), ya = W.scale.linear([0, top], [a.h, 0]);
      a.axisY(ya, { ticks: 4, format: tick });
      a.axisXLinear(xa, { ticks: 4, format: tick });
      a.add(svg('line', { x1: xa(lo), y1: ya(u.f(lo)), x2: xa(hi), y2: ya(u.f(hi)), class: 'wm-guide' }));
      a.add(svg('line', { x1: 0, y1: ya(EU), x2: xa(Math.max(EW, CE)), y2: ya(EU), class: 'wm-guide' }));
      a.add(svg('line', { x1: xa(CE), y1: ya(EU), x2: xa(CE), y2: a.h, class: 'wm-guide' }));
      a.add(svg('line', { x1: xa(EW), y1: ya(u.f(EW)), x2: xa(EW), y2: a.h, class: 'wm-guide' }));
      a.clipped(svg('path', { d: W.plotPath(u.f, lo, hi, xa, ya, 200), class: 'wm-line ' + W.series(0) }));
      a.dot(xa(EW), ya(u.f(EW)), W.series(0), 3.5);
      a.dot(xa(EW), ya(EU), W.series(1), 3.5);
      a.dot(xa(CE), ya(EU), 'wm-hl', 5);
      a.label(xa(CE), ya(EU), 'W_CE', { at: 'nw', cls: 'wm-strong' });
      a.label(xa(EW), ya(u.f(EW)), 'U(E[W])', { at: 'nw' });
      a.label(xa(EW), ya(EU), 'E[U]', { at: 'se' });

      // Right: U(E[W] − π) as π moves; the zone is where paying beats the lottery.
      right.textContent = '';
      var b = W.chart(right, { width: 340, height: 270, margin: { left: 40, right: 14 }, title: say({ en: 'paying π for certainty', it: 'pagare π per la certezza' }), xTitle: 'π', yTitle: 'U(E[W] − π)' });
      var xb = W.scale.linear([pmin, pmax], [0, b.w]), yb = W.scale.linear([0, top], [b.h, 0]);
      b.axisY(yb, { ticks: 4, format: tick });
      b.axisXLinear(xb, { ticks: 4, format: tick });
      var edge = xb(Math.max(pmin, Math.min(piMax, pmax)));
      b.clipped(svg('rect', { x: 0, y: 0, width: Math.max(0, edge), height: b.h, class: 'wm-zone' }));
      b.add(svg('line', { x1: 0, y1: yb(EU), x2: b.w, y2: yb(EU), class: 'wm-guide' }));
      b.clipped(svg('path', { d: W.plotPath(function (p) { return u.f(EW - p); }, pmin, pmax, xb, yb, 200), class: 'wm-line ' + W.series(0) }));
      if (piMax >= pmin && piMax <= pmax) b.dot(xb(piMax), yb(EU), W.series(1), 3.5);
      b.dot(xb(P.pi), yb(u.f(EW - P.pi)), W.series(0), 4.5);
      if (piMax >= pmin && piMax <= pmax) b.label(xb(piMax), yb(EU), 'π*', { at: 'ne', cls: 'wm-strong' });
      b.label(0, yb(EU), 'E[U]', { at: 'ne' });

      var gain = u.f(EW - P.pi) - EU;
      set('eu', fix(EU, 2));
      set('ue', fix(u.f(EW), 2));
      set('ce', fix(CE, 2));
      set('max', fix(piMax, 2));
      verdict(Math.abs(gain) < 1e-9 ? 'info' : gain > 0 ? 'pos' : 'neg', Math.abs(gain) < 1e-9
        ? say({ en: 'Indifferent: paying π gives exactly the utility of the lottery.', it: 'Indifferente: pagare π dà esattamente l’utilità della lotteria.' })
        : gain > 0
          ? say({ en: 'Worth it: the sure amount E[W] − π gives more utility than the lottery.', it: 'Conviene: la somma certa E[W] − π dà più utilità della lotteria.' })
          : say({ en: 'Too much: the lottery gives more utility than E[W] − π.', it: 'Troppo: la lotteria dà più utilità di E[W] − π.' }));
    }
    update();
  }
});
