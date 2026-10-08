/* Terminus: model answers. The panel under a question, loading the answer file, maths (KaTeX, loaded on first use) and the
   practice score. Ticking a marking point saves quietly and updates the page in place, so an open answer never closes. */
(function (root) {
  'use strict';
  var FE = root.FE = root.FE || {}; FE.parts = FE.parts || [];

  FE.parts.push(function (env) {
    var core = env.core, store = env.store, u = env.u, ctx = env.ctx, P = core.PLAN, esc = u.esc, doc = root.document;
    ctx.ansData = {}; ctx.ansLoading = {}; ctx.openAns = {};

    function fileFor(paper) { var p = P.papers[paper]; return p && p.ah ? 'answers/' + paper + '.' + p.ah + '.json' : null; }
    function answerUrls() { return Object.keys(P.papers).map(fileFor).filter(Boolean).concat((P.meta && P.meta.figs) || []); }   // answer files and their figures
    function n1(x) { return String(Math.round(x * 10) / 10); }

    /* ---------- loading ---------- */
    function load(paper) {
      if (ctx.ansData[paper]) return Promise.resolve(ctx.ansData[paper]);
      if (ctx.ansLoading[paper]) return ctx.ansLoading[paper];
      var url = fileFor(paper);
      if (!url) return Promise.reject(new Error('no answers for ' + paper));
      var p = root.fetch(url).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then(function (d) { ctx.ansData[paper] = d; delete ctx.ansLoading[paper]; return d; }, function (e) { delete ctx.ansLoading[paper]; throw e; });
      ctx.ansLoading[paper] = p;
      return p;
    }
    var katexP = null;
    function ensureKatex() {
      if (root.katex) return Promise.resolve();
      if (katexP) return katexP;
      katexP = new Promise(function (res, rej) {
        var l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = 'vendor/katex/katex.min.css'; doc.head.appendChild(l);
        var s = doc.createElement('script'); s.src = 'vendor/katex/katex.min.js'; s.onload = function () { res(); };
        s.onerror = function () { katexP = null; rej(new Error('katex')); };
        doc.head.appendChild(s);
      });
      return katexP;
    }
    function typeset(el) {
      if (!root.katex || !el) return;
      [].forEach.call(el.querySelectorAll('.tex:not([data-done])'), function (n) {
        try { root.katex.render(n.textContent, n, { displayMode: n.classList.contains('d'), throwOnError: false, strict: 'ignore' }); } catch (e) { /* leave the TeX as text */ }
        n.setAttribute('data-done', '1');
      });
    }

    /* ---------- the panel ---------- */
    function entry(q) { var d = ctx.ansData[q.p]; return d && d.q[q.q] || null; }
    function ticksFor(q, a) { var rec = store.getPractice(q.k); return rec && rec.ph === a.ph ? rec.t : []; }
    function scoreOf(a, ticked) { return Math.min(a.m, ticked.reduce(function (s, i) { return s + a.pts[i][0]; }, 0)); }
    function scoreText(a, ticked) { return 'Your score ' + n1(scoreOf(a, ticked)) + ' / ' + (a.est ? 'about ' : '') + n1(a.m); }

    function panel(q, a, lvl) {
      lvl = lvl || 3;
      var ticked = ticksFor(q, a);
      var pts = a.pts.map(function (p, i) {
        return '<li><label class="pt"><input type="checkbox" data-act="anspt" data-key="' + esc(q.k) + '" data-i="' + i + '"' + (ticked.indexOf(i) >= 0 ? ' checked' : '') + '><span class="w" aria-label="' + n1(p[0]) + ' marks">' + n1(p[0]) + '</span><span class="t">' + p[1] + '</span></label></li>';
      }).join('');
      return '<h' + lvl + ' class="ans-title">Model answer</h' + lvl + '>' +
        '<div class="chips"><span class="chip">' + (a.est ? 'about ' : '') + n1(a.m) + ' marks</span><span class="chip">about ' + a.t + ' min</span>' +
        (a.conf && a.conf !== 'high' ? '<span class="chip weak">' + (a.conf === 'low' ? 'Low' : 'Medium') + ' confidence</span>' : '') + (a.chk ? '<span class="chip">Numbers re-checked</span>' : '') + '</div>' +
        '<div class="ans-body">' + a.html + '</div>' +
        (a.sketch ? '<div class="notice ans-box ans-draw"><b>Diagram to draw</b><div class="ans-body">' + a.sketch + '</div></div>' : '') +
        '<div class="ans-pts"><h' + (lvl + 1) + ' class="ans-sub">Mark yourself</h' + (lvl + 1) + '><p class="hint">Tick what your own answer covered. Be strict: a point counts only if you wrote it.</p><ul class="pts">' + pts + '</ul>' +
        '<div class="score-row"><output class="score" aria-live="polite" data-key="' + esc(q.k) + '">' + scoreText(a, ticked) + '</output><button class="btn ghost sm" data-act="ansclear" data-key="' + esc(q.k) + '">Clear ticks</button></div></div>' +
        (a.watch ? '<div class="ans-box"><b>Watch out</b><div class="ans-body">' + a.watch + '</div></div>' : '') +
        (a.fix ? '<div class="notice ans-box fix"><b>Correction to the slides</b><div class="ans-body">' + a.fix + '</div></div>' : '') +
        (a.src ? '<p class="sub">Sources: ' + esc(a.src) + '.</p>' : '');
    }

    /* pieces the question card and the question page use */
    function slot(q, lvl) {      // lvl: the heading level of the panel title (3 on a card under a section heading, 2 on the question page)
      if (!q.a) return '';
      lvl = lvl || 3;
      var a = ctx.openAns[q.k] && entry(q);
      return '<div class="ans" data-key="' + esc(q.k) + '" data-lvl="' + lvl + '"' + (a ? '' : ' hidden') + '>' + (a ? panel(q, a, lvl) : '') + '</div>';
    }
    function isOpen(q) { return !!(q.a && ctx.openAns[q.k] && entry(q)); }
    function wide() { return !!(root.matchMedia && root.matchMedia('(min-width: 1100px)').matches); }
    function button(q) {
      if (!q.a) return '';
      var open = !!(ctx.openAns[q.k] && entry(q));
      return '<button class="btn sm ans-btn' + (open ? ' ghost' : '') + '" data-act="ansshow" data-key="' + esc(q.k) + '" aria-expanded="' + open + '" title="Write your answer first, then check it">' + (open ? 'Hide model answer' : 'Show model answer') + '</button>';
    }
    function chip(key) {
      var r = store.getPractice(key);
      return '<span class="chip score" data-score-chip="' + esc(key) + '"' + (r ? '' : ' hidden') + ' title="Your last score on this question">' + (r ? n1(r.s) + '/' + n1(r.m) : '') + '</span>';
    }
    function setChips(key) {
      var r = store.getPractice(key);
      [].forEach.call(doc.querySelectorAll('[data-score-chip]'), function (c) {
        if (c.getAttribute('data-score-chip') !== key) return;
        c.hidden = !r; c.textContent = r ? n1(r.s) + '/' + n1(r.m) : '';
      });
    }

    /* ---------- topic summary ---------- */
    function summaryText(keys) {
      var withAns = keys.filter(function (k) { return core.qByKey[k] && core.qByKey[k].a; });
      if (!withAns.length) return '';
      var s = store.practiceSummary(withAns);
      return 'Model answers for ' + withAns.length + ' of ' + keys.length + ' questions. ' + (s.n ? 'Practised ' + s.n + ', average ' + Math.round(s.avg * 100) + '%.' : 'Not practised yet.');
    }
    function summaryEl() {
      var el = doc.getElementById('practice-sum'); if (!el) return;
      el.textContent = summaryText((el.getAttribute('data-keys') || '').split(',').filter(Boolean));
    }

    /* ---------- actions (called from app.js) ---------- */
    function toggle(btn) {
      var key = btn.getAttribute('data-key'), q = core.qByKey[key]; if (!q) return;
      var host = btn.closest('.qcard, .qpage'), slotEl = host && host.querySelector('.ans'); if (!slotEl) return;
      var split = host.querySelector('.qsplit');
      if (!slotEl.hidden) {                                      // hide
        slotEl.hidden = true; delete ctx.openAns[key];
        if (split) split.classList.remove('split');
        btn.setAttribute('aria-expanded', 'false'); btn.textContent = 'Show model answer'; btn.classList.remove('ghost');
        return;
      }
      btn.disabled = true; btn.textContent = 'Loading...';
      Promise.all([load(q.p), ensureKatex().catch(function () { return null; })]).then(function () {
        var a = entry(q);
        if (!a) throw new Error('missing');
        ctx.openAns[key] = true;
        slotEl.innerHTML = panel(q, a, +slotEl.getAttribute('data-lvl') || 3); slotEl.hidden = false;
        if (split) {                                             // wide screens: the question on the left, the answer on the right
          split.classList.add('split');
          var qb = host.querySelector('.qbody'), qs = host.querySelector('[data-act=qshow]');
          if (wide() && qb && qb.hidden && qs) qs.click();
        }
        btn.setAttribute('aria-expanded', 'true'); btn.textContent = 'Hide model answer'; btn.classList.add('ghost');
        typeset(slotEl);
      }).catch(function () {
        slotEl.innerHTML = '<p class="imgfail">This answer is not saved on this device yet. Connect once to read it, or open More and choose Save all papers and answers for offline.</p>';
        slotEl.hidden = false; btn.textContent = 'Show model answer';
      }).then(function () { btn.disabled = false; });
    }
    function tick(input) {
      var key = input.getAttribute('data-key'), q = core.qByKey[key], a = q && entry(q); if (!a) return;
      var box = input.closest('.ans'), ticked = [];
      [].forEach.call(box.querySelectorAll('input[data-act=anspt]'), function (b) { if (b.checked) ticked.push(+b.getAttribute('data-i')); });
      store.setPractice(key, ticked, scoreOf(a, ticked), a.m, a.ph);
      var out = box.querySelector('output.score'); if (out) out.textContent = scoreText(a, ticked);
      setChips(key); summaryEl();
    }
    function clear(btn) {
      var key = btn.getAttribute('data-key'), q = core.qByKey[key], a = q && entry(q); if (!a) return;
      [].forEach.call(btn.closest('.ans').querySelectorAll('input[data-act=anspt]'), function (b) { b.checked = false; });
      store.setPractice(key, [], 0, a.m, a.ph);
      var out = btn.closest('.ans').querySelector('output.score'); if (out) out.textContent = scoreText(a, []);
      setChips(key); summaryEl();
    }
    /* after any redraw: re-typeset answers that were open (their text is rebuilt from the loaded data) */
    function restore(rootEl) {
      var open = (rootEl || doc).querySelectorAll('.ans:not([hidden])');
      if (!open.length) return;
      ensureKatex().then(function () { [].forEach.call(open, typeset); }, function () { /* shows the TeX as text */ });
    }

    return {
      ansSlot: slot, ansButton: button, ansChip: chip, ansOpen: isOpen, ansWide: wide, ansToggle: toggle, ansTick: tick, ansClear: clear, ansRestore: restore,
      ansSummaryText: summaryText, ansSummaryEl: summaryEl, ansUrls: answerUrls, ansFile: fileFor
    };
  });
})(typeof window !== 'undefined' ? window : globalThis);
