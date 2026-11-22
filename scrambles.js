/* =========================================================================
   Cube Arena — events & scramble engines
   Pure functions only (no DOM). Deterministic for a given seed so that a
   battle link reproduces the exact same five scrambles on every device.
   ========================================================================= */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------- RNG -- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashStr(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function randomSeed() {
    return Math.floor(Math.random() * 0x7fffffff);
  }

  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

  /* ------------------------------------------------------------- events -- */
  /* format: ao5 = average of 5, mo3 = mean of 3, single = best of attempts */
  const EVENTS = [
    {
      id: 'fto', name: 'FTO', ko: '정팔면체', en: 'Octahedron', group: 'new',
      badge: 'NEW 2027', badgeKind: 'new', format: 'ao5', preview: 'fto',
      gen: 'fto', xp: 18, hot: true,
      note: '2027 시즌부터 WCA 공식 종목. 25수 스크램블 · Ao5'
    },
    {
      id: 'clock', name: 'Clock', ko: '클락 · 레거시', en: 'Clock · legacy', group: 'new',
      badge: '~2027.07', badgeKind: 'legacy', format: 'ao5', preview: 'clock',
      gen: 'clock', xp: 14,
      note: '2027년 7월까지 공식 종목. 굿바이 클락!'
    },
    { id: '333', name: '3x3x3', ko: '333', en: '3x3', group: 'cube', format: 'ao5', preview: 'cube3', gen: 'cube3', xp: 10 },
    { id: '222', name: '2x2x2', ko: '222', en: '2x2', group: 'cube', format: 'ao5', preview: 'cube2', gen: 'cube2', xp: 8 },
    { id: '444', name: '4x4x4', ko: '444', en: '4x4', group: 'cube', format: 'ao5', preview: 'cube4', gen: 'cube4', xp: 12 },
    { id: '555', name: '5x5x5', ko: '555', en: '5x5', group: 'big', format: 'ao5', gen: 'cube5', xp: 14 },
    { id: '666', name: '6x6x6', ko: '666', en: '6x6', group: 'big', format: 'mo3', gen: 'cube6', xp: 16 },
    { id: '777', name: '7x7x7', ko: '777', en: '7x7', group: 'big', format: 'mo3', gen: 'cube7', xp: 18 },
    { id: '333oh', name: '3x3 OH', ko: '한손', en: 'One-handed', group: 'cube', format: 'ao5', gen: 'cube3', xp: 12 },
    { id: '333bf', name: '3x3 BLD', ko: '눈감고 맞추기', en: 'Blindfolded', group: 'blind', format: 'single', gen: 'cube3', xp: 22 },
    { id: '333fm', name: '3x3 FMC', ko: '최소 회전수', en: 'Fewest moves', group: 'other', format: 'mo3', gen: 'fmc', xp: 20 },
    { id: '333mbf', name: '3x3 MBLD', ko: '다중 블라인드', en: 'Multi-blind', group: 'blind', format: 'single', gen: 'mbld', xp: 24 },
    { id: 'pyram', name: 'Pyraminx', ko: '피라밍크스', en: 'Pyraminx', group: 'other', format: 'ao5', preview: 'pyra', gen: 'pyra', xp: 8 },
    { id: 'skewb', name: 'Skewb', ko: '스큐브', en: 'Skewb', group: 'other', format: 'ao5', preview: 'skewb', gen: 'skewb', xp: 8 },
    { id: 'sq1', name: 'Square-1', ko: '스퀘어원', en: 'Square-1', group: 'other', format: 'ao5', gen: 'sq1', xp: 14 },
    { id: 'minx', name: 'Megaminx', ko: '메가밍크스', en: 'Megaminx', group: 'other', format: 'ao5', gen: 'minx', xp: 16 },
    { id: '444bf', name: '4x4 BLD', ko: '4x4 눈감고', en: '4x4 blind', group: 'blind', format: 'single', gen: 'cube4', xp: 26 },
    { id: '555bf', name: '5x5 BLD', ko: '5x5 눈감고', en: '5x5 blind', group: 'blind', format: 'single', gen: 'cube5', xp: 30 }
  ];

  const BY_ID = {};
  EVENTS.forEach((e) => (BY_ID[e.id] = e));

  /* -------------------------------------------------------- generators -- */
  const AXIS = { U: 'y', D: 'y', L: 'x', R: 'x', F: 'z', B: 'z' };

  /* {p: layer prefix, w: wide marker} -> "3Rw", "2R", "R" */
  function widthsFor(n) {
    if (n <= 3) return [{ p: '', w: '' }];
    if (n === 4) return [{ p: '', w: '' }, { p: '', w: 'w' }, { p: '', w: 'w' }];
    if (n === 5) return [{ p: '', w: '' }, { p: '', w: 'w' }, { p: '', w: 'w' }, { p: '3', w: 'w' }];
    if (n === 6) return [{ p: '', w: '' }, { p: '2', w: '' }, { p: '', w: 'w' }, { p: '', w: 'w' }, { p: '3', w: 'w' }];
    return [{ p: '', w: '' }, { p: '2', w: '' }, { p: '3', w: '' }, { p: '', w: 'w' }, { p: '3', w: 'w' }];
  }

  /* Generic NxN random-move scramble: no repeated face, no three moves on
     one axis in a row (the classic "R L R" cancellation guard). */
  function cubeScramble(n, len, rng) {
    const faces = ['U', 'D', 'L', 'R', 'F', 'B'];
    const widths = widthsFor(n);
    const out = [];
    let prevFace = '';
    let axis1 = '';
    let axis2 = '';
    let guard = 0;
    while (out.length < len && guard++ < 8000) {
      const f = pick(rng, faces);
      const ax = AXIS[f];
      if (f === prevFace) continue;
      if (ax === axis1 && ax === axis2) continue;
      const w = pick(rng, widths);
      const suf = pick(rng, ['', '', "'", '2']);
      out.push(w.p + f + w.w + suf);
      axis2 = axis1;
      axis1 = ax;
      prevFace = f;
    }
    return out.join(' ');
  }

  function pyraScramble(rng) {
    const faces = ['U', 'L', 'R', 'B'];
    const out = [];
    let prev = '';
    for (let i = 0; i < 11; i++) {
      let f;
      do {
        f = pick(rng, faces);
      } while (f === prev);
      prev = f;
      out.push(f + pick(rng, ['', '', "'"]));
    }
    ['u', 'l', 'r', 'b'].forEach((t) => {
      if (rng() < 0.75) out.push(t + pick(rng, ['', "'"]));
    });
    return out.join(' ');
  }

  function skewbScramble(rng) {
    const faces = ['R', 'U', 'L', 'B'];
    const out = [];
    let prev = '';
    for (let i = 0; i < 11; i++) {
      let f;
      do {
        f = pick(rng, faces);
      } while (f === prev);
      prev = f;
      out.push(f + pick(rng, ['', '', "'"]));
    }
    return out.join(' ');
  }

  function sq1Scramble(rng) {
    const parts = [];
    for (let i = 0; i < 12; i++) {
      let a = 0;
      let b = 0;
      do {
        a = Math.floor(rng() * 12) - 5;
        b = Math.floor(rng() * 12) - 5;
      } while (a === 0 && b === 0);
      parts.push('(' + a + ',' + b + ')');
    }
    return parts.join('/') + '/';
  }

  function minxScramble(rng) {
    const lines = [];
    for (let l = 0; l < 7; l++) {
      let s = '';
      for (let i = 0; i < 5; i++) {
        s += 'R' + (rng() < 0.5 ? '++' : '--') + ' ';
        s += 'D' + (rng() < 0.5 ? '++' : '--') + ' ';
      }
      s += l === 4 ? 'U' : "U'";
      lines.push(s.trim());
    }
    return lines;
  }

  const FTO_FACES = ['U', 'D', 'F', 'B', 'L', 'R', 'BL', 'BR'];

  function ftoScramble(rng) {
    const out = [];
    let prev = '';
    for (let i = 0; i < 25; i++) {
      let f;
      do {
        f = pick(rng, FTO_FACES);
      } while (f === prev);
      prev = f;
      out.push(f + pick(rng, ['', '', "'", '2']));
    }
    return out.join(' ');
  }

  /* Clock: the official shape is nine turns on the front side (one per pin
     configuration) around a y2, then five on the back side (U R D L ALL). */
  const CLOCK_FRONT = ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'];
  const CLOCK_BACK = ['U', 'R', 'D', 'L', 'ALL'];

  function clockToken(rng, name) {
    const n = Math.floor(rng() * 7);
    const sign = rng() < 0.5 ? '+' : '-';
    return name + n + sign;
  }

  function clockScramble(rng) {
    const front = CLOCK_FRONT.map((name) => clockToken(rng, name));
    const back = CLOCK_BACK.map((name) => clockToken(rng, name));
    return front.join(' ') + ' y2 ' + back.join(' ');
  }

  /* ------------------------------------------------------------ lookup -- */
  function scrambleFor(id, seed) {
    const ev = BY_ID[id];
    const rng = mulberry32((seed >>> 0) || 1);
    const lines = [];
    let text = '';
    switch (ev.gen) {
      case 'cube2':
        text = cubeScramble(2, 11, rng);
        break;
      case 'cube3':
        text = cubeScramble(3, 20, rng);
        break;
      case 'cube4':
        text = cubeScramble(4, 40, rng);
        break;
      case 'cube5':
        text = cubeScramble(5, 60, rng);
        break;
      case 'cube6':
        text = cubeScramble(6, 80, rng);
        break;
      case 'cube7':
        text = cubeScramble(7, 100, rng);
        break;
      case 'fmc':
        text = "R' U' F " + cubeScramble(3, 20, rng) + " R' U' F";
        break;
      case 'mbld':
        for (let i = 0; i < 3; i++) lines.push('#' + (i + 1) + '  ' + cubeScramble(3, 20, rng));
        text = lines.join('\n');
        break;
      case 'pyra':
        text = pyraScramble(rng);
        break;
      case 'skewb':
        text = skewbScramble(rng);
        break;
      case 'sq1':
        text = sq1Scramble(rng);
        break;
      case 'minx':
        lines.push.apply(lines, minxScramble(rng));
        text = lines.join('\n');
        break;
      case 'clock':
        text = clockScramble(rng);
        break;
      case 'fto':
        text = ftoScramble(rng);
        break;
      default:
        text = cubeScramble(3, 20, rng);
    }
    return { event: ev, text: text, lines: lines.length ? lines : [text] };
  }

  global.CA = global.CA || {};
  global.CA.SCRAMBLE = {
    EVENTS: EVENTS,
    BY_ID: BY_ID,
    mulberry32: mulberry32,
    hashStr: hashStr,
    randomSeed: randomSeed,
    scrambleFor: scrambleFor,
    cubeScramble: cubeScramble
  };
})(window);
