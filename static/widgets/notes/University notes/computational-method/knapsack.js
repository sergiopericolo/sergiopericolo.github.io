/*
 * knapsack — a 0/1 knapsack drawn as a truck of capacity C: pick the items by
 * hand, or step through a greedy rule (P, V, UP), the improved greedy (UP or
 * the first item that did not fit) and the swap local search, against the
 * optimum found by enumeration.
 *   ```wimark-knapsack {"cap": 1200, "unit": "cm", "mode": "P"}
 *   [["1", 330, 3], ["2", 360, 8], ["3", 140, 5]]
 *   ```
 * Items are [label, volume, profit], 2 to 16 of them. mode is the first view:
 * "hand", "P", "V", "UP", "UP+", "LS" or "OPT". Clicking an item toggles it by
 * hand. The highlight is the item the algorithm is looking at.
 */
WiMark.register('knapsack', {
  title: 'Knapsack: greedy, local search and optimum',
  description: 'Greedy rules, the improved greedy and a swap local search on a 0/1 knapsack, step by step.',
  example: {
    opts: { cap: 1200, unit: 'cm', mode: 'P' },
    body: '[["1", 330, 3], ["2", 360, 8], ["3", 140, 5], ["4", 400, 8], ["5", 310, 3], ["6", 220, 2], ["7", 330, 6], ["8", 360, 7], ["9", 350, 7]]'
  },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var items = W.list(v.items).map(function (r, i) {
      if (!Array.isArray(r) || r.length < 3) throw new Error('knapsack: each item is [label, volume, profit]');
      var vol = W.num(r[1], NaN), pr = W.num(r[2], NaN);
      if (!(vol > 0) || !(pr >= 0)) throw new Error('knapsack: item ' + (i + 1) + ' needs volume > 0 and profit ≥ 0');
      return { i: i, label: String(r[0]), v: vol, p: pr };
    });
    var n = items.length;
    if (n < 2 || n > 16) throw new Error('knapsack: give 2 to 16 items');
    var C = W.num(v.cap, NaN);
    if (!(C > 0)) throw new Error('knapsack: cap must be a positive number');
    var unit = v.unit ? ' ' + v.unit : '';
    var num = function (x) { return W.fmt(x, { maximumFractionDigits: 2 }); };
    var maxV = Math.max.apply(null, items.map(function (it) { return it.v; }));

    // Orders of the three greedy criteria (stable: ties keep the input order).
    function sorted(cmp) { return items.slice().sort(function (a, b) { return cmp(a, b) || a.i - b.i; }); }
    var ORD = {
      P: sorted(function (a, b) { return b.p - a.p; }),
      V: sorted(function (a, b) { return a.v - b.v; }),
      UP: sorted(function (a, b) { return b.p / b.v - a.p / a.v; })
    };

    function profit(sel) { return W.sum(sel.map(function (i) { return items[i].p; })); }
    function volume(sel) { return W.sum(sel.map(function (i) { return items[i].v; })); }
    function names(sel) { return sel.length ? sel.map(function (i) { return items[i].label; }).join(', ') : '∅'; }

    // Optimum by enumeration of the 2^n subsets.
    var best = { p: -1, sel: [] };
    (function () {
      var N = 1 << n, vol = new Float64Array(N), pro = new Float64Array(N), bm = 0;
      for (var m = 1; m < N; m++) {
        var low = m & -m, k = 31 - Math.clz32(low);
        vol[m] = vol[m ^ low] + items[k].v;
        pro[m] = pro[m ^ low] + items[k].p;
        if (vol[m] <= C && pro[m] > pro[bm]) bm = m;
      }
      best.p = pro[bm];
      for (var j = 0; j < n; j++) if (bm & (1 << j)) best.sel.push(j);
    })();

    // A trace is a list of states { sel, focus, ok, msg }.
    function greedy(key) {
      var order = ORD[key], sel = [], R = C, tr = [];
      tr.push({ sel: [], msg: say({ en: 'Order by criterion ' + key + ': ', it: 'Ordine secondo il criterio ' + key + ': ' }) + order.map(function (it) { return it.label; }).join(' → ') + say({ en: '. Residual capacity R = ', it: '. Capacità residua R = ' }) + num(C) + unit + '.' });
      order.forEach(function (it) {
        var ok = it.v <= R, before = R;
        if (ok) { sel = sel.concat([it.i]); R -= it.v; }
        tr.push({ sel: sel, focus: it.i, ok: ok, msg: say({ en: 'Item ', it: 'Oggetto ' }) + it.label + ': ' + num(it.v) + (ok ? ' ≤ ' : ' > ') + 'R = ' + num(before) +
          (ok ? say({ en: ' → load it, R = ', it: ' → si carica, R = ' }) + num(R) : say({ en: ' → skip it', it: ' → si scarta' })) + '.' });
      });
      return tr;
    }
    function improved() {
      var tr = greedy('UP'), last = tr[tr.length - 1], PG = profit(last.sel), k = null;
      for (var s = 1; s < tr.length; s++) if (!tr[s].ok) { k = tr[s].focus; break; }
      if (k === null) {
        tr.push({ sel: last.sel, msg: say({ en: 'Every item fits: the greedy solution is optimal.', it: 'Tutti gli oggetti entrano: la soluzione greedy è ottima.' }) });
        return tr;
      }
      var pk = items[k].p, take = pk > PG;
      tr.push({ sel: take ? [k] : last.sel, focus: k, ok: take, msg: say({ en: 'First item that did not fit: ', it: 'Primo oggetto che non è entrato: ' }) + items[k].label +
        ' (p = ' + num(pk) + '). P^G = ' + num(PG) + (take ? ' < ' : ' ≥ ') + num(pk) +
        (take ? say({ en: ' → return the single item ', it: ' → si restituisce il solo oggetto ' }) + items[k].label : say({ en: ' → keep the greedy solution', it: ' → si tiene la soluzione greedy' })) + '.' });
      return tr;
    }
    function local() {
      var g = greedy('UP'), order = ORD.UP, sel = g[g.length - 1].sel.slice(), R = C - volume(sel);
      var tr = [{ sel: sel, msg: say({ en: 'Start from greedy UP: ', it: 'Si parte da greedy UP: ' }) + '{' + names(sel) + '}, P = ' + num(profit(sel)) + ', R = ' + num(R) + '.' }];
      var improvedPass = true, guard = 0;
      while (improvedPass && guard++ < 200) {
        improvedPass = false;
        for (var a = 0; a < n; a++) {
          var j = order[a];
          if (sel.indexOf(j.i) < 0) continue;
          for (var b = a + 1; b < n; b++) {
            var k = order[b];
            if (sel.indexOf(k.i) >= 0 || k.v > R + j.v || k.p <= j.p) continue;
            sel = sel.filter(function (x) { return x !== j.i; }).concat([k.i]);
            R = R + j.v - k.v;
            improvedPass = true;
            tr.push({ sel: sel, focus: k.i, ok: true, msg: say({ en: 'Swap: out ', it: 'Scambio: esce ' }) + j.label + ' (p = ' + num(j.p) + say({ en: '), in ', it: '), entra ' }) + k.label +
              ' (p = ' + num(k.p) + ', v = ' + num(k.v) + ' ≤ R + v = ' + num(R + k.v) + '). P = ' + num(profit(sel)) + ', R = ' + num(R) + '.' });
            break;
          }
        }
      }
      tr.push({ sel: sel, msg: say({ en: 'No swap improves the profit: local optimum, P = ', it: 'Nessuno scambio migliora il profitto: ottimo locale, P = ' }) + num(profit(sel)) + '.' });
      return tr;
    }

    var MODES = [
      { key: 'hand', label: say({ en: 'by hand', it: 'a mano' }) },
      { key: 'P', label: 'greedy P' },
      { key: 'V', label: 'greedy V' },
      { key: 'UP', label: 'greedy UP' },
      { key: 'UP+', label: say({ en: 'UP + best item', it: 'UP + oggetto migliore' }) },
      { key: 'LS', label: say({ en: 'local search', it: 'ricerca locale' }) },
      { key: 'OPT', label: say({ en: 'optimum', it: 'ottimo' }) }
    ];
    var mode = MODES.some(function (m) { return m.key === v.mode; }) ? v.mode : 'hand';
    var hand = [], trace = [], P = { step: 0 };

    var pane = W.pane(el, { title: say({ en: 'Loading the knapsack', it: 'Riempire lo zaino' }), tag: say({ en: 'interactive', it: 'interattivo' }) });
    var bar = pane.body.appendChild(h('div', 'wm-toolbar'));
    var modeBtns = MODES.map(function (m) {
      var b = h('button', { type: 'button', class: 'wm-btn', text: m.label });
      b.addEventListener('click', function () { setMode(m.key); });
      bar.appendChild(b);
      return b;
    });
    var plot = pane.body.appendChild(h('div', { style: { marginTop: '0.8rem' } }));
    var chips = pane.section();
    chips.appendChild(h('div', { class: 'wm-label', style: { marginBottom: '0.45rem' } }, say({ en: 'items · volume · profit (click to load by hand)', it: 'oggetti · volume · profitto (clic per caricare a mano)' })));
    var chipRow = chips.appendChild(h('div', 'wm-toolbar'));
    var itemBtns = items.map(function (it) {
      var b = h('button', { type: 'button', class: 'wm-btn', text: it.label + ' · ' + num(it.v) + ' · ' + num(it.p) });
      b.addEventListener('click', function () {
        var cur = current().sel.slice();
        hand = cur.indexOf(it.i) >= 0 ? cur.filter(function (x) { return x !== it.i; }) : cur.concat([it.i]);
        setMode('hand', true);
      });
      chipRow.appendChild(b);
      return b;
    });
    var stepHost = pane.section();
    var set = W.stats(pane.section('wm-flush'), [
      { key: 'vol', label: say({ en: 'volume used', it: 'volume usato' }) },
      { key: 'p', label: say({ en: 'profit', it: 'profitto' }) },
      { key: 'opt', label: say({ en: 'optimum', it: 'ottimo' }), hl: true },
      { key: 'ratio', label: say({ en: 'ratio A / OPT', it: 'rapporto A / OPT' }) }
    ]);
    var verdict = W.note(pane.root);
    W.dataTable(pane.root, [say({ en: 'item', it: 'oggetto' }), 'v', 'p', 'p / v'], items.map(function (it) { return [it.label, it.v, it.p, W.fmt(it.p / it.v, { maximumFractionDigits: 4 })]; }));

    function current() { return trace.length ? trace[Math.min(P.step, trace.length - 1)] : { sel: hand }; }

    function setMode(key, keepHand) {
      mode = key;
      if (key === 'hand') trace = [];
      else if (key === 'OPT') trace = [{ sel: best.sel.slice(), msg: say({ en: 'Optimum by enumerating all 2^', it: 'Ottimo enumerando tutti i 2^' }) + n + ' = ' + W.fmt(Math.pow(2, n)) + say({ en: ' subsets: {', it: ' sottoinsiemi: {' }) + names(best.sel) + '}.' }];
      else if (key === 'UP+') trace = improved();
      else if (key === 'LS') trace = local();
      else trace = greedy(key);
      if (!keepHand && key === 'hand') hand = [];
      P.step = trace.length ? trace.length - 1 : 0;
      stepHost.textContent = '';
      stepHost.style.display = trace.length > 1 ? '' : 'none';
      if (trace.length > 1) {
        W.controls(stepHost, P, [{ key: 'step', label: say({ en: 'step', it: 'passo' }), min: 0, max: trace.length - 1, step: 1, format: function (x) { return x + ' / ' + (trace.length - 1); } }], draw, 1);
      }
      draw();
    }

    function draw() {
      var st = current(), sel = st.sel, used = volume(sel), pr = profit(sel);
      modeBtns.forEach(function (b, i) { b.setAttribute('aria-pressed', MODES[i].key === mode ? 'true' : 'false'); });
      itemBtns.forEach(function (b, i) { b.setAttribute('aria-pressed', sel.indexOf(i) >= 0 ? 'true' : 'false'); });

      plot.textContent = '';
      var c = W.chart(plot, { width: 680, height: 118, margin: { left: 14, right: 14, top: 22, bottom: 40 }, xTitle: say({ en: 'length used', it: 'lunghezza usata' }) + (v.unit ? ' (' + v.unit + ')' : '') });
      var top = Math.max(C + maxV * 0.6, used * 1.02);
      var x = W.scale.linear([0, top], [0, c.w]);
      c.axisXLinear(x, { ticks: 6, format: function (t) { return W.fmt(t); } });
      var y0 = 4, hh = c.h - 8;
      c.add(svg('rect', { x: 0, y: y0, width: x(C), height: hh, class: 'wm-outline' }));
      var at = 0;
      sel.forEach(function (i) {
        var it = items[i], w = x(at + it.v) - x(at);
        var g = c.add(svg('g', i === st.focus && st.ok ? 'wm-hl' : W.series(0)));
        g.appendChild(svg('rect', { x: x(at), y: y0, width: w, height: hh, class: 'wm-mark' }));
        if (w > 16) g.appendChild(svg('text', { x: x(at) + w / 2, y: y0 + hh / 2, dy: '0.35em', 'text-anchor': 'middle', class: 'wm-on', text: it.label }));
        at += it.v;
      });
      if (st.focus !== undefined && !st.ok && sel.indexOf(st.focus) < 0) {
        var f = items[st.focus];
        c.clipped(svg('rect', { x: x(used), y: y0 + 3, width: x(used + f.v) - x(used), height: hh - 6, class: 'wm-guide' }));
        c.label(x(used + f.v / 2), y0 + 3, f.label + ' ✕', { at: 'n' });
      }
      c.add(svg('line', { x1: x(C), x2: x(C), y1: -6, y2: c.h, class: 'wm-stroke-ink' }));
      c.label(x(C), -4, 'C = ' + W.fmt(C), { at: 'e', cls: 'wm-strong' });

      set('vol', W.fmt(used) + ' / ' + W.fmt(C));
      set('p', W.fmt(pr));
      set('opt', W.fmt(best.p));
      set('ratio', used > C ? '—' : best.p > 0 ? W.fmt(pr / best.p, { maximumFractionDigits: 3 }) : '1');
      if (used > C) verdict('warn', say({ en: 'Over capacity by ', it: 'Capacità superata di ' }) + W.fmt(used - C) + unit + say({ en: ': this load is not feasible.', it: ': il carico non è ammissibile.' }));
      else if (st.msg) verdict(pr === best.p && P.step === trace.length - 1 ? 'pos' : 'info', st.msg);
      else verdict(pr === best.p ? 'pos' : 'info', pr === best.p ? say({ en: 'Your load reaches the optimum.', it: 'Il tuo carico raggiunge l\'ottimo.' }) : say({ en: 'Feasible load. ', it: 'Carico ammissibile. ' }) + W.fmt(best.p - pr) + say({ en: ' profit points below the optimum.', it: ' punti di profitto sotto l\'ottimo.' }));
    }
    setMode(mode);
  }
});
