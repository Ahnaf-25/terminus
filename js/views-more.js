/* Terminus: More (progress code, undo and recent changes, sound, install, how the plan works). */
(function (root) {
  'use strict';
  var FE = root.FE = root.FE || {}; FE.parts = FE.parts || [];

  FE.parts.push(function (env) {
    var core = env.core, store = env.store, u = env.u, ctx = env.ctx, P = core.PLAN, esc = u.esc, rich = u.rich, f1 = core.f1;
    var ERR = {
      empty: 'Paste a code first.',
      short: 'That code looks too short. Copy the whole code, including every group.',
      checksum: 'That code has a typo or a missing character. Compare it with the original.',
      version: 'That code comes from a different version of the app.',
      plan: 'That code was made with a different version of the plan. Open the latest link on both devices, then make a new code.'
    };

    function names(ids) {
      if (!ids.length) return '';
      return ids.length === 1 ? u.plain(core.byId[ids[0]].n) : ids.length + ' topics';
    }
    function label(e) {
      switch (e.a) {
        case 'done': return 'Done: ' + names(e.dA);
        case 'open': return 'Reopened: ' + names(e.dD);
        case 'park': return 'Set aside: ' + names(e.pA);
        case 'unpark': return 'Brought back: ' + names(e.pD);
        case 'import': return 'Loaded progress from a code';
        case 'reset': return 'Cleared all progress';
      }
      return 'Change';
    }
    FE.entryLabel = label;

    function more() {
      var st = store.state, code = store.exportCode(), link = ctx.baseUrl() + '#/import/' + code, tone = FE.tear.getTone();
      var imp = ctx.imp || { text: '', res: null }, res = imp.res, impBlock = '';
      if (res && !res.ok) impBlock = '<p class="msg bad" role="alert">' + esc(ERR[res.error] || 'That code could not be read.') + '</p>';
      if (res && res.ok) {
        impBlock = '<div class="msg" role="status"><p>This code holds <b>' + res.done.length + ' topics done</b> and ' + res.parked.length + ' set aside. This device has ' + st.done.size + ' done and ' + st.parked.size + ' set aside.</p>' +
          '<p style="margin-top:6px">Loading it replaces the progress on this device. You can undo that right after.</p><div class="row-actions" style="margin-top:10px"><button class="btn sm" data-act="import-apply">Replace progress here</button><button class="btn ghost sm" data-act="import-cancel">Cancel</button></div></div>';
      }
      var storageText = ctx.persisted ? 'Protected. This browser has promised to keep it.'
        : ctx.iosSafari && !ctx.standalone ? 'Not protected. On iPhone tap Share, then Add to Home Screen.'
        : ctx.standalone ? 'The browser has not promised to keep it, so keep a backup.' : 'Not protected yet. Installing the app asks the browser to keep it.';
      var log = store.log.slice(-12).reverse();
      var recent = log.length ? '<ul class="recent">' + log.map(function (e) {
        return '<li class="' + (e.rev ? 'rev' : '') + '"><span class="what">' + esc(label(e)) + '</span>' +
          '<button class="btn ghost sm" data-act="' + (e.rev ? 'reapply' : 'reverse') + '" data-eid="' + e.id + '" aria-label="' + (e.rev ? 'Redo' : 'Undo') + ': ' + esc(label(e)) + '">' + u.icon(e.rev ? 'redo' : 'undo') + (e.rev ? 'Redo' : 'Undo') + '</button>' +
          '<span class="when">' + esc(u.when(e.t)) + '</span></li>';
      }).join('') + '</ul>' : '<p class="hint">Nothing yet. Every tick, reopen and set-aside will show here, each with its own Undo.</p>';
      var resetBlock = ctx.resetAsk
        ? '<div class="msg" role="alert"><p>This clears <b>' + st.done.size + ' done</b> and ' + st.parked.size + ' set-aside topics on this device. You can undo it right after.</p><div class="row-actions" style="margin-top:10px"><button class="btn sm" data-act="reset-do">Yes, clear all progress</button><button class="btn ghost sm" data-act="reset-cancel">Keep my progress</button></div></div>'
        : '<div class="row-actions" style="margin-top:8px"><button class="btn ghost sm" data-act="reset-ask"' + (st.done.size || st.parked.size ? '' : ' disabled') + '>Clear all progress</button></div>';
      var install = ctx.canInstall ? '<button class="btn sm" data-act="install">' + u.icon('install') + 'Install the app</button>'
        : '<p class="hint" style="margin-top:0">Android or desktop Chrome: browser menu, then Install app. iPhone or iPad: open in Safari, tap Share, then Add to Home Screen.</p>';
      var html = '<section class="sheet" aria-labelledby="h-more">' + u.band('More', 'Progress and settings', true) + '<div class="body"><h1 id="h-more">More</h1>' +
        (!store.persistOk ? '<p class="msg bad" role="alert">This browser is not saving progress (private window or blocked storage). Copy your progress code below to keep a copy.</p>' : '') +
        '<div class="more-grid"><div>' +
        '<h2 style="margin-top:20px">Undo and recent changes</h2><p class="lede">Pressed something by mistake? Undo it here, or reopen the topic from Courses.</p>' +
        '<div class="row-actions" style="margin:12px 0 4px"><button class="btn sm" data-act="undo"' + (store.canUndo() ? '' : ' disabled') + '>' + u.icon('undo') + 'Undo last</button><button class="btn ghost sm" data-act="redo"' + (store.canRedo() ? '' : ' disabled') + '>' + u.icon('redo') + 'Redo</button></div>' + recent +
        '<h2>Keep your progress safe</h2><p class="lede">Your ticks live in this browser only, and browsers sometimes clear that: iPhone Safari after about a week unused, any phone that runs very low on space. A backup code fixes all of it, and moves your ticks to another device.</p>' +
        '<ul class="plain-list"><li><b>Storage:</b> ' + esc(storageText) + '</li><li><b>Last backup:</b> ' + esc(ctx.backupInfo()) + '</li></ul>' +
        '<p class="code" id="code-text" style="margin-top:12px">' + esc(code) + '</p><div class="row-actions" style="margin-top:10px">' + (ctx.canShare ? '<button class="btn sm" data-act="share">' + u.icon('link') + 'Send to myself</button>' : '') + '<button class="btn' + (ctx.canShare ? ' ghost' : '') + ' sm" data-act="copy" data-what="code">' + u.icon('copy') + 'Copy code</button><button class="btn ghost sm" data-act="copy" data-what="link">' + u.icon('link') + 'Copy link</button></div>' +
        '<p class="hint">Paste it into Telegram Saved Messages or a note. To restore, open the link, or paste the code under Load progress below.</p>' +
        '<h2>Load progress from a code</h2><label class="hint" for="code-in" style="display:block;margin:0 0 6px">Paste the code from your other device.</label><textarea class="code" id="code-in" rows="3" spellcheck="false" autocapitalize="characters" autocomplete="off" placeholder="FE1-XXXX-XXXX-...">' + esc(imp.text) + '</textarea>' +
        '<div class="row-actions" style="margin-top:10px"><button class="btn sm" data-act="import-check">Check code</button></div>' + impBlock +
        '<h2>Start again</h2><p class="lede">Clear everything you have ticked or set aside on this device.</p>' + resetBlock + '</div><div>' +
        '<h2 style="margin-top:20px">Tear sound</h2><p class="lede">The tear-off when you press Done.</p><div class="seg" role="group" aria-label="Tear sound" style="margin-top:10px">' +
        FE.tear.tones.map(function (t) { return '<button data-act="tone" data-tone="' + t + '" aria-pressed="' + (t === tone) + '">' + t.charAt(0).toUpperCase() + t.slice(1) + '</button>'; }).join('') + '</div>' +
        '<h2>Install and offline</h2><p class="lede">' + esc(ctx.offlineText()) + '</p><div style="margin-top:10px">' + install + '</div>' +
        '<h2>How this plan works</h2><p class="lede">Each topic is sized in points, roughly focused hours: small 1, medium 2, large 3.5. A checkpoint is a set of topics due by a date. Pace is the points left divided by the days left. A day holds about ' + core.CAP + ' points.</p>' +
        '<ol class="rules" style="margin-top:14px">' + P.rules.map(function (r) { return '<li><span><b>' + esc(r.t) + '</b>' + rich(r.x) + '</span></li>'; }).join('') + '</ol>' +
        '<details class="details-box"><summary>Watch-outs in this plan</summary><div><ul class="watch">' + P.risks.map(function (r) { return '<li>' + rich(r.x) + '</li>'; }).join('') + '</ul></div></details>' +
        '<p class="fine">Terminus, plan version ' + esc(P.meta.version) + '. The plan is the same for everyone; ticks and set-aside topics stay on your own device. Tags come from counting the past papers: core is asked most, optional least.</p>' +
        '</div></div></div></section>';
      return { html: html, title: 'More' };
    }
    return { more: more };
  });
})(typeof window !== 'undefined' ? window : globalThis);
