/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  GOTOMARK WIDGET — lorenz
 *  Laboratorio animato sul sistema di Lorenz:
 *   1. attrattore 3D ruotante (più traiettorie quasi identiche che divergono);
 *   2. serie temporale x(t) di due traiettorie;
 *   3. distanza tra due traiettorie in scala log (crescita esponenziale);
 *   4. mappa di Lorenz: massimo z_n contro il successivo z_{n+1}.
 *  Cursori per σ, ρ, β e velocità; stima live dell'esponente di Lyapunov
 *  (metodo di Benettin) e del regime dinamico.
 *
 *  Usa SOLO i colori della palette (CSS variables del tema), sempre pieni:
 *  nessuna trasparenza, quindi nessuna tonalità fuori palette.
 *
 *  Payload atteso (blocco ```widget-lorenz):
 *  {
 *    "data":   { "sigma": 10, "rho": 28, "beta": 2.6667 },
 *    "config": { "trajectories": 7, "trail": 700, "height": 380 }
 *  }
 * ─────────────────────────────────────────────────────────────────────────────
 */
(function (global) {
  'use strict';

  var Widgets = global.Widgets;
  var h = Widgets.dom.h;

  var TEXT = {
    it: {
      attractor: 'Attrattore 3D', series: 'x(t) — due traiettorie',
      sep: 'log₁₀ distanza tra traiettorie', map: 'Mappa di Lorenz: zₙ → zₙ₊₁',
      speed: 'velocità', pause: 'Pausa', play: 'Avvia', reset: 'Reset', classic: 'Classico',
      lyap: 'Esponente di Lyapunov λ', regime: 'Regime', time: 'Tempo t',
      r0: 'origine stabile: tutto collassa in 0',
      r1: 'punti fissi C± stabili: spirale verso l’equilibrio',
      r2: 'caos: attrattore strano',
      ref: 'pendenza attesa da λ'
    },
    en: {
      attractor: '3D attractor', series: 'x(t) — two trajectories',
      sep: 'log₁₀ distance between trajectories', map: 'Lorenz map: zₙ → zₙ₊₁',
      speed: 'speed', pause: 'Pause', play: 'Play', reset: 'Reset', classic: 'Classic',
      lyap: 'Lyapunov exponent λ', regime: 'Regime', time: 'Time t',
      r0: 'stable origin: everything collapses to 0',
      r1: 'stable fixed points C±: spiral to equilibrium',
      r2: 'chaos: strange attractor',
      ref: 'slope expected from λ'
    }
  };

  Widgets.register('lorenz', {
    dependencies: [],
    mount: function (el, data, config) {
      data = data || {};
      config = config || {};
      var lang = (document.documentElement.lang || 'it').slice(0, 2);
      var T = TEXT[lang] || TEXT.en;

      var def = {
        sigma: Number(data.sigma) || 10,
        rho: Number(data.rho) || 28,
        beta: Number(data.beta) || 8 / 3
      };
      var P = { sigma: def.sigma, rho: def.rho, beta: def.beta, speed: 3 };
      var nTraj = Math.max(2, Math.min(24, Number(config.trajectories) || 7));
      var trail = Math.max(50, Number(config.trail) || 700);
      var height = Number(config.height) || 380;

      var c = Widgets.colors();
      var shades = [c.line, c.graySoft, c.gray, c.ink]; // lontano → vicino
      var font = getComputedStyle(document.documentElement).getPropertyValue('--mono').trim() || 'monospace';

      /* ─── DOM ─────────────────────────────────────────────────────────── */
      var root = h('div', 'w-lorenz');
      el.appendChild(root);

      function panel(parent, title, px) {
        var p = h('div', 'w-lorenz-panel');
        p.appendChild(h('div', 'w-lorenz-title', title));
        var box = h('div', 'w-lorenz-canvas');
        box.style.height = px + 'px';
        var cv = document.createElement('canvas');
        box.appendChild(cv);
        p.appendChild(box);
        parent.appendChild(p);
        var o = { box: box, cv: cv, ctx: cv.getContext('2d'), W: 0, H: 0 };
        o.resize = function () {
          var dpr = global.devicePixelRatio || 1;
          o.W = box.clientWidth; o.H = box.clientHeight;
          cv.width = Math.round(o.W * dpr); cv.height = Math.round(o.H * dpr);
          cv.style.width = o.W + 'px'; cv.style.height = o.H + 'px';
          o.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        return o;
      }

      var A = panel(root, T.attractor, height);

      // Controlli
      var ctrl = h('div', 'w-lorenz-controls');
      root.appendChild(ctrl);
      var sliders = {};
      function slider(key, label, min, max, stepv) {
        var wrap = h('label', 'w-lorenz-slider');
        var head = h('span', 'w-lorenz-slabel');
        var name = h('span', null, label);
        var val = h('span', 'w-lorenz-sval');
        head.appendChild(name); head.appendChild(val);
        var input = document.createElement('input');
        input.type = 'range'; input.min = min; input.max = max; input.step = stepv;
        input.value = P[key];
        function show() { val.textContent = key === 'speed' ? P[key] + '×' : Number(P[key]).toFixed(2); }
        input.addEventListener('input', function () {
          P[key] = Number(input.value);
          show();
          if (key !== 'speed') reset();
        });
        show();
        wrap.appendChild(head); wrap.appendChild(input);
        ctrl.appendChild(wrap);
        sliders[key] = { input: input, show: show };
      }
      slider('sigma', 'σ', 1, 20, 0.1);
      slider('rho', 'ρ', 0.5, 60, 0.1);
      slider('beta', 'β', 0.2, 6, 0.01);
      slider('speed', T.speed, 1, 10, 1);

      var btns = h('div', 'w-lorenz-buttons');
      ctrl.appendChild(btns);
      var running = true;
      var bPause = h('button', 'w-lorenz-btn', T.pause);
      var bReset = h('button', 'w-lorenz-btn', T.reset);
      var bClassic = h('button', 'w-lorenz-btn', T.classic);
      bPause.type = bReset.type = bClassic.type = 'button';
      btns.appendChild(bPause); btns.appendChild(bReset); btns.appendChild(bClassic);
      bPause.addEventListener('click', function () {
        running = !running;
        bPause.textContent = running ? T.pause : T.play;
      });
      bReset.addEventListener('click', function () { reset(); });
      bClassic.addEventListener('click', function () {
        ['sigma', 'rho', 'beta'].forEach(function (k) {
          P[k] = def[k]; sliders[k].input.value = def[k]; sliders[k].show();
        });
        reset();
      });

      // Statistiche
      var stats = h('div', 'w-lorenz-stats');
      root.appendChild(stats);
      function stat(label) {
        var s = h('div', 'w-lorenz-stat');
        s.appendChild(h('div', 'w-lorenz-slabel', label));
        var v = h('div', 'w-lorenz-stat-val', '—');
        s.appendChild(v);
        stats.appendChild(s);
        return v;
      }
      var vLyap = stat(T.lyap), vRegime = stat(T.regime), vTime = stat(T.time);

      var grid = h('div', 'w-lorenz-grid');
      root.appendChild(grid);
      var S = panel(grid, T.series, 200);
      var D = panel(grid, T.sep, 200);
      var M = panel(grid, T.map, 200);
      var panels = [A, S, D, M];

      /* ─── Dinamica ────────────────────────────────────────────────────── */
      function deriv(p) {
        return [
          P.sigma * (p[1] - p[0]),
          p[0] * (P.rho - p[2]) - p[1],
          p[0] * p[1] - P.beta * p[2]
        ];
      }
      function rk4(p, dt) {
        var k1 = deriv(p);
        var k2 = deriv([p[0] + k1[0] * dt / 2, p[1] + k1[1] * dt / 2, p[2] + k1[2] * dt / 2]);
        var k3 = deriv([p[0] + k2[0] * dt / 2, p[1] + k2[1] * dt / 2, p[2] + k2[2] * dt / 2]);
        var k4 = deriv([p[0] + k3[0] * dt, p[1] + k3[1] * dt, p[2] + k3[2] * dt]);
        return [
          p[0] + dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
          p[1] + dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
          p[2] + dt / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2])
        ];
      }
      function dist(a, b) {
        var dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
      }

      var dt = 0.005, D0 = 1e-8, SERIES = 600;
      var trajs, shadow, lsum, t, seriesA, seriesB, sepLog, zPeaks, lastZ, prevZdot, angle = 0;
      var view = { cx: 0, cy: 0, cz: 25, span: 50 };

      function reset() {
        trajs = [];
        for (var i = 0; i < nTraj; i++) trajs.push({ head: [0.1 + i * 1e-3, 0, 20], pts: [] });
        shadow = [0.1 + D0, 0, 20];
        lsum = 0; t = 0;
        seriesA = []; seriesB = []; sepLog = [];
        zPeaks = []; lastZ = null; prevZdot = null;
      }

      function step() {
        for (var s = 0; s < P.speed; s++) {
          trajs.forEach(function (tr) {
            tr.head = rk4(tr.head, dt);
            tr.pts.push(tr.head);
            if (tr.pts.length > trail) tr.pts.shift();
          });
          // Lyapunov (Benettin): ombra a distanza D0, rinormalizzata a ogni passo.
          var ref = trajs[0].head;
          shadow = rk4(shadow, dt);
          var d = dist(shadow, ref);
          if (d > 0 && isFinite(d)) {
            lsum += Math.log(d / D0);
            var k = D0 / d;
            shadow = [ref[0] + (shadow[0] - ref[0]) * k, ref[1] + (shadow[1] - ref[1]) * k, ref[2] + (shadow[2] - ref[2]) * k];
          }
          t += dt;
          // Mappa di Lorenz: massimi locali di z (ż passa da + a −).
          var zdot = ref[0] * ref[1] - P.beta * ref[2];
          if (prevZdot !== null && prevZdot > 0 && zdot <= 0) {
            if (lastZ !== null) zPeaks.push([lastZ, ref[2]]);
            if (zPeaks.length > 4000) zPeaks.shift();
            lastZ = ref[2];
          }
          prevZdot = zdot;
        }
        var a = trajs[0].head, b = trajs[nTraj - 1].head;
        seriesA.push(a[0]); seriesB.push(b[0]);
        sepLog.push(Math.log(Math.max(dist(a, b), 1e-12)) / Math.LN10);
        if (seriesA.length > SERIES) { seriesA.shift(); seriesB.shift(); sepLog.shift(); }
        angle += 0.0035;
      }

      function regime() {
        var s = P.sigma, b = P.beta, r = P.rho;
        if (r < 1) return T.r0;
        var rH = s > b + 1 ? s * (s + b + 3) / (s - b - 1) : Infinity; // soglia di Hopf
        return r < rH ? T.r1 : T.r2;
      }

      /* ─── Disegno ─────────────────────────────────────────────────────── */
      function clear(o) {
        o.ctx.fillStyle = c.surface;
        o.ctx.fillRect(0, 0, o.W, o.H);
      }
      function label(o, txt, x, y, align, color) {
        o.ctx.fillStyle = color || c.graySoft;
        o.ctx.font = '10px ' + font;
        o.ctx.textAlign = align || 'left';
        o.ctx.fillText(txt, x, y);
      }

      function drawAttractor() {
        var o = A, ctx = o.ctx;
        clear(o);
        // Inquadratura adattiva: segue l'estensione reale dell'attrattore.
        var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
        trajs.forEach(function (tr) {
          for (var k = 0; k < tr.pts.length; k++) {
            var p = tr.pts[k];
            for (var j = 0; j < 3; j++) { if (p[j] < mn[j]) mn[j] = p[j]; if (p[j] > mx[j]) mx[j] = p[j]; }
          }
        });
        if (isFinite(mn[0])) {
          var span = Math.max(10, mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
          var e = 0.06;
          view.cx += ((mn[0] + mx[0]) / 2 - view.cx) * e;
          view.cy += ((mn[1] + mx[1]) / 2 - view.cy) * e;
          view.cz += ((mn[2] + mx[2]) / 2 - view.cz) * e;
          view.span += (span - view.span) * e;
        }
        var scale = Math.min(o.W, o.H * 1.3) / (view.span * 1.25);
        var ca = Math.cos(angle), sa = Math.sin(angle), tilt = 0.32, ct = Math.cos(tilt), st = Math.sin(tilt);
        function project(p) {
          var x = p[0] - view.cx, y = p[1] - view.cy, z = p[2] - view.cz;
          var rx = x * ca - y * sa, ry = x * sa + y * ca;
          return [o.W / 2 + rx * scale, o.H / 2 - (z * ct - ry * st) * scale, z * st + ry * ct];
        }

        var buckets = shades.map(function () { return []; });
        var heads = [];
        trajs.forEach(function (tr) {
          var prev = null;
          for (var k = 0; k < tr.pts.length; k++) {
            var q = project(tr.pts[k]);
            if (prev) {
              var d = ((prev[2] + q[2]) / 2) / view.span + 0.5;
              var bi = Math.max(0, Math.min(shades.length - 1, Math.floor(d * shades.length)));
              buckets[bi].push(prev[0], prev[1], q[0], q[1]);
            }
            prev = q;
          }
          if (prev) heads.push(prev);
        });
        ctx.lineWidth = 1.1; ctx.lineCap = 'round';
        buckets.forEach(function (seg, bi) {
          if (!seg.length) return;
          ctx.strokeStyle = shades[bi];
          ctx.beginPath();
          for (var j = 0; j < seg.length; j += 4) { ctx.moveTo(seg[j], seg[j + 1]); ctx.lineTo(seg[j + 2], seg[j + 3]); }
          ctx.stroke();
        });
        ctx.fillStyle = c.ink;
        heads.forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], 2.6, 0, Math.PI * 2); ctx.fill(); });
        label(o, 'σ=' + P.sigma.toFixed(2) + '  ρ=' + P.rho.toFixed(2) + '  β=' + P.beta.toFixed(2), 10, o.H - 10);
      }

      function frameAxes(o, pad) {
        var ctx = o.ctx;
        ctx.strokeStyle = c.line; ctx.lineWidth = 1;
        ctx.strokeRect(pad.l + 0.5, pad.t + 0.5, o.W - pad.l - pad.r - 1, o.H - pad.t - pad.b - 1);
      }

      function plotLine(o, arr, n, y0, y1, pad, color, width) {
        if (arr.length < 2) return;
        var ctx = o.ctx, w = o.W - pad.l - pad.r, hh = o.H - pad.t - pad.b;
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round';
        ctx.beginPath();
        for (var i = 0; i < arr.length; i++) {
          var x = pad.l + (i / (n - 1)) * w;
          var y = pad.t + (1 - (arr[i] - y0) / (y1 - y0)) * hh;
          y = Math.max(pad.t, Math.min(pad.t + hh, y));
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }

      var PAD = { l: 30, r: 8, t: 8, b: 18 };

      function drawSeries() {
        var o = S; clear(o);
        var m = 1;
        for (var i = 0; i < seriesA.length; i++) m = Math.max(m, Math.abs(seriesA[i]), Math.abs(seriesB[i]));
        m = Math.ceil(m / 5) * 5;
        frameAxes(o, PAD);
        var mid = PAD.t + (o.H - PAD.t - PAD.b) / 2;
        o.ctx.strokeStyle = c.line; o.ctx.beginPath(); o.ctx.moveTo(PAD.l, mid + 0.5); o.ctx.lineTo(o.W - PAD.r, mid + 0.5); o.ctx.stroke();
        plotLine(o, seriesB, SERIES, -m, m, PAD, c.graySoft, 1.2);
        plotLine(o, seriesA, SERIES, -m, m, PAD, c.ink, 1.4);
        label(o, '+' + m, PAD.l - 4, PAD.t + 9, 'right');
        label(o, '0', PAD.l - 4, mid + 3, 'right');
        label(o, '−' + m, PAD.l - 4, o.H - PAD.b, 'right');
        label(o, 't', o.W - PAD.r, o.H - 5, 'right');
      }

      function drawSep() {
        var o = D; clear(o);
        var y0 = -4, y1 = 2;
        frameAxes(o, PAD);
        var hh = o.H - PAD.t - PAD.b, w = o.W - PAD.l - PAD.r, ctx = o.ctx;
        for (var g = y0 + 1; g < y1; g++) {
          var gy = Math.round(PAD.t + (1 - (g - y0) / (y1 - y0)) * hh) + 0.5;
          ctx.strokeStyle = c.line; ctx.setLineDash([2, 4]);
          ctx.beginPath(); ctx.moveTo(PAD.l, gy); ctx.lineTo(o.W - PAD.r, gy); ctx.stroke();
          ctx.setLineDash([]);
          label(o, String(g), PAD.l - 4, gy + 3, 'right');
        }
        // Retta di riferimento: crescita attesa e^{λt} dal primo campione.
        var lam = t > 1 ? lsum / t : 0;
        if (sepLog.length > 1 && lam > 0) {
          var first = sepLog[0], tFrame = dt * P.speed;
          ctx.strokeStyle = c.gray; ctx.setLineDash([5, 4]); ctx.lineWidth = 1;
          ctx.beginPath();
          for (var i = 0; i < SERIES; i++) {
            var v = first + lam * i * tFrame / Math.LN10;
            var x = PAD.l + (i / (SERIES - 1)) * w;
            var y = PAD.t + (1 - (v - y0) / (y1 - y0)) * hh;
            if (y < PAD.t) break;
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          ctx.stroke(); ctx.setLineDash([]);
          label(o, T.ref, o.W - PAD.r - 4, o.H - PAD.b - 6, 'right', c.gray);
        }
        plotLine(o, sepLog, SERIES, y0, y1, PAD, c.ink, 1.4);
      }

      function drawMap() {
        var o = M; clear(o);
        frameAxes(o, PAD);
        if (zPeaks.length < 2) { label(o, '…', o.W / 2, o.H / 2, 'center'); return; }
        var lo = Infinity, hi = -Infinity;
        zPeaks.forEach(function (p) { lo = Math.min(lo, p[0], p[1]); hi = Math.max(hi, p[0], p[1]); });
        if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
        var w = o.W - PAD.l - PAD.r, hh = o.H - PAD.t - PAD.b, ctx = o.ctx;
        function X(v) { return PAD.l + (v - lo) / (hi - lo) * w; }
        function Y(v) { return PAD.t + (1 - (v - lo) / (hi - lo)) * hh; }
        ctx.strokeStyle = c.line; ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.moveTo(X(lo), Y(lo)); ctx.lineTo(X(hi), Y(hi)); ctx.stroke(); ctx.setLineDash([]);
        var n = zPeaks.length;
        zPeaks.forEach(function (p, i) {
          ctx.fillStyle = i >= n - 12 ? c.ink : (i >= n - 200 ? c.gray : c.graySoft);
          ctx.fillRect(X(p[0]) - 1, Y(p[1]) - 1, 2, 2);
        });
        label(o, lo.toFixed(0), PAD.l, o.H - 5);
        label(o, hi.toFixed(0), o.W - PAD.r, o.H - 5, 'right');
      }

      function drawStats() {
        vLyap.textContent = t > 1 ? (lsum / t).toFixed(3) : '—';
        vRegime.textContent = regime();
        vTime.textContent = t.toFixed(1);
      }

      function drawAll() { drawAttractor(); drawSeries(); drawSep(); drawMap(); drawStats(); }

      /* ─── Avvio ───────────────────────────────────────────────────────── */
      reset();
      panels.forEach(function (o) { o.resize(); });
      if (global.ResizeObserver) {
        var ro = new ResizeObserver(function () { panels.forEach(function (o) { o.resize(); }); drawAll(); });
        panels.forEach(function (o) { ro.observe(o.box); });
      }

      var reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        running = false;
        bPause.textContent = T.play;
        for (var n = 0; n < SERIES; n++) step();
      }

      var visible = true;
      if (global.IntersectionObserver) {
        new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }).observe(root);
      }

      drawAll();
      (function loop() {
        if (running && visible && !document.hidden) { step(); drawAll(); }
        global.requestAnimationFrame(loop);
      })();
    }
  });
})(window);
