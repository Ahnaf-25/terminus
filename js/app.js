/* Terminus: the app. Routing, the tear flow, undo toasts, progress code and offline. */
(function (root) {
  'use strict';
  var FE = root.FE, doc = root.document, PLAN = root.PLAN;
  var core = FE.createCore(PLAN), store = FE.createStore(core), u = FE.ui.create(core, store), esc = FE.ui.esc;
  var params = new URLSearchParams(root.location.search), override = params.get('today');
  var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion:reduce)').matches;

  var ctx = { preview: !!(override && /^\d{4}-\d{2}-\d{2}$/.test(override)), flipped: null, imp: null, resetAsk: false, cutAmount: null, canInstall: false, deferredPrompt: null };
  ctx.today = function () { return ctx.preview ? override : core.iso(new Date()); };
  ctx.baseUrl = function () { return root.location.origin === 'null' || root.location.protocol === 'file:' ? root.location.href.split('#')[0].split('?')[0] : root.location.origin + root.location.pathname; };
  ctx.offlineText = function () {
    if (root.location.protocol === 'file:') return 'You opened this from a file. Open the web link once while online and it will keep working offline.';
    if (!('serviceWorker' in root.navigator)) return 'This browser cannot keep the app offline. It still works while you are online.';
    return root.navigator.serviceWorker.controller ? 'Ready offline. The whole plan and your progress live on this device.' : 'Offline mode switches on after the first visit. Reload once while online.';
  };

  var V = {};
  FE.parts.forEach(function (p) { var o = p({ core: core, store: store, u: u, ctx: ctx }); Object.keys(o).forEach(function (k) { V[k] = o[k]; }); });

  var $ = function (id) { return doc.getElementById(id); };
  var main = $('view'), toastEl = $('toast'), cur = { name: 'today', tab: 'today' }, toastTimer = null;

  /* ---------- guilloche pattern, drawn once and reused by every band ---------- */
  (function () {
    var W = 380, H = 60, d = '';
    for (var k = 0; k < 26; k++) {
      var p = '';
      for (var x = 0; x <= W; x += 5) {
        var env = 0.55 + 0.45 * Math.cos(x / 31 + k * 0.17), y = H / 2 + 24 * env * Math.sin(x * 0.075 + k * 0.24);
        p += (x ? 'L' : 'M') + x + ',' + y.toFixed(1);
      }
      d += '<path d="' + p + '"/>';
    }
    var s = doc.createElement('div');
    s.innerHTML = '<svg aria-hidden="true" style="position:absolute;width:0;height:0"><symbol id="guil" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><g fill="none" stroke="#7FA37E" stroke-width=".7" opacity=".7">' + d + '</g></symbol></svg>';
    doc.body.insertBefore(s.firstChild, doc.body.firstChild);
  })();

  /* ---------- navigation ---------- */
  var TABS = [['today', 'Today', '#/'], ['plan', 'Plan', '#/plan'], ['courses', 'Courses', '#/courses'], ['cut', 'Cut order', '#/cut'], ['more', 'More', '#/more']];
  $('nav').innerHTML = TABS.map(function (t) { return '<a href="' + t[2] + '" data-tab="' + t[0] + '">' + FE.ui.icon(t[0]) + '<span>' + t[1] + '</span></a>'; }).join('');

  function parse() {
    var h = root.location.hash.replace(/^#\/?/, ''), seg = h.split('/');
    return { name: seg[0] || 'today', arg: decodeURIComponent(seg.slice(1).join('/')) };
  }
  function build(r) {
    switch (r.name) {
      case 'plan': return [V.plan(), 'plan'];
      case 'day': return [V.day(r.arg), 'plan'];
      case 'courses': return [V.courses(r.arg), 'courses'];
      case 'topic': return [V.topic(r.arg), 'courses'];
      case 'cut': return [V.cut(r.arg), 'cut'];
      case 'more': return [V.more(), 'more'];
      default: return [V.today(), 'today'];
    }
  }
  function focusKey(el) {
    var a = el && el.closest && el.closest('[data-act]'); if (!a) return null;
    return ['act', 'id', 'ids', 'eid', 'tone', 'what', 'd'].map(function (k) { return a.getAttribute('data-' + k) || ''; }).join('|');
  }
  function refocus(key) {
    if (!key) return;
    var els = main.querySelectorAll('[data-act]');
    for (var i = 0; i < els.length; i++) if (focusKey(els[i]) === key) { els[i].focus({ preventScroll: true }); return; }
  }
  function render(keep) {
    var r = parse(), pair, y = root.scrollY, key = keep ? focusKey(doc.activeElement) : null;
    try { pair = build(r); } catch (err) {
      pair = [{ html: '<section class="sheet"><div class="body"><h1>Something went wrong</h1><p class="lede">Your progress is safe on this device. Reload the page to try again.</p><div class="row-actions" style="margin-top:14px"><button class="btn" data-act="reload">Reload</button></div></div></section>', title: 'Error' }, 'today'];
      if (root.console) root.console.error(err);
    }
    var v = pair[0];
    main.className = 'view ' + (v.cls || '');
    main.innerHTML = v.html;
    doc.title = (r.name === '' || r.name === 'today' ? 'Terminus' : v.title + ' · Terminus');
    cur = { name: r.name, tab: pair[1] };
    Array.prototype.forEach.call($('nav').querySelectorAll('a'), function (a) { if (a.getAttribute('data-tab') === pair[1]) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (keep) { root.scrollTo(0, y); refocus(key); }
    else {
      root.scrollTo(0, 0);
      var h1 = main.querySelector('h1'); if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
    }
  }
  function route() {
    if (ctx.busy) { ctx.pendingRoute = true; return; }
    var r = parse();
    if (r.name === 'import') {
      ctx.imp = { text: r.arg, res: store.parseCode(r.arg) };
      root.history.replaceState(null, '', '#/more'); render(false);
      var t = $('code-in'); if (t) t.scrollIntoView({ block: 'center' });
      return;
    }
    ctx.resetAsk = false; render(false);
  }
  function rerender() { if (ctx.busy) { ctx.dirty = true; return; } render(true); ctx.flipped = null; }

  /* ---------- toast with undo ---------- */
  function toast(msg, act) {
    clearTimeout(toastTimer);
    toastEl.innerHTML = '<p>' + esc(msg) + '</p>' + (act ? '<button data-act="' + act[0] + '">' + esc(act[1]) + '</button>' : '') + '<button class="x" data-act="toast-close" aria-label="Dismiss">' + FE.ui.icon('close') + '</button>';
    toastEl.hidden = false;
    toastTimer = setTimeout(hideToast, act ? 10000 : 4000);
  }
  function hideToast() { toastEl.hidden = true; }
  toastEl.addEventListener('pointerenter', function () { clearTimeout(toastTimer); });
  toastEl.addEventListener('focusin', function () { clearTimeout(toastTimer); });
  toastEl.addEventListener('pointerleave', function () { clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, 5000); });

  function after(e) { if (e) toast(FE.entryLabel(e) + '.', ['undo', 'Undo']); }
  function afterUndo(e) { if (e) toast('Undone. ' + FE.entryLabel(e) + ' was reversed.', ['redo', 'Redo']); }
  function afterRedo(e) { if (e) toast('Redone: ' + FE.entryLabel(e), ['undo', 'Undo']); }

  /* ---------- the tear ---------- */
  function doneFlow(btn) {
    if (ctx.busy) return;
    var id = btn.getAttribute('data-id'), stub = btn.closest('.stub'), ticket = stub && stub.closest('.ticket');
    if (reduce || !stub || !ticket) { var e0 = store.setDone([id], true); render(true); after(e0); return; }
    ctx.busy = true;
    var n = ticket.querySelectorAll('.stub').length, k = Math.ceil(core.pts(id));
    var e = store.setDone([id], true);               // saved the moment you press, so closing the tab mid-tear loses nothing
    ctx.flipped = core.byId[id].c;
    [].slice.call(doc.querySelectorAll('.hole:not(.on)')).slice(0, k).forEach(function (h, i) { setTimeout(function () { h.classList.add('on', 'new'); }, 120 + i * 70); });
    Promise.resolve().then(function () { return FE.tear.run(stub, ticket); }).catch(function () { /* animation failure must not block the tick */ }).then(function () {
      ctx.busy = false;
      render(true);
      var all = doc.querySelectorAll('.stubs .stub'), fresh = all[all.length - 1];
      if (fresh && all.length >= n) {
        var cs = root.getComputedStyle(fresh), fh = fresh.offsetHeight; fresh.style.overflow = 'hidden';
        fresh.animate([{ height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0 }, { height: fh + 'px', paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, opacity: 1 }], { duration: 360, easing: 'cubic-bezier(.16,1,.3,1)' }).onfinish = function () { fresh.style.overflow = ''; };
      }
      ctx.flipped = null; ctx.dirty = false;
      after(e);
      if (ctx.pendingRoute) { ctx.pendingRoute = false; route(); }
      var next = main.querySelector('.stub .btn'); if (next && doc.activeElement === doc.body) next.focus({ preventScroll: true });
    });
  }

  /* ---------- clipboard ---------- */
  function copy(text, done) {
    function fallback() {
      var ta = doc.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0'; doc.body.appendChild(ta); ta.select();
      var ok = false; try { ok = doc.execCommand('copy'); } catch (e) { ok = false; } ta.remove(); done(ok);
    }
    if (root.navigator.clipboard && root.isSecureContext) root.navigator.clipboard.writeText(text).then(function () { done(true); }, fallback); else fallback();
  }

  /* ---------- clicks ---------- */
  function ids(el) { return (el.getAttribute('data-ids') || '').split(',').filter(Boolean); }
  function cutAmount() { return ctx.cutAmount == null ? core.overload(core.target(store.state, ctx.today())) : ctx.cutAmount; }
  doc.addEventListener('click', function (ev) {
    var el = ev.target.closest && ev.target.closest('[data-act]'); if (!el) return;
    var act = el.getAttribute('data-act'), id = el.getAttribute('data-id'), e, l;
    switch (act) {
      case 'done': doneFlow(el); break;
      case 'toggle':
        if (store.isDone(id)) e = store.setDone([id], false); else if (store.isParked(id)) e = store.setParked([id], false); else e = store.setDone([id], true);
        after(e); break;
      case 'mark': after(store.setDone([id], true)); break;
      case 'reopen': after(store.setDone([id], false)); break;
      case 'park': l = ids(el); e = store.setParked(l, true); if (e) { ctx.cutAmount = null; toast('Set aside ' + (l.length === 1 ? u.plain(core.byId[l[0]].n) : l.length + ' topics') + '. It no longer counts toward the checkpoint.', ['undo', 'Undo']); } break;
      case 'unpark': l = ids(el); e = store.setParked(l, false); if (e) toast('Brought back ' + (l.length === 1 ? u.plain(core.byId[l[0]].n) : l.length + ' topics') + '.', ['undo', 'Undo']); break;
      case 'undo': afterUndo(store.undo()); break;
      case 'redo': afterRedo(store.redo()); break;
      case 'reverse': afterUndo(store.reverse(+el.getAttribute('data-eid'))); break;
      case 'reapply': afterRedo(store.reapply(+el.getAttribute('data-eid'))); break;
      case 'cut-step': ctx.cutAmount = Math.max(0, Math.round((cutAmount() + parseFloat(el.getAttribute('data-d'))) * 2) / 2); rerender(); break;
      case 'copy': copy(el.getAttribute('data-what') === 'link' ? ctx.baseUrl() + '#/import/' + store.exportCode() : store.exportCode(), function (ok) { toast(ok ? 'Copied.' : 'Could not copy. Select the code and copy it by hand.'); }); break;
      case 'import-check': var ta = $('code-in'), text = ta ? ta.value : ''; ctx.imp = { text: text, res: store.parseCode(text) }; rerender(); break;
      case 'import-apply': if (ctx.imp && ctx.imp.res && ctx.imp.res.ok) { e = store.replaceAll(ctx.imp.res.done, ctx.imp.res.parked, 'import'); ctx.imp = null; rerender(); toast(e ? 'Progress loaded from the code.' : 'That code matches what is already here.', e ? ['undo', 'Undo'] : null); } break;
      case 'import-cancel': ctx.imp = null; rerender(); break;
      case 'reset-ask': ctx.resetAsk = true; rerender(); break;
      case 'reset-cancel': ctx.resetAsk = false; rerender(); break;
      case 'reset-do': ctx.resetAsk = false; e = store.reset(); rerender(); if (e) toast('All progress cleared.', ['undo', 'Undo']); break;
      case 'tone': FE.tear.setTone(el.getAttribute('data-tone')); store.setPref('tone', FE.tear.getTone()); rerender(); break;
      case 'install': if (ctx.deferredPrompt) { ctx.deferredPrompt.prompt(); ctx.deferredPrompt = null; ctx.canInstall = false; rerender(); } break;
      case 'toast-close': hideToast(); break;
      case 'reload': root.location.reload(); break;
    }
  });
  doc.addEventListener('input', function (ev) { if (ev.target && ev.target.id === 'code-in') ctx.imp = { text: ev.target.value, res: null }; });
  doc.addEventListener('keydown', function (ev) {
    var tag = ev.target && ev.target.tagName; if (tag === 'TEXTAREA' || tag === 'INPUT') return;
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey) {
      var k = ev.key.toLowerCase();
      if (k === 'z' && !ev.shiftKey) { ev.preventDefault(); afterUndo(store.undo()); }
      else if ((k === 'z' && ev.shiftKey) || k === 'y') { ev.preventDefault(); afterRedo(store.redo()); }
    }
  });

  store.subscribe(function () { rerender(); });
  root.addEventListener('hashchange', route);
  root.addEventListener('pointerdown', function () { FE.tear.prime(); }, { once: true, passive: true });
  root.addEventListener('beforeinstallprompt', function (ev) { ev.preventDefault(); ctx.deferredPrompt = ev; ctx.canInstall = true; if (cur.name === 'more') rerender(); });

  /* ---------- offline ---------- */
  if ('serviceWorker' in root.navigator && /^https?:$/.test(root.location.protocol)) {
    var had = !!root.navigator.serviceWorker.controller;
    root.navigator.serviceWorker.register('sw.js').catch(function () { /* offline mode is optional */ });
    root.navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (had) toast('The plan was updated. Reload to see it.', ['reload', 'Reload']); else if (cur.name === 'more') rerender();
      had = true;
    });
  }
  if (root.navigator.storage && root.navigator.storage.persist) root.navigator.storage.persist().catch(function () {});

  FE.tear.setTone(store.getPref('tone', 'soft'), true);
  FE.app = { core: core, store: store, ctx: ctx, route: route, render: render, V: V, toast: toast };
  route();
})(window);
