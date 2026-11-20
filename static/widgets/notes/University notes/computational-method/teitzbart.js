/*
 * teitzbart — the Teitz and Bart swap heuristic for the p-median, one
 * iteration at a time, on a cost matrix (rows: candidate sites, columns:
 * customers). Each step tries one closed site k against every open site i
 * and shows the savings s_ik = z(S) − z(S \ {i} ∪ {k}) and the labels ℓ.
 *   ```wimark-teitzbart {"p": 2, "start": [1, 2]}
 *   [[7, 7, 14, 3, 4, 8], [17, 16, 12, 11, 7, 15], [8, 9, 15, 1, 5, 7]]
 *   ```
 * Sites and customers are numbered from 1; start lists the initial open
 * sites (default the first p). The highlight is the candidate site k.
 */
WiMark.register('teitzbart', {
  title: 'Teitz and Bart, step by step',
  description: 'The swap local search for the p-median on a cost matrix, with savings and labels.',
  example: {
    opts: { p: 2, start: [1, 2] },
    body: '[[7, 7, 14, 3, 4, 8], [17, 16, 12, 11, 7, 15], [8, 9, 15, 1, 5, 7], [11, 6, 11, 13, 11, 17], [19, 14, 3, 17, 12, 23]]'
  },
  mount: function (el, v) {
    var W = WiMark, h = W.h, say = W.say;
    var M = W.list(v.items).map(function (row, i) {
      if (!Array.isArray(row)) throw new Error('teitzbart: row ' + (i + 1) + ' must be a list of costs');
      return row.map(function (x) { var c = W.num(x, NaN); if (!isFinite(c)) throw new Error('teitzbart: bad cost in row ' + (i + 1)); return c; });
    });
    var m = M.length, n = m ? M[0].length : 0;
    if (m < 2 || m > 12 || n < 1 || n > 14 || M.some(function (r) { return r.length !== n; })) throw new Error('teitzbart: give 2–12 rows of the same length (1–14 customers)');
    var p = Math.max(1, Math.min(m - 1, Math.round(W.num(v.p, 2))));
    var start = W.list(v.start).map(function (x) { return Math.round(W.num(x, 0)) - 1; }).filter(function (i) { return i >= 0 && i < m; });
    if (start.length !== p) { start = []; for (var q = 0; q < p; q++) start.push(q); }
    function z(S) { var t = 0; for (var j = 0; j < n; j++) { var b = Infinity; S.forEach(function (i) { b = Math.min(b, M[i][j]); }); t += b; } return t; }
    function setStr(S) { return '{' + S.slice().sort(function (a, b) { return a - b; }).map(function (i) { return i + 1; }).join(', ') + '}'; }

    // The run, recorded step by step.
    var steps = [], S = start.slice(), lab = [];
    for (var i0 = 0; i0 < m; i0++) lab.push(S.indexOf(i0) >= 0 ? 1 : 0);
    steps.push({ S: S.slice(), lab: lab.slice(), msg: say({ en: 'Start: S = ', it: 'Inizio: S = ' }) + setStr(S) + ', z(S) = ' + z(S) + say({ en: '. Open sites get ℓ = 1, closed ones ℓ = 0 (still to try).', it: '. I siti aperti hanno ℓ = 1, i chiusi ℓ = 0 (da provare).' }) });
    var guard = 0;
    while (guard++ < 200) {
      var k = -1;
      for (var c = 0; c < m; c++) if (S.indexOf(c) < 0 && lab[c] === 0) { k = c; break; }
      if (k < 0) break;
      var zS = z(S), sav = {}, bi = -1;
      S.forEach(function (i) { sav[i] = zS - z(S.filter(function (x) { return x !== i; }).concat([k])); if (bi < 0 || sav[i] > sav[bi]) bi = i; });
      if (sav[bi] <= 0) {
        lab[k] = -1;
        steps.push({ S: S.slice(), lab: lab.slice(), k: k, sav: sav, msg: say({ en: 'Try k = ', it: 'Si prova k = ' }) + (k + 1) + say({ en: ': the best saving is ', it: ': il risparmio migliore è ' }) + sav[bi] + ' ≤ 0 → ℓ(' + (k + 1) + ') = −1.' });
      } else {
        S = S.filter(function (x) { return x !== bi; }).concat([k]);
        for (var t = 0; t < m; t++) lab[t] = S.indexOf(t) >= 0 ? 1 : 0;
        lab[bi] = -1;
        steps.push({ S: S.slice(), lab: lab.slice(), k: k, out: bi, sav: sav, msg: say({ en: 'Try k = ', it: 'Si prova k = ' }) + (k + 1) + ': s' + (bi + 1) + ',' + (k + 1) + ' = ' + sav[bi] + ' > 0 → ' + say({ en: 'swap ', it: 'scambio ' }) + (bi + 1) + ' ↔ ' + (k + 1) + '. S = ' + setStr(S) + ', z = ' + z(S) + say({ en: '. Labels reset; ℓ(', it: '. Etichette azzerate; ℓ(' }) + (bi + 1) + ') = −1.' });
      }
    }
    steps.push({ S: S.slice(), lab: lab.slice(), done: true, msg: say({ en: 'Every closed site has ℓ = −1: no swap improves. Stop with S = ', it: 'Ogni sito chiuso ha ℓ = −1: nessuno scambio migliora. Stop con S = ' }) + setStr(S) + ', z = ' + z(S) + '.' });
    var best = Infinity;
    (function rec(s, cur) { if (cur.length === p) { best = Math.min(best, z(cur)); return; } for (var i = s; i < m; i++) { cur.push(i); rec(i + 1, cur); cur.pop(); } })(0, []);

    var at = 0;
    var pane = W.pane(el, { title: say({ en: 'Teitz and Bart · p = ', it: 'Teitz e Bart · p = ' }) + p, tag: say({ en: 'step by step', it: 'passo per passo' }) });
    var tools = pane.body.appendChild(h('div', 'wm-toolbar'));
    function btn(label, fn) { var b = h('button', { type: 'button', class: 'wm-btn', text: label }); b.addEventListener('click', function () { fn(); draw(); }); tools.appendChild(b); }
    btn(say({ en: '⟲ reset', it: '⟲ da capo' }), function () { at = 0; });
    btn(say({ en: '◂ back', it: '◂ indietro' }), function () { at = Math.max(0, at - 1); });
    btn(say({ en: 'next ▸', it: 'avanti ▸' }), function () { at = Math.min(steps.length - 1, at + 1); });
    btn(say({ en: 'to the end ▸▸', it: 'fino alla fine ▸▸' }), function () { at = steps.length - 1; });
    var view = pane.body.appendChild(h('div', { style: { marginTop: '0.8rem' } }));
    var savHost = pane.section();
    var set = W.stats(pane.section('wm-flush'), [
      { key: 'S', label: 'S' },
      { key: 'z', label: 'z(S)', hl: true },
      { key: 'step', label: say({ en: 'step', it: 'passo' }) },
      { key: 'opt', label: say({ en: 'optimum (enumeration)', it: 'ottimo (enumerazione)' }) }
    ]);
    var verdict = W.note(pane.root);

    function draw() {
      var st = steps[at], S1 = st.S;
      var head = [say({ en: 'site i', it: 'sito i' }), 'ℓ(i)'];
      for (var j = 0; j < n; j++) head.push(String(j + 1));
      var mins = [];
      for (j = 0; j < n; j++) { var b = Infinity; S1.forEach(function (i) { b = Math.min(b, M[i][j]); }); mins.push(b); }
      var rows = M.map(function (row, i) {
        var open = S1.indexOf(i) >= 0;
        var name = (open ? '■ ' : '□ ') + (i + 1);
        var r = [st.k === i ? h('span', 'wm-hl-text', name + ' = k') : name, st.lab[i] === -1 ? '−1' : String(st.lab[i])];
        row.forEach(function (cst, jj) { r.push(open && cst === mins[jj] ? h('strong', null, String(cst)) : (open ? String(cst) : h('span', 'wm-muted', String(cst)))); });
        return r;
      });
      var foot = [h('strong', null, say({ en: 'assigned', it: 'assegnato' })), ''];
      mins.forEach(function (x) { foot.push(h('strong', null, String(x))); });
      rows.push(foot);
      view.textContent = '';
      view.appendChild(W.table(head, rows, { rowHeader: true, align: head.map(function (_, i) { return i === 0 ? 'l' : 'r'; }) }));
      savHost.textContent = '';
      savHost.appendChild(h('div', 'wm-small wm-muted', say({ en: '■ open, □ closed. Bold: the cost each customer pays to its nearest open site; z(S) is their sum.', it: '■ aperto, □ chiuso. In grassetto: il costo che ogni cliente paga verso il sito aperto più vicino; z(S) è la loro somma.' })));
      if (st.sav) {
        var row = h('div', { class: 'wm-toolbar', style: { marginTop: '0.5rem' } });
        Object.keys(st.sav).forEach(function (i) { row.appendChild(h('span', 'wm-tag', 's' + (Number(i) + 1) + ',' + (st.k + 1) + ' = ' + st.sav[i])); });
        savHost.appendChild(row);
      }
      set('S', setStr(S1));
      set('z', String(z(S1)));
      set('step', at + ' / ' + (steps.length - 1));
      set('opt', String(best));
      verdict(st.done ? (z(S1) === best ? 'pos' : 'info') : 'info', st.msg + (st.done ? (z(S1) === best ? say({ en: ' Here the local optimum is also the global one.', it: ' Qui l\'ottimo locale è anche globale.' }) : say({ en: ' The global optimum is ', it: ' L\'ottimo globale è ' }) + best + '.') : ''));
    }
    draw();
  }
});
