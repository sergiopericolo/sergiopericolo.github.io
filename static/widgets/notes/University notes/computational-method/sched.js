/*
 * sched — a Gantt chart for one machine or m identical parallel machines.
 * Pick a dispatching rule (SPT, WSPT, EDD, ERT, ECT, LPT) or reorder the jobs
 * by hand, and compare the objective with the optimum found by enumeration.
 *   ```wimark-sched {"machines": 1, "obj": "sumwc", "rules": ["given", "spt", "wspt"]}
 *   [{"j": "1", "p": 3, "w": 10}, {"j": "2", "p": 2, "w": 5}]
 *   ```
 * Jobs take p and optionally w (weight), d (due date), r (release time).
 * obj: cmax, sumc, sumwc or lmax. Click two bars to swap them in the
 * sequence. Jobs are list-scheduled: each one, in order, goes to the machine
 * that is free first, never before its release time. The highlight is the
 * objective readout and the bar picked for a swap.
 */
WiMark.register('sched', {
  title: 'Scheduling rules on a Gantt chart',
  description: 'SPT, WSPT, EDD, ERT, ECT and LPT on one or parallel machines, against the optimum.',
  example: {
    opts: { machines: 1, obj: 'sumwc', rules: ['given', 'spt', 'wspt'] },
    body: '[{"j": "1", "p": 3, "w": 10}, {"j": "2", "p": 2, "w": 5}, {"j": "3", "p": 1, "w": 2}, {"j": "4", "p": 4, "w": 4}]'
  },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var jobs = W.list(v.items).map(function (o, i) {
      if (!o || typeof o !== 'object') throw new Error('sched: each job is an object {"j", "p", …}');
      var p = W.num(o.p, NaN);
      if (!(p > 0)) throw new Error('sched: job ' + (i + 1) + ' needs p > 0');
      return { i: i, label: String(o.j !== undefined ? o.j : i + 1), p: p, w: W.num(o.w, 1), d: o.d === undefined ? null : W.num(o.d, 0), r: W.num(o.r, 0) };
    });
    var n = jobs.length, m = Math.max(1, Math.round(W.num(v.machines, 1)));
    if (n < 2 || n > 12) throw new Error('sched: give 2 to 12 jobs');
    var hasW = jobs.some(function (j) { return j.w !== 1; }), hasD = jobs.some(function (j) { return j.d !== null; }), hasR = jobs.some(function (j) { return j.r > 0; });
    var obj = ['cmax', 'sumc', 'sumwc', 'lmax'].indexOf(v.obj) >= 0 ? v.obj : 'sumc';
    var num = function (x) { return W.fmt(x, { maximumFractionDigits: 2 }); };

    function by(f) { return function () { return jobs.slice().sort(function (a, b) { return f(a) - f(b) || a.i - b.i; }); }; }
    function ect() {
      var left = jobs.slice(), t = 0, seq = [];
      while (left.length) {
        var best = null;
        left.forEach(function (j) { var c = Math.max(t, j.r) + j.p; if (!best || c < best.c) best = { j: j, c: c }; });
        seq.push(best.j); t = best.c; left.splice(left.indexOf(best.j), 1);
      }
      return seq;
    }
    var RULES = {
      given: { label: say({ en: 'as listed', it: 'come in elenco' }), seq: function () { return jobs.slice(); } },
      spt: { label: 'SPT', seq: by(function (j) { return j.p; }) },
      lpt: { label: 'LPT', seq: by(function (j) { return -j.p; }) },
      wspt: { label: 'WSPT', seq: by(function (j) { return j.p / j.w; }) },
      edd: { label: 'EDD', seq: by(function (j) { return j.d === null ? Infinity : j.d; }) },
      ert: { label: 'ERT', seq: by(function (j) { return j.r; }) },
      ect: { label: 'ECT', seq: ect }
    };
    var ruleKeys = W.list(v.rules).filter(function (k) { return RULES[k]; });
    if (!ruleKeys.length) ruleKeys = ['given', 'spt'];
    var rule = RULES[v.rule] ? v.rule : ruleKeys[ruleKeys.length - 1];
    var seq = RULES[rule].seq(), pick = null;

    function schedule(order) {
      var free = [], rows = [];
      for (var k = 0; k < m; k++) free.push(0);
      order.forEach(function (j) {
        var mk = 0;
        for (var k = 1; k < m; k++) if (free[k] < free[mk]) mk = k;
        var s = Math.max(free[mk], j.r), e = s + j.p;
        free[mk] = e;
        rows.push({ j: j, m: mk, s: s, c: e });
      });
      return rows;
    }
    function score(rows, key) {
      if (key === 'cmax') return Math.max.apply(null, rows.map(function (x) { return x.c; }));
      if (key === 'sumc') return W.sum(rows.map(function (x) { return x.c; }));
      if (key === 'sumwc') return W.sum(rows.map(function (x) { return x.j.w * x.c; }));
      return Math.max.apply(null, rows.map(function (x) { return x.c - (x.j.d === null ? Infinity : x.j.d); }));
    }
    // Optimum by enumeration: sequences on one machine, assignments on m.
    var best = (function () {
      if (m === 1) {
        if (n > 8) return null;
        var bestV = Infinity, a = jobs.slice();
        (function perm(k) {
          if (k === n) { bestV = Math.min(bestV, score(schedule(a), obj)); return; }
          for (var i = k; i < n; i++) { var t = a[k]; a[k] = a[i]; a[i] = t; perm(k + 1); t = a[k]; a[k] = a[i]; a[i] = t; }
        })(0);
        return bestV;
      }
      if (hasR || (obj !== 'cmax' && obj !== 'sumc') || Math.pow(m, n) > 300000) return null;
      var bv = Infinity, total = Math.pow(m, n);
      for (var code = 0; code < total; code++) {
        var c = code, loads = [], val = 0, groups = [];
        for (var k = 0; k < m; k++) { loads.push(0); groups.push([]); }
        for (var i = 0; i < n; i++) { groups[c % m].push(jobs[i].p); loads[c % m] += jobs[i].p; c = Math.floor(c / m); }
        if (obj === 'cmax') val = Math.max.apply(null, loads);
        else groups.forEach(function (g) { g.sort(function (x, y) { return x - y; }); var t = 0; g.forEach(function (p) { t += p; val += t; }); });
        if (val < bv) bv = val;
      }
      return bv;
    })();

    var OBJ = {
      cmax: { label: 'Cmax' }, sumc: { label: 'Σ Cj' }, sumwc: { label: 'Σ wj Cj' }, lmax: { label: 'Lmax' }
    };
    var pane = W.pane(el, { title: (m === 1 ? say({ en: 'One machine', it: 'Una macchina' }) : m + say({ en: ' identical machines', it: ' macchine identiche' })) + ' · ' + say({ en: 'objective ', it: 'obiettivo ' }) + OBJ[obj].label, tag: say({ en: 'interactive', it: 'interattivo' }) });
    var bar = pane.body.appendChild(h('div', 'wm-toolbar'));
    var ruleBtns = ruleKeys.map(function (k) {
      var b = h('button', { type: 'button', class: 'wm-btn', text: RULES[k].label });
      b.addEventListener('click', function () { rule = k; seq = RULES[k].seq(); pick = null; draw(); });
      bar.appendChild(b);
      return b;
    });
    bar.appendChild(h('span', 'wm-small wm-muted', say({ en: '· click two bars to swap them', it: '· clic su due barre per scambiarle' })));
    var plot = pane.body.appendChild(h('div', { style: { marginTop: '0.6rem' } }));
    var tbl = pane.section();
    var specs = [{ key: 'cmax', label: 'Cmax' }, { key: 'sumc', label: 'Σ Cj' }];
    if (hasW) specs.push({ key: 'sumwc', label: 'Σ wj Cj' });
    if (hasD) specs.push({ key: 'lmax', label: 'Lmax' });
    specs.forEach(function (s) { if (s.key === obj) s.hl = true; });
    specs.push({ key: 'opt', label: say({ en: 'optimal ', it: 'ottimo ' }) + OBJ[obj].label });
    var set = W.stats(pane.section('wm-flush'), specs);
    var verdict = W.note(pane.root);

    function draw() {
      ruleBtns.forEach(function (b, i) { b.setAttribute('aria-pressed', ruleKeys[i] === rule ? 'true' : 'false'); });
      var rows = schedule(seq), cmax = score(rows, 'cmax');
      plot.textContent = '';
      var top = Math.max(cmax, hasD ? Math.max.apply(null, jobs.map(function (j) { return j.d || 0; })) : 0);
      var c = W.chart(plot, { width: 680, height: 46 + 44 * m, margin: { left: m > 1 ? 40 : 16, right: 16, top: 10, bottom: 40 }, xTitle: say({ en: 'time', it: 'tempo' }) });
      var x = W.scale.linear([0, top], [0, c.w]);
      c.axisXLinear(x, { ticks: Math.min(12, Math.ceil(top)), format: function (t) { return W.fmt(t); } });
      var band = c.h / m;
      for (var k = 0; k < m; k++) {
        c.add(svg('rect', { x: 0, y: k * band + 4, width: c.w, height: band - 8, class: 'wm-outline' }));
        if (m > 1) c.add(svg('text', { x: -8, y: k * band + band / 2, dy: '0.35em', 'text-anchor': 'end', text: 'M' + (k + 1) }));
      }
      rows.forEach(function (row) {
        var g = c.add(svg('g', pick === row.j.i ? 'wm-hl' : W.series(row.j.i % 8)));
        var w = Math.max(1, x(row.c) - x(row.s));
        var rect = g.appendChild(svg('rect', { x: x(row.s), y: row.m * band + 4, width: w, height: band - 8, class: 'wm-mark' }));
        rect.style.cursor = 'pointer';
        if (w > 12) g.appendChild(svg('text', { x: x(row.s) + w / 2, y: row.m * band + band / 2, dy: '0.35em', 'text-anchor': 'middle', class: 'wm-tag-text wm-strong', text: row.j.label }));
        g.addEventListener('click', function () {
          if (pick === null) pick = row.j.i;
          else if (pick === row.j.i) pick = null;
          else {
            var a = seq.indexOf(jobs[pick]), b = seq.indexOf(row.j);
            seq = seq.slice(); var t = seq[a]; seq[a] = seq[b]; seq[b] = t;
            rule = 'custom'; pick = null;
          }
          draw();
        });
      });

      tbl.textContent = '';
      var head = [say({ en: 'job', it: 'job' }), 'pj'];
      if (hasW) head.push('wj');
      if (hasR) head.push('rj');
      if (m > 1) head.push(say({ en: 'machine', it: 'macchina' }));
      head.push(say({ en: 'start', it: 'inizio' }), 'Cj');
      if (hasD) head.push('dj', 'Lj');
      var trs = rows.map(function (row) {
        var r = [row.j.label, row.j.p];
        if (hasW) r.push(row.j.w);
        if (hasR) r.push(row.j.r);
        if (m > 1) r.push('M' + (row.m + 1));
        r.push(row.s, row.c);
        if (hasD) r.push(row.j.d === null ? '—' : row.j.d, row.j.d === null ? '—' : (row.c - row.j.d > 0 ? '+' : '') + num(row.c - row.j.d));
        return r;
      });
      tbl.appendChild(h('div', { class: 'wm-label', style: { marginBottom: '0.3rem' } }, say({ en: 'sequence: ', it: 'sequenza: ' }) + seq.map(function (j) { return j.label; }).join(' → ')));
      tbl.appendChild(W.table(head, trs, { align: head.map(function (_, i) { return i === 0 ? 'l' : 'r'; }) }));

      var val = score(rows, obj);
      set('cmax', num(cmax));
      set('sumc', num(score(rows, 'sumc')));
      if (hasW) set('sumwc', num(score(rows, 'sumwc')));
      if (hasD) set('lmax', num(score(rows, 'lmax')));
      set('opt', best === null ? '—' : num(best));
      var rname = rule === 'custom' ? say({ en: 'Your sequence', it: 'La tua sequenza' }) : RULES[rule].label;
      if (best === null) verdict('info', rname + ': ' + OBJ[obj].label + ' = ' + num(val) + '.');
      else if (Math.abs(val - best) < 1e-9) verdict('pos', rname + ': ' + OBJ[obj].label + ' = ' + num(val) + say({ en: ', the optimum.', it: ', l\'ottimo.' }));
      else verdict('info', rname + ': ' + OBJ[obj].label + ' = ' + num(val) + say({ en: ', the optimum is ', it: ', l\'ottimo è ' }) + num(best) + ' (+' + num(val - best) + ').');
    }
    draw();
  }
});
