/* Terminus: Questions (find any past question), a single question, and the full scanned page. */
(function (root) {
  'use strict';
  var FE = root.FE = root.FE || {}; FE.parts = FE.parts || [];

  FE.parts.push(function (env) {
    var core = env.core, u = env.u, ctx = env.ctx, P = core.PLAN, esc = u.esc, rich = u.rich, plain = u.plain;
    var PAGE_SIZE = 20;

    function qhref(q) { return '#/q/' + encodeURIComponent(q.p) + '/' + encodeURIComponent(q.q); }
    function pagehref(c, pg, key) { return '#/page/' + c + '/' + pg + (key ? '?q=' + encodeURIComponent(key) : ''); }
    function qid(q) { return 'q-' + q.k.replace(/[^A-Za-z0-9]/g, '_'); }
    function qtitle(q) { var p = P.papers[q.p]; return p.l + ', ' + p.code + ', question ' + q.q; }
    function topicChips(q, skip) {
      var h = q.f.filter(function (id) { return id !== skip; }).map(function (id) { return '<a class="chip tl" href="#/topic/' + id + '">' + rich(core.byId[id].n) + '</a>'; }).join('');
      if (skip && q.w.indexOf(skip) >= 0) h += '<span class="chip weak">Partly related to this topic</span>';
      h += q.w.filter(function (id) { return id !== skip; }).map(function (id) { return '<a class="chip tl weak" href="#/topic/' + id + '" title="Only partly about this topic">Partly: ' + rich(core.byId[id].n) + '</a>'; }).join('');
      return h || (skip ? '' : '<span class="chip">Not a plan topic</span>');
    }

    /* A band of a page image, exactly as printed. */
    function cropBox(c, pg, y0, y1, alt) {
      var r = core.pageRatio(c, pg), url = core.pageUrl(c, pg), h = y1 - y0;
      return '<div class="crop" style="aspect-ratio:' + (1 / (h * r)).toFixed(4) + '"><img decoding="async" src="' + url + '" alt="' + esc(alt) + '" style="top:-' + (y0 / h * 100).toFixed(3) + '%"></div>';
    }
    function crop(q) {
      var c = core.qCourse(q), alt = 'Scanned exam question, ' + qtitle(q) + '. ' + plain(q.t);
      if (!q.b) return '<div class="crop full" style="aspect-ratio:1/' + core.pageRatio(c, q.pg) + '"><img decoding="async" src="' + core.pageUrl(c, q.pg) + '" alt="' + esc(alt) + '"></div>';
      return cropBox(c, q.pg, q.b[0], q.b[1], alt);
    }
    function zoomBtn() { return '<button class="btn ghost sm zoombtn" data-act="cropzoom" aria-pressed="false">Zoom in</button>'; }
    function shot(q) {
      var c = core.qCourse(q), p = P.papers[q.p], n = core.pageCount(c), links = [], x = q.x || [];
      links.push('<a class="lnk" href="' + pagehref(c, q.pg, q.k) + '">Open the full page</a>');
      if (q.c && q.pg < n && !x.some(function (e) { return e[0] === q.pg + 1; })) links.push('<a class="lnk" href="' + pagehref(c, q.pg + 1, '') + '">Rest is on the next page</a>');
      var note = q.b ? '' : ' The exact spot is not marked, so the whole page is shown.';
      var main = '<figure class="qshot"><div class="cropwrap">' + crop(q) + '</div><figcaption>' + zoomBtn() + links.join(' \u00b7 ') + '<span class="sub">Page ' + q.pg + ' of the ' + esc(p.code) + ' paper pack' + (p.pp ? '. This paper is on pages ' + p.pp[0] + ' to ' + p.pp[1] + '.' : '.') + note + '</span></figcaption></figure>';
      var more = x.map(function (e) {
        return '<figure class="qshot extra"><div class="cropwrap">' + cropBox(c, e[0], e[1], e[2], e[3] + ', page ' + e[0]) + '</div><figcaption>' + zoomBtn() + '<b>' + esc(e[3]) + '</b> (page ' + e[0] + ') \u00b7 <a class="lnk" href="' + pagehref(c, e[0], '') + '">Open that page</a></figcaption></figure>';
      }).join('');
      return main + more;
    }

    function card(q, open, skip) {
      var p = P.papers[q.p], ao = q.a && env.V.ansOpen(q.k);
      return '<article class="qcard" id="' + qid(q) + '" data-key="' + esc(q.k) + '"><header><span class="qn">Q' + esc(q.q) + '</span><span class="qmeta">' + esc(p.l) + ' · ' + esc(p.code) + (q.m ? ' · ' + q.m + ' marks' : '') + '</span>' + (q.a ? env.V.ansChip(q.k) : '') + '</header>' +
        '<p class="qtext">' + rich(q.t) + '</p><div class="chips">' + topicChips(q, skip) + '</div>' +
        '<div class="qact"><button class="btn sm' + (open ? ' ghost' : '') + '" data-act="qshow" data-key="' + esc(q.k) + '" aria-expanded="' + !!open + '">' + (open ? 'Hide the question' : 'Show the exact question') + '</button>' + (q.a ? env.V.ansButton(q) : '') +
        '<a class="lnk" href="' + qhref(q) + '">Open</a></div><div class="qsplit' + (ao ? ' split' : '') + '"><div class="qbody"' + (open ? '' : ' hidden') + '>' + (open ? shot(q) : '') + '</div>' + (q.a ? env.V.ansSlot(q) : '') + '</div></article>';
    }

    /* ---------- the finder ---------- */
    function qfFrom(params) { return { q: (params && params.get('q')) || '', c: (params && params.get('c')) || '', p: (params && params.get('p')) || '', pr: (params && params.get('pr')) || '', n: PAGE_SIZE }; }
    function qfQuery(f) {
      var a = []; if (f.q) a.push('q=' + encodeURIComponent(f.q)); if (f.c) a.push('c=' + encodeURIComponent(f.c)); if (f.p) a.push('p=' + encodeURIComponent(f.p)); if (f.pr) a.push('pr=' + encodeURIComponent(f.pr));
      return a.length ? '?' + a.join('&') : '';
    }
    function filters(f) {
      var chips = [['', 'All']].concat(P.courses.map(function (c) { return [c.id, c.short]; })).map(function (x) {
        return '<button class="tab" data-act="qcourse" data-c="' + x[0] + '" aria-pressed="' + (f.c === x[0]) + '"' + (x[0] ? ' aria-label="' + esc(core.courseById[x[0]].code) + '"' : '') + '>' + esc(x[1]) + '</button>';
      }).join('');
      var sel = '';
      if (f.c) {
        sel = '<label class="sr" for="qpaper">Paper</label><select id="qpaper" class="sel"><option value="">All papers</option>' + core.papersOfCourse(f.c).map(function (id) {
          return '<option value="' + esc(id) + '"' + (f.p === id ? ' selected' : '') + '>' + esc(P.papers[id].l + ' (' + P.papers[id].n + ' questions)') + '</option>';
        }).join('') + '</select>';
      }
      var prsel = '';
      if (core.questions.some(function (q) { return q.a; })) {
        prsel = '<label class="sr" for="qpr">Model answers</label><select id="qpr" class="sel">' + [['', 'All questions'], ['ans', 'With a model answer'], ['none', 'Not practised yet'], ['low', 'Scored below 60%']].map(function (o) {
          return '<option value="' + o[0] + '"' + (f.pr === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('') + '</select>';
      }
      return '<div class="tabs qtabs" role="group" aria-label="Course">' + chips + '</div>' + sel + prsel;
    }
    function browse() {
      return P.courses.map(function (c) {
        return '<section><h2>' + esc(c.code) + '</h2><ul class="paperlist">' + core.papersOfCourse(c.id).map(function (id) {
          var p = P.papers[id], code = p.code !== c.code ? esc(p.code) + ' \u00b7 ' : '';
          return '<li><a class="paperrow" href="#/questions?c=' + c.id + '&p=' + encodeURIComponent(id) + '"><b>' + esc(p.l) + '</b><span>' + code + p.n + ' questions' + (p.pp ? ' \u00b7 pages ' + p.pp[0] + ' to ' + p.pp[1] : '') + '</span></a></li>';
        }).join('') + '</ul></section>';
      }).join('');
    }
    function byPractice(list, pr) {
      if (!pr) return list;
      return list.filter(function (q) {
        if (!q.a) return false;
        var r = env.store.getPractice(q.k);
        return pr === 'ans' || (pr === 'none' ? !r : !!(r && r.m && r.s / r.m < 0.6));
      });
    }
    function results(f) {
      if (!f.q && !f.c && !f.p && !f.pr) return browse();
      var list = byPractice(core.searchQuestions(f), f.pr), shown = list.slice(0, f.n), auto = list.length > 0 && list.length <= 3;
      var head = '<p class="count" role="status">' + (list.length ? core.plural(list.length, 'question') : 'No question matches.') + (f.p ? ' in ' + esc(P.papers[f.p].l + ' ' + P.papers[f.p].code) : '') + '</p>';
      if (!list.length) return head + '<p class="hint">Try fewer words, a topic name (Jominy, Weibull, NPV), or a question number like 5b. Clear the course filter to search everything.</p>';
      return head + shown.map(function (q) { return card(q, auto); }).join('') + (list.length > shown.length ? '<div class="row-actions" style="margin-top:12px"><button class="btn ghost sm" data-act="qmore">Show ' + Math.min(PAGE_SIZE, list.length - shown.length) + ' more</button></div>' : '');
    }
    function questions(arg, params) {
      var f = ctx.qf;
      var html = '<section class="sheet" aria-labelledby="h-q">' + u.band('Questions', 'Find any past question', true) +
        '<div class="body"><h1 id="h-q">Past questions</h1><p class="lede">Search by a word, a topic or a question number, or browse a paper. Open a question to see it exactly as printed in the paper.</p>' +
        '<form class="qsearch" role="search" data-qform><label class="sr" for="qs">Search past questions</label><input id="qs" type="search" inputmode="search" autocomplete="off" spellcheck="false" placeholder="Try: weibull, jominy, npv, 23-24 q5b" value="' + esc(f.q) + '"></form>' +
        '<div id="qfilters">' + filters(f) + '</div><div id="qresults">' + results(f) + '</div></div></section>';
      return { html: html, title: 'Questions' };
    }
    function refresh() {
      var f = ctx.qf, a = root.document.getElementById('qfilters'), b = root.document.getElementById('qresults');
      if (a) a.innerHTML = filters(f); if (b) b.innerHTML = results(f);
      try { root.history.replaceState(null, '', '#/questions' + qfQuery(f)); } catch (e) { /* not allowed here */ }
    }

    /* ---------- one question ---------- */
    function question(arg) {
      var parts = String(arg).split('/'), key = decodeURIComponent(parts[0]) + '|' + decodeURIComponent(parts.slice(1).join('/')), q = core.qByKey[key];
      if (!q) return { html: '<section class="sheet">' + u.band('Question', 'Not found', true) + '<div class="body"><a class="back" href="#/questions">' + u.icon('back') + 'Questions</a><h1>Question not found</h1></div></section>', title: 'Question' };
      var c = core.qCourse(q), p = P.papers[q.p];
      var sibs = core.questions.filter(function (x) { return x.p === q.p; }), i = sibs.indexOf(q), prev = sibs[i - 1], next = sibs[i + 1];
      var html = '<section class="sheet" aria-labelledby="h-q1">' + u.band('Question', p.l + ' ' + p.code, true) + '<div class="body qpage"><a class="back" href="#/questions?c=' + c + '&p=' + encodeURIComponent(q.p) + '">' + u.icon('back') + 'All of ' + esc(p.l + ' ' + p.code) + '</a>' +
        '<h1 id="h-q1">Question ' + esc(q.q) + '</h1><div class="day-hero">' + u.courseChip(c) + '<span class="chip">' + esc(p.l) + '</span>' + (q.m ? '<span class="chip">' + q.m + ' marks</span>' : '') + (q.a ? env.V.ansChip(q.k) : '') + '</div>' +
        '<div class="qsplit' + (q.a && env.V.ansOpen(q.k) ? ' split' : '') + '"><div class="qside"><p class="lede">' + rich(q.t) + '</p><div class="chips" style="margin-top:10px">' + topicChips(q) + '</div>' + shot(q) + '</div>' +
        (q.a ? '<div class="aside"><div class="qact" style="margin-top:14px">' + env.V.ansButton(q) + '</div><p class="hint">Write your own answer first, then check it against the model answer.</p>' + env.V.ansSlot(q, 2) + '</div>' : '') + '</div>' +
        '<div class="row-actions" style="margin-top:14px"><button class="btn ghost sm" data-act="copy-qlink" data-key="' + esc(q.k) + '">' + u.icon('link') + 'Copy link to this question</button></div>' +
        '<div class="pager">' + (prev ? '<a class="btn ghost sm" href="' + qhref(prev) + '">' + u.icon('back') + 'Q' + esc(prev.q) + '</a>' : '<span></span>') + (next ? '<a class="btn ghost sm" href="' + qhref(next) + '">Q' + esc(next.q) + u.icon('next') + '</a>' : '<span></span>') + '</div></div></section>';
      return { html: html, title: 'Q' + q.q + ' ' + p.l };
    }

    /* ---------- the whole page, with the questions on it marked ---------- */
    function page(arg, params) {
      var seg = String(arg).split('/'), c = seg[0], pg = parseInt(seg[1], 10), n = core.pageCount(c), sel = params && params.get('q');
      if (!core.courseById[c] || !(pg >= 1 && pg <= n)) return { html: '<section class="sheet">' + u.band('Page', 'Not found', true) + '<div class="body"><a class="back" href="#/questions">' + u.icon('back') + 'Questions</a><h1>Page not found</h1></div></section>', title: 'Page' };
      var pid = core.paperOfPage(c, pg), p = pid ? P.papers[pid] : null, qs = core.questionsOnPage(c, pg);
      var overlays = qs.filter(function (q) { return q.b; }).map(function (q) {
        return '<a class="hl' + (q.k === sel ? ' on' : '') + '" href="' + pagehref(c, pg, q.k) + '" style="top:' + (q.b[0] * 100).toFixed(2) + '%;height:' + ((q.b[1] - q.b[0]) * 100).toFixed(2) + '%" aria-hidden="true" tabindex="-1"><span>Q' + esc(q.q) + '</span></a>';
      }).join('');
      var list = qs.map(function (q) { return '<a class="chip tl' + (q.k === sel ? ' core' : '') + '" href="' + pagehref(c, pg, q.k) + '">Q' + esc(q.q) + '</a>'; }).join('');
      var html = '<section class="sheet" aria-labelledby="h-pg">' + u.band('Page ' + pg, core.courseById[c].code, true) + '<div class="body"><a class="back" href="' + (sel ? '#/q/' + encodeURIComponent(sel.split('|')[0]) + '/' + encodeURIComponent(sel.split('|').slice(1).join('|')) : '#/questions') + '">' + u.icon('back') + (sel ? 'Back to the question' : 'Questions') + '</a>' +
        '<h1 id="h-pg">' + esc(core.courseById[c].code) + (p ? ', ' + esc(p.l) : '') + ', page ' + pg + '</h1><p class="lede">Page ' + pg + ' of ' + n + ' in the ' + esc(core.courseById[c].code) + ' paper pack' + (p && p.pp ? '. This paper is pages ' + p.pp[0] + ' to ' + p.pp[1] + '.' : '.') + '</p>' +
        (qs.length ? '<div class="chips" style="margin-top:10px" aria-label="Questions on this page">' + list + '</div>' : '') +
        '<div class="seg zoomseg" role="group" aria-label="Zoom" style="margin-top:12px"><button data-act="zoom" data-z="1" aria-pressed="true">Fit</button><button data-act="zoom" data-z="1.6" aria-pressed="false">Larger</button><button data-act="zoom" data-z="2.4" aria-pressed="false">Largest</button></div>' +
        '<div class="pagebox" id="pagebox" style="--z:1"><div class="pageimg"><img src="' + core.pageUrl(c, pg) + '" alt="Scanned page ' + pg + ' of the ' + esc(core.courseById[c].code) + ' paper pack" style="aspect-ratio:1/' + core.pageRatio(c, pg) + '">' + overlays + '</div></div>' +
        '<div class="pager">' + (pg > 1 ? '<a class="btn ghost sm" href="' + pagehref(c, pg - 1) + '">' + u.icon('back') + 'Page ' + (pg - 1) + '</a>' : '<span></span>') + (pg < n ? '<a class="btn ghost sm" href="' + pagehref(c, pg + 1) + '">Page ' + (pg + 1) + u.icon('next') + '</a>' : '<span></span>') + '</div></div></section>';
      return { html: html, title: core.courseById[c].short + ' page ' + pg };
    }

    return { questions: questions, question: question, page: page, qfFrom: qfFrom, qfRefresh: refresh, qcard: card, qshot: function (key) { var q = core.qByKey[key]; return q ? shot(q) : ''; }, qPAGE: PAGE_SIZE };
  });
})(typeof window !== 'undefined' ? window : globalThis);
