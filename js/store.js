/* Terminus: progress store. Done and set-aside topics, an append-only history with undo and redo,
   saving on the device, and the transfer code. No DOM here, so it runs under Node tests too. */
(function (root) {
  'use strict';

  var KEY = 'fe.v1', PREFS = 'fe.prefs', LOG_MAX = 100;

  /* ---------- transfer code ---------- */
  var ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';   // Crockford base32: no I, L, O, U
  function crc16(bytes) {
    var c = 0xFFFF;
    for (var i = 0; i < bytes.length; i++) {
      c ^= bytes[i] << 8;
      for (var k = 0; k < 8; k++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF;
    }
    return c;
  }
  function strBytes(s) { var out = []; for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 255); return out; }
  function b32(bytes) {
    var bits = 0, val = 0, out = '';
    for (var i = 0; i < bytes.length; i++) {
      val = (val << 8) | bytes[i]; bits += 8;
      while (bits >= 5) { out += ALPHA[(val >>> (bits - 5)) & 31]; bits -= 5; }
      val &= (1 << bits) - 1;
    }
    if (bits) out += ALPHA[(val << (5 - bits)) & 31];
    return out;
  }
  function unb32(s) {
    var bits = 0, val = 0, out = [];
    for (var i = 0; i < s.length; i++) {
      var v = ALPHA.indexOf(s[i]); if (v < 0) return null;
      val = (val << 5) | v; bits += 5;
      if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
      val &= (1 << bits) - 1;
    }
    return out;
  }

  function createStore(core, opts) {
    opts = opts || {};
    var ids = core.topics.map(function (t) { return t.id; });
    var known = {}; ids.forEach(function (i) { known[i] = 1; });
    var nb = Math.ceil(ids.length / 8);
    var planHash = crc16(strBytes(ids.join('|')));
    var now = opts.now || function () { return Date.now(); };
    var mem = {};
    var storage = opts.storage || (function () {
      try { var s = root.localStorage; s.setItem('fe.probe', '1'); s.removeItem('fe.probe'); return s; } catch (e) { return null; }
    })();
    var persistOk = !!storage;
    function read(k) { try { return storage ? storage.getItem(k) : (mem[k] || null); } catch (e) { persistOk = false; return mem[k] || null; } }
    function write(k, v) {
      mem[k] = v;
      try { if (storage) storage.setItem(k, v); } catch (e) { persistOk = false; }
    }

    var st = { done: new Set(), parked: new Set() }, log = [], seq = 0, subs = [], prefs = {};

    /* ---------- load and save ---------- */
    (function load() {
      try {
        var raw = read(KEY);
        if (raw) {
          var o = JSON.parse(raw);
          (o.done || []).forEach(function (i) { if (known[i]) st.done.add(i); });
          (o.parked || []).forEach(function (i) { if (known[i] && !st.done.has(i)) st.parked.add(i); });
          log = (o.log || []).filter(function (e) { return e && e.id; });
          seq = log.reduce(function (m, e) { return Math.max(m, e.id); }, 0);
        }
      } catch (e) { /* damaged data: start clean rather than crash */ }
      try { prefs = JSON.parse(read(PREFS) || '{}') || {}; } catch (e) { prefs = {}; }
    })();
    function save() {
      write(KEY, JSON.stringify({ v: 1, done: ids.filter(function (i) { return st.done.has(i); }), parked: ids.filter(function (i) { return st.parked.has(i); }), log: log.slice(-LOG_MAX) }));
    }
    function emit(kind, entry) { subs.slice().forEach(function (f) { try { f(kind, entry); } catch (e) { /* a view error must not break saving */ } }); }

    /* ---------- applying changes ---------- */
    function applyDiff(e, inverse) {
      var dA = inverse ? e.dD : e.dA, dD = inverse ? e.dA : e.dD, pA = inverse ? e.pD : e.pA, pD = inverse ? e.pA : e.pD;
      dA.forEach(function (i) { st.done.add(i); }); dD.forEach(function (i) { st.done.delete(i); });
      pA.forEach(function (i) { st.parked.add(i); }); pD.forEach(function (i) { st.parked.delete(i); });
      st.parked.forEach(function (i) { if (st.done.has(i)) st.parked.delete(i); });
    }
    function record(a, dA, dD, pA, pD) {
      if (!dA.length && !dD.length && !pA.length && !pD.length) return null;
      var e = { id: ++seq, t: now(), a: a, dA: dA, dD: dD, pA: pA, pD: pD, rev: 0 };
      applyDiff(e, false); log.push(e); if (log.length > LOG_MAX * 2) log = log.slice(-LOG_MAX);
      save(); emit('change', e); return e;
    }
    function setDone(list, on) {
      var dA = [], dD = [], pD = [];
      list.forEach(function (i) {
        if (!known[i]) return;
        if (on && !st.done.has(i)) { dA.push(i); if (st.parked.has(i)) pD.push(i); }
        if (!on && st.done.has(i)) dD.push(i);
      });
      return record(on ? 'done' : 'open', dA, dD, [], pD);
    }
    function setParked(list, on) {
      var pA = [], pD = [];
      list.forEach(function (i) {
        if (!known[i]) return;
        if (on && core.isOpen(st, i)) pA.push(i);
        if (!on && st.parked.has(i)) pD.push(i);
      });
      return record(on ? 'park' : 'unpark', [], [], pA, pD);
    }
    /* Replace everything (import, reset) as one entry, so one undo restores the previous progress. */
    function replaceAll(done, parked, kind) {
      var nd = new Set(done.filter(function (i) { return known[i]; })), np = new Set(parked.filter(function (i) { return known[i] && !nd.has(i); }));
      var dA = [], dD = [], pA = [], pD = [];
      ids.forEach(function (i) {
        if (nd.has(i) && !st.done.has(i)) dA.push(i); if (!nd.has(i) && st.done.has(i)) dD.push(i);
        if (np.has(i) && !st.parked.has(i)) pA.push(i); if (!np.has(i) && st.parked.has(i)) pD.push(i);
      });
      return record(kind || 'import', dA, dD, pA, pD);
    }

    /* ---------- undo and redo ---------- */
    function find(id) { for (var i = log.length - 1; i >= 0; i--) if (log[i].id === id) return log[i]; return null; }
    function reverse(id) {
      var e = find(id); if (!e || e.rev) return null;
      applyDiff(e, true); e.rev = 1; e.rt = now(); save(); emit('change', e); return e;
    }
    function reapply(id) {
      var e = find(id); if (!e || !e.rev) return null;
      applyDiff(e, false); e.rev = 0; e.rt = now(); save(); emit('change', e); return e;
    }
    function lastApplied() { for (var i = log.length - 1; i >= 0; i--) if (!log[i].rev) return log[i]; return null; }
    function lastReversed() {
      var best = null; log.forEach(function (e) { if (e.rev && (!best || (e.rt || 0) >= (best.rt || 0))) best = e; }); return best;
    }
    function undo() { var e = lastApplied(); return e ? reverse(e.id) : null; }
    function redo() { var e = lastReversed(); return e ? reapply(e.id) : null; }

    /* ---------- transfer code ---------- */
    function bitsOf(set) {
      var b = []; for (var k = 0; k < nb; k++) b.push(0);
      ids.forEach(function (i, n) { if (set.has(i)) b[n >> 3] |= 1 << (n & 7); });
      return b;
    }
    function exportCode() {
      var body = [1, planHash >> 8, planHash & 255].concat(bitsOf(st.done), bitsOf(st.parked));
      var c = crc16(body), s = b32(body.concat([c >> 8, c & 255]));
      var parts = []; for (var i = 0; i < s.length; i += 4) parts.push(s.slice(i, i + 4));
      return 'FE1-' + parts.join('-');
    }
    function parseCode(text) {
      var s = String(text || '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
      var m = s.match(/FE1[^A-Z0-9]*([A-Z0-9\- _]+)/); if (m) s = m[1];
      s = s.replace(/[^0-9A-Z]/g, '');
      if (!s) return { ok: false, error: 'empty' };
      var bytes = unb32(s);
      var want = 3 + nb * 2 + 2;
      if (!bytes || bytes.length < want) return { ok: false, error: 'short' };
      bytes = bytes.slice(0, want);
      var c = crc16(bytes.slice(0, want - 2));
      if (c !== ((bytes[want - 2] << 8) | bytes[want - 1])) return { ok: false, error: 'checksum' };
      if (bytes[0] !== 1) return { ok: false, error: 'version' };
      if (((bytes[1] << 8) | bytes[2]) !== planHash) return { ok: false, error: 'plan' };
      var done = [], parked = [];
      ids.forEach(function (i, n) {
        if (bytes[3 + (n >> 3)] & (1 << (n & 7))) done.push(i);
        else if (bytes[3 + nb + (n >> 3)] & (1 << (n & 7))) parked.push(i);
      });
      return { ok: true, done: done, parked: parked };
    }

    function setPref(k, v) { prefs[k] = v; write(PREFS, JSON.stringify(prefs)); }

    return {
      state: st, get log() { return log; }, get persistOk() { return persistOk; },
      isDone: function (i) { return st.done.has(i); }, isParked: function (i) { return st.parked.has(i); },
      setDone: setDone, setParked: setParked, replaceAll: replaceAll,
      reset: function () { return replaceAll([], [], 'reset'); },
      undo: undo, redo: redo, reverse: reverse, reapply: reapply,
      canUndo: function () { return !!lastApplied(); }, canRedo: function () { return !!lastReversed(); },
      lastApplied: lastApplied, find: find,
      exportCode: exportCode, parseCode: parseCode,
      getPref: function (k, d) { return prefs[k] === undefined ? d : prefs[k]; }, setPref: setPref,
      subscribe: function (f) { subs.push(f); return function () { subs = subs.filter(function (x) { return x !== f; }); }; },
      planHash: planHash
    };
  }

  root.FE = root.FE || {};
  root.FE.createStore = createStore;
  if (typeof module !== 'undefined' && module.exports) module.exports = createStore;
})(typeof window !== 'undefined' ? window : globalThis);
