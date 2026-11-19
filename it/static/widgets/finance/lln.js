/*
 * lln — Law of Large Numbers: the running average of fair die rolls
 * converging to E[X] = 3.5 as the number of rolls grows.
 *   ```wimark-lln {"max": 2000}
 *   [4, 2, 5, 1, 6, 3, 4, 6, 2, 5]
 *   ```
 * The body seeds the first rolls; the slider adds random ones up to max. The
 * highlight is the current average X̄ₙ.
 */
WiMark.register('lln', {
  title: 'Law of large numbers',
  description: 'Running average of die rolls against E[X] = 3.5.',
  example: { opts: { max: 2000 }, body: [4, 2, 5, 1, 6, 3, 4, 6, 2, 5] },
  mount: function (el, v) {
    var W = WiMark, h = W.h, svg = W.svg, say = W.say;
    var seed = W.list(v.items).map(Number).filter(function (x) { return x >= 1 && x <= 6; });
    var max = W.num(v.max, 2000), height = W.num(v.height, 260);
    var rolls = seed.slice();
    var P = { n: Math.max(seed.length, 10) };
    var fix = function (x, d) { return W.fmt(x, { minimumFractionDigits: d, maximumFractionDigits: d }); };

    var pane = W.pane(el, { title: say({ en: 'Law of large numbers: rolling a die', it: 'Legge dei grandi numeri: il lancio di un dado' }), tag: say({ en: 'simulation', it: 'simulazione' }) });
    var plot = pane.body.appendChild(h('div'));
    var sec = pane.section();
    var grid = W.controls(sec, P, [{ key: 'n', label: say({ en: 'rolls n', it: 'lanci n' }), min: 10, max: max, step: 10, format: function (x) { return String(x); } }], draw, 1);
    var slider = grid.querySelector('input');
    var reroll = h('button', { type: 'button', class: 'wm-btn', text: say({ en: 're-roll', it: 'rilancia' }) });
    var reset = h('button', { type: 'button', class: 'wm-btn', text: say({ en: 'seed rolls', it: 'lanci iniziali' }) });
    sec.appendChild(h('div', { class: 'wm-toolbar', style: { marginTop: '0.5rem' } }, reroll, reset));
    var set = W.stats(pane.section('wm-flush'), [
      { key: 'avg', label: 'X̄ₙ', hl: true },
      { key: 'err', label: '|X̄ₙ − 3,5|'.replace(',', say({ en: '.', it: ',' })) }
    ]);

    function draw() {
      var n = P.n;
      while (rolls.length < n) rolls.push(1 + Math.floor(Math.random() * 6));
      plot.textContent = '';
      var c = W.chart(plot, { width: 680, height: height, margin: { left: 40, right: 20 }, title: say({ en: 'running average of the rolls', it: 'media progressiva dei lanci' }), xTitle: say({ en: 'rolls', it: 'lanci' }), yTitle: 'X̄ₙ' });
      var x = W.scale.linear([1, n], [0, c.w]);
      var y = W.scale.linear([1, 6], [c.h, 0]);
      c.axisY(y, { format: String });
      c.axisXLinear(x, { ticks: 5, format: function (t) { return String(Math.round(t)); } });
      c.add(svg('line', { x1: 0, x2: c.w, y1: y(3.5), y2: y(3.5), class: 'wm-guide' }));
      var d = '', sum = 0, avg = 0;
      for (var i = 1; i <= n; i++) {
        sum += rolls[i - 1];
        avg = sum / i;
        d += (i === 1 ? 'M' : 'L') + x(i).toFixed(1) + ',' + y(avg).toFixed(1);
      }
      c.clipped(svg('path', { d: d, class: 'wm-line ' + W.series(0) }));
      c.dot(x(n), y(avg), 'wm-hl', 5);
      c.label(c.w, y(3.5), 'E[X] = ' + fix(3.5, 1), { at: 'sw' });
      set('avg', fix(avg, 3));
      set('err', fix(Math.abs(avg - 3.5), 3));
    }

    reroll.addEventListener('click', function () { rolls = []; draw(); });
    reset.addEventListener('click', function () {
      rolls = seed.slice();
      P.n = Math.max(seed.length, 10);
      slider.value = P.n;
      slider.dispatchEvent(new Event('input'));
    });
    draw();
  }
});
