/*
 * quiz — multiple-choice self-check: pick an answer, see if it is right and why.
 *   ```wimark-quiz {"title": "Check yourself"}
 *   [
 *     {"q": "What is $2 + 2$?", "options": ["3", "4"], "answer": 1, "why": "Basic sums."}
 *   ]
 *   ```
 * answer is the 0-based index of the right option; why is optional. Text
 * takes inline markup and $math$. No yellow: right and wrong are states.
 */
WiMark.register('quiz', {
  title: 'Quiz',
  description: 'Multiple-choice questions with feedback and a running score.',
  example: {
    opts: { title: 'Check yourself' },
    body: '[\n  {"q": "A risk-averse agent has a utility function that is…", "options": ["linear", "concave", "convex"], "answer": 1, "why": "Concavity means diminishing marginal utility: $U\'\' < 0$."},\n  {"q": "The risk premium of a risk-neutral agent is…", "options": ["positive", "zero", "negative"], "answer": 1}\n]'
  },
  mount: function (el, v) {
    var W = WiMark, h = W.h, say = W.say;
    var items = W.list(v.items);
    if (!items.length) throw new Error('quiz: give a JSON array of {q, options, answer}');
    items.forEach(function (it, i) {
      if (!it || !it.q || !Array.isArray(it.options) || typeof it.answer !== 'number' || !it.options[it.answer]) {
        throw new Error('quiz: question ' + (i + 1) + ' needs q, options and a valid answer index');
      }
    });
    var done = 0, right = 0;
    var pane = W.pane(el, { title: v.title ? say(v.title) : say({ en: 'Check yourself', it: 'Verifica' }), tag: items.length + ' ' + say({ en: 'questions', it: 'domande' }) });
    pane.body.className = 'wm-pane-body wm-quiz';
    items.forEach(function (it, i) {
      var sec = i ? pane.section() : pane.body;
      var feedback = h('div');
      var row = h('div', { class: 'wm-toolbar', style: { marginTop: '0.6rem' } });
      var buttons = it.options.map(function (o, k) {
        var b = h('button', { type: 'button', class: 'wm-btn' }, W.inline(o));
        b.addEventListener('click', function () {
          var ok = k === it.answer;
          done++;
          if (ok) right++;
          buttons.forEach(function (x, j) {
            x.disabled = true;
            if (j === it.answer) x.setAttribute('aria-pressed', 'true');
            else if (j === k) x.classList.add('wm-struck');
          });
          var st = W.state(ok ? 'pos' : 'neg');
          feedback.appendChild(h('div', { class: 'wm-row wm-' + st, style: { marginTop: '0.7rem' } }, h('span', 'wm-icon', ok ? '✓' : '✕'),
            h('strong', 'wm-text', ok ? say({ en: 'Right.', it: 'Esatto.' }) : say({ en: 'Not quite: the answer is marked.', it: 'Non proprio: la risposta giusta è evidenziata.' }))));
          if (it.why) feedback.appendChild(h('p', { class: 'wm-text', style: { marginTop: '0.35rem' } }, W.inline(it.why)));
          W.typeset(feedback);
          showScore();
        });
        row.appendChild(b);
        return b;
      });
      sec.appendChild(h('div', 'wm-text', h('span', 'wm-muted', (i + 1) + '.  '), W.inline(it.q)));
      sec.appendChild(row);
      sec.appendChild(feedback);
    });
    var foot = pane.section();
    var score = h('span', 'wm-muted wm-small', '');
    var reset = h('button', { type: 'button', class: 'wm-btn', text: say({ en: 'reset', it: 'ricomincia' }) });
    reset.addEventListener('click', function () { el.textContent = ''; W.get('quiz').mount(el, v); W.typeset(el); });
    foot.appendChild(h('div', { class: 'wm-row', style: { justifyContent: 'space-between' } }, score, reset));
    function showScore() {
      score.textContent = say({ en: 'score ', it: 'punteggio ' }) + right + ' / ' + done + ' · ' + (items.length - done) + say({ en: ' left', it: ' da fare' });
    }
    showScore();
  }
});
