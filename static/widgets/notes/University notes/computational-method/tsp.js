/*
 * tsp — constructive heuristics for the symmetric Euclidean TSP, step by
 * step: nearest neighbor, nearest / cheapest / farthest insertion and the
 * Clarke & Wright savings, then optionally 2-opt; against the optimum
 * (Held–Karp) when there are at most 13 nodes.
 *   ```wimark-tsp {"n": 9, "seed": 4, "algo": "nn", "opt2": false}
 *   ```
 *   ```wimark-tsp {"algo": "fi"}
 *   [[50, 50], [20, 80], [85, 75], [70, 20]]
 *   ```
 * A body gives the points [x, y] in a 0–100 square, the first one is the
 * depot 0; without it, n random customers from seed. algo: nn, ni, ci, fi,
 * cw. The highlight is the edge just added (or the 2-opt move).
 */
WiMark.register('tsp', {
  title: 'TSP heuristics',
  description: 'Nearest neighbor, insertion, savings and 2-opt on points in the plane, one step at a time.',
  example: { opts: { n: 9, seed: 4, algo: 'nn', opt2: false } },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var given = W.list(v.items);
    var seed = Math.round(W.num(v.seed, 1)), nRand = Math.round(W.num(v.n, 9));
    var pts;
    function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function makePoints() {
      if (given.length) {
        pts = given.map(function (p, i) {
          var x = W.num(p && p[0], NaN), y = W.num(p && p[1], NaN);
          if (!isFinite(x) || !isFinite(y)) throw new Error('tsp: point ' + i + ' must be [x, y]');
          return [x, y];
        });
      } else {
        var r = rng(seed * 7919 + 13);
        pts = [[50, 50]];
        for (var i = 0; i < nRand; i++) pts.push([6 + r() * 88, 6 + r() * 88]);
      }
      if (pts.length < 4 || pts.length > 30) throw new Error('tsp: use 3 to 29 customers');
    }
    function d(a, b) { var dx = pts[a][0] - pts[b][0], dy = pts[a][1] - pts[b][1]; return Math.sqrt(dx * dx + dy * dy); }
    var f1 = function (x) { return W.fmt(x, { minimumFractionDigits: 1, maximumFractionDigits: 1 }); };
    function cyc(t) { var e = []; for (var i = 0; i < t.length; i++) e.push([t[i], t[(i + 1) % t.length]]); return e; }
    function len(t) { return W.sum(cyc(t).map(function (e) { return d(e[0], e[1]); })); }

    // ─── constructive methods: each returns a trace and the final tour ──────
    function nn() {
      var N = pts.length, t = [0], seen = { 0: true }, tr = [{ edges: [], fresh: [], msg: say({ en: 'Start at the depot 0.', it: 'Si parte dal deposito 0.' }) }];
      while (t.length < N) {
        var last = t[t.length - 1], bj = -1;
        for (var j = 1; j < N; j++) if (!seen[j] && (bj < 0 || d(last, j) < d(last, bj))) bj = j;
        t.push(bj); seen[bj] = true;
        var e = []; for (var q = 0; q + 1 < t.length; q++) e.push([t[q], t[q + 1]]);
        tr.push({ edges: e, fresh: [[last, bj]], msg: say({ en: 'From ', it: 'Da ' }) + last + say({ en: ' the nearest unvisited node is ', it: ' il nodo non visitato più vicino è ' }) + bj + ' (' + f1(d(last, bj)) + ').' });
      }
      tr.push({ edges: cyc(t), fresh: [[t[N - 1], 0]], tour: t, msg: say({ en: 'All nodes visited: go back to 0.', it: 'Tutti i nodi visitati: si torna a 0.' }) });
      return { trace: tr, tour: t };
    }
    function insertion(kind) {
      var N = pts.length, a = -1;
      for (var j = 1; j < N; j++) if (a < 0 || (kind === 'fi' ? d(0, j) > d(0, a) : d(0, j) < d(0, a))) a = j;
      var t = [0, a], seen = { 0: true }; seen[a] = true;
      var tr = [{ edges: cyc(t), fresh: [[0, a]], msg: say({ en: 'Start: 0 and its ', it: 'Inizio: 0 e il nodo ' }) + (kind === 'fi' ? say({ en: 'farthest', it: 'più lontano' }) : say({ en: 'nearest', it: 'più vicino' })) + say({ en: ' node ', it: ', ' }) + a + say({ en: ', there and back.', it: ', andata e ritorno.' }) }];
      function bestPos(vv) {
        var bq = 0, bc = Infinity;
        for (var q = 0; q < t.length; q++) { var x = t[q], y = t[(q + 1) % t.length], c = d(x, vv) + d(vv, y) - d(x, y); if (c < bc) { bc = c; bq = q; } }
        return { q: bq, c: bc };
      }
      while (t.length < N) {
        var vv = -1, pos = null, key = null;
        for (var u = 1; u < N; u++) {
          if (seen[u]) continue;
          if (kind === 'ci') { var p = bestPos(u); if (!pos || p.c < pos.c) { pos = p; vv = u; } continue; }
          var m = Infinity; t.forEach(function (w) { m = Math.min(m, d(u, w)); });
          if (vv < 0 || (kind === 'fi' ? m > key : m < key)) { vv = u; key = m; }
        }
        if (kind !== 'ci') pos = bestPos(vv);
        var x = t[pos.q], y = t[(pos.q + 1) % t.length];
        t.splice(pos.q + 1, 0, vv); seen[vv] = true;
        var why = kind === 'ci' ? say({ en: 'Cheapest insertion overall: node ', it: 'Inserimento più economico in assoluto: nodo ' }) + vv
          : (kind === 'fi' ? say({ en: 'Farthest from the tour: node ', it: 'Più lontano dal giro: nodo ' }) : say({ en: 'Nearest to the tour: node ', it: 'Più vicino al giro: nodo ' })) + vv + ' (' + f1(key) + ')';
        tr.push({ edges: cyc(t), fresh: [[x, vv], [vv, y]], removed: [[x, y]], msg: why + say({ en: ', placed between ', it: ', inserito tra ' }) + x + say({ en: ' and ', it: ' e ' }) + y + ': +' + f1(pos.c) + '.' });
      }
      tr[tr.length - 1].tour = t;
      return { trace: tr, tour: t };
    }
    function savings() {
      var N = pts.length, routes = [], where = {}, list = [];
      for (var i = 1; i < N; i++) { routes.push([i]); where[i] = routes.length - 1; }
      for (var a = 1; a < N; a++) for (var b = a + 1; b < N; b++) list.push({ i: a, j: b, s: d(a, 0) + d(0, b) - d(a, b) });
      list.sort(function (x, y) { return y.s - x.s; });
      function edgesOf() { var e = []; routes.forEach(function (r) { if (!r) return; e.push([0, r[0]]); for (var q = 0; q + 1 < r.length; q++) e.push([r[q], r[q + 1]]); e.push([r[r.length - 1], 0]); }); return e; }
      var tr = [{ edges: edgesOf(), fresh: [], msg: say({ en: 'Start: one return trip 0 → i → 0 per customer. Savings sorted from the largest.', it: 'Inizio: un viaggio 0 → i → 0 per cliente. Risparmi ordinati dal più grande.' }) }];
      list.forEach(function (sv) {
        var ri = where[sv.i], rj = where[sv.j];
        if (ri === rj) return;
        var A = routes[ri], B = routes[rj];
        var aEnd = A[A.length - 1] === sv.i, aStart = A[0] === sv.i, bStart = B[0] === sv.j, bEnd = B[B.length - 1] === sv.j;
        if (!(aEnd || aStart) || !(bStart || bEnd)) return;
        if (!aEnd) A = A.slice().reverse();
        if (!bStart) B = B.slice().reverse();
        var M = A.concat(B);
        routes[ri] = M; routes[rj] = null;
        M.forEach(function (x) { where[x] = ri; });
        tr.push({ edges: edgesOf(), fresh: [[sv.i, sv.j]], removed: [[sv.i, 0], [0, sv.j]], msg: say({ en: 'Link ', it: 'Si collegano ' }) + sv.i + ' – ' + sv.j + say({ en: ': saving s = c', it: ': risparmio s = c' }) + sv.i + '0 + c0' + sv.j + ' − c' + sv.i + sv.j + ' = ' + f1(sv.s) + '.' });
      });
      var t = [0].concat(routes.filter(Boolean)[0]);
      tr[tr.length - 1].tour = t;
      return { trace: tr, tour: t };
    }
    function twoOpt(t0, tr) {
      var t = t0.slice(), N = t.length, guard = 0;
      while (guard++ < 500) {
        var best = -1e-9, ba = -1, bb = -1;
        for (var a = 0; a < N - 1; a++) for (var b = a + 2; b < N; b++) {
          if (a === 0 && b === N - 1) continue;
          var p = t[a], q = t[a + 1], r = t[b], s = t[(b + 1) % N];
          var delta = d(p, r) + d(q, s) - d(p, q) - d(r, s);
          if (delta < best) { best = delta; ba = a; bb = b; }
        }
        if (ba < 0) break;
        var i = t[ba], j = t[ba + 1], pp = t[bb], qq = t[(bb + 1) % N];
        t = t.slice(0, ba + 1).concat(t.slice(ba + 1, bb + 1).reverse(), t.slice(bb + 1));
        tr.push({ edges: cyc(t), fresh: [[i, pp], [j, qq]], removed: [[i, j], [pp, qq]], two: true, msg: '2-opt: ' + say({ en: 'remove ', it: 'si tolgono ' }) + '(' + i + ',' + j + ') (' + pp + ',' + qq + '), ' + say({ en: 'add ', it: 'si aggiungono ' }) + '(' + i + ',' + pp + ') (' + j + ',' + qq + '): s = ' + f1(best) + '.' });
      }
      tr.push({ edges: cyc(t), fresh: [], tour: t, two: true, msg: say({ en: 'No pair of edges gives s < 0: 2-opt stops at a local optimum.', it: 'Nessuna coppia di archi dà s < 0: il 2-opt si ferma in un ottimo locale.' }) });
      return t;
    }
    function heldKarp() {
      var N = pts.length;
      if (N > 13) return null;
      var M = N - 1, full = (1 << M) - 1, D = [], i, j, S;
      for (S = 0; S <= full; S++) { D.push(new Float64Array(M)); for (i = 0; i < M; i++) D[S][i] = Infinity; }
      for (i = 0; i < M; i++) D[1 << i][i] = d(0, i + 1);
      for (S = 1; S <= full; S++) for (i = 0; i < M; i++) {
        if (!(S & (1 << i)) || D[S][i] === Infinity) continue;
        for (j = 0; j < M; j++) { if (S & (1 << j)) continue; var T = S | (1 << j), c = D[S][i] + d(i + 1, j + 1); if (c < D[T][j]) D[T][j] = c; }
      }
      var best = Infinity; for (i = 0; i < M; i++) best = Math.min(best, D[full][i] + d(i + 1, 0));
      return best;
    }

    var ALGOS = [
      { key: 'nn', label: 'nearest neighbor', run: nn },
      { key: 'ni', label: say({ en: 'nearest insertion', it: 'nearest insertion' }), run: function () { return insertion('ni'); } },
      { key: 'ci', label: 'cheapest insertion', run: function () { return insertion('ci'); } },
      { key: 'fi', label: 'farthest insertion', run: function () { return insertion('fi'); } },
      { key: 'cw', label: 'Clarke & Wright', run: savings }
    ];
    var algo = ALGOS.some(function (a) { return a.key === v.algo; }) ? v.algo : 'nn';
    var use2 = !!v.opt2, P = { step: 0 }, trace = [], built = 0, after = 0, opt = null;

    var pane = W.pane(el, { title: say({ en: 'TSP: build a tour, then improve it', it: 'TSP: costruire un giro, poi migliorarlo' }), tag: say({ en: 'interactive', it: 'interattivo' }) });
    var bar = pane.body.appendChild(h('div', 'wm-toolbar'));
    var algoBtns = ALGOS.map(function (a) {
      var b = h('button', { type: 'button', class: 'wm-btn', text: a.label });
      b.addEventListener('click', function () { algo = a.key; rebuild(true); });
      bar.appendChild(b);
      return b;
    });
    var bar2 = pane.body.appendChild(h('div', { class: 'wm-toolbar', style: { marginTop: '0.5rem' } }));
    var b2 = h('button', { type: 'button', class: 'wm-btn', text: '+ 2-opt' });
    b2.addEventListener('click', function () { use2 = !use2; rebuild(true); });
    bar2.appendChild(b2);
    if (!given.length) {
      var again = h('button', { type: 'button', class: 'wm-btn', text: say({ en: 'new points', it: 'nuovi punti' }) });
      again.addEventListener('click', function () { seed++; makePoints(); opt = heldKarp(); rebuild(true); });
      bar2.appendChild(again);
    }
    var plot = pane.body.appendChild(h('div', { style: { marginTop: '0.6rem' } }));
    pane.body.appendChild(W.legend([
      { label: say({ en: 'tour', it: 'giro' }), i: 0 },
      { label: say({ en: 'just added', it: 'appena aggiunto' }), cls: 'wm-hl' }
    ], 'line'));
    var stepHost = pane.section();
    var set = W.stats(pane.section('wm-flush'), [
      { key: 'cur', label: say({ en: 'length now', it: 'lunghezza ora' }) },
      { key: 'built', label: say({ en: 'heuristic', it: 'euristica' }) },
      { key: 'two', label: say({ en: 'after 2-opt', it: 'dopo 2-opt' }) },
      { key: 'opt', label: say({ en: 'optimum', it: 'ottimo' }), hl: true },
      { key: 'gap', label: say({ en: 'gap', it: 'scarto' }) }
    ]);
    var verdict = W.note(pane.root);

    function rebuild(toEnd) {
      var res = ALGOS.filter(function (a) { return a.key === algo; })[0].run();
      trace = res.trace; built = len(res.tour);
      after = use2 ? len(twoOpt(res.tour, trace)) : null;
      P.step = toEnd ? trace.length - 1 : 0;
      stepHost.textContent = '';
      W.controls(stepHost, P, [{ key: 'step', label: say({ en: 'step', it: 'passo' }), min: 0, max: trace.length - 1, step: 1, format: function (x) { return x + ' / ' + (trace.length - 1); } }], draw, 1);
      draw();
    }

    function draw() {
      var st = trace[P.step];
      algoBtns.forEach(function (b, i) { b.setAttribute('aria-pressed', ALGOS[i].key === algo ? 'true' : 'false'); });
      b2.setAttribute('aria-pressed', use2 ? 'true' : 'false');
      plot.textContent = '';
      var c = W.chart(plot, { width: 680, height: 430, margin: { left: 16, right: 16, top: 12, bottom: 12 } });
      var side = Math.min(c.w, c.h), ox = (c.w - side) / 2;
      var x = W.scale.linear([0, 100], [ox, ox + side]), y = W.scale.linear([0, 100], [side, 0]);
      c.add(svg('rect', { x: ox, y: 0, width: side, height: side, class: 'wm-outline' }));
      function seg(e, cls) { c.add(svg('line', { x1: x(pts[e[0]][0]), y1: y(pts[e[0]][1]), x2: x(pts[e[1]][0]), y2: y(pts[e[1]][1]), class: cls })); }
      function same(a, b) { return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]); }
      (st.removed || []).forEach(function (e) { if (!st.edges.some(function (f) { return same(e, f); })) seg(e, 'wm-guide'); });
      st.edges.forEach(function (e) { if (!st.fresh.some(function (f) { return same(e, f); })) seg(e, 'wm-line ' + W.series(0)); });
      st.fresh.forEach(function (e) { seg(e, 'wm-line wm-hl'); });
      pts.forEach(function (p, i) {
        if (i === 0) {
          c.add(svg('rect', { x: x(p[0]) - 7, y: y(p[1]) - 7, width: 14, height: 14, class: 'wm-mark ' + W.series(1) }));
          c.avoid(x(p[0]) - 7, y(p[1]) - 7, 14, 14);
        } else c.dot(x(p[0]), y(p[1]), W.series(0), 4.5);
        c.label(x(p[0]), y(p[1]), String(i), { cls: i === 0 ? 'wm-strong' : null });
      });
      var isTour = !!(st.tour || st.two);
      var curLen = W.sum(st.edges.map(function (e) { return d(e[0], e[1]); }));
      set('cur', f1(curLen) + (isTour ? '' : say({ en: ' (partial)', it: ' (parziale)' })));
      set('built', f1(built));
      set('two', after === null ? '—' : f1(after));
      set('opt', opt === null ? '—' : f1(opt));
      var fin = after === null ? built : after;
      set('gap', opt === null ? '—' : '+' + W.fmt((fin / opt - 1) * 100, { maximumFractionDigits: 1 }) + '%');
      var last = P.step === trace.length - 1;
      verdict(last && opt !== null && fin - opt < 1e-6 ? 'pos' : 'info', st.msg + (last && opt !== null ? (fin - opt < 1e-6 ? say({ en: ' The tour is optimal.', it: ' Il giro è ottimo.' }) : say({ en: ' Final tour ', it: ' Giro finale ' }) + W.fmt((fin / opt - 1) * 100, { maximumFractionDigits: 1 }) + say({ en: '% above the optimum.', it: '% sopra l\'ottimo.' })) : ''));
    }

    makePoints();
    opt = heldKarp();
    rebuild(true);
  }
});
