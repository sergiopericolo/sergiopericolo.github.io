/*
 * eventstudy — a CAPM event study on simulated daily returns: for each of N
 * events, α and β are estimated on the window t−250…t−30, abnormal returns
 * AR = r − (α̂ + β̂ r_M) are computed on t−1…t+5 and cumulated; the chart shows
 * the average CAR across events with a 95% band.
 *   ```wimark-eventstudy {"shock": -0.007, "rebound": 1, "noise": 0.015, "events": 16}
 *   ```
 * shock hits on day +1; rebound is the share of it reversed on day +2. The
 * highlight is day +1, the day of the shock, and its t-statistic.
 */
WiMark.register('eventstudy', {
  title: 'Event study: abnormal returns and CARs',
  description: 'Average cumulative abnormal returns around an event, estimated with the CAPM.',
  example: { opts: { shock: -0.007, rebound: 1, noise: 0.015, events: 16 } },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var P = { shock: W.num(v.shock, -0.007), rebound: W.num(v.rebound, 1), noise: W.num(v.noise, 0.015), events: Math.round(W.num(v.events, 16)) };
    var seed = 5, E0 = -250, E1 = -30, D0 = -1, D1 = 5;
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

    var pane = W.pane(el, { title: say({ en: 'Event study: abnormal returns and CARs', it: 'Event study: rendimenti anomali e CAR' }), tag: say({ en: 'simulation', it: 'simulazione' }) });
    var plot = pane.body.appendChild(h('div'));
    pane.body.appendChild(W.legend([
      { label: say({ en: 'average CAR', it: 'CAR medio' }), i: 0 },
      { label: say({ en: 'true cumulative effect', it: 'effetto cumulato vero' }), cls: 'wm-s-other' },
      { label: say({ en: '95% band', it: 'banda al 95%' }), i: 2 }
    ], 'line'));
    var sec = pane.section();
    W.controls(sec, P, [
      { key: 'shock', label: say({ en: 'day +1 shock', it: 'shock al giorno +1' }), min: -0.03, max: 0.03, step: 0.0005, format: pct },
      { key: 'rebound', label: say({ en: 'reversal on day +2', it: 'rientro al giorno +2' }), min: 0, max: 1.5, step: 0.05, format: function (x) { return Math.round(x * 100) + '%'; } },
      { key: 'noise', label: say({ en: 'daily σ_ε', it: 'σ_ε giornaliera' }), min: 0.002, max: 0.04, step: 0.001, format: pct },
      { key: 'events', label: say({ en: 'number of events', it: 'numero di eventi' }), min: 1, max: 100, step: 1, format: function (x) { return String(x); } }
    ], update);
    var again = h('button', { type: 'button', class: 'wm-btn', text: say({ en: 'new sample', it: 'nuovo campione' }) });
    again.addEventListener('click', function () { seed++; update(); });
    sec.appendChild(h('div', { class: 'wm-toolbar', style: { marginTop: '0.5rem' } }, again));
    var set = W.stats(pane.section('wm-flush'), [
      { key: 'a1', label: say({ en: 'average AR, day +1', it: 'AR medio, giorno +1' }) },
      { key: 't1', label: say({ en: 't-stat, day +1', it: 't-stat, giorno +1' }), hl: true },
      { key: 'c', label: 'CAR(−1, +5)' }
    ]);

    function update() {
      var r = rng(seed);
      var n01 = function () { return Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r()); };
      var L = D1 - D0 + 1, sumAR = [], s2 = 0, k, d;
      for (k = 0; k < L; k++) sumAR.push(0);
      for (var e = 0; e < P.events; e++) {
        var beta = 0.8 + 0.6 * r(), alpha = 0.0002 * n01();
        var m = [], z = [];
        for (d = E0; d <= D1; d++) {
          var mt = 0.0003 + 0.01 * n01();
          var eff = d === 1 ? P.shock : d === 2 ? -P.rebound * P.shock : 0;
          m.push(mt);
          z.push(alpha + beta * mt + P.noise * n01() + eff);
        }
        var n = E1 - E0 + 1, mm = 0, mz = 0, i;
        for (i = 0; i < n; i++) { mm += m[i]; mz += z[i]; }
        mm /= n; mz /= n;
        var sxy = 0, sxx = 0;
        for (i = 0; i < n; i++) { sxy += (m[i] - mm) * (z[i] - mz); sxx += (m[i] - mm) * (m[i] - mm); }
        var bh = sxy / sxx, ah = mz - bh * mm, sse = 0;
        for (i = 0; i < n; i++) { var res = z[i] - ah - bh * m[i]; sse += res * res; }
        s2 += sse / (n - 2);
        for (k = 0; k < L; k++) {
          var idx = D0 + k - E0;
          sumAR[k] += z[idx] - ah - bh * m[idx];
        }
      }
      var N = P.events, sig = Math.sqrt(s2 / N);
      var aar = sumAR.map(function (x) { return x / N; });
      var car = [], acc = 0, truth = [], tacc = 0;
      aar.forEach(function (x, k2) {
        acc += x; car.push(acc);
        var day = D0 + k2;
        tacc += day === 1 ? P.shock : day === 2 ? -P.rebound * P.shock : 0;
        truth.push(tacc);
      });
      var band = car.map(function (c, k2) { return 1.96 * sig * Math.sqrt(k2 + 1) / Math.sqrt(N); });

      plot.textContent = '';
      var c = W.chart(plot, { width: 680, height: 280, margin: { left: 50, right: 20 }, title: say({ en: 'average cumulative abnormal return, days −1 to +5', it: 'rendimento anomalo cumulato medio, giorni da −1 a +5' }), xTitle: say({ en: 'day', it: 'giorno' }), yTitle: 'CAR' });
      var vals = car.map(function (x, k2) { return x + band[k2]; }).concat(car.map(function (x, k2) { return x - band[k2]; }), truth, [0]);
      var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = (hi - lo) * 0.08 || 0.001;
      var x = W.scale.linear([D0, D1], [0, c.w]), y = W.scale.linear([lo - pad, hi + pad], [c.h, 0], true);
      c.axisY(y, { ticks: 5, format: function (q) { return pct(q, 1); } });
      c.axisXLinear(x, { ticks: 6, format: function (q) { return (q > 0 ? '+' : '') + Math.round(q); } });
      var up = '', dn = '', path = '', tp = '', area = [];
      car.forEach(function (cv, k2) { area.push(x(D0 + k2).toFixed(1) + ',' + y(cv + band[k2]).toFixed(1)); });
      car.slice().reverse().forEach(function (cv, k3) {
        var k2 = car.length - 1 - k3;
        area.push(x(D0 + k2).toFixed(1) + ',' + y(cv - band[k2]).toFixed(1));
      });
      car.forEach(function (cv, k2) {
        var px = x(D0 + k2).toFixed(1), cmd = k2 ? 'L' : 'M';
        up += cmd + px + ',' + y(cv + band[k2]).toFixed(1);
        dn += cmd + px + ',' + y(cv - band[k2]).toFixed(1);
        path += cmd + px + ',' + y(cv).toFixed(1);
        tp += cmd + px + ',' + y(truth[k2]).toFixed(1);
      });
      c.clipped(svg('path', { d: 'M' + area.join('L') + 'Z', class: 'wm-zone' }));
      c.clipped(svg('path', { d: up, class: 'wm-line ' + W.series(2) }));
      c.clipped(svg('path', { d: dn, class: 'wm-line ' + W.series(2) }));
      c.clipped(svg('path', { d: tp, class: 'wm-line wm-s-other' }));
      c.clipped(svg('path', { d: path, class: 'wm-line ' + W.series(0) }));
      car.forEach(function (cv, k2) { c.dot(x(D0 + k2), y(cv), D0 + k2 === 1 ? 'wm-hl' : W.series(0), D0 + k2 === 1 ? 5 : 3.5); });
      c.add(svg('line', { x1: x(0), x2: x(0), y1: 0, y2: c.h, class: 'wm-guide' }));
      c.label(x(0), 0, say({ en: 'event', it: 'evento' }), { at: 'se' });
      c.label(x(1), y(car[1 - D0]), 'AR +1', { at: 'sw', cls: 'wm-strong' });

      var a1 = aar[1 - D0];
      set('a1', pct(a1));
      set('t1', fix(a1 / (sig / Math.sqrt(N)), 2));
      set('c', pct(car[L - 1]));
    }
    update();
  }
});
