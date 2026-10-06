/* Terminus: Today, Plan and Day views. */
(function (root) {
  'use strict';
  var FE = root.FE = root.FE || {}; FE.parts = FE.parts || [];

  FE.parts.push(function (env) {
    var core = env.core, store = env.store, u = env.u, ctx = env.ctx, P = core.PLAN, esc = u.esc, rich = u.rich, f1 = core.f1;
    var KIND = { first: 'First pass', win: 'Exam window', exam: 'Exam day', catch: 'Catch-up' };

    /* ---------- Today ---------- */
    function route(tg, date) {
      var start = P.meta.start, span = core.diff(start, P.meta.end), y = 24;
      function X(d) { return 14 + Math.max(0, Math.min(span, core.diff(start, d))) / span * 312; }
      var x1 = null, x2 = null, l1 = '', l2 = '';
      if (tg) {
        if (tg.kind === 'window') { x1 = X(tg.cp.from); x2 = X(tg.cp.d); l1 = 'Window'; l2 = 'Mock'; }
        else { x1 = tg.prev ? X(tg.prev.d) : 14; x2 = X(tg.cp.d); l1 = tg.prev ? tg.prev.s : 'Start'; l2 = tg.cp.s; }
      }
      var g = '<line x1="14" y1="' + y + '" x2="326" y2="' + y + '" stroke="#35513F" stroke-width="1.5" stroke-dasharray="3 4"/>';
      if (tg) {
        g += '<line x1="14" y1="' + y + '" x2="' + x1.toFixed(1) + '" y2="' + y + '" stroke="#0D2418" stroke-width="3"/>';
        g += '<line x1="' + x1.toFixed(1) + '" y1="' + y + '" x2="' + x2.toFixed(1) + '" y2="' + y + '" stroke="#C42B1E" stroke-width="5"/>';
      }
      core.stations().forEach(function (s) {
        var passed = s.kind === 'cp' ? s.topics.every(function (id) { return !core.isOpen(store.state, id); }) : s.d < date;
        g += '<circle cx="' + X(s.d).toFixed(1) + '" cy="' + y + '" r="' + (s.kind === 'exam' ? 4.5 : 3.2) + '" fill="' + (passed ? '#0D2418' : '#D8E8D3') + '" stroke="#0D2418" stroke-width="1.6"/>';
      });
      var tx = X(date);
      g += '<path d="M' + (tx - 6).toFixed(1) + ',6 L' + (tx + 6).toFixed(1) + ',6 L' + tx.toFixed(1) + ',16 Z" fill="#C42B1E"/>';
      var t = '';
      if (tg) {
        var close = x2 - x1 < 30;
        if (x1 < 40) t += '<text x="' + x1.toFixed(1) + '" y="46">' + esc(l1) + '</text>';
        else t += '<text x="' + x1.toFixed(1) + '" y="46" text-anchor="end">' + esc(l1) + '</text>';
        if (!(x1 < 40 && close)) t += '<text x="' + (x2 + 2).toFixed(1) + '" y="46">' + esc(l2) + '</text>';
      }
      if (!tg || x2 < 262) t += '<text x="326" y="46" text-anchor="end">' + core.fmtShort(P.meta.end) + '</text>';
      g += '<g font-family="Martian Mono,monospace" font-size="9.5" font-weight="600" fill="#0D2418">' + t + '</g>';
      var dayNo = Math.max(1, Math.min(span + 1, core.diff(start, date) + 1));
      return '<svg viewBox="0 0 340 54" role="img" aria-label="Day ' + dayNo + ' of ' + (span + 1) + ' of the plan">' + g + '</svg>';
    }

    function dayLine(info, date, stage) {
      if (stage === 'before') return 'The plan starts <b>' + core.fmt(P.meta.start) + '</b>. You can begin early.';
      if (stage === 'after' || !info) return 'The last exam is done.';
      var chip = u.courseChip(info.c), hol = info.h ? ' <span>' + esc(info.h) + ', a BUET holiday.</span>' : '';
      if (info.k === 'first') return chip + ' <b>First pass</b>' + (info.of > 1 ? ', day ' + info.i + ' of ' + info.of : '') + hol;
      if (info.k === 'catch') return chip + ' <b>Catch-up day.</b> Finish anything late, then start MME 421.' + hol;
      if (info.k === 'win') return chip + ' <b>Window day ' + info.i + ' of ' + info.of + '.</b> ' + esc(info.t) + hol;
      return chip + ' <b>Exam today, 2 to 5 PM.</b>';
    }
    function examLine(date, info) {
      var ex = core.nextExam(info && info.k === 'exam' ? core.addDays(date, 1) : date);
      if (!ex) return '';
      var d = core.diff(date, ex.exam.d), when = d === 0 ? 'today' : d === 1 ? 'tomorrow' : 'in ' + d + ' days';
      return '<p class="exam">' + (info && info.k === 'exam' ? 'Next: ' : '') + '<b>' + esc(ex.course.code) + '</b> exam ' + core.fmt(ex.exam.d) + ', ' + when + '.</p>';
    }

    function fields(tg, date) {
      function f(label, val, sub) { return '<div><dt>' + label + '</dt><dd>' + val + (sub ? '<small>' + sub + '</small>' : '') + '</dd></div>'; }
      if (!tg) {
        var o = core.overall(store.state), info = core.dayInfo(date), onExam = info && info.k === 'exam';
        var ex = core.nextExam(onExam ? core.addDays(date, 1) : date), tail = f('Topics done', o.nDone + ' of ' + o.n, '') + f('Points done', f1(o.done) + ' of ' + f1(o.total), '');
        if (onExam) return f('Exam today', esc(core.courseById[info.c].code), '2 to 5 PM') + (ex ? f('Next exam', esc(ex.course.code), core.fmt(ex.exam.d)) : f('Next exam', 'None', 'this is the last')) + tail;
        if (!ex) return f('Exams', 'All done', 'five of five') + f('Plan', 'Finished', core.plural(core.diff(P.meta.start, P.meta.end) + 1, 'day')) + tail;
        return f('Next exam', esc(ex.course.code), core.fmt(ex.exam.d)) + f('Days left', core.plural(ex.days, 'day'), '') + tail;
      }
      var win = tg.kind === 'window';
      var first = win ? f('Finish by', core.fmtShort(tg.cp.d), core.fmt(tg.cp.d).slice(0, 3) + ', the day before the mock')
                      : f('Checkpoint', esc(tg.cp.s) + ' · ' + core.fmtShort(tg.cp.d), core.fmt(tg.cp.d).slice(0, 3));
      return first + f('Days left', core.plural(tg.days, 'day'), 'counting today') +
             f('Points done', f1(tg.got) + ' of ' + f1(tg.due), tg.carry > 0 ? f1(tg.carry) + ' carried over' : '') +
             f('Needs', tg.left > 0 ? f1(tg.need) + ' a day' : 'Nothing', tg.left > 0 ? paceSub(tg) : 'all done');
    }
    function paceSub(tg) {
      if (tg.need < tg.planned * 0.9) return 'ahead of plan';
      if (tg.need > tg.planned * 1.1) return 'plan was ' + f1(tg.planned) + ' a day';
      return 'on plan';
    }
    function paceNote(tg) {
      if (!tg) return '';
      if (tg.mode === 'done') return tg.kind === 'window' ? 'Every topic for this exam is done. Use the window for questions and the timed mock.' : 'Everything for this checkpoint is done.';
      var cap = core.CAP;
      if (tg.beforeStart) return 'Counted from the first day of the plan.';
      if (tg.mode === 'steady') return 'A steady pace. A day holds about ' + cap + ' points.';
      if (tg.mode === 'full') return 'Close to a full day (' + cap + '). A light day makes the next ones heavier.';
      return 'More than a day holds (' + cap + '). <a class="lnk" href="#/cut">Choose what to set aside</a>.';
    }

    function stub(id, first) {
      var t = core.byId[id], solve = u.solveLine(t), study = u.studyLine(t);
      return '<li class="stub" data-id="' + id + '">' +
        '<div class="stub-head"><span class="chip id">' + id + (t.r ? ' · ' + esc(t.r) : '') + '</span>' + u.chipTag(t) + '</div>' +
        '<h3><a href="#/topic/' + id + '">' + rich(t.n) + '</a></h3>' +
        '<p class="covers">' + rich(t.cv) + '</p>' +
        '<p class="meta">' + esc(u.ptsWord(t)) + ' · ' + u.trackWord(t) + ' · ' + esc(u.freqWord(t)) + '</p>' +
        '<dl class="work">' + (study ? '<div><dt>Study</dt><dd>' + rich(study) + '</dd></div>' : '') + (solve ? '<div><dt>Solve</dt><dd>' + rich(solve) + '</dd></div>' : '') +
          '<div><dt>Practise</dt><dd>' + rich(u.practiseLine(t)) + '</dd></div></dl>' +
        (t.pd ? '<p class="notice">' + esc(t.pd) + '</p>' : '') +
        '<div class="act"><button class="btn" data-act="done" data-id="' + id + '" aria-label="Mark done: ' + esc(u.plain(t.n)) + '">Done</button><a class="lnk" href="#/topic/' + id + '">Details and questions</a></div>' +
        (first ? '<p class="stub-note">Done means: studied, past questions solved, one-page note written.</p>' : '') + '</li>';
    }

    function emptyBlock(tg, date, info, stage) {
      var body;
      if (stage === 'after') body = '<h3>That is the last exam.</h3><p class="meta">Everything in the plan has run its course. Well done.</p>';
      else if (info && info.k === 'exam') {
        var nw = P.windows.filter(function (w) { return w.s > date; })[0];
        body = '<h3>Exam day</h3><p class="meta">2 to 5 PM. Nothing else today.' + (nw ? ' The ' + esc(core.courseById[nw.c].code) + ' window starts ' + (nw.s === core.addDays(date, 1) ? 'tomorrow' : core.fmt(nw.s)) + '.' : '') + '</p>';
      } else if (info && info.k === 'win') {
        var w = core.windowFor(date);
        body = '<h3>' + esc(info.t) + '</h3><p class="meta">' + rich(w ? w.note : '') + '</p><div class="act"><a class="btn" href="#/courses/' + info.c + '">Open ' + esc(core.courseById[info.c].code) + ' questions</a></div>';
      } else body = '<h3>Nothing left in the queue</h3><p class="meta">Every topic is done or set aside. Check Plan for the next window.</p>';
      return '<div class="empty">' + body + '</div>';
    }

    function board(date) {
      var tot = core.courseTotals(store.state), next = core.nextExam(date);
      var rows = P.exams.map(function (e) {
        var c = core.courseById[e.c], t = tot.filter(function (x) { return x.c === e.c; })[0], open = t.open;
        var cell = e.d < date ? 'Done' : open > 0 ? core.ptsText(open) + ' open' : 'Ready';
        return '<tr class="' + (next && next.exam.id === e.id ? 'next' : '') + '"><td><a href="#/courses/' + e.c + '">' + esc(c.code) + '</a></td><td>' + core.fmtShort(e.d) + '</td><td>' + core.fmtShort(c.win[0]) + '–' + core.fmtShort(c.win[1]) +
          '</td><td><span class="' + (ctx.flipped === e.c ? 'flip' : '') + '">' + cell + '</span></td></tr>';
      }).join('');
      return '<aside class="board" aria-labelledby="h-board"><h2 id="h-board">Exam board</h2><table><thead><tr><th scope="col">Course</th><th scope="col">Exam</th><th scope="col">Study window</th><th scope="col">Open</th></tr></thead><tbody>' + rows +
        '</tbody><caption>Open means points not done yet. Exams run 2 to 5 PM.</caption></table></aside>';
    }

    function today() {
      var date = ctx.today(), st = store.state, stage = core.stage(date), info = core.dayInfo(date), tg = core.target(st, date), next = core.nextTopics(tg);
      var preview = ctx.preview ? '<p class="pace-note">Preview date. Your device date is not used.</p>' : '';
      var html = '<section class="ticket" aria-labelledby="h-today">' + u.band('Terminus', 'BUET L4T1 ' + P.meta.start.slice(0, 4)) +
        '<div class="body perf"><h1 class="date" id="h-today">' + core.fmt(date) + '</h1>' + preview +
        '<p class="today-plan">' + dayLine(info, date, stage) + '</p>' + examLine(date, info) +
        '<div class="route">' + route(tg, date) + '</div>' +
        '<dl class="fields">' + fields(tg, date) + '</dl>' +
        (tg ? '<div class="punches" role="img" aria-label="' + f1(tg.got) + ' of ' + f1(tg.due) + ' points done">' + u.holes(tg.got, tg.due) + '</div><p class="pace-note">' + paceNote(tg) + '</p>' : '') +
        (tg && tg.overdue ? '<p class="pace-note">Earlier checkpoints still have <b>' + f1(tg.carry) + ' pts</b> open. They count here, so the pace above already includes them.</p>' : '') +
        '</div>' +
        (next.length ? '<h2 class="sr">Next topics</h2><ol class="stubs">' + next.map(function (id, i) { return stub(id, i === 0); }).join('') + '</ol>' : emptyBlock(tg, date, info, stage)) + '</section>' + board(date);
      return { html: html, title: core.fmt(date), cls: 'today' };
    }

    /* ---------- Plan ---------- */
    function cell(date, today) {
      var d = parseInt(date.slice(8), 10), info = P.days[date];
      if (!info) return '<span class="day empty-cell" aria-hidden="true"></span>';
      var cps = P.checkpoints.filter(function (c) { return c.d === date; });
      var label = core.fmt(date) + ': ' + info.t + (info.h ? ', ' + info.h + ' holiday' : '') + (cps.length ? '. Checkpoint ' + cps.map(function (c) { return c.s; }).join(', ') : '') + (date === today ? '. Today.' : '');
      var c = core.courseById[info.c];
      return '<a class="day ' + info.k + (date === today ? ' today' : '') + '" data-c="' + info.c + '" href="#/day/' + date + '" aria-label="' + esc(label) + '"' + (date === today ? ' aria-current="date"' : '') + '>' +
        '<span class="n">' + d + '</span>' + (cps.length ? '<span class="cp">' + esc(cps[0].s) + '</span>' : '') +
        '<span class="c">' + esc(c.short) + '<em>' + esc(info.sh) + '</em></span>' + (info.h ? '<span class="hol"></span>' : '') + '</a>';
    }
    function month(y, m, today) {
      var cells = core.monthGrid(y, m), dows = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      return '<section class="month" aria-label="' + core.MONL[m] + ' ' + y + '"><h2>' + core.MONL[m] + ' ' + y + '</h2><div class="cal">' +
        dows.map(function (w) { return '<span class="dow" aria-hidden="true">' + w + '</span>'; }).join('') +
        cells.map(function (d) {
          if (!d) return '<span class="day empty-cell" aria-hidden="true"></span>';
          return P.days[d] ? cell(d, today) : '<span class="day free" aria-hidden="true"><span class="n">' + parseInt(d.slice(8), 10) + '</span></span>';
        }).join('') + '</div></section>';
    }
    function cpItem(c, open) {
      var ids = c.t, dots = ids.map(function (id) { return '<i class="' + (store.isDone(id) ? 'on' : '') + '"></i>'; }).join('');
      var due = core.sum(ids.filter(function (id) { return !store.isParked(id); })), got = core.sum(ids.filter(function (id) { return store.isDone(id); }));
      return '<details class="cp-item"' + (open ? ' open' : '') + '><summary><h3>' + esc(c.s) + ' · ' + esc(c.lb) + '</h3><span class="when">' + core.fmt(c.d) + '</span>' +
        '<span class="bar" aria-hidden="true">' + dots + '</span><span class="sr">' + f1(got) + ' of ' + f1(due) + ' points done</span></summary><ul class="cp-topics">' +
        ids.map(function (id) {
          var t = core.byId[id], s = u.state(id);
          return '<li><span class="st ' + (s === 'done' ? 'on' : s === 'parked' ? 'parked' : '') + '" role="img" aria-label="' + (s === 'done' ? 'Done' : s === 'parked' ? 'Set aside' : 'Not done') + '"></span>' +
            '<a href="#/topic/' + id + '">' + rich(t.n) + '</a><span class="pts">' + core.ptsText(core.pts(id)) + '</span></li>';
        }).join('') + '</ul></details>';
    }
    function plan() {
      var date = ctx.today(), o = core.overall(store.state), tg = core.target(store.state, date), chain = tg && tg.kind === 'cp' ? tg.chain.map(function (c) { return c.id; }) : [];
      var nDays = core.diff(P.meta.start, P.meta.end) + 1;
      var legend = '<div class="legend" aria-label="Key"><span><i class="sw first"></i>First pass</span><span><i class="sw win"></i>Exam window</span><span><i class="sw exam"></i>Exam</span><span><i class="sw catch"></i>Catch-up</span><span><i class="sw hol"></i>BUET holiday</span><span><i class="sw cpm">CP</i>Checkpoint due</span>' +
        PLAN_COURSES().map(function (c) { return '<span><i class="sw" style="background:var(--c' + c.id + ')"></i>' + esc(c.short) + '</span>'; }).join('') + '</div>';
      var html = '<section class="sheet" aria-labelledby="h-plan">' + u.band('Plan', core.fmtShort(P.meta.start) + ' to ' + core.fmtShort(P.meta.end), true) +
        '<div class="body"><h1 id="h-plan">The whole plan</h1><p class="lede">' + nDays + ' days, five exams. ' + o.nDone + ' of ' + o.n + ' topics done, ' + f1(o.done) + ' of ' + f1(o.total) + ' points. Tap a day to see what it holds.</p>' +
        legend + '<div class="cal-wrap">' + month(2026, 9, date) + month(2026, 10, date) + '</div>' +
        '<h2>Checkpoints</h2><p class="lede">Each checkpoint is a set of topics due by a date. The one you are working toward is open.</p><div class="cp-list">' +
        P.checkpoints.map(function (c) { return cpItem(c, chain.indexOf(c.id) >= 0); }).join('') + '</div></div></section>';
      return { html: html, title: 'Plan' };
    }
    function PLAN_COURSES() { return P.courses; }

    /* ---------- Day ---------- */
    function dayPage(date) {
      var info = P.days[date];
      if (!info) return { html: '<section class="sheet">' + u.band('Day', date, true) + '<div class="body"><a class="back" href="#/plan">' + u.icon('back') + 'Plan</a><h1>Not in the plan</h1><p class="lede">' + esc(core.fmtLong(date)) + ' is outside the plan.</p></div></section>', title: 'Day' };
      var c = core.courseById[info.c], hol = info.h ? '<p class="lede">' + esc(info.h) + ' is a BUET holiday. It may free or constrain your day.</p>' : '';
      var body = '', i;
      if (info.k === 'first' || info.k === 'catch') {
        var cps = P.checkpoints.filter(function (x) { return x.from <= date && date <= x.d; });
        body += '<h2>Checkpoints in play</h2>' + (cps.length ? '<div class="cp-list">' + cps.map(function (x) { return cpItem(x, true); }).join('') + '</div>' : '<p class="lede">No checkpoint runs on this day.</p>');
        if (info.k === 'catch') body = '<p class="lede">Two catch-up days: finish any topics that slipped, then begin MME 421 (soft target on ' + core.fmt('2026-10-25') + ').</p>' + body;
      } else if (info.k === 'win') {
        var w = core.windowFor(date);
        body += '<h2>' + esc(c.code) + ' window</h2><ul class="plain-list">' + w.days.map(function (d) {
          return '<li' + (d.d === date ? ' class="cur"' : '') + '><b>' + core.fmt(d.d) + '.</b> ' + esc(d.do) + '</li>';
        }).join('') + '</ul><p class="lede">' + rich(w.note) + '</p><div class="row-actions" style="margin-top:14px"><a class="btn sm" href="#/courses/' + info.c + '">Open ' + esc(c.code) + ' topics and questions</a></div>';
      } else {
        var nw = P.windows.filter(function (x) { return x.s > date; })[0];
        body += '<p class="lede">The night before is recap only, and the exam evening is off.' + (nw ? ' The ' + esc(core.courseById[nw.c].code) + ' window starts ' + core.fmt(nw.s) + '.' : ' This is the last exam.') + '</p>';
      }
      var prev = date > P.meta.start ? core.addDays(date, -1) : null, next = date < P.meta.end ? core.addDays(date, 1) : null;
      var html = '<section class="sheet" aria-labelledby="h-day">' + u.band('Day', core.fmtShort(date), true) + '<div class="body"><a class="back" href="#/plan">' + u.icon('back') + 'Plan</a>' +
        '<h1 id="h-day">' + esc(core.fmtLong(date)) + '</h1><div class="day-hero">' + u.courseChip(info.c) + '<span class="chip">' + KIND[info.k] + (info.of > 1 ? ', day ' + info.i + ' of ' + info.of : '') + '</span></div>' +
        '<p class="lede"><b>' + esc(info.t) + '</b></p>' + hol + body +
        '<div class="day-nav">' + (prev ? '<a class="btn ghost sm" href="#/day/' + prev + '">' + u.icon('back') + core.fmtShort(prev) + '</a>' : '<span></span>') +
        (next ? '<a class="btn ghost sm" href="#/day/' + next + '">' + core.fmtShort(next) + u.icon('next') + '</a>' : '<span></span>') + '</div></div></section>';
      return { html: html, title: core.fmt(date) };
    }

    return { today: today, plan: plan, day: dayPage, stub: stub };
  });
})(typeof window !== 'undefined' ? window : globalThis);
