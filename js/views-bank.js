/* Terminus: the question bank. Past questions by topic and course contents, grouped into kinds, plus a self-check per topic. */
(function (root) {
  'use strict';
  var FE = root.FE = root.FE || {}; FE.parts = FE.parts || [];

  FE.parts.push(function (env) {
    var core = env.core, store = env.store, u = env.u, ctx = env.ctx, P = core.PLAN, esc = u.esc, rich = u.rich, plain = u.plain;

    function qhref(q) { return '#/q/' + encodeURIComponent(q.p) + '/' + encodeURIComponent(q.q); }
    function getP(k) { return store.getPractice(k); }
    function pct(x) { return Math.round(x * 100) + '%'; }
    function notFound(what) {
      return { html: '<section class="sheet">' + u.band('Questions', 'Not found', true) + '<div class="body"><a class="back" href="#/bank">' + u.icon('back') + 'Question bank</a><h1>' + esc(what) + ' not found</h1></div></section>', title: 'Question bank' };
    }

    /* "By topic | Search and papers" switch, shown at the top of the bank and of the finder. */
    function bankMode(active) {
      return '<nav class="seg qmode" aria-label="Question views"><a href="#/bank"' + (active === 'bank' ? ' aria-current="page"' : '') + '>By topic</a>' +
        '<a href="#/questions"' + (active === 'questions' ? ' aria-current="page"' : '') + '>Search and papers</a></nav>';
    }
    function searchForm() {
      return '<form class="qsearch" role="search" data-bankq><label class="sr" for="bq">Search past questions</label><input id="bq" type="search" inputmode="search" autocomplete="off" spellcheck="false" placeholder="Search every question: weibull, jominy, npv"></form>';
    }

    /* One punch hole per past paper of the course: filled when it asked this topic, dashed when only in part. */
    function strip(t) {
      var ys = core.yearStrip(t), asked = ys.filter(function (y) { return y.s; }).map(function (y) { return y.l + (y.s === 'part' ? ' partly' : ''); });
      var label = ys.length ? 'Asked in ' + ys.filter(function (y) { return y.s === 'firm'; }).length + ' of ' + ys.length + ' papers' + (asked.length ? ': ' + asked.join(', ') : '') : 'No past papers';
      return '<div class="yrs" role="img" aria-label="' + esc(label) + '">' + ys.map(function (y) {
        return '<span class="yr"><i class="hole' + (y.s === 'firm' ? ' on' : y.s === 'part' ? ' part' : '') + '"></i><small>' + esc(y.l) + '</small></span>';
      }).join('') + '</div>';
    }
    function counts(t) {
      var keys = core.bankKeys(t), ks = core.kinds(t), ans = keys.filter(function (k) { return core.qByKey[k].a; }), sum = store.practiceSummary(ans);
      return { keys: keys, kinds: ks, n: keys.length, answered: ans.length, sum: sum };
    }
    function statLine(c) {
      if (!c.n) return 'Not asked in past papers.';
      var s = core.plural(c.n, 'question') + ' in ' + core.plural(c.kinds.length, 'kind');
      s += c.sum.n ? '. Checked ' + c.sum.n + ' of ' + c.answered + ', average ' + pct(c.sum.avg) : '. Not checked yet';
      return s + '.';
    }
    function checkHref(t, set, idx) { return '#/check/' + t.id + '?l=' + idx.join('.') + (set ? '&set=' + set : ''); }

    /* ---------- the bank, one course ---------- */
    function row(t) {
      var c = counts(t), s = u.state(t.id), idx = core.checkSet(t, 'kinds', getP);
      var act = c.n ? (idx.length ? '<a class="btn ghost sm" href="' + checkHref(t, 'kinds', idx) + '">Self-check</a>' : '') : '';
      return '<li class="brow" data-c="' + t.c + '"><div class="main"><h3><a href="#/bank/' + t.id + '">' + rich(t.n) + '</a></h3>' +
        '<div class="line"><span class="chip id">' + t.id + (t.r ? ' · ' + esc(t.r) : '') + '</span>' + u.chipTag(t) + (s === 'parked' ? '<span class="chip">Set aside</span>' : '') + '</div>' +
        (c.n ? strip(t) : '') + '<p class="bstat">' + esc(statLine(c)) + '</p></div>' + (act ? '<div class="bact">' + act + '</div>' : '') + '</li>';
    }
    function landing(cid, params) {
      var c = core.courseById[cid], sort = params && params.get('sort') === 'asked' ? 'asked' : 'order', list = core.courseTopics(cid), body;
      if (sort === 'asked') {
        var sorted = list.map(function (t, i) { return { t: t, i: i, n: core.bankKeys(t).length }; }).sort(function (a, b) { return (b.t.f[0] - a.t.f[0]) || (b.n - a.n) || (a.i - b.i); });
        body = '<ul class="blist">' + sorted.map(function (x) { return row(x.t); }).join('') + '</ul>';
      } else {
        var groups = c.parts.length ? c.parts.map(function (p) { return { label: p.label, items: list.filter(function (t) { return (t.p || '') === p.id; }) }; }) : [{ label: '', items: list }];
        body = groups.map(function (g) { return (g.label ? '<h2 class="part-title">' + esc(g.label) + '</h2>' : '') + '<ul class="blist">' + g.items.map(row).join('') + '</ul>'; }).join('');
      }
      var other = core.otherQuestions(cid);
      var seg = '<div class="seg" role="group" aria-label="Order"><a href="#/bank/' + cid + '"' + (sort === 'order' ? ' aria-current="page"' : '') + '>Course order</a><a href="#/bank/' + cid + '?sort=asked"' + (sort === 'asked' ? ' aria-current="page"' : '') + '>Most asked</a></div>';
      var html = '<section class="sheet" aria-labelledby="h-bank">' + u.band('Questions', 'By topic', true) + '<div class="body"><h1 id="h-bank">Question bank</h1>' + bankMode('bank') +
        '<p class="lede">Every past question, filed under the topic it tests. Open a topic to see what was asked and how often, then check yourself.</p>' + searchForm() +
        env.V.courseTabs('bank', cid) + '<div class="course-head"><h2 style="margin-top:14px">' + esc(c.code) + ': ' + esc(c.title) + '</h2>' + seg + '</div>' + body +
        (other.length ? '<ul class="blist"><li class="brow other"><div class="main"><h3><a href="#/bank/' + cid + '/other">Other questions</a></h3><p class="bstat">' + core.plural(other.length, 'question') + ' not matched to a topic this term.</p></div></li></ul>' : '') + '</div></section>';
      return { html: html, title: 'Question bank ' + c.short };
    }
    function other(cid) {
      var c = core.courseById[cid], list = core.otherQuestions(cid);
      var html = '<section class="sheet" aria-labelledby="h-bo">' + u.band('Questions', 'Other', true) + '<div class="body"><a class="back" href="#/bank/' + cid + '">' + u.icon('back') + 'Question bank</a><h1 id="h-bo">Other questions, ' + esc(c.code) + '</h1>' +
        '<p class="lede">These questions are not about a topic in this term’s plan, so they have no model answer.</p>' + list.map(function (q) { return env.V.qcard(q, false); }).join('') + '</div></section>';
      return { html: html, title: 'Other questions' };
    }

    /* ---------- the bank, one topic ---------- */
    function kindHead(kd) {
      var t = core.byId[ctx.bankTopic], labs = kd.keys.map(function (k) { return esc(u.paperLabel(core.qByKey[k].p, t)); });
      return '<h3 class="khead"><span class="mono">' + (kd.keys.length > 1 ? kd.keys.length + ' times' : 'Once') + '</span> ' + labs.join(' · ') + '</h3>';
    }
    function kindBlock(kd, t) {
      var lead = env.V.qcard(core.qByKey[kd.lead], false, t.id), rest = kd.keys.slice(1);
      var openAny = rest.some(function (k) { return env.V.ansOpen(k); });
      return '<div class="kind" data-c="' + t.c + '">' + kindHead(kd) + lead + (rest.length ? '<details class="vers"' + (openAny ? ' open' : '') + '><summary>' + core.plural(rest.length, 'earlier version') + '</summary>' +
        rest.map(function (k) { return env.V.qcard(core.qByKey[k], false, t.id); }).join('') + '</details>' : '') + '</div>';
    }
    function topicPage(t) {
      ctx.bankTopic = t.id;
      var c = counts(t), c0 = core.courseById[t.c], sibs = core.courseTopics(t.c), i = sibs.indexOf(t), prev = sibs[i - 1], next = sibs[i + 1];
      var firm = core.bankKeys(t), kinds = c.kinds, multi = kinds.filter(function (k) { return k.keys.length > 1; }), single = kinds.filter(function (k) { return k.keys.length === 1; });
      var part = core.bankPart(t), also = core.alsoPapers(t);
      var last = firm.length ? P.papers[core.qByKey[firm[0]].p].l : '';
      var stat = statLine(c) + (last ? ' Last asked ' + last + '.' : '') + (c.sum.last ? ' Last check ' + core.fmtShort(c.sum.last) + '.' : '');
      var sets = [['kinds', 'Self-check: one of each kind'], ['new', 'Not checked yet'], ['low', 'Below 60%']].map(function (s, n) {
        var idx = core.checkSet(t, s[0], getP), label = s[1] + ' (' + idx.length + ')';
        return idx.length ? '<a class="btn' + (n ? ' ghost' : '') + '" href="' + checkHref(t, s[0], idx) + '">' + esc(label) + '</a>' : '<span class="btn ghost" aria-disabled="true">' + esc(label) + '</span>';
      }).join('');
      var nav = '<nav class="bank-nav" aria-label="Topics in ' + esc(c0.code) + '"><ol>' + sibs.map(function (s) {
        return '<li><a href="#/bank/' + s.id + '"' + (s === t ? ' aria-current="page"' : '') + '><span class="mono">' + s.id + '</span> ' + rich(s.n) + '</a></li>';
      }).join('') + '</ol></nav>';
      var main = '';
      if (multi.length) main += '<h2>Asked more than once</h2>' + multi.map(function (k) { return kindBlock(k, t); }).join('');
      if (single.length) main += '<h2>' + (multi.length ? 'Asked once' : 'Past questions') + '</h2>' + single.map(function (k) { return kindBlock(k, t); }).join('');
      if (part.length) main += '<h2>Partly related</h2><p class="hint">These touch the topic only in part.</p>' + part.map(function (k) { return env.V.qcard(core.qByKey[k], false, t.id); }).join('');
      if (!main) main = '<p class="lede">No past question points here directly. Read it for understanding.</p>';
      var html = '<section class="sheet" aria-labelledby="h-bt">' + u.band('Question bank', t.id, true) + '<div class="body"><a class="back" href="#/bank/' + t.c + '">' + u.icon('back') + esc(c0.code) + ' question bank</a>' +
        '<h1 id="h-bt">' + rich(t.n) + '</h1><p class="lede">' + rich(t.cv) + '</p>' +
        '<div class="chips" style="margin-top:12px">' + u.courseChip(t.c) + '<span class="chip id">' + t.id + '</span>' + u.chipTag(t) + '</div>' +
        (c.n ? strip(t) : '') + (also.length ? '<p class="hint">Also asked on ' + esc(P.papers[also[0]].code) + ' papers: ' + also.map(function (p) { return esc(P.papers[p].l); }).join(', ') + '.</p>' : '') +
        '<p class="bstat" role="status">' + esc(stat) + '</p>' + (c.n ? '<div class="row-actions bsets">' + sets + '</div>' : '') +
        '<p class="hint"><a class="lnk" href="#/topic/' + t.id + '">Study steps for this topic</a></p>' +
        '<div class="bank-cols">' + nav + '<section class="bank-main">' + main + '</section></div>' +
        '<div class="pager">' + (prev ? '<a class="btn ghost sm" href="#/bank/' + prev.id + '">' + u.icon('back') + esc(prev.id) + '</a>' : '<span></span>') + (next ? '<a class="btn ghost sm" href="#/bank/' + next.id + '">' + esc(next.id) + u.icon('next') + '</a>' : '<span></span>') + '</div></div></section>';
      return { html: html, title: plain(t.n) + ' questions' };
    }

    function bank(arg, params) {
      var seg = String(arg || '').split('/'), a = seg[0];
      if (!a) return landing(env.V.focusCourse(ctx.today()), params);
      if (core.courseById[a]) return seg[1] === 'other' ? other(a) : landing(a, params);
      if (core.byId[a]) return topicPage(core.byId[a]);
      return notFound('Topic');
    }

    /* ---------- self-check: one question at a time ---------- */
    function parseL(t, params) {
      var keys = core.bankKeys(t), raw = params && params.get('l');
      var idx = raw === null || raw === undefined ? core.checkSet(t, 'kinds', getP) : String(raw).split('.').map(Number).filter(function (n) { return n >= 0 && n < keys.length && n % 1 === 0; });
      return idx.filter(function (n) { return core.qByKey[keys[n]].a; }).map(function (n) { return keys[n]; });
    }
    function slipUrl(t, params, i) { var l = params.get('l'); return '#/check/' + t.id + '?' + (l !== null ? 'l=' + l + '&' : '') + 'i=' + i; }
    function check(arg, params) {
      var t = core.byId[String(arg).split('/')[0]];
      if (!t) return notFound('Topic');
      var keys = parseL(t, params), n = keys.length, i = Math.max(0, parseInt(params.get('i'), 10) || 0), back = '#/bank/' + t.id;
      if (!n) {
        return { html: '<section class="sheet">' + u.band('Self-check', t.id, true) + '<div class="body"><a class="back" href="' + back + '">' + u.icon('back') + 'Question bank</a><h1>Self-check: ' + rich(t.n) + '</h1><p class="lede">There is no question to check in this set.</p></div></section>', title: 'Self-check' };
      }
      if (i >= n) return summary(t, keys, params, back);
      var q = core.qByKey[keys[i]], p = P.papers[q.p], mins = core.minutesFor(q.m);
      var holes = keys.map(function (k, j) { return '<span class="hole' + (j < i ? ' on' : j === i ? ' cur' : '') + '"></span>'; }).join('');
      var html = '<section class="sheet" aria-labelledby="h-ck">' + u.band('Self-check', t.id + ' · ' + (i + 1) + ' of ' + n, true) + '<div class="body qpage slip"><a class="back" href="' + back + '">' + u.icon('back') + 'Question bank</a>' +
        '<h1 id="h-ck">Self-check: ' + rich(t.n) + '</h1><p class="count" role="status">Question ' + (i + 1) + ' of ' + n + '</p><div class="slipmeter" role="img" aria-label="Question ' + (i + 1) + ' of ' + n + '">' + holes + '</div>' +
        '<div class="day-hero">' + u.courseChip(core.qCourse(q)) + '<span class="chip">' + esc(p.l) + '</span><span class="chip">Q' + esc(q.q) + '</span>' + (q.m ? '<span class="chip">' + q.m + ' marks</span>' : '') + (mins ? '<span class="chip">about ' + mins + ' min</span>' : '') + (q.a ? env.V.ansChip(q.k) : '') + '</div>' +
        '<div class="qsplit' + (env.V.ansOpen(q.k) ? ' split' : '') + '"><div class="qside"><p class="lede">' + rich(q.t) + '</p>' + env.V.qshot(q.k) + '</div>' +
        '<div class="aside"><div class="qact" style="margin-top:14px">' + env.V.ansButton(q) + '</div><p class="hint">Write your answer on paper first, then open the model answer and tick what you covered.</p>' + env.V.ansSlot(q, 2) + '</div></div>' +
        '<div class="pager">' + (i > 0 ? '<a class="btn ghost sm" href="' + slipUrl(t, params, i - 1) + '">' + u.icon('back') + 'Previous</a>' : '<span></span>') +
        '<a class="btn ghost sm" href="' + slipUrl(t, params, n) + '">End and see results</a>' +
        '<a class="btn sm" href="' + slipUrl(t, params, i + 1) + '">' + (i + 1 < n ? 'Next question' : 'Finish') + u.icon('next') + '</a></div></div></section>';
      return { html: html, title: 'Self-check ' + plain(t.n) };
    }
    function summary(t, keys, params, back) {
      var rows = '', marked = 0, sum = 0, low = [];
      keys.forEach(function (k) {
        var q = core.qByKey[k], r = getP(k), p = P.papers[q.p];
        if (r && r.m) { marked++; sum += r.s / r.m; if (r.s / r.m < 0.6) low.push(k); }
        rows += '<li><a class="lnk" href="' + qhref(q) + '">' + esc(p.l) + ' Q' + esc(q.q) + '</a><span class="mono">' + (r && r.m ? core.f1(r.s) + '/' + r.m : 'not marked') + '</span></li>';
      });
      var s = u.state(t.id), lowIdx = core.checkSet(t, 'low', getP);
      var html = '<section class="sheet" aria-labelledby="h-cs">' + u.band('Self-check', t.id + ' · results', true) + '<div class="body"><a class="back" href="' + back + '">' + u.icon('back') + 'Question bank</a>' +
        '<h1 id="h-cs">Self-check: ' + rich(t.n) + '</h1><p class="lede">Marked ' + marked + ' of ' + keys.length + (marked ? ', average ' + pct(sum / marked) : '') + '.</p>' +
        '<ul class="sumlist">' + rows + '</ul>' +
        (low.length ? '<p class="notice">Worth another look: ' + low.map(function (k) { var q = core.qByKey[k]; return esc(P.papers[q.p].l + ' Q' + q.q); }).join(', ') + '. Read the model answer again, then try them from a blank page.</p>' : (marked ? '<p class="notice">Everything you marked is at 60% or better.</p>' : '')) +
        '<div class="row-actions">' + (lowIdx.length ? '<a class="btn" href="' + checkHref(t, 'low', lowIdx) + '">Check again: below 60% (' + lowIdx.length + ')</a>' : '') + '<a class="btn ghost" href="' + back + '">Back to the bank</a>' +
        (s === 'open' ? '<button class="btn ghost" data-act="mark" data-id="' + t.id + '">Mark topic done</button>' : '') + '</div></div></section>';
      return { html: html, title: 'Self-check results' };
    }

    return { bank: bank, check: check, bankMode: bankMode };
  });
})(typeof window !== 'undefined' ? window : globalThis);
