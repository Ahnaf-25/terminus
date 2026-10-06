/* Terminus: the tear-off. A tear front travels along the perforation, right to left, one hole at a time.
   The stub right of the front is a flap hinged at the front and lifting toward you; the stub left of it is still flat.
   One list of snaps drives the motion, the ticks you hear and the buzz you feel. Sound is synthesised (no audio files). */
(function (root) {
  'use strict';

  var tone = 'soft', actx = null, bus = null, crack = null;
  var TONES = { soft: { hp: 700, rate: 0.62, gain: 0.1 }, crisp: { hp: 1800, rate: 0.9, gain: 0.14 } };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function ease(u) { return u * u * (3 - 2 * u); }

  function audio() {
    if (tone === 'off') return null;
    var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
    try {
      if (!actx) {
        actx = new AC();
        var lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 8000;
        bus = actx.createGain(); bus.gain.value = 0.9; bus.connect(lp); lp.connect(actx.destination);
        var sr = actx.sampleRate, n = Math.floor(sr * 0.03); crack = actx.createBuffer(1, n, sr);
        var d = crack.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (Math.exp(-i / (0.0007 * sr)) + 0.1 * Math.exp(-i / (0.009 * sr)));
      }
      if (actx.state === 'suspended') actx.resume();
    } catch (e) { return null; }
    return actx;
  }

  function ripSound(times) {
    var c = audio(); if (!c || !TONES[tone]) return;
    var T = TONES[tone], t0 = c.currentTime + 0.015;
    function tick(ms, amp) {
      var src = c.createBufferSource(); src.buffer = crack; src.playbackRate.value = T.rate * (0.7 + Math.random() * 0.6);
      var hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = T.hp * (0.6 + Math.random() * 0.8);
      var g = c.createGain(); g.gain.value = T.gain * amp * (0.4 + Math.random());
      src.connect(hp); hp.connect(g); g.connect(bus); src.start(t0 + Math.max(0, ms) / 1000);
    }
    times.forEach(function (ms, i) {
      var gap = i ? ms - times[i - 1] : 12;
      tick(ms + (Math.random() - 0.5) * gap * 0.9, Math.random() < 0.15 ? 1.6 : 1);
      if (Math.random() < 0.25) tick(ms + 2 + Math.random() * 4, 0.5);
    });
  }
  function flapSound() {
    if (!actx || tone === 'off') return;
    var c = actx, n = Math.floor(c.sampleRate * 0.12), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5);
    var src = c.createBufferSource(); src.buffer = buf;
    var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.7;
    var g = c.createGain(); g.gain.value = 0.06; src.connect(bp); bp.connect(g); g.connect(bus); src.start();
  }

  /* Tear `stub` (an li.stub inside ol.stubs inside .ticket). Resolves when the piece has left and the gap has closed. */
  function tear(stub, ticket) {
    return new Promise(function (resolve) {
      var tr = ticket.getBoundingClientRect(), sr = stub.getBoundingClientRect(), cs = getComputedStyle(stub);
      var W = sr.width, left = sr.left - tr.left, top = sr.top - tr.top, h = sr.height, hasBottom = !!stub.nextElementSibling;
      var padT = cs.paddingTop, padB = cs.paddingBottom;
      var xs = []; for (var x = W - 10; x >= 10; x -= 10) xs.push(x);
      var N = xs.length, D = 560, T0 = 90, acc = 0;
      var gaps = xs.map(function (x, i) { acc += (1.7 - 1.1 * i / N) * (0.65 + 0.7 * Math.abs(Math.sin(i * 12.9898))); return acc; });
      var snaps = xs.map(function (x, i) { return { t: T0 + gaps[i] / acc * D, x: x }; });
      var tEnd = T0 + D + 70, MAXA = 26, PERSP = 1400;

      var ghost = document.createElement('ol'); ghost.className = 'stubs';
      ghost.style.cssText = 'position:absolute;left:' + left + 'px;top:' + top + 'px;width:' + W + 'px;margin:0;padding:0;z-index:2;pointer-events:none';
      var flap = stub.cloneNode(true); flap.setAttribute('aria-hidden', 'true'); flap.inert = true;
      flap.querySelectorAll('[id]').forEach(function (e) { e.removeAttribute('id'); });
      flap.style.cssText = 'width:' + W + 'px;height:' + h + 'px;clip-path:inset(0 0 0 ' + W + 'px);transform-origin:' + W + 'px 50%';
      var sheen = document.createElement('div'), shade = document.createElement('div'); sheen.className = 'sheen'; shade.className = 'shade'; flap.append(shade, sheen);
      ghost.appendChild(flap);
      if (hasBottom) { var pad = document.createElement('li'); pad.style.display = 'none'; ghost.appendChild(pad); }
      ticket.appendChild(ghost);

      function fleck(x) {
        var el = document.createElement('i'); el.className = 'fleck'; el.style.left = (left + x) + 'px'; el.style.top = top + 'px'; ticket.appendChild(el);
        var vx = (Math.random() - 0.5) * 14, vy = 12 + Math.random() * 26;
        el.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: 'translate(' + vx + 'px,' + vy + 'px) rotate(' + ((Math.random() - 0.5) * 300) + 'deg)', opacity: 0 }],
          { duration: 420 + Math.random() * 260, easing: 'cubic-bezier(.2,.6,.4,1)' }).onfinish = function () { el.remove(); };
      }
      var finished = false, guard;
      function cleanup() {
        if (finished) return; finished = true; clearTimeout(guard);
        ticket.getAnimations().forEach(function (a) { a.cancel(); });
        ghost.remove(); ticket.querySelectorAll('.fleck').forEach(function (e) { e.remove(); });
        resolve();
      }
      guard = setTimeout(cleanup, tEnd + 1300);

      ripSound(snaps.map(function (q) { return q.t; }));
      ticket.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(0.12deg)' }], { duration: T0 + D, easing: 'ease-in-out', fill: 'forwards' });
      if (navigator.vibrate) { try { navigator.vibrate([8, 16, 8, 16, 8, 16, 8, 16, 8, 16, 8, 16, 8, 16, 8, 16, 8]); } catch (e) { /* not allowed here */ } }

      var hx = W, kick = 0, k = 0, flapped = false, last = performance.now(), t0 = last;
      function frame(now) {
        if (finished) return;
        var t = now - t0, dt = Math.max(1, now - last); last = now;
        while (k < N && snaps[k].t <= t) { kick += 0.18; if (Math.random() < 0.12) fleck(snaps[k].x); k++; }
        kick *= Math.exp(-dt / 80);
        var release = t >= tEnd;
        hx += ((release ? 0 : (k ? snaps[k - 1].x : W)) - hx) * (1 - Math.exp(-dt / 20));
        var pr = clamp((t - T0) / D, 0, 1), pw = clamp(pr + 0.03 * Math.sin(pr * 11), 0, 1);
        var ang = MAXA * ease(pw) + kick, lift = clamp(ang / MAXA, 0, 1), tf, op = 1;
        if (!release) {
          stub.style.clipPath = 'inset(0 ' + (W - hx).toFixed(1) + 'px 0 0)';
          flap.style.clipPath = 'inset(0 0 0 ' + hx.toFixed(1) + 'px)';
          flap.style.transformOrigin = hx.toFixed(1) + 'px 50%';
          tf = 'perspective(' + PERSP + 'px) rotateY(' + (-ang).toFixed(2) + 'deg)';
        } else {
          if (!flapped) {
            flapped = true; stub.style.visibility = 'hidden'; flap.style.clipPath = 'none'; flap.style.transformOrigin = '0 50%'; flapSound();
            flap.style.filter = 'drop-shadow(0 6px 8px rgba(0,0,0,.28))';
            // the vacated space closes as the piece leaves, so only the ticket is ever left on the desk
            stub.style.overflow = 'hidden';
            stub.animate([{ height: h + 'px', paddingTop: padT, paddingBottom: padB }, { height: '0px', paddingTop: '0px', paddingBottom: '0px' }],
              { duration: 340, delay: 60, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'both' });
            ticket.getAnimations().forEach(function (a) { a.cancel(); });
            ticket.animate([{ transform: 'rotate(0.12deg)' }, { transform: 'rotate(-0.07deg)', offset: 0.35 }, { transform: 'rotate(0)' }], { duration: 340, easing: 'ease-out' });
          }
          var r = clamp((t - tEnd) / 480, 0, 1), eo = 1 - (1 - r) * (1 - r);
          tf = 'translate(' + (72 * eo).toFixed(1) + 'px,' + (44 * eo).toFixed(1) + 'px) rotate(' + (5 * eo).toFixed(1) + 'deg) perspective(' + PERSP + 'px) rotateY(' + (-(MAXA + 14 * eo)).toFixed(2) + 'deg) scale(' + (1 + 0.05 * eo).toFixed(3) + ')';
          op = r < 0.78 ? 1 : 1 - (r - 0.78) / 0.22;
        }
        flap.style.transform = tf; flap.style.opacity = op;
        sheen.style.opacity = (0.34 * Math.sin(lift * Math.PI)).toFixed(2); sheen.style.backgroundPosition = (100 - lift * 100).toFixed(0) + '% 0';
        shade.style.opacity = (release ? 0.12 : 0.45 * lift).toFixed(2);
        if (t < tEnd + 500) requestAnimationFrame(frame); else cleanup();
      }
      requestAnimationFrame(frame);
    });
  }

  root.FE = root.FE || {};
  root.FE.tear = {
    run: tear,
    prime: function () { audio(); },                 // wake audio on the first touch so the tear never pays the start-up cost
    setTone: function (t, quiet) { tone = TONES[t] ? t : 'off'; if (tone !== 'off' && !quiet) audio(); },
    getTone: function () { return tone },
    tones: ['soft', 'crisp', 'off']
  };
})(typeof window !== 'undefined' ? window : globalThis);
