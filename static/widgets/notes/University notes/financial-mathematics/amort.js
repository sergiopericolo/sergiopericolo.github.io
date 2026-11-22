/*
 * amort — a loan amortization plan: French (constant instalments), Italian
 * (constant principal) or American (interest + sinking fund at rate j).
 *   ```wimark-amort {"S": 10000, "m": 8, "i": 0.06, "j": 0.04, "plan": "french"}
 *   ```
 * Stacked bars split each payment into principal (or fund deposit) and
 * interest; the line is the outstanding balance after the payment. The
 * highlight is the total interest paid, the number to compare across plans.
 */
WiMark.register('amort', {
  title: 'Amortization plans',
  description: 'French, Italian and American amortization: principal, interest and outstanding balance per period.',
  example: { opts: { S: 10000, m: 8, i: 0.06, j: 0.04, plan: 'french' } },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var P = { S: W.num(v.S, 10000), m: Math.round(W.num(v.m, 8)), i: W.num(v.i, 0.06), j: W.num(v.j, 0.04) };
    var plan = ['french', 'italian', 'american'].indexOf(v.plan) >= 0 ? v.plan : 'french';
    if (!(P.S > 0) || !(P.m >= 1) || !(P.i > 0) || !(P.j > 0)) throw new Error('amort: need S > 0, m ≥ 1, i > 0, j > 0');
    var fix = function (x, d) { return W.fmt(x, { minimumFractionDigits: d, maximumFractionDigits: d }); };
    var pct = function (x) { return fix(x * 100, 1) + '%'; };
    var money = function (x) { return fix(x, 2); };
    var labels = { french: say({ en: 'French', it: 'francese' }), italian: say({ en: 'Italian', it: 'italiano' }), american: say({ en: 'American', it: 'americano' }) };

    function build() {
      var rows = [], D = P.S, k;
      if (plan === 'french') {
        var R = P.S * P.i / (1 - Math.pow(1 + P.i, -P.m));
        for (k = 1; k <= P.m; k++) { var I = D * P.i, C = R - I; D -= C; rows.push([k, R, C, I, Math.max(D, 0)]); }
      } else if (plan === 'italian') {
        var Ci = P.S / P.m;
        for (k = 1; k <= P.m; k++) { var Ii = D * P.i; D -= Ci; rows.push([k, Ci + Ii, Ci, Ii, Math.max(D, 0)]); }
      } else {
        var A = P.S * P.j / (Math.pow(1 + P.j, P.m) - 1), Ia = P.S * P.i;
        for (k = 1; k <= P.m; k++) { var F = A * (Math.pow(1 + P.j, k) - 1) / P.j; rows.push([k, A + Ia, A, Ia, Math.max(P.S - F, 0)]); }
      }
      return rows;
    }

    var pane = W.pane(el, { title: say({ en: 'Amortization plan', it: 'Piano di ammortamento' }), tag: say({ en: 'interactive', it: 'interattivo' }) });
    var bar = pane.body.appendChild(h('div', 'wm-toolbar'));
    var btns = ['french', 'italian', 'american'].map(function (k) {
      var btn = h('button', { class: 'wm-btn', text: labels[k], attr: { type: 'button' }, on: { click: function () { plan = k; update(); } } });
      btn.dataset.k = k;
      return bar.appendChild(btn);
    });
    var plot = pane.body.appendChild(h('div', { style: { marginTop: '0.6rem' } }));
    var legend = pane.body.appendChild(h('div'));
    var ctl = pane.section();
    var set = W.stats(pane.section('wm-flush'), [
      { key: 'r1', label: say({ en: 'first payment', it: 'prima rata' }) },
      { key: 'rm', label: say({ en: 'last payment', it: 'ultima rata' }) },
      { key: 'tot', label: say({ en: 'total interest', it: 'interessi totali' }), hl: true }
    ]);
    var data = pane.section();

    function controls() {
      ctl.textContent = '';
      W.controls(ctl, P, [
        { key: 'm', label: say({ en: 'periods m', it: 'periodi m' }), min: 2, max: 20, step: 1, format: function (x) { return String(x); } },
        { key: 'i', label: say({ en: 'loan rate i', it: 'tasso i' }), min: 0.005, max: 0.15, step: 0.005, format: pct }
      ].concat(plan === 'american' ? [{ key: 'j', label: say({ en: 'fund rate j', it: 'tasso di accumulo j' }), min: 0.005, max: 0.15, step: 0.005, format: pct }] : []), draw);
    }
    function update() {
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.k === plan)); });
      legend.textContent = '';
      legend.appendChild(W.legend([
        { label: plan === 'american' ? say({ en: 'fund deposit A', it: 'quota di accumulo A' }) : say({ en: 'principal C_k', it: 'quota capitale C_k' }), i: 0 },
        { label: say({ en: 'interest I_k', it: 'quota interessi I_k' }), i: 1 },
        { label: plan === 'american' ? say({ en: 'S − fund F_k', it: 'S − fondo F_k' }) : say({ en: 'balance D_k', it: 'debito residuo D_k' }), i: 2 }
      ]));
      controls();
      draw();
    }
    function draw() {
      var rows = build();
      var keys = rows.map(function (r) { return String(r[0]); });
      var top = Math.max.apply(null, rows.map(function (r) { return r[1]; }));
      plot.textContent = '';
      var c = W.chart(plot, { width: 680, height: 280, margin: { left: 56, right: 56 }, title: say({ en: 'payment split and outstanding balance', it: 'composizione della rata e debito residuo' }), xTitle: say({ en: 'period k', it: 'periodo k' }), yTitle: say({ en: 'payment', it: 'rata' }) });
      var x = W.scale.band(keys, [0, c.w], 0.3), y = W.scale.linear([0, top * 1.1], [c.h, 0], true), yd = W.scale.linear([0, P.S], [c.h, 0]);
      c.axisY(y, { ticks: 4, format: function (t) { return W.compact(t); } });
      var right = svg('g', 'wm-axis');
      yd.ticks(4).forEach(function (t) { right.appendChild(svg('text', { x: c.w + 8, y: yd(t), dy: '0.32em', text: W.compact(t) })); });
      c.add(right);
      c.add(svg('text', { x: c.w + c.margin.right - 4, y: -12, 'text-anchor': 'end', class: 'wm-axis-title', text: plan === 'american' ? 'S − F_k' : 'D_k' }));
      c.axisX(keys, keys.map(function (k) { var s = x(k); return s.x + s.w / 2; }));
      rows.forEach(function (r) {
        var s = x(String(r[0]));
        c.add(svg('rect', { x: s.x, y: y(r[2]), width: s.w, height: c.h - y(r[2]), class: 'wm-mark ' + W.series(0) }));
        c.add(svg('rect', { x: s.x, y: y(r[2] + r[3]), width: s.w, height: y(r[2]) - y(r[2] + r[3]), class: 'wm-mark ' + W.series(1) }));
      });
      var pts = [[0, P.S]].concat(rows.map(function (r) { return [r[0], r[4]]; }));
      var cx = function (k) { if (k === 0) { var s = x(keys[0]); return s.x - s.w * 0.6; } var b = x(String(k)); return b.x + b.w / 2; };
      c.add(svg('path', { d: pts.map(function (p, n) { return (n ? 'L' : 'M') + cx(p[0]).toFixed(1) + ',' + yd(p[1]).toFixed(1); }).join(''), class: 'wm-line ' + W.series(2) }));
      pts.forEach(function (p) { c.dot(cx(p[0]), yd(p[1]), W.series(2), 3); });

      var tot = rows.reduce(function (a, r) { return a + r[3]; }, 0);
      set('r1', money(rows[0][1]));
      set('rm', money(rows[rows.length - 1][1]));
      set('tot', money(tot));
      data.textContent = '';
      W.dataTable(data, ['k', 'R_k', plan === 'american' ? 'A' : 'C_k', 'I_k', plan === 'american' ? 'S − F_k' : 'D_k'],
        rows.map(function (r) { return [String(r[0]), money(r[1]), money(r[2]), money(r[3]), money(r[4])]; }));
    }
    update();
  }
});
