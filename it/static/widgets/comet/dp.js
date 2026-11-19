/*
 * dp — dynamic programming filled one entry at a time. Two problems:
 * rod cutting, r_j = max_i { p_i + r_{j−i} } with the first-cut array s, and
 * the 0/1 knapsack table f(g, j) with marked entries and the backtracking.
 *   ```wimark-dp {"problem": "rod", "prices": [1, 5, 8, 9, 10, 17, 17, 20], "n": 4}
 *   ```
 *   ```wimark-dp {"problem": "kp", "cap": 5}
 *   [["1", 2, 3], ["2", 3, 4], ["3", 4, 5], ["4", 5, 6]]
 *   ```
 * kp items are [label, volume, profit] (integer volumes, cap ≤ 30, at most 10
 * items). The highlight is the entry being computed.
 */
WiMark.register('dp', {
  title: 'Dynamic programming, step by step',
  description: 'Rod cutting and the knapsack DP table, filled one entry at a time, then the solution read back.',
  example: { opts: { problem: 'kp', cap: 5 }, body: '[["1", 2, 3], ["2", 3, 4], ["3", 4, 5], ["4", 5, 6]]' },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var num = function (x) { return W.fmt(x, { maximumFractionDigits: 2 }); };
    var kp = v.problem === 'kp';
    var pane = W.pane(el, { title: kp ? say({ en: 'Knapsack: the DP table f(g, j)', it: 'Knapsack: la tabella DP f(g, j)' }) : say({ en: 'Rod cutting: the arrays r and s', it: 'Taglio delle barre: i vettori r e s' }), tag: say({ en: 'step by step', it: 'passo per passo' }) });
    var tools = pane.body.appendChild(h('div', 'wm-toolbar'));
    function btn(label, fn) { var b = h('button', { type: 'button', class: 'wm-btn', text: label }); b.addEventListener('click', fn); tools.appendChild(b); return b; }
    var view = pane.body.appendChild(h('div', { style: { marginTop: '0.8rem' } }));
    var extra = pane.section();
    var verdict = W.note(pane.root);
    function sub(s) { return h('sub', null, String(s)); }

    if (!kp) {
      // ─── Rod cutting ─────────────────────────────────────────────────────
      var prices = W.list(v.prices).map(function (x) { return W.num(x, NaN); });
      if (prices.length < 1 || prices.length > 12 || prices.some(function (x) { return !(x >= 0); })) throw new Error('dp: prices must be 1 to 12 numbers ≥ 0');
      var P = { n: Math.min(prices.length, Math.max(1, Math.round(W.num(v.n, Math.min(4, prices.length))))) };
      var k = 0, r = [], s = [];
      function solve() {
        r = [0]; s = [0];
        for (var j = 1; j <= P.n; j++) {
          var bi = 1, bv = -Infinity;
          for (var i = 1; i <= j; i++) if (prices[i - 1] + r[j - i] > bv) { bv = prices[i - 1] + r[j - i]; bi = i; }
          r.push(bv); s.push(bi);
        }
      }
      btn(say({ en: '⟲ reset', it: '⟲ da capo' }), function () { k = 0; draw(); });
      btn(say({ en: 'next r_j ▸', it: 'prossimo r_j ▸' }), function () { if (k < P.n) k++; draw(); });
      btn(say({ en: 'fill all ▸▸', it: 'riempi tutto ▸▸' }), function () { k = P.n; draw(); });
      var ctl = pane.section();
      W.controls(ctl, P, [{ key: 'n', label: say({ en: 'rod length n', it: 'lunghezza n' }), min: 1, max: prices.length, step: 1, format: String }], function () { k = 0; draw(); }, 1);
      var set = W.stats(pane.section('wm-flush'), [
        { key: 'r', label: say({ en: 'optimal revenue r_n', it: 'ricavo ottimo r_n' }), hl: true },
        { key: 'cut', label: say({ en: 'cutting pattern', it: 'schema di taglio' }) },
        { key: 'dp', label: say({ en: 'DP evaluations', it: 'valutazioni DP' }) },
        { key: 'bf', label: say({ en: 'brute force 2^(n−1)', it: 'forza bruta 2^(n−1)' }) }
      ]);
      var draw = function () {
        solve();
        view.textContent = '';
        var head = ['j'], rowP = [h('span', null, 'p', sub('j'))], rowR = [h('span', null, 'r', sub('j'))], rowS = [h('span', null, 's', sub('j'))];
        for (var j = 0; j <= P.n; j++) {
          head.push(String(j));
          var done = j <= k, cur = j === k && k > 0;
          rowP.push(j === 0 ? '—' : num(prices[j - 1]));
          rowR.push(done ? (cur ? h('span', 'wm-hl-text', num(r[j])) : num(r[j])) : '·');
          rowS.push(done ? (j === 0 ? '0' : String(s[j])) : '·');
        }
        view.appendChild(W.table(head, [rowP, rowR, rowS], { rowHeader: true, align: ['l'].concat(head.slice(1).map(function () { return 'r'; })) }));
        extra.textContent = '';
        if (k > 0) {
          var cands = h('div', 'wm-toolbar');
          for (var i = 1; i <= k; i++) {
            var val = prices[i - 1] + r[k - i], isBest = i === s[k];
            cands.appendChild(h('span', { class: 'wm-tag' }, h('span', isBest ? 'wm-hl-text' : null, 'p' + i + ' + r' + (k - i) + ' = ' + num(prices[i - 1]) + ' + ' + num(r[k - i]) + ' = ' + num(val))));
          }
          extra.appendChild(h('div', { class: 'wm-label', style: { marginBottom: '0.45rem' } }, 'r' + k + ' = max { p_i + r_{' + k + '−i} }'));
          extra.appendChild(cands);
        }
        // the pieces of the optimal cut, read from s
        var pieces = [], rest = P.n;
        while (rest > 0) { pieces.push(s[rest]); rest -= s[rest]; }
        if (k === P.n) {
          var rod = extra.appendChild(h('div', { style: { marginTop: '0.8rem' } }));
          var c = W.chart(rod, { width: 680, height: 74, margin: { left: 10, right: 10, top: 18, bottom: 22 } });
          var x = W.scale.linear([0, P.n], [0, c.w]), at = 0;
          pieces.forEach(function (len, q) {
            var g = c.add(svg('g', W.series(q % 2)));
            g.appendChild(svg('rect', { x: x(at), y: 0, width: x(at + len) - x(at), height: c.h, class: 'wm-mark' }));
            g.appendChild(svg('text', { x: x(at + len / 2), y: c.h / 2, dy: '0.35em', 'text-anchor': 'middle', class: 'wm-on', text: len + ' → ' + num(prices[len - 1]) }));
            at += len;
          });
        }
        set('r', k === P.n ? num(r[P.n]) : '…');
        set('cut', k === P.n ? P.n + ' = ' + pieces.join(' + ') : '…');
        set('dp', W.fmt(k * (k + 1) / 2));
        set('bf', W.fmt(Math.pow(2, P.n - 1)));
        if (k === 0) verdict('info', say({ en: 'r₀ = 0. Press "next" to compute r₁, r₂, … in increasing order: each one reuses the ones already known.', it: 'r₀ = 0. Premi "prossimo" per calcolare r₁, r₂, … in ordine crescente: ognuno riusa quelli già noti.' }));
        else if (k < P.n) verdict('info', 'r' + k + ' = ' + num(r[k]) + say({ en: ': best first piece s', it: ': miglior primo pezzo s' }) + k + ' = ' + s[k] + say({ en: ', then the best way to cut the remaining ', it: ', poi il modo migliore di tagliare i restanti ' }) + (k - s[k]) + '.');
        else verdict('pos', say({ en: 'Read s backwards: ', it: 'Si legge s all\'indietro: ' }) + 's' + P.n + ' = ' + s[P.n] + (pieces.length > 1 ? say({ en: ', then s of the rest, until 0. ', it: ', poi s del resto, fino a 0. ' }) : '. ') + say({ en: 'Optimal revenue ', it: 'Ricavo ottimo ' }) + num(r[P.n]) + '.');
      };
      draw();
      return;
    }

    // ─── Knapsack ─────────────────────────────────────────────────────────
    var items = W.list(v.items).map(function (t, i) {
      if (!Array.isArray(t) || t.length < 3) throw new Error('dp: each item is [label, volume, profit]');
      var vol = Math.round(W.num(t[1], NaN)), pr = W.num(t[2], NaN);
      if (!(vol >= 1) || !(pr >= 0)) throw new Error('dp: item ' + (i + 1) + ' needs an integer volume ≥ 1 and profit ≥ 0');
      return { label: String(t[0]), v: vol, p: pr };
    });
    var n = items.length, C = Math.round(W.num(v.cap, NaN));
    if (n < 1 || n > 10) throw new Error('dp: give 1 to 10 items');
    if (!(C >= 1 && C <= 30)) throw new Error('dp: cap must be an integer from 1 to 30');
    var f = [], mark = [];
    for (var g0 = 0; g0 <= C; g0++) { f.push([]); mark.push([]); for (var j0 = 0; j0 <= n; j0++) { f[g0].push(0); mark[g0].push(false); } }
    for (var jj = 1; jj <= n; jj++) for (var gg = 1; gg <= C; gg++) {
      var it = items[jj - 1], skip = f[gg][jj - 1];
      if (gg >= it.v && it.p + f[gg - it.v][jj - 1] > skip) { f[gg][jj] = it.p + f[gg - it.v][jj - 1]; mark[gg][jj] = true; }
      else f[gg][jj] = skip;
    }
    var path = [], S = [];
    (function () { var g = C; for (var j = n; j >= 1 && g > 0; j--) { path.push(g + ',' + j); if (mark[g][j]) { S.unshift(j); g -= items[j - 1].v; } } })();
    var total = n * C, kk = 0;
    function pos(t) { return { j: Math.floor((t - 1) / C) + 1, g: (t - 1) % C + 1 }; }
    btn(say({ en: '⟲ reset', it: '⟲ da capo' }), function () { kk = 0; draw2(); });
    btn(say({ en: 'next cell ▸', it: 'prossima cella ▸' }), function () { if (kk < total) kk++; draw2(); });
    btn(say({ en: 'next column ▸▸', it: 'prossima colonna ▸▸' }), function () { kk = Math.min(total, (Math.floor(kk / C) + 1) * C); draw2(); });
    btn(say({ en: 'fill all ▸▸▸', it: 'riempi tutto ▸▸▸' }), function () { kk = total; draw2(); });
    var set2 = W.stats(pane.section('wm-flush'), [
      { key: 'f', label: 'f(C, n)', hl: true },
      { key: 'S', label: say({ en: 'items loaded', it: 'oggetti caricati' }) },
      { key: 'cells', label: say({ en: 'cells filled', it: 'celle riempite' }) },
      { key: 'bf', label: say({ en: 'subsets 2^n', it: 'sottoinsiemi 2^n' }) }
    ]);
    function draw2() {
      var cur = kk > 0 ? pos(kk) : null, done = kk === total;
      var src = {};
      if (cur && !done) {
        src[cur.g + ',' + (cur.j - 1)] = true;
        if (cur.g >= items[cur.j - 1].v) src[(cur.g - items[cur.j - 1].v) + ',' + (cur.j - 1)] = true;
      }
      var head = [h('span', null, 'g \\ j')];
      head.push(h('span', null, '0'));
      items.forEach(function (it, i) { head.push(h('span', null, String(i + 1) + ' ', h('span', 'wm-muted', '(' + it.v + ',' + num(it.p) + ')'))); });
      var rows = [];
      for (var g = 0; g <= C; g++) {
        var row = [String(g)];
        for (var j = 0; j <= n; j++) {
          var filled = j === 0 || g === 0 || (j - 1) * C + g <= kk;
          if (!filled) { row.push(h('span', 'wm-muted', '·')); continue; }
          var txt = num(f[g][j]) + (mark[g][j] ? '*' : '');
          var key = g + ',' + j;
          if (cur && !done && cur.g === g && cur.j === j) row.push(h('span', 'wm-hl-text', txt));
          else if (src[key]) row.push(h('strong', null, txt));
          else if (done && path.indexOf(key) >= 0) row.push(h('strong', null, (mark[g][j] ? '✓ ' : '← ') + txt));
          else row.push(txt);
        }
        rows.push(row);
      }
      view.textContent = '';
      view.appendChild(W.table(head, rows, { rowHeader: true, align: ['l'].concat(head.slice(1).map(function () { return 'r'; })) }));
      extra.textContent = '';
      extra.appendChild(h('div', 'wm-small wm-muted', say({ en: 'Columns: item j (volume, profit). * = marked: item j is taken in f(g, j). In bold: the two entries the current cell reads; at the end, the backtracking path.', it: 'Colonne: oggetto j (volume, profitto). * = marcata: l\'oggetto j è preso in f(g, j). In grassetto: le due celle lette dalla cella corrente; alla fine, il percorso a ritroso.' })));
      set2('f', done ? num(f[C][n]) : '…');
      set2('S', done ? '{' + S.map(function (j) { return items[j - 1].label; }).join(', ') + '}' : '…');
      set2('cells', W.fmt(kk) + ' / ' + W.fmt(total));
      set2('bf', W.fmt(Math.pow(2, n)));
      if (!cur) verdict('info', say({ en: 'Row g = 0 and column j = 0 are 0. Fill column by column: f(g, j) = max { p_j + f(g − v_j, j − 1), f(g, j − 1) }.', it: 'La riga g = 0 e la colonna j = 0 valgono 0. Si riempie colonna per colonna: f(g, j) = max { p_j + f(g − v_j, j − 1), f(g, j − 1) }.' }));
      else if (!done) {
        var it = items[cur.j - 1], without = f[cur.g][cur.j - 1];
        if (cur.g < it.v) verdict('info', 'f(' + cur.g + ', ' + cur.j + ') = f(' + cur.g + ', ' + (cur.j - 1) + ') = ' + num(without) + say({ en: ': item ', it: ': l\'oggetto ' }) + it.label + say({ en: ' (v = ', it: ' (v = ' }) + it.v + say({ en: ') does not fit in g = ', it: ') non entra in g = ' }) + cur.g + '.');
        else {
          var withIt = it.p + f[cur.g - it.v][cur.j - 1];
          verdict('info', 'f(' + cur.g + ', ' + cur.j + ') = max { ' + num(it.p) + ' + f(' + (cur.g - it.v) + ', ' + (cur.j - 1) + '), f(' + cur.g + ', ' + (cur.j - 1) + ') } = max { ' + num(withIt) + ', ' + num(without) + ' } = ' + num(f[cur.g][cur.j]) +
            (mark[cur.g][cur.j] ? say({ en: ' → take item ', it: ' → si prende l\'oggetto ' }) + it.label + ' (*)' : say({ en: ' → leave it', it: ' → si lascia' })) + '.');
        }
      } else verdict('pos', say({ en: 'Backtracking from f(C, n): at a marked cell load item j and move up by v_j; otherwise just move left. Load {', it: 'A ritroso da f(C, n): in una cella marcata si carica l\'oggetto j e si sale di v_j; altrimenti si va solo a sinistra. Si carica {' }) +
        S.map(function (j) { return items[j - 1].label; }).join(', ') + '}, ' + say({ en: 'value ', it: 'valore ' }) + num(f[C][n]) + '.');
    }
    draw2();
  }
});
