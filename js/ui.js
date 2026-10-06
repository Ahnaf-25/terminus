/* Terminus: shared view helpers. Strings in, strings out; nothing here touches the page. */
(function (root) {
  'use strict';
  var FE = root.FE = root.FE || {};

  var ICON = {
    today: '<path d="M4 6h16v3.2a2.4 2.4 0 0 0 0 4.8V18H4v-4a2.4 2.4 0 0 0 0-4.8V6z"/><path d="M14.5 8.5v7" stroke-dasharray="1.6 2.2"/>',
    plan: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
    courses: '<path d="M5 4.5h9.5A2.5 2.5 0 0 1 17 7v13H7.5A2.5 2.5 0 0 1 5 17.5V4.5z"/><path d="M8.5 16.5H17M8.5 8h4"/>',
    cut: '<circle cx="6.5" cy="7" r="2.5"/><circle cx="6.5" cy="17" r="2.5"/><path d="M8.6 8.4L20 16M8.6 15.6L20 8"/>',
    more: '<circle cx="5.5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    minus: '<path d="M6 12h12"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    questions: '<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5L20 20"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    install: '<path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/>'
  };
  function icon(n, cls) { return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' viewBox="0 0 24 24" aria-hidden="true">' + ICON[n] + '</svg>'; }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* Plan text writes subscripts as _{x}. Escape first, then turn those into <sub>. */
  function rich(s) { return esc(s).replace(/_\{([^}]*)\}/g, '<sub>$1</sub>'); }
  function plain(s) { return String(s == null ? '' : s).replace(/_\{([^}]*)\}/g, '$1'); }

  function create(core, store) {
    var P = core.PLAN, byId = core.byId, f1 = core.f1;
    var TAGW = { core: 'Core', standard: 'Standard', optional: 'Optional' };
    var TAGHELP = { core: 'Asked most often. Never cut.', standard: 'Asked sometimes.', optional: 'Asked rarely. Cut first when behind.' };

    function course(id) { return core.courseById[id]; }
    function codeShort(c) { return course(c).short; }
    function trackWord(t) { return t.k === 'H' ? 'Numerical' : 'Descriptive'; }
    function ptsWord(t) { return f1(core.pts(t.id)) + (core.pts(t.id) === 1 ? ' point' : ' points'); }
    function freqWord(t) {
      var n = t.f[0], of = t.f[1];
      var s = 'Asked in ' + n + ' of ' + of + ' past papers';
      if (t.fb && t.fb > n) s += ' (' + t.fb + ' counting partial matches)';
      return s;
    }
    function paperLabel(pid, t) {
      var p = P.papers[pid], l = p ? p.l : pid;
      return t && p && p.c !== t.c && !(t.c === '405' && p.c === '405') ? l + ' (' + codeShort(p.c) + ')' : l;
    }
    function firmQ(t) { return (t.q || []).filter(function (q) { return !q[2]; }); }
    function weakQ(t) { return (t.q || []).filter(function (q) { return !!q[2]; }); }

    /* One line about the questions: the newest two, then a count. */
    function practiseLine(t) {
      var firm = firmQ(t), weak = weakQ(t);
      if (!firm.length && !weak.length) return 'No past question points here directly. Read it for understanding.';
      var src = firm.length ? firm : weak, seen = {}, out = [];
      src.forEach(function (q) { var k = q[0] + ' ' + q[1]; if (!seen[k]) { seen[k] = 1; out.push(paperLabel(q[0], t) + ' Q' + q[1]); } });
      var shown = out.slice(0, 2).join(', ');
      var more = out.length - 2;
      return (firm.length ? 'Latest: ' : 'Related only: ') + shown + (more > 0 ? ' and ' + more + ' more' : '');
    }
    /* Like practiseLine, but the question numbers are links that open the question itself. */
    function practiseHtml(t) {
      var firm = firmQ(t), weak = weakQ(t);
      if (!firm.length && !weak.length) return esc('No past question points here directly. Read it for understanding.');
      var src = firm.length ? firm : weak, seen = {}, out = [];
      src.forEach(function (q) { var k = q[0] + ' ' + q[1]; if (!seen[k]) { seen[k] = 1; out.push(q); } });
      var links = out.slice(0, 2).map(function (q) {
        return '<a class="lnk" href="#/q/' + encodeURIComponent(q[0]) + '/' + encodeURIComponent(q[1]) + '">' + esc(paperLabel(q[0], t) + ' Q' + q[1]) + '</a>';
      }), more = out.length - 2;
      return (firm.length ? 'Latest: ' : 'Related only: ') + links.join(', ') + (more > 0 ? ' and <a class="lnk" href="#/topic/' + t.id + '/questions">' + more + ' more</a>' : '');
    }
    function solveLine(t) {
      if (t.nm) return t.nm;
      return t.k === 'H' ? 'Numericals from the past questions' : '';
    }
    function studyLine(t) {
      if (!t.src.length) return t.pd ? 'Slides not available yet' : '';
      var s = t.src[0];
      return s[0] + ', ' + s[1] + (t.src.length > 1 ? ' and ' + (t.src.length - 1) + ' more' : '');
    }
    function state(id) { return store.isDone(id) ? 'done' : store.isParked(id) ? 'parked' : 'open'; }

    /* A toggle that punches or reopens a topic. */
    function punch(id, extra) {
      var t = byId[id], s = state(id);
      var label = (s === 'done' ? 'Done: ' : s === 'parked' ? 'Set aside: ' : 'Not done: ') + plain(t.n) + '. ' + (s === 'done' ? 'Press to reopen.' : s === 'parked' ? 'Press to bring back.' : 'Press to mark done.');
      return '<button class="punch' + (s === 'parked' ? ' parked' : '') + '" data-act="toggle" data-id="' + id + '" aria-pressed="' + (s === 'done') + '" aria-label="' + esc(label) + '"' + (extra || '') + '><i>' + icon(s === 'parked' ? 'minus' : 'check') + '</i></button>';
    }
    function holes(done, due, cap) {
      var n = Math.min(cap || 40, Math.ceil(due)), on = Math.floor(done), h = '';
      for (var i = 0; i < n; i++) h += '<span class="hole' + (i < on ? ' on' : '') + (i === n - 1 && due % 1 && n === Math.ceil(due) ? ' half' : '') + '"></span>';
      return h;
    }
    function band(left, right, slim) {
      return '<div class="band' + (slim ? ' slim' : '') + '"><svg class="guil" aria-hidden="true" preserveAspectRatio="none"><use href="#guil"/></svg><b>' + esc(left) + '</b><span>' + esc(right) + '</span></div>';
    }
    function chipTag(t) { return '<span class="chip' + (t.g === 'core' ? ' core' : '') + '" title="' + esc(TAGHELP[t.g]) + '">' + TAGW[t.g] + '</span>'; }
    function courseChip(c) { return '<span class="chip cc" data-c="' + c + '">' + esc(course(c).code) + '</span>'; }
    function topicLine(t) { return ptsWord(t) + ' · ' + trackWord(t) + ' · ' + TAGW[t.g]; }
    function when(ts) {
      var d = new Date(ts), diff = Date.now() - ts;
      if (diff < 60e3) return 'just now';
      if (diff < 3600e3) return Math.floor(diff / 60e3) + ' min ago';
      var hh = d.getHours(), mm = d.getMinutes();
      var t = ((hh % 12) || 12) + ':' + core.pad(mm) + ' ' + (hh < 12 ? 'am' : 'pm');
      var today = core.iso(new Date());
      return (core.iso(d) === today ? 'today ' : core.fmtShort(core.iso(d)) + ', ') + t;
    }
    return { esc: esc, rich: rich, plain: plain, icon: icon, course: course, codeShort: codeShort, trackWord: trackWord, ptsWord: ptsWord, freqWord: freqWord,
             paperLabel: paperLabel, firmQ: firmQ, weakQ: weakQ, practiseLine: practiseLine, practiseHtml: practiseHtml, solveLine: solveLine, studyLine: studyLine, state: state,
             punch: punch, holes: holes, band: band, chipTag: chipTag, courseChip: courseChip, topicLine: topicLine, when: when, TAGW: TAGW, TAGHELP: TAGHELP };
  }

  FE.ui = { icon: icon, esc: esc, rich: rich, plain: plain, create: create };
})(typeof window !== 'undefined' ? window : globalThis);
