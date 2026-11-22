/*
 * regimes — the three financial regimes at the same unit rate i: simple
 * interest, compound interest and commercial discount, as accumulation
 * factors f(t) or discount factors v(t).
 *   ```wimark-regimes {"i": 0.2, "t": 1.6, "view": "f"}
 *   ```
 * view is "f" (accumulation) or "v" (discount). Sliders move i and the date t;
 * the readouts give each factor at t. The highlight is the common point at
 * t = 1, where the order of the curves flips.
 */
WiMark.register('regimes', {
  title: 'Simple, compound, commercial',
  description: 'Accumulation or discount factors of the three regimes at the same unit rate.',
  example: { opts: { i: 0.2, t: 1.6, view: 'f' } },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var P = { i: W.num(v.i, 0.2), t: W.num(v.t, 1.6) };
    var view = v.view === 'v' ? 'v' : 'f';
    if (!(P.i > 0)) throw new Error('regimes: i must be positive');
    var T = 3;
    var fix = function (x, d) { return W.fmt(x, { minimumFractionDigits: d, maximumFractionDigits: d }); };
    var pct = function (x) { return fix(x * 100, 1) + '%'; };
    var names = [say({ en: 'simple', it: 'semplice' }), say({ en: 'compound', it: 'composto' }), say({ en: 'commercial', it: 'commerciale' })];
    function d() { return P.i / (1 + P.i); }
    function fs(t) { return 1 + P.i * t; }
    function fc(t) { return Math.pow(1 + P.i, t); }
    function fa(t) { var q = 1 - d() * t; return q > 0 ? 1 / q : NaN; }
    function vs(t) { return 1 / fs(t); }
    function vc(t) { return 1 / fc(t); }
    function va(t) { var q = 1 - d() * t; return q > 0 ? q : NaN; }

    var pane = W.pane(el, { title: say({ en: 'Three regimes, one rate', it: 'Tre regimi, un tasso' }), tag: say({ en: 'interactive', it: 'interattivo' }) });
    var bar = pane.body.appendChild(h('div', 'wm-toolbar'));
    var btns = [['f', say({ en: 'accumulation f(t)', it: 'montante f(t)' })], ['v', say({ en: 'discount v(t)', it: 'attualizzazione v(t)' })]].map(function (b) {
      var btn = h('button', { class: 'wm-btn', text: b[1], attr: { type: 'button' }, on: { click: function () { view = b[0]; update(); } } });
      btn.dataset.k = b[0];
      return bar.appendChild(btn);
    });
    var plot = pane.body.appendChild(h('div', { style: { marginTop: '0.6rem' } }));
    pane.body.appendChild(W.legend(names.map(function (n, k) { return { label: n, i: k }; }), 'line'));
    W.controls(pane.section(), P, [
      { key: 'i', label: say({ en: 'unit rate i', it: 'tasso unitario i' }), min: 0.01, max: 0.5, step: 0.01, format: pct },
      { key: 't', label: say({ en: 'date t', it: 'epoca t' }), min: 0, max: T, step: 0.05, format: function (x) { return fix(x, 2); } }
    ], update);
    var set = W.stats(pane.section('wm-flush'), [
      { key: 's', label: names[0] }, { key: 'c', label: names[1] }, { key: 'a', label: names[2] }
    ]);
    var note = W.note(pane.section('wm-flush'));

    function update() {
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.k === view)); });
      var fns = view === 'f' ? [fs, fc, fa] : [vs, vc, va];
      var lim = 1 / d();
      var y0 = view === 'f' ? 1 : 0, y1 = view === 'f' ? Math.max(fs(T), fc(T)) * 1.25 : 1.02;
      plot.textContent = '';
      var c = W.chart(plot, { width: 680, height: 290, margin: { left: 48, right: 20 }, title: view === 'f' ? say({ en: 'accumulation factor against time', it: 'fattore di montante nel tempo' }) : say({ en: 'discount factor against time', it: 'fattore di attualizzazione nel tempo' }), xTitle: 't', yTitle: view === 'f' ? 'f(t)' : 'v(t)' });
      var x = W.scale.linear([0, T], [0, c.w]), y = W.scale.linear([y0, y1], [c.h, 0]);
      c.axisY(y, { ticks: 5, format: function (t) { return fix(t, 2); } });
      c.axisXLinear(x, { ticks: 6, format: function (t) { return fix(t, 1); } });
      if (lim < T) c.add(svg('line', { x1: x(lim), x2: x(lim), y1: 0, y2: c.h, class: 'wm-guide' }));
      fns.forEach(function (f, k) {
        c.clipped(svg('path', { d: W.plotPath(f, 0, Math.min(T, lim - 1e-6), x, y, 240), class: 'wm-line ' + W.series(k) }));
      });
      c.add(svg('line', { x1: x(P.t), x2: x(P.t), y1: 0, y2: c.h, class: 'wm-guide' }));
      fns.forEach(function (f, k) { var val = f(P.t); if (isFinite(val) && val <= y1) c.dot(x(P.t), y(val), W.series(k), 3.5); });
      var one = view === 'f' ? 1 + P.i : 1 / (1 + P.i);
      c.dot(x(1), y(one), 'wm-hl', 5);
      c.label(x(1), y(one), 't = 1', { at: view === 'f' ? 'nw' : 'sw', cls: 'wm-strong' });
      if (lim < T) c.label(x(lim), 12, 't = 1/d', { at: 'w' });

      var show = function (val) { return isFinite(val) ? fix(val, 4) : say({ en: 'undefined', it: 'non definito' }); };
      set('s', show(fns[0](P.t)));
      set('c', show(fns[1](P.t)));
      set('a', show(fns[2](P.t)));
      var order = [0, 1, 2].sort(function (a, b) { return fns[b](P.t) - fns[a](P.t); }).map(function (k) { return names[k]; }).join(' > ');
      if (P.t >= lim) note('warn', say({ en: 'Beyond t = 1/d the commercial regime has no meaning: v(t) = 1 − dt ≤ 0.', it: 'Oltre t = 1/d il regime commerciale perde significato: v(t) = 1 − dt ≤ 0.' }));
      else if (P.t === 0 || Math.abs(P.t - 1) < 1e-9) note('info', say({ en: 'At t = 0 and t = 1 the three regimes agree.', it: 'In t = 0 e t = 1 i tre regimi coincidono.' }));
      else note('info', say({ en: 'At t = ', it: 'In t = ' }) + fix(P.t, 2) + ': ' + order + '. ' + say({ en: 'The order flips at t = 1.', it: "L'ordine si inverte in t = 1." }) + ' d < δ < i: ' + pct(d()) + ' < ' + pct(Math.log(1 + P.i)) + ' < ' + pct(P.i) + '.');
    }
    update();
  }
});
