/* Terminus: plan logic (pure, no DOM). Used by the app and by the Node tests. */
(function (root) {
  'use strict';

  function create(PLAN) {
    var META = PLAN.meta, CAP = META.capacity, PTS = META.pts;
    var topics = PLAN.topics, cps = PLAN.checkpoints;
    var byId = {}, index = {}, courseById = {};
    topics.forEach(function (t, i) { byId[t.id] = t; index[t.id] = i; });
    PLAN.courses.forEach(function (c) { courseById[c.id] = c; });

    /* ---------- dates (ISO strings, local calendar, no Intl so output never varies by device) ---------- */
    var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var WDL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function isoOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function dt(s) { return new Date(s + 'T12:00:00'); }
    function diff(a, b) { return Math.round((dt(b) - dt(a)) / 864e5); }
    function addDays(s, n) { return isoOf(new Date(dt(s).getTime() + n * 864e5)); }
    function fmt(s) { var d = dt(s); return WD[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; }
    function fmtShort(s) { var d = dt(s); return d.getDate() + ' ' + MON[d.getMonth()]; }
    function fmtLong(s) { var d = dt(s); return WDL[d.getDay()] + ' ' + d.getDate() + ' ' + MONL[d.getMonth()]; }
    function f1(x) { return String(Math.round(x * 10) / 10); }
    function ptsText(x) { return f1(x) + (Math.round(x * 10) === 10 ? ' pt' : ' pts'); }
    function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

    /* ---------- points ---------- */
    function pts(id) { return PTS[byId[id].s]; }
    function sum(ids) { var a = 0; for (var i = 0; i < ids.length; i++) a += pts(ids[i]); return a; }
    function isOpen(st, id) { return !st.done.has(id) && !st.parked.has(id); }

    /* ---------- the target: the checkpoint the next work is measured against ---------- */
    /* Inside an exam window only that course is studied (rule 2). Its open topics are due the day before the timed mock. */
    function windowCheckpoint(w) {
      var mock = null;
      w.days.forEach(function (d) { if (!mock && /^timed/i.test(d.do)) mock = d.d; });
      var deadline = mock ? addDays(mock, -1) : w.e;
      if (deadline < w.s) deadline = w.e;
      var c = courseById[w.c];
      return { id: 'WIN-' + w.c, s: c.short, d: deadline, from: w.s, lb: c.code + ' topics before the mock', soft: 0, route: 0, win: 1,
               t: topics.filter(function (t) { return t.c === w.c; }).map(function (t) { return t.id; }) };
    }
    function target(st, today) {
      var t0 = today < META.start ? META.start : today;
      var day = PLAN.days[today], w = windowFor(today), list = cps, i = -1, k;
      if (today > META.end || (day && day.k === 'exam')) return null;
      if (w) list = [windowCheckpoint(w)];
      for (k = 0; k < list.length; k++) { if (list[k].t.some(function (id) { return isOpen(st, id); })) { i = k; break; } }
      if (i < 0) {
        if (!w) return null;
        i = 0;                          // window with nothing open: report a finished target instead of nothing
      }
      var cps_ = list;
      var j = i;
      // A checkpoint that has passed with work left does not become an alarm: its work rolls into the next checkpoint.
      while (cps_[j].d < t0 && j < cps_.length - 1) j++;
      var chain = cps_.slice(i, j + 1), ids = [];
      chain.forEach(function (c) { c.t.forEach(function (id) { if (!st.parked.has(id)) ids.push(id); }); });
      var open = ids.filter(function (id) { return !st.done.has(id); });
      var due = sum(ids), got = sum(ids.filter(function (id) { return st.done.has(id); })), left = due - got;
      var cp = cps_[j];
      var days = cp.d < t0 ? 1 : diff(t0, cp.d) + 1;
      var need = left / days;
      var carryIds = [];
      chain.slice(0, -1).forEach(function (c) { c.t.forEach(function (id) { if (isOpen(st, id)) carryIds.push(id); }); });
      var span = diff(cp.from, cp.d) + 1;
      var planned = sum(cp.t.filter(function (id) { return !st.parked.has(id); })) / span;
      var mode = left <= 0 ? 'done' : need <= CAP * 0.8 ? 'steady' : need <= CAP ? 'full' : 'over';
      return { cp: cp, index: j, prev: j > 0 ? cps_[j - 1] : null, kind: w ? 'window' : 'cp', chain: chain, ids: ids, open: open, due: due, got: got, left: left,
               days: days, need: need, planned: planned, carry: sum(carryIds), carryIds: carryIds, overdue: j !== i, mode: mode, beforeStart: today < META.start };
    }

    /* One numerical (or derivation-heavy) topic and one descriptive topic, as rule 4 says; fill to two if one kind is missing. */
    function nextTopics(tg) {
      if (!tg) return [];
      var left = tg.open, h = null, l = null, out = [];
      for (var k = 0; k < left.length; k++) {
        if (!h && byId[left[k]].k === 'H') h = left[k];
        if (!l && byId[left[k]].k === 'L') l = left[k];
        if (h && l) break;
      }
      out = [h, l].filter(Boolean);
      for (k = 0; k < left.length && out.length < 2; k++) { if (out.indexOf(left[k]) < 0) out.push(left[k]); }
      out.sort(function (a, b) { return left.indexOf(a) - left.indexOf(b); });
      return out;
    }

    /* ---------- courses ---------- */
    function courseTopics(c) { return topics.filter(function (t) { return t.c === c; }); }
    function courseTotals(st) {
      return PLAN.courses.map(function (c) {
        var ids = courseTopics(c.id).map(function (t) { return t.id; });
        var total = sum(ids), done = sum(ids.filter(function (i) { return st.done.has(i); })), parked = sum(ids.filter(function (i) { return st.parked.has(i); }));
        return { c: c.id, code: c.code, short: c.short, total: total, done: done, parked: parked, open: total - done - parked, n: ids.length,
                 nDone: ids.filter(function (i) { return st.done.has(i); }).length };
      });
    }
    function overall(st) {
      var all = topics.map(function (t) { return t.id; });
      var total = sum(all), done = sum(all.filter(function (i) { return st.done.has(i); }));
      return { total: total, done: done, n: all.length, nDone: all.filter(function (i) { return st.done.has(i); }).length };
    }

    /* ---------- cut order ---------- */
    var TAGRANK = { optional: 0, standard: 1, core: 2 };
    function ratio(t) { return t.f[1] ? t.f[0] / t.f[1] : 0; }
    function cutOrder(st, c) {
      var cand = courseTopics(c).filter(function (t) { return t.g !== 'core' && isOpen(st, t.id); });
      cand.sort(function (a, b) {
        return (TAGRANK[a.g] - TAGRANK[b.g]) || (ratio(a) - ratio(b)) || (pts(b.id) - pts(a.id)) || (index[b.id] - index[a.id]);
      });
      var cum = 0;
      return cand.map(function (t) { cum += pts(t.id); return { id: t.id, pts: pts(t.id), cum: cum }; });
    }
    function coreOpen(st, c) { return sum(courseTopics(c).filter(function (t) { return t.g === 'core' && isOpen(st, t.id); }).map(function (t) { return t.id; })); }
    /* How many points beyond a day's capacity the current target asks for, rounded up to half a point. */
    function overload(tg) {
      if (!tg) return 0;
      var over = tg.left - CAP * tg.days;
      return over > 0 ? Math.ceil(over * 2) / 2 : 0;
    }
    /* The shortest prefix of a cut list that frees at least `amount` points. */
    function cutPrefix(list, amount) {
      var out = [], got = 0;
      for (var i = 0; i < list.length && got < amount; i++) { out.push(list[i].id); got += list[i].pts; }
      return { ids: out, pts: got, enough: got >= amount };
    }

    /* ---------- days, windows, exams ---------- */
    function dayInfo(today) { return PLAN.days[today] || null; }
    function windowFor(today) {
      for (var i = 0; i < PLAN.windows.length; i++) { var w = PLAN.windows[i]; if (today >= w.s && today <= w.e) return w; }
      return null;
    }
    function nextExam(today) {
      for (var i = 0; i < PLAN.exams.length; i++) { if (PLAN.exams[i].d >= today) return { exam: PLAN.exams[i], course: courseById[PLAN.exams[i].c], days: diff(today, PLAN.exams[i].d) }; }
      return null;
    }
    function stage(today) { return today < META.start ? 'before' : today > META.end ? 'after' : 'during'; }

    /* Calendar for one month, Saturday first (the BUET week). Cells outside the month are null. */
    function monthGrid(year, month) {
      var first = new Date(year, month, 1, 12), lead = (first.getDay() + 1) % 7;
      var n = new Date(year, month + 1, 0).getDate(), cells = [], i;
      for (i = 0; i < lead; i++) cells.push(null);
      for (i = 1; i <= n; i++) cells.push(year + '-' + pad(month + 1) + '-' + pad(i));
      while (cells.length % 7) cells.push(null);
      return cells;
    }

    /* ---------- past questions ---------- */
    var Q = PLAN.questions || [], papers = PLAN.papers || {}, qByKey = {}, paperRank = {}, qIndex = null;
    Object.keys(papers).forEach(function (p, i) { paperRank[p] = i; });
    Q.forEach(function (q) { qByKey[q.k] = q; });
    function stripSub(s) { return String(s == null ? '' : s).replace(/_\{([^}]*)\}/g, '$1'); }
    function qNum(l) { var m = String(l).match(/^(\d+)/); return m ? +m[1] : 99; }
    function qOrder(a, b) { return (qNum(a) - qNum(b)) || (a < b ? -1 : a > b ? 1 : 0); }
    function qCourse(q) { return papers[q.p].c; }
    function qIndexBuild() {
      qIndex = Q.map(function (q) {
        var p = papers[q.p], names = q.f.concat(q.w).map(function (id) { return stripSub(byId[id].n + ' ' + byId[id].cv); }).join(' ');
        return { sum: stripSub(q.t).toLowerCase(), top: names.toLowerCase(),
                 meta: [p.l, p.code, 'q' + q.q, q.q, (q.m || '') + ' marks', 'page ' + q.pg].join(' ').toLowerCase() };
      });
    }
    var LABEL = /^q?(\d{1,2})([a-z]?)(?:\(?([ivx]+)\)?)?$/;
    /* Every word typed must match something about the question: its summary, its topics, its paper, its number.
       A word that looks like a question number (5, 5b, q5b, 7a(iv)) also matches questions whose number starts with it. */
    function searchQuestions(o) {
      if (!qIndex) qIndexBuild();
      var toks = String(o.q || '').toLowerCase().replace(/[“”"']/g, '').split(/[\s,;]+/).filter(Boolean), res = [];
      for (var i = 0; i < Q.length; i++) {
        var q = Q[i], ix = qIndex[i], score = 0, ok = true, t;
        if (o.p && q.p !== o.p) continue;
        if (o.c && qCourse(q) !== o.c) continue;
        for (t = 0; t < toks.length && ok; t++) {
          var tok = toks[t], hit = false, lm = tok.match(LABEL), ql = q.q.toLowerCase();
          if (lm) { var pre = lm[1] + lm[2] + (lm[3] || ''); if (ql.indexOf(pre) === 0) { hit = true; score += ql === pre ? 6 : 3; } }
          if (ix.sum.indexOf(tok) >= 0) { hit = true; score += 2; }
          if (ix.top.indexOf(tok) >= 0) { hit = true; score += 1; }
          if (ix.meta.indexOf(tok) >= 0) { hit = true; score += 1; }
          ok = hit;
        }
        if (ok) res.push({ q: q, s: score });
      }
      res.sort(function (a, b) { return (b.s - a.s) || (paperRank[a.q.p] - paperRank[b.q.p]) || qOrder(a.q.q, b.q.q); });
      return res.map(function (r) { return r.q; });
    }
    function papersOfCourse(c) { return Object.keys(papers).filter(function (p) { return papers[p].c === c; }); }
    function paperOfPage(c, pg) {
      var ids = papersOfCourse(c);
      for (var i = 0; i < ids.length; i++) { var pp = papers[ids[i]].pp; if (pp && pg >= pp[0] && pg <= pp[1]) return ids[i]; }
      return null;
    }
    function questionsOnPage(c, pg) {
      return Q.filter(function (q) { return qCourse(q) === c && q.pg === pg; }).sort(function (a, b) { return (a.b ? a.b[0] : 0) - (b.b ? b.b[0] : 0) || qOrder(a.q, b.q); });
    }
    function pageCount(c) { return PLAN.pr && PLAN.pr[c] ? PLAN.pr[c].length - 1 : 0; }
    function pageRatio(c, pg) { return PLAN.pr && PLAN.pr[c] && PLAN.pr[c][pg] || 1.41; }
    function pageUrl(c, pg) { return 'papers/' + c + '/' + core_pad(pg) + '.webp'; }
    function core_pad(n) { return (n < 10 ? '0' : '') + n; }

    /* ---------- route line (Today): where the days of the plan sit ---------- */
    function stations() {
      var out = [];
      cps.forEach(function (c) { if (c.route) out.push({ id: c.s, d: c.d, kind: 'cp', topics: c.t }); });
      PLAN.exams.forEach(function (e) { out.push({ id: courseById[e.c].short, d: e.d, kind: 'exam', course: e.c }); });
      return out;
    }

    return {
      PLAN: PLAN, META: META, CAP: CAP, PTS: PTS, topics: topics, byId: byId, index: index, courseById: courseById, cps: cps,
      iso: isoOf, dt: dt, diff: diff, addDays: addDays, fmt: fmt, fmtShort: fmtShort, fmtLong: fmtLong, f1: f1, ptsText: ptsText, plural: plural, pad: pad,
      WD: WD, WDL: WDL, MON: MON, MONL: MONL,
      pts: pts, sum: sum, isOpen: isOpen, target: target, nextTopics: nextTopics, courseTopics: courseTopics, courseTotals: courseTotals, overall: overall,
      cutOrder: cutOrder, coreOpen: coreOpen, overload: overload, cutPrefix: cutPrefix,
      questions: Q, qByKey: qByKey, searchQuestions: searchQuestions, papersOfCourse: papersOfCourse, paperOfPage: paperOfPage, questionsOnPage: questionsOnPage,
      pageCount: pageCount, pageRatio: pageRatio, pageUrl: pageUrl, qCourse: qCourse, qOrder: qOrder,
      dayInfo: dayInfo, windowFor: windowFor, nextExam: nextExam, stage: stage, monthGrid: monthGrid, stations: stations
    };
  }

  root.FE = root.FE || {};
  root.FE.createCore = create;
  if (typeof module !== 'undefined' && module.exports) module.exports = create;
})(typeof window !== 'undefined' ? window : globalThis);
