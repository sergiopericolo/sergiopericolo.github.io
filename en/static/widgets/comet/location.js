/*
 * location — p-median, p-center and their compromise on a map. Every
 * village is a customer and a candidate site; the optimum for
 * α·Dmax + (1 − α)·Σ dj·cij is found by enumerating the subsets of p sites.
 * Next to the map, every subset as a point (total distance, max distance):
 * the Pareto front of the two objectives.
 *   ```wimark-location {"p": 3, "alpha": 0}
 *   [["A", 5, 30, 15], ["B", 12, 22, 10], ["C", 30, 8, 12]]
 *   ```
 * Villages are [label, x, y, demand] (km); 4 to 16 of them. Click a village
 * to open or close its branch by hand. The highlight is the chosen solution
 * on the front and the longest trip on the map.
 */
WiMark.register('location', {
  title: 'p-median and p-center on a map',
  description: 'Choose p branches: total distance against the worst trip, with the Pareto front of all subsets.',
  example: {
    opts: { p: 3, alpha: 0 },
    body: '[["1", 4, 30, 15], ["2", 12, 34, 10], ["3", 21, 37, 12], ["4", 33, 33, 18], ["5", 38, 24, 5], ["6", 30, 16, 24], ["7", 8, 18, 15], ["8", 17, 22, 16], ["9", 22, 10, 13], ["10", 36, 5, 22]]'
  },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var V = W.list(v.items).map(function (r, i) {
      if (!Array.isArray(r) || r.length < 4) throw new Error('location: each village is [label, x, y, demand]');
      var x = W.num(r[1], NaN), y = W.num(r[2], NaN), dm = W.num(r[3], NaN);
      if (!isFinite(x) || !isFinite(y) || !(dm >= 0)) throw new Error('location: village ' + (i + 1) + ' needs numbers x, y and demand ≥ 0');
      return { label: String(r[0]), x: x, y: y, d: dm };
    });
    var n = V.length;
    if (n < 4 || n > 16) throw new Error('location: give 4 to 16 villages');
    var D = V.map(function (a) { return V.map(function (b) { return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)); }); });
    var totalDemand = W.sum(V.map(function (a) { return a.d; }));
    var f1 = function (x) { return W.fmt(x, { minimumFractionDigits: 1, maximumFractionDigits: 1 }); };
    var P = { p: Math.max(1, Math.min(n - 1, Math.round(W.num(v.p, 3)))), alpha: Math.max(0, Math.min(1, W.num(v.alpha, 0))) };
    var S = [], manual = false, all = [];

    function evaluate(set) {
      var tot = 0, mx = 0, worst = 0, assign = [];
      for (var j = 0; j < n; j++) {
        var bi = set[0];
        set.forEach(function (i) { if (D[i][j] < D[bi][j]) bi = i; });
        assign.push(bi);
        tot += V[j].d * D[bi][j];
        if (D[bi][j] > mx) { mx = D[bi][j]; worst = j; }
      }
      return { S: set, tot: tot, max: mx, worst: worst, assign: assign };
    }
    function enumerate() {
      all = [];
      var count = 1; for (var q = 0; q < P.p; q++) count = count * (n - q) / (q + 1);
      if (count > 20000) throw new Error('location: too many subsets to enumerate');
      (function rec(start, cur) {
        if (cur.length === P.p) { all.push(evaluate(cur.slice())); return; }
        for (var i = start; i < n; i++) { cur.push(i); rec(i + 1, cur); cur.pop(); }
      })(0, []);
      all.forEach(function (a) { a.front = !all.some(function (b) { return b.tot <= a.tot && b.max <= a.max && (b.tot < a.tot || b.max < a.max); }); });
    }
    function solve() {
      var best = null;
      all.forEach(function (a) { var z = P.alpha * a.max + (1 - P.alpha) * a.tot; if (!best || z < best.z - 1e-9) best = { z: z, a: a }; });
      S = best.a.S.slice();
    }

    var pane = W.pane(el, { title: say({ en: 'Where to keep the branches open', it: 'Dove tenere aperte le filiali' }), tag: say({ en: 'interactive', it: 'interattivo' }) });
    var bar = pane.body.appendChild(h('div', 'wm-toolbar'));
    var bMed = h('button', { type: 'button', class: 'wm-btn', text: 'p-median (α = 0)' });
    var bCen = h('button', { type: 'button', class: 'wm-btn', text: 'p-center (α = 1)' });
    bMed.addEventListener('click', function () { setAlpha(0); });
    bCen.addEventListener('click', function () { setAlpha(1); });
    bar.appendChild(bMed); bar.appendChild(bCen);
    bar.appendChild(h('span', 'wm-small wm-muted', say({ en: '· click a village to open or close it', it: '· clic su un villaggio per aprirlo o chiuderlo' })));
    var grid = pane.body.appendChild(h('div', { class: 'wm-grid', style: { '--cols': 2, marginTop: '0.6rem' } }));
    var left = grid.appendChild(h('div')), right = grid.appendChild(h('div'));
    pane.body.appendChild(W.legend([
      { label: say({ en: 'open branch', it: 'filiale aperta' }), i: 1 },
      { label: say({ en: 'village (size = demand)', it: 'villaggio (dimensione = domanda)' }), i: 0 },
      { label: say({ en: 'longest trip / chosen solution', it: 'viaggio più lungo / soluzione scelta' }), cls: 'wm-hl' }
    ]));
    var ctlHost = pane.section();
    W.controls(ctlHost, P, [
      { key: 'p', label: say({ en: 'branches p', it: 'filiali p' }), min: 1, max: Math.min(n - 1, 8), step: 1, format: String },
      { key: 'alpha', label: say({ en: 'weight α on Dmax', it: 'peso α su Dmax' }), min: 0, max: 1, step: 0.05, format: function (x) { return W.fmt(x, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); } }
    ], function (key) { if (key === 'p') enumerate(); manual = false; solve(); draw(); });
    var set = W.stats(pane.section('wm-flush'), [
      { key: 'tot', label: say({ en: 'total distance Σ dj cij', it: 'distanza totale Σ dj cij' }) },
      { key: 'avg', label: say({ en: 'average distance', it: 'distanza media' }) },
      { key: 'max', label: say({ en: 'max distance Dmax', it: 'distanza max Dmax' }), hl: true },
      { key: 'S', label: say({ en: 'open branches', it: 'filiali aperte' }) }
    ]);
    var verdict = W.note(pane.root);

    function setAlpha(a) {
      P.alpha = a;
      var inputs = ctlHost.querySelectorAll('input');
      if (inputs[1]) { inputs[1].value = a; inputs[1].dispatchEvent(new Event('input')); }
    }

    function draw() {
      bMed.setAttribute('aria-pressed', !manual && P.alpha === 0 ? 'true' : 'false');
      bCen.setAttribute('aria-pressed', !manual && P.alpha === 1 ? 'true' : 'false');
      var cur = evaluate(S);

      left.textContent = '';
      var xs = V.map(function (a) { return a.x; }), ys = V.map(function (a) { return a.y; });
      var ex = W.extent(xs), ey = W.extent(ys), span = Math.max(ex[1] - ex[0], ey[1] - ey[0]) * 1.12 || 1;
      var cx = (ex[0] + ex[1]) / 2, cy = (ey[0] + ey[1]) / 2;
      var c = W.chart(left, { width: 420, height: 400, margin: { left: 12, right: 12, top: 12, bottom: 12 }, title: say({ en: 'map (km) · each village goes to its nearest open branch', it: 'mappa (km) · ogni villaggio va alla filiale aperta più vicina' }) });
      var side = Math.min(c.w, c.h), ox = (c.w - side) / 2;
      var x = W.scale.linear([cx - span / 2, cx + span / 2], [ox, ox + side]), y = W.scale.linear([cy - span / 2, cy + span / 2], [side, 0]);
      c.add(svg('rect', { x: ox, y: 0, width: side, height: side, class: 'wm-outline' }));
      var maxD = Math.max.apply(null, V.map(function (a) { return a.d; })) || 1;
      V.forEach(function (a, j) {
        var b = V[cur.assign[j]];
        if (cur.assign[j] !== j) c.add(svg('line', { x1: x(a.x), y1: y(a.y), x2: x(b.x), y2: y(b.y), class: j === cur.worst ? 'wm-line wm-hl' : 'wm-guide' }));
      });
      V.forEach(function (a, j) {
        var open = S.indexOf(j) >= 0, r = 4 + 7 * Math.sqrt(a.d / maxD), node;
        if (open) {
          node = c.add(svg('rect', { x: x(a.x) - r, y: y(a.y) - r, width: 2 * r, height: 2 * r, class: 'wm-mark ' + W.series(1) }));
          c.avoid(x(a.x) - r, y(a.y) - r, 2 * r, 2 * r);
        } else node = c.dot(x(a.x), y(a.y), W.series(0), r);
        node.style.cursor = 'pointer';
        node.addEventListener('click', function () {
          if (open && S.length === 1) return;
          S = open ? S.filter(function (i) { return i !== j; }) : S.concat([j]);
          manual = true;
          draw();
        });
        c.label(x(a.x), y(a.y), a.label + ' · ' + W.fmt(a.d), { cls: open ? 'wm-strong' : null });
      });

      right.textContent = '';
      var k = W.chart(right, { width: 420, height: 400, margin: { left: 46, right: 14 }, title: say({ en: 'every choice of ', it: 'ogni scelta di ' }) + P.p + say({ en: ' branches · Pareto front', it: ' filiali · frontiera di Pareto' }), xTitle: say({ en: 'total distance', it: 'distanza totale' }), yTitle: 'Dmax' });
      var et = W.extent(all.map(function (a) { return a.tot; }).concat([cur.tot])), em = W.extent(all.map(function (a) { return a.max; }).concat([cur.max]));
      var px = W.scale.linear([et[0] * 0.97, et[1] * 1.02], [0, k.w], true), py = W.scale.linear([em[0] * 0.9, em[1] * 1.05], [k.h, 0], true);
      k.axisY(py, { ticks: 5, format: function (t) { return W.fmt(t); } });
      k.axisXLinear(px, { ticks: 4, format: function (t) { return W.compact(t); } });
      all.forEach(function (a) { if (!a.front) k.add(svg('circle', { cx: px(a.tot), cy: py(a.max), r: 2, class: 'wm-dot wm-s-other' })); });
      var front = all.filter(function (a) { return a.front; }).sort(function (a, b) { return a.tot - b.tot; });
      if (front.length > 1) {
        var dpath = '';
        front.forEach(function (a, i) {
          dpath += (i ? 'H' + px(a.tot) + 'V' + py(a.max) : 'M' + px(a.tot) + ',' + py(a.max));
        });
        k.clipped(svg('path', { d: dpath, class: 'wm-line ' + W.series(0) }));
      }
      front.forEach(function (a) { k.dot(px(a.tot), py(a.max), W.series(0), 3.5); });
      k.dot(px(cur.tot), py(cur.max), 'wm-hl', 6.5);
      k.label(px(cur.tot), py(cur.max), manual ? say({ en: 'your choice', it: 'la tua scelta' }) : 'α = ' + W.fmt(P.alpha, { minimumFractionDigits: 2 }), { cls: 'wm-strong' });

      set('tot', f1(cur.tot));
      set('avg', totalDemand > 0 ? f1(cur.tot / totalDemand) + ' km' : '—');
      set('max', f1(cur.max) + ' km');
      set('S', S.map(function (i) { return V[i].label; }).sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); }).join(', '));
      var onFront = all.some(function (a) { return a.front && Math.abs(a.tot - cur.tot) < 1e-9 && Math.abs(a.max - cur.max) < 1e-9; });
      if (manual && S.length !== P.p) verdict('warn', say({ en: 'You have ', it: 'Hai ' }) + S.length + say({ en: ' branches open, the Board asked for p = ', it: ' filiali aperte, il CdA ne ha chieste p = ' }) + P.p + '.');
      else if (manual) verdict(onFront ? 'pos' : 'info', onFront ? say({ en: 'Your choice is Pareto-efficient: no other set of branches is better on both objectives.', it: 'La tua scelta è Pareto-efficiente: nessun altro insieme di filiali è migliore su entrambi gli obiettivi.' }) : say({ en: 'Your choice is dominated: some other set has both a lower total distance and a lower Dmax.', it: 'La tua scelta è dominata: un altro insieme ha sia distanza totale sia Dmax più basse.' }));
      else verdict('info', (P.alpha === 0 ? say({ en: 'p-median: the lowest total distance; the worst village is ', it: 'p-median: la distanza totale più bassa; il villaggio peggio servito è ' }) + V[cur.worst].label + ' (' + f1(cur.max) + ' km).'
        : P.alpha === 1 ? say({ en: 'p-center: the lowest Dmax, whatever the total. Several sets may tie on Dmax: the model cannot tell them apart.', it: 'p-center: la Dmax più bassa, qualunque sia il totale. Più insiemi possono avere la stessa Dmax: il modello non li distingue.' })
        : say({ en: 'Compromise: minimize α·Dmax + (1 − α)·total. Note the scales: the total is in the hundreds, Dmax in tens.', it: 'Compromesso: si minimizza α·Dmax + (1 − α)·totale. Attenzione alle scale: il totale è nelle centinaia, Dmax nelle decine.' })));
    }
    enumerate();
    solve();
    draw();
  }
});
