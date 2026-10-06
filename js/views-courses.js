/* Terminus: Courses, Topic and Cut order views. */
(function (root) {
  'use strict';
  var FE = root.FE = root.FE || {}; FE.parts = FE.parts || [];

  FE.parts.push(function (env) {
    var core = env.core, store = env.store, u = env.u, ctx = env.ctx, P = core.PLAN, esc = u.esc, rich = u.rich, f1 = core.f1;

    function focusCourse(date) {
      var info = core.dayInfo(date), tg = core.target(store.state, date);
      if (tg && tg.open.length) return core.byId[tg.open[0]].c;
      return info && info.c ? info.c : '401';
    }
    function tabsFor(base, cid) {
      return '<nav class="tabs" aria-label="Course">' + P.courses.map(function (c) {
        return '<a href="#/' + base + '/' + c.id + '"' + (c.id === cid ? ' aria-current="page"' : '') + ' aria-label="' + esc(c.code) + '">' + esc(c.short) + '</a>';
      }).join('') + '</nav>';
    }
    function bar(done, total) {
      var n = Math.ceil(total), on = Math.floor(done), h = '';
      for (var i = 0; i < n; i++) h += '<i class="' + (i < on ? 'on' : i === on && done % 1 ? 'half' : '') + '"></i>';
      return '<div class="summary-bar" role="img" aria-label="' + f1(done) + ' of ' + f1(total) + ' points done">' + h + '</div>';
    }

    /* ---------- Courses ---------- */
    function row(t) {
      var s = u.state(t.id);
      return '<li class="trow ' + (s === 'done' ? 'is-done' : '') + '" data-id="' + t.id + '">' + u.punch(t.id) + '<div class="main"><h3><a href="#/topic/' + t.id + '">' + rich(t.n) + '</a></h3>' +
        '<div class="line"><span class="chip id">' + t.id + (t.r ? ' · ' + esc(t.r) : '') + '</span><span>' + esc(u.ptsWord(t)) + ' · ' + u.trackWord(t) + '</span>' + u.chipTag(t) +
        (s === 'parked' ? '<span class="chip">Set aside</span>' : '') + '</div>' +
        '<p class="covers">' + rich(t.cv) + '</p></div></li>';
    }
    function papersNote(cid) {
      var by = {};
      Object.keys(P.papers).forEach(function (k) { var p = P.papers[k]; if (p.c === cid) (by[p.code] = by[p.code] || []).push(p.l); });
      return Object.keys(by).map(function (code) { return esc(code) + ': ' + by[code].join(', '); }).join('. ');
    }
    function courses(cid) {
      var date = ctx.today();
      if (!core.courseById[cid]) cid = focusCourse(date);
      var c = core.courseById[cid], tot = core.courseTotals(store.state).filter(function (x) { return x.c === cid; })[0], list = core.courseTopics(cid);
      var groups = c.parts.length ? c.parts.map(function (p) { return { label: p.label, items: list.filter(function (t) { return (t.p || '') === p.id; }) }; }) : [{ label: '', items: list }];
      var body = groups.map(function (g) {
        return (g.label ? '<h2 class="part-title">' + esc(g.label) + '</h2>' : '') + '<ul>' + g.items.map(row).join('') + '</ul>';
      }).join('');
      var html = '<section class="sheet" aria-labelledby="h-courses">' + u.band('Courses', 'Tick topics here', true) +
        '<div class="body"><h1 id="h-courses">Courses</h1>' + tabsFor('courses', cid) +
        '<div class="course-head"><h2 style="margin-top:14px">' + esc(c.code) + ': ' + esc(c.title) + '</h2>' +
        '<p>Exam ' + core.fmt(c.exam) + ', 2 to 5 PM. Study window ' + core.fmtShort(c.win[0]) + ' to ' + core.fmtShort(c.win[1]) + '.</p>' + bar(tot.done, tot.total) +
        '<div class="numbers"><span>' + tot.nDone + ' of ' + tot.n + ' topics</span><span>' + f1(tot.done) + ' of ' + f1(tot.total) + ' pts</span>' + (tot.parked ? '<span>' + f1(tot.parked) + ' pts set aside</span>' : '') + '</div>' +
        '<details class="details-box"><summary>About this paper and its past questions</summary><div><p>' + esc(c.fmt) + '</p><p>Past papers mapped to topics: ' + papersNote(cid) + '.</p>' +
        '<p>Each topic page lists every question that touched it, with marks and the page in the past-paper PDF.</p></div></details></div>' + body + '</div></section>';
      return { html: html, title: c.code };
    }

    /* ---------- Topic ---------- */
    function grouped(t) {
      var out = [], cur = null;
      (t.q || []).forEach(function (q) { if (!cur || cur.id !== q[0]) { cur = { id: q[0], items: [] }; out.push(cur); } cur.items.push(q); });
      return out;
    }
    function topic(arg) {
      var seg = String(arg).split('/'), id = seg[0];
      if (seg[1] === 'questions') ctx.scrollTo = 'topic-questions';
      var t = core.byId[id];
      if (!t) return { html: '<section class="sheet">' + u.band('Topic', 'Not found', true) + '<div class="body"><a class="back" href="#/courses">' + u.icon('back') + 'Courses</a><h1>Topic not found</h1><p class="lede">There is no topic called ' + esc(id) + '.</p></div></section>', title: 'Topic' };
      var c = core.courseById[t.c], s = u.state(id), sibs = core.courseTopics(t.c), i = sibs.indexOf(t);
      var prev = sibs[i - 1], next = sibs[i + 1], solve = u.solveLine(t);
      var stateBox;
      if (s === 'done') stateBox = '<strong>Done.</strong><p class="hint" style="margin:0">Counted toward the checkpoint. Marked by mistake? Reopen it.</p><div class="row-actions"><button class="btn ghost" data-act="reopen" data-id="' + id + '">Reopen: not done</button></div>';
      else if (s === 'parked') stateBox = '<strong>Set aside.</strong><p class="hint" style="margin:0">Not counted toward any checkpoint. You can bring it back any time.</p><div class="row-actions"><button class="btn" data-act="unpark" data-ids="' + id + '">Bring it back</button></div>';
      else stateBox = '<strong>Not done yet.</strong><p class="hint" style="margin:0">Done means: studied, past questions solved, one-page note written.</p><div class="row-actions"><button class="btn" data-act="mark" data-id="' + id + '">Mark done</button>' +
        (t.g === 'core' ? '' : '<button class="btn ghost" data-act="park" data-ids="' + id + '">Set aside</button>') + '</div>';
      var study = t.src.length ? '<ul>' + t.src.map(function (s2) { return '<li>' + rich(s2[0]) + ', ' + rich(s2[1]) + '</li>'; }).join('') + '</ul>' : '';
      var steps = '<li><div><h3>Study</h3>' + study + (t.pd ? '<p class="notice">' + esc(t.pd) + '</p>' : '') + (t.op ? '<p class="hint">Short on time? You can skip: ' + rich(t.op) + '.</p>' : '') + '</div></li>' +
        (solve ? '<li><div><h3>Solve</h3><p>' + rich(solve) + '</p></div></li>' : '') +
        '<li><div><h3>Practise</h3><p>' + esc(u.freqWord(t)) + '. Work the questions listed on this page, newest first, and write full answers.' + (u.weakQ(t).length ? ' Questions marked partly related only touch this topic in part.' : '') + '</p></div></li>' +
        '<li><div><h3>Note</h3><p>Write one page by hand: the key definitions, the formulas you need and one worked example.</p></div></li>';
      var papers = grouped(t).map(function (g) {
        var p = P.papers[g.id];
        return '<div class="paper"><h3>' + esc(p.l) + '<span>' + esc(p.code) + '</span></h3>' + g.items.map(function (q) {
          var qq = core.qByKey[q[0] + '|' + q[1]]; return qq ? env.V.qcard(qq, false, id) : '';
        }).join('') + '</div>';
      }).join('');
      var html = '<section class="sheet" aria-labelledby="h-topic">' + u.band('Topic', id, true) + '<div class="body"><a class="back" href="#/courses/' + t.c + '">' + u.icon('back') + esc(c.code) + '</a>' +
        '<h1 id="h-topic">' + rich(t.n) + '</h1><p class="lede">' + rich(t.cv) + '</p>' +
        '<div class="chips" style="margin-top:12px">' + u.courseChip(t.c) + '<span class="chip id">' + id + '</span>' + (t.r ? '<span class="chip">' + esc(t.r) + '</span>' : '') +
        '<span class="chip">' + esc(u.ptsWord(t)) + '</span><span class="chip">' + u.trackWord(t) + '</span>' + u.chipTag(t) + '</div>' +
        '<p class="hint">' + esc(u.TAGHELP[t.g]) + (t.tn ? ' ' + rich(t.tn) + '.' : '') + '</p>' +
        '<div class="state-box" id="state-box">' + stateBox + '</div>' +
        '<div class="topic-cols"><section><h2>The work</h2><ol class="steps">' + steps + '</ol></section>' +
        '<section id="topic-questions"><h2>Past questions</h2>' + (papers || '<p class="lede">No past question points here directly. Read it for understanding.</p>') +
        (papers ? '<p class="hint">Each summary is a short paraphrase. Press Show the exact question to see the question as printed in the paper.</p>' : '') + '</section></div>' +
        '<div class="pager">' + (prev ? '<a class="btn ghost sm" href="#/topic/' + prev.id + '">' + u.icon('back') + esc(prev.id) + '</a>' : '<span></span>') +
        (next ? '<a class="btn ghost sm" href="#/topic/' + next.id + '">' + esc(next.id) + u.icon('next') + '</a>' : '<span></span>') + '</div></div></section>';
      return { html: html, title: u.plain(t.n) };
    }

    /* ---------- Cut order ---------- */
    function cut(cid) {
      var date = ctx.today(), st = store.state, tg = core.target(st, date);
      if (!core.courseById[cid]) cid = focusCourse(date);
      var c = core.courseById[cid], over = core.overload(tg), amount = ctx.cutAmount == null ? over : ctx.cutAmount;
      var list = core.cutOrder(st, cid), pre = core.cutPrefix(list, amount), pick = {}; pre.ids.forEach(function (i) { pick[i] = 1; });
      var banner;
      if (!tg) banner = 'Nothing is due right now, so there is nothing to cut.';
      else if (over > 0) banner = 'Right now the plan needs <b>' + f1(tg.need) + ' a day</b> and a day holds ' + core.CAP + '. Setting aside about <b>' + f1(over) + ' pts</b> would bring it within reach.';
      else banner = 'Right now the plan needs <b>' + f1(tg.need) + ' a day</b>. A day holds ' + core.CAP + ', so nothing has to be cut. You can still plan ahead below.';
      var parked = core.courseTopics(cid).filter(function (t) { return store.isParked(t.id); });
      var rows = list.map(function (x, i) {
        var t = core.byId[x.id];
        return '<li class="cut-row' + (pick[x.id] ? ' pick' : '') + '"><span class="no">' + (i + 1) + '</span><h3><a href="#/topic/' + x.id + '">' + rich(t.n) + '</a></h3><span class="cum">frees ' + f1(x.cum) + '</span>' +
          '<span class="sub">' + u.TAGW[t.g] + ' · ' + esc(u.freqWord(t)) + ' · ' + esc(u.ptsWord(t)) + '</span>' +
          '<span class="sub"><button class="btn ghost sm" data-act="park" data-ids="' + x.id + '">Set aside</button></span></li>';
      }).join('');
      var html = '<section class="sheet" aria-labelledby="h-cut">' + u.band('Cut order', 'If you fall behind', true) +
        '<div class="body"><h1 id="h-cut">Cut order</h1><p class="lede">' + banner + '</p><p class="hint">Core topics and past-question practice are never cut. Setting a topic aside is not failing: it leaves the checkpoint count, and you can bring it back.</p>' +
        tabsFor('cut', cid) + '<h2 style="margin-top:14px">' + esc(c.code) + '</h2>' +
        '<div class="free-box"><div class="row-actions"><strong>Free up</strong><span class="stepper"><button data-act="cut-step" data-d="-0.5" aria-label="Free up half a point less">−</button><output aria-live="polite">' + f1(amount) + ' pts</output><button data-act="cut-step" data-d="0.5" aria-label="Free up half a point more">+</button></span></div>' +
        (list.length ? '<p class="hint" style="margin:0">' + (pre.ids.length ? 'The highlighted ' + core.plural(pre.ids.length, 'topic') + ' free ' + f1(pre.pts) + ' pts' + (pre.enough ? '.' : ', all this course can give.') : 'Choose an amount to highlight the topics to set aside, in order.') + '</p>' : '<p class="hint" style="margin:0">Nothing in this course can be cut: every open topic is core.</p>') +
        '<div class="row-actions"><button class="btn" data-act="park" data-ids="' + pre.ids.join(',') + '"' + (pre.ids.length ? '' : ' disabled') + '>Set aside ' + (pre.ids.length ? core.plural(pre.ids.length, 'topic') : 'highlighted topics') + '</button></div></div>' +
        (list.length ? '<h2>Order to set aside</h2><p class="lede">Optional topics first, then standard ones the papers ask least. Each row shows the points freed so far.</p><ol>' + rows + '</ol>' : '') +
        '<p class="hint">Core topics still open here: ' + f1(core.coreOpen(st, cid)) + ' pts. These stay.</p>' +
        (parked.length ? '<h2>Set aside now</h2><ul class="parked-list">' + parked.map(function (t) {
          return '<li><span><a class="lnk" href="#/topic/' + t.id + '">' + rich(t.n) + '</a> <span class="mono" style="font-size:12px">' + esc(core.ptsText(core.pts(t.id))) + '</span></span><button class="btn ghost sm" data-act="unpark" data-ids="' + t.id + '">Bring back</button></li>';
        }).join('') + '</ul>' : '') + '</div></section>';
      return { html: html, title: 'Cut order' };
    }

    return { courses: courses, topic: topic, cut: cut };
  });
})(typeof window !== 'undefined' ? window : globalThis);
