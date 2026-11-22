/*
 * annuity — a constant periodic annuity on a timeline: each payment R as a
 * bar and, inside it, its present value at t = 0 under compound interest.
 *   ```wimark-annuity {"R": 100, "m": 8, "i": 0.06, "p": 0, "due": false}
 *   ```
 * m payments, periodic rate i, deferral p periods; due = true pays at the
 * start of each period. Readouts: present value (highlighted), accumulated
 * value, perpetuity value with the same payment.
 */
WiMark.register('annuity', {
  title: 'Annuity timeline',
  description: 'Payments of a constant annuity and their present values; ordinary or due, immediate or deferred.',
  example: { opts: { R: 100, m: 8, i: 0.06, p: 0, due: false } },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var P = { R: W.num(v.R, 100), m: Math.round(W.num(v.m, 8)), i: W.num(v.i, 0.06), p: Math.round(W.num(v.p, 0)) };
    var due = v.due === true;
    if (!(P.R > 0) || !(P.m >= 1) || !(P.i > 0) || P.p < 0) throw new Error('annuity: need R > 0, m ≥ 1, i > 0, p ≥ 0');
    var fix = function (x, d) { return W.fmt(x, { minimumFractionDigits: d, maximumFractionDigits: d }); };
    var pct = function (x) { return fix(x * 100, 1) + '%'; };

    var pane = W.pane(el, { title: say({ en: 'Annuity on a timeline', it: 'Rendita sulla linea dei tempi' }), tag: say({ en: 'interactive', it: 'interattivo' }) });
    var bar = pane.body.appendChild(h('div', 'wm-toolbar'));
    var btns = [[false, say({ en: 'ordinary (end of period)', it: 'posticipata' })], [true, say({ en: 'due (start of period)', it: 'anticipata' })]].map(function (b) {
      var btn = h('button', { class: 'wm-btn', text: b[1], attr: { type: 'button' }, on: { click: function () { due = b[0]; update(); } } });
      btn.dataset.k = String(b[0]);
      return bar.appendChild(btn);
    });
    var plot = pane.body.appendChild(h('div', { style: { marginTop: '0.6rem' } }));
    pane.body.appendChild(W.legend([
      { label: say({ en: 'payment R', it: 'rata R' }), i: 0 },
      { label: say({ en: 'its present value at t = 0', it: 'suo valore attuale in t = 0' }), i: 1 }
    ]));
    W.controls(pane.section(), P, [
      { key: 'm', label: say({ en: 'payments m', it: 'rate m' }), min: 1, max: 20, step: 1, format: function (x) { return String(x); } },
      { key: 'i', label: say({ en: 'periodic rate i', it: 'tasso periodale i' }), min: 0.005, max: 0.2, step: 0.005, format: pct },
      { key: 'p', label: say({ en: 'deferral p', it: 'differimento p' }), min: 0, max: 10, step: 1, format: function (x) { return String(x); } },
      { key: 'R', label: say({ en: 'payment R', it: 'rata R' }), min: 10, max: 500, step: 10, format: function (x) { return fix(x, 0); } }
    ], update);
    var set = W.stats(pane.section('wm-flush'), [
      { key: 'pv', label: say({ en: 'present value W(0)', it: 'valore attuale W(0)' }), hl: true },
      { key: 'fv', label: say({ en: 'accumulated value', it: 'montante' }) },
      { key: 'sum', label: say({ en: 'sum of payments', it: 'somma delle rate' }) },
      { key: 'perp', label: say({ en: 'perpetuity value', it: 'rendita perpetua' }) }
    ]);
    var note = W.note(pane.section('wm-flush'));

    function update() {
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.k === String(due))); });
      var first = P.p + (due ? 0 : 1), last = first + P.m - 1, end = P.p + P.m;
      var keys = [];
      for (var t = 0; t <= end; t++) keys.push(String(t));
      var pv = 0, flows = [];
      for (var k = first; k <= last; k++) { var d = P.R * Math.pow(1 + P.i, -k); pv += d; flows.push([k, d]); }
      var a = (1 - Math.pow(1 + P.i, -P.m)) / P.i;
      var fv = P.R * (Math.pow(1 + P.i, P.m) - 1) / P.i * (due ? 1 + P.i : 1);
      var perp = P.R / P.i * (due ? 1 + P.i : 1) * Math.pow(1 + P.i, -P.p);

      plot.textContent = '';
      var c = W.chart(plot, { width: 680, height: 260, margin: { left: 48, right: 16 }, title: say({ en: 'payments and their present values', it: 'rate e loro valori attuali' }), xTitle: say({ en: 'period', it: 'periodo' }), yTitle: '€' });
      var x = W.scale.band(keys, [0, c.w], 0.25), y = W.scale.linear([0, P.R * 1.15], [c.h, 0]);
      c.axisY(y, { ticks: 4, format: function (t) { return fix(t, 0); } });
      c.axisX(keys, keys.map(function (k) { var s = x(k); return s.x + s.w / 2; }));
      flows.forEach(function (f) {
        var s = x(String(f[0]));
        c.add(svg('rect', { x: s.x, y: y(P.R), width: s.w, height: c.h - y(P.R), class: 'wm-mark ' + W.series(0) }));
        c.add(svg('rect', { x: s.x + s.w * 0.2, y: y(f[1]), width: s.w * 0.6, height: c.h - y(f[1]), class: 'wm-mark ' + W.series(1) }));
      });
      if (P.p > 0) {
        var s0 = x('0'), sp = x(String(P.p));
        c.add(svg('rect', { x: s0.x, y: 0, width: sp.x + sp.w - s0.x, height: c.h, class: 'wm-zone' }));
        c.label((s0.x + sp.x + sp.w) / 2, 14, say({ en: 'deferral', it: 'differimento' }), {});
      }
      var z = x('0');
      c.dot(z.x + z.w / 2, c.h, 'wm-hl', 5);
      c.label(z.x + z.w / 2, c.h - 6, 'W(0)', { at: 'ne', cls: 'wm-strong' });

      set('pv', fix(pv, 2));
      set('fv', fix(fv, 2));
      set('sum', fix(P.R * P.m, 2));
      set('perp', fix(perp, 2));
      var sym = (due ? 'ä' : 'a') + '(' + P.m + ', ' + pct(P.i) + ') = ' + fix(a * (due ? 1 + P.i : 1), 4);
      note('info', 'W(0) = R · ' + (P.p ? 'v^' + P.p + ' · ' : '') + sym + '. ' + say({ en: 'The accumulated value ignores the deferral.', it: 'Il montante non dipende dal differimento.' }));
    }
    update();
  }
});
