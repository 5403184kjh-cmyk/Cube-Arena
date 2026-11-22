/* =========================================================================
   Cube Arena — app logic
   Everything is stored in localStorage. No server, no build step.
   ========================================================================= */
(function () {
  'use strict';

  const SCR = window.CA.SCRAMBLE;
  const PZ = window.CA.PUZZLE;
  const EVENTS = SCR.EVENTS;
  const BY_ID = SCR.BY_ID;

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const DNF = Infinity;

  /* =============================================================== state == */
  const KEY = 'cubeArena.v1';

  function defaults() {
    return {
      v: 1,
      settings: {
        theme: 'dark',
        sound: true,
        inspection: true,
        preview: true,
        holdMs: 300,
        event: '333'
      },
      profile: { name: 'Cuber', xp: 0 },
      records: {},
      quests: { date: '', items: [], todayEvents: {}, streak: 0, claimed: [] },
      ach: {},
      stats: { solves: 0, pbs: 0, xpTotal: 0, events: {} },
      battle: null,
      minigame: { clockBest: null, chalBest: null, chalLevel: 1 },
      flags: {}
    };
  }

  let S = load();

  function load() {
    const base = defaults();
    let raw = null;
    try {
      raw = JSON.parse(localStorage.getItem(KEY));
    } catch (e) {
      raw = null;
    }
    if (!raw || typeof raw !== 'object') return base;
    const out = Object.assign(base, raw);
    out.settings = Object.assign(base.settings, raw.settings || {});
    out.profile = Object.assign(base.profile, raw.profile || {});
    out.stats = Object.assign(base.stats, raw.stats || {});
    out.quests = Object.assign(base.quests, raw.quests || {});
    out.minigame = Object.assign(base.minigame, raw.minigame || {});
    out.records = raw.records && typeof raw.records === 'object' ? raw.records : {};
    out.ach = raw.ach && typeof raw.ach === 'object' ? raw.ach : {};
    return out;
  }

  let saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(S));
      } catch (e) {
        /* storage full or blocked — the session still works */
      }
    }, 120);
  }

  /* ============================================================== helpers == */
  function fmt(ms) {
    if (ms == null) return '—';
    if (ms === DNF) return 'DNF';
    const t = Math.max(0, ms);
    if (t < 60000) return (t / 1000).toFixed(2);
    const m = Math.floor(t / 60000);
    const s = (t % 60000) / 1000;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
  }

  function eff(rec) {
    if (!rec) return DNF;
    if (rec.pen === 'dnf') return DNF;
    return rec.ms + (rec.pen === '+2' ? 2000 : 0);
  }

  /* WCA trimming: drop the same number of best and worst results on each side.
     Ao5/Ao12 -> 1, Ao50 -> 3, Ao100 -> 5 (5%), mean of 3 -> 0.  Two or more
     DNFs left in the middle make the whole average a DNF. */
  function trimCount(n) {
    if (n < 5) return 0;
    if (n <= 12) return 1;
    if (n <= 50) return 3;
    return 5;
  }

  function averageOf(recs, n) {
    if (!recs || recs.length < n) return null;
    const last = recs.slice(-n).map(eff);
    const sorted = last.slice().sort((a, b) => a - b);
    const t = trimCount(n);
    const mid = sorted.slice(t, n - t);
    if (!mid.length) return null;
    if (mid.some((v) => v === DNF)) return DNF;
    return Math.round(mid.reduce((a, b) => a + b, 0) / mid.length);
  }

  function bestOf(recs) {
    if (!recs || !recs.length) return null;
    let b = null;
    recs.forEach((r) => {
      const v = eff(r);
      if (v !== DNF && (b === null || v < b)) b = v;
    });
    return b;
  }

  function meanOf(recs) {
    if (!recs || !recs.length) return null;
    let sum = 0;
    let n = 0;
    recs.forEach((r) => {
      const v = eff(r);
      if (v !== DNF) {
        sum += v;
        n++;
      }
    });
    return n ? Math.round(sum / n) : null;
  }

  function todayStr(d) {
    const t = d || new Date();
    const p = (x) => (x < 10 ? '0' + x : '' + x);
    return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate());
  }

  /* --------------------------------------------------------------- tiers -- */
  /* Thresholds are best-single times (ms) for World Class, Grandmaster,
     Master, Pro, Challenger — anything slower is Rookie. */
  const TIER_TIMES = {
    '333': [6500, 8500, 10500, 14000, 20000],
    '222': [1300, 1800, 2400, 3200, 4500],
    '444': [24000, 30000, 38000, 50000, 70000],
    '555': [45000, 58000, 72000, 95000, 130000],
    '666': [95000, 120000, 150000, 190000, 260000],
    '777': [140000, 175000, 220000, 280000, 380000],
    '333oh': [10000, 13000, 16000, 21000, 30000],
    '333bf': [25000, 35000, 50000, 80000, 150000],
    '333fm': [24, 27, 30, 36, 45],
    'pyram': [1800, 2400, 3200, 4500, 7000],
    'skewb': [1800, 2400, 3200, 4500, 7000],
    'sq1': [7000, 10000, 13000, 18000, 28000],
    'minx': [40000, 55000, 70000, 95000, 130000],
    'clock': [3600, 4500, 5500, 7000, 10000],
    '444bf': [120000, 180000, 300000, 480000, 900000],
    '555bf': [240000, 360000, 600000, 900000, 1800000],
    'fto': [12000, 16000, 22000, 30000, 45000]
  };
  const TIER_NAMES = ['Rookie', 'Challenger', 'Pro', 'Master', 'Grandmaster', 'World Class'];

  function tierFor(evId, ms) {
    const t = TIER_TIMES[evId];
    if (!t) return null;
    if (ms == null) {
      return { level: 0, name: 'Rookie', pct: 0, gap: null, next: 'Challenger' };
    }
    for (let lvl = 5; lvl >= 1; lvl--) {
      const at = t[5 - lvl];
      if (ms <= at) {
        const nextAt = lvl < 5 ? t[5 - (lvl + 1)] : null;
        const gap = nextAt == null ? null : ms - nextAt;
        const from = lvl < 5 ? at : at;
        const pct = lvl === 5 ? 100 : clamp(Math.round(((from - ms) / (from - nextAt)) * 100), 2, 99);
        return { level: lvl, name: TIER_NAMES[lvl], pct: pct, gap: gap, next: lvl < 5 ? TIER_NAMES[lvl + 1] : null };
      }
    }
    const from = t[4] * 1.7;
    const to = t[4];
    return {
      level: 0,
      name: 'Rookie',
      pct: clamp(Math.round(((from - ms) / (from - to)) * 100), 0, 96),
      gap: ms - to,
      next: 'Challenger'
    };
  }

  function fmtGap(ms) {
    if (ms == null) return '';
    const v = Math.abs(ms);
    if (v < 60000) return (v / 1000).toFixed(2) + 's';
    return Math.floor(v / 60000) + ':' + ((v % 60000) / 1000).toFixed(2).padStart(5, '0');
  }

  /* ================================================================ sound == */
  const Sound = {
    ctx: null,
    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        try {
          this.ctx = new AC();
        } catch (e) {
          this.ctx = null;
        }
      }
    },
    tone(freq, dur, type, vol, delay) {
      if (!S.settings.sound) return;
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t0 = this.ctx.currentTime + (delay || 0);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol == null ? 0.07 : vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.04);
    },
    ready() {
      this.tone(880, 0.05, 'triangle', 0.05);
    },
    start() {
      this.tone(520, 0.06, 'square', 0.035);
    },
    stop() {
      this.tone(220, 0.11, 'sine', 0.05);
    },
    tick() {
      this.tone(1200, 0.03, 'sine', 0.03);
    },
    bad() {
      this.tone(160, 0.16, 'sawtooth', 0.05);
    },
    pb() {
      [660, 880, 1180].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.06, i * 0.085));
    },
    level() {
      [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.055, i * 0.09));
    },
    win() {
      [784, 988, 1318].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.06, i * 0.1));
    }
  };

  /* ============================================================= confetti == */
  const Confetti = {
    canvas: null,
    ctx: null,
    parts: [],
    raf: 0,
    init() {
      this.canvas = $('#confetti');
      this.ctx = this.canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize());
    },
    resize() {
      if (!this.canvas) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.floor(window.innerWidth * dpr);
      this.canvas.height = Math.floor(window.innerHeight * dpr);
      this.canvas.style.width = window.innerWidth + 'px';
      this.canvas.style.height = window.innerHeight + 'px';
      if (this.ctx) this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
    fire(count) {
      if (!this.ctx) return;
      const W = window.innerWidth;
      const colors = ['#22d3ee', '#a855f7', '#f472b6', '#34d399', '#fbbf24', '#f4f7ff'];
      const n = count || 90;
      for (let i = 0; i < n; i++) {
        this.parts.push({
          x: W / 2 + (Math.random() - 0.5) * W * 0.5,
          y: window.innerHeight * 0.32 + (Math.random() - 0.5) * 60,
          vx: (Math.random() - 0.5) * 9,
          vy: -Math.random() * 11 - 3,
          w: 4 + Math.random() * 6,
          h: 7 + Math.random() * 9,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.35,
          c: colors[(Math.random() * colors.length) | 0],
          life: 1
        });
      }
      if (!this.raf) this.loop();
    },
    loop() {
      const ctx = this.ctx;
      if (!ctx) return;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const alive = [];
      this.parts.forEach((p) => {
        p.vy += 0.32;
        p.vx *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 0.006;
        if (p.life > 0 && p.y < window.innerHeight + 60) {
          alive.push(p);
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.c;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      });
      this.parts = alive;
      if (alive.length) {
        this.raf = requestAnimationFrame(() => this.loop());
      } else {
        this.raf = 0;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    }
  };

  /* ================================================================ toast == */
  function toast(msg, kind, icon) {
    const box = $('#toasts');
    const t = h('div', 'toast' + (kind ? ' ' + kind : ''));
    if (icon) t.appendChild(h('span', 't-ico', icon));
    t.appendChild(h('span', null, msg));
    box.appendChild(t);
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 300);
    }, 2600);
    while (box.children.length > 4) box.firstChild.remove();
  }

  /* ================================================================== xp == */
  function needFor(level) {
    return 100 + (level - 1) * 60;
  }
  function levelInfo(xp) {
    let level = 1;
    let rem = Math.max(0, xp | 0);
    while (rem >= needFor(level) && level < 500) {
      rem -= needFor(level);
      level++;
    }
    const need = needFor(level);
    return { level: level, into: rem, need: need, pct: Math.round((rem / need) * 100) };
  }

  function addXp(amount, quiet) {
    if (!amount) return;
    const before = levelInfo(S.profile.xp).level;
    S.profile.xp = (S.profile.xp | 0) + amount;
    S.stats.xpTotal = (S.stats.xpTotal | 0) + amount;
    const after = levelInfo(S.profile.xp);
    renderHud();
    if (!quiet) toast('+' + amount + ' XP', null, '⭐');
    if (after.level > before) {
      toast('레벨 업! Lv.' + after.level, 'good', '🎖');
      Sound.level();
      Confetti.fire(70);
    }
    checkAchievements();
    save();
  }

  /* ================================================================ timer == */
  function createTimer(cfg) {
    const st = {
      state: 'idle',
      ready: false,
      inspecting: false,
      inspStart: 0,
      start: 0,
      ms: 0,
      pen: null,
      raf: 0,
      iraf: 0,
      holdTimer: 0,
      beeps: {},
      splits: [],
      splitPress: false
    };

    function paint() {
      cfg.pad.dataset.state = st.state;
    }
    function showTime(ms) {
      cfg.time.textContent = ms == null ? '0.00' : fmt(ms);
    }
    function inspectTick() {
      if (!st.inspecting) return;
      const sec = (performance.now() - st.inspStart) / 1000;
      const left = 15 - sec;
      if (cfg.overlay) {
        cfg.overlay.hidden = false;
        cfg.overlay.textContent = left > 0 ? String(Math.ceil(left)) : sec > 17 ? 'DNF' : '+2';
        cfg.overlay.dataset.warn = sec >= 15 ? '3' : sec >= 8 ? '2' : '1';
      }
      if (sec >= 8 && !st.beeps.a) {
        st.beeps.a = 1;
        Sound.tone(700, 0.07, 'sine', 0.05);
      }
      if (sec >= 12 && !st.beeps.b) {
        st.beeps.b = 1;
        Sound.tone(760, 0.07, 'sine', 0.05);
        setTimeout(() => Sound.tone(760, 0.07, 'sine', 0.05), 150);
      }
      if (sec >= 15 && !st.beeps.c) {
        st.beeps.c = 1;
        Sound.tone(300, 0.28, 'sawtooth', 0.05);
      }
      st.iraf = requestAnimationFrame(inspectTick);
    }
    function startInspection() {
      st.inspecting = true;
      st.inspStart = performance.now();
      st.beeps = {};
      if (cfg.overlay) {
        cfg.overlay.hidden = false;
        cfg.overlay.textContent = '15';
        cfg.overlay.dataset.warn = '1';
      }
      cancelAnimationFrame(st.iraf);
      st.iraf = requestAnimationFrame(inspectTick);
    }
    function hideInspection() {
      cancelAnimationFrame(st.iraf);
      if (cfg.overlay) cfg.overlay.hidden = true;
    }
    function begin() {
      if (st.inspecting) {
        const sec = (performance.now() - st.inspStart) / 1000;
        st.pen = sec > 17 ? 'dnf' : sec > 15 ? '+2' : null;
        if (st.pen === '+2') toast('인스펙션 초과 +2', 'good', '⏱');
        if (st.pen === 'dnf') toast('인스펙션 초과 DNF', 'good', '⏱');
      } else {
        st.pen = null;
      }
      st.inspecting = false;
      hideInspection();
      st.state = 'running';
      st.ready = false;
      st.ms = 0;
      st.splits = [];
      st.start = performance.now();
      paint();
      showTime(0);
      Sound.start();
      if (cfg.onStart) cfg.onStart();
      cancelAnimationFrame(st.raf);
      const loop = () => {
        st.ms = performance.now() - st.start;
        cfg.time.textContent = fmt(st.ms);
        st.raf = requestAnimationFrame(loop);
      };
      st.raf = requestAnimationFrame(loop);
    }
    function finish() {
      cancelAnimationFrame(st.raf);
      st.ms = performance.now() - st.start;
      st.state = 'done';
      cfg.time.textContent = fmt(st.ms);
      paint();
      Sound.stop();
      const marks = st.splits.slice();
      let segs = null;
      if (marks.length) segs = splitSegments(marks.concat([st.ms]));
      const res = { ms: Math.round(st.ms), pen: st.pen, splits: segs };
      st.splits = [];
      st.pen = null;
      st.inspecting = false;
      hideInspection();
      st.ready = false;
      if (cfg.onFinish) cfg.onFinish(res);
    }
    function press() {
      if (st.state === 'running') {
        if (cfg.allowSplit && cfg.allowSplit() && st.splits.length < 3) {
          st.splits.push(performance.now() - st.start);
          st.splitPress = true;
          if (cfg.onSplit) cfg.onSplit(splitSegments(st.splits), st.splits.length);
          Sound.tick();
          return;
        }
        finish();
        return;
      }
      if (st.state === 'done') {
        st.state = 'idle';
        showTime(0);
      }
      if (S.settings.inspection && !cfg.noInspection && !st.inspecting && st.state !== 'holding') startInspection();
      if (st.ready) {
        paint();
        return;
      }
      st.state = 'holding';
      paint();
      clearTimeout(st.holdTimer);
      st.holdTimer = setTimeout(() => {
        if (st.state !== 'holding') return;
        st.ready = true;
        st.state = 'ready';
        paint();
        Sound.ready();
      }, clamp(S.settings.holdMs || 300, 120, 2000));
    }
    function release() {
      clearTimeout(st.holdTimer);
      if (st.splitPress) {
        st.splitPress = false;
        return;
      }
      if (st.state === 'running') {
        finish();
        return;
      }
      if (st.state === 'ready') {
        begin();
        return;
      }
      st.ready = false;
      if (st.inspecting) {
        st.state = 'inspecting';
      } else {
        st.state = 'idle';
      }
      paint();
    }
    function reset() {
      clearTimeout(st.holdTimer);
      cancelAnimationFrame(st.raf);
      st.inspecting = false;
      st.ready = false;
      st.state = 'idle';
      st.ms = 0;
      st.pen = null;
      hideInspection();
      paint();
      showTime(0);
    }
    return {
      press: press,
      release: release,
      reset: reset,
      isBusy: () => st.state === 'running' || st.state === 'holding' || st.state === 'ready' || st.inspecting,
      isRunning: () => st.state === 'running'
    };
  }

  function splitSegments(marks) {
    return marks.map((v, i) => Math.round(v - (i ? marks[i - 1] : 0)));
  }

  /* ============================================================= records == */
  function recsOf(evId) {
    return S.records[evId] || [];
  }

  function evStats(evId) {
    const r = recsOf(evId);
    return { count: r.length, best: bestOf(r), ao5: averageOf(r, 5), ao12: averageOf(r, 12), mean: meanOf(r) };
  }

  /* ============================================================ scramble == */
  let current = null;

  function newScramble(evId) {
    const id = evId || S.settings.event;
    current = SCR.scrambleFor(id, SCR.randomSeed());
    renderScramble();
  }

  function renderScramble() {
    if (!current) return;
    const ev = BY_ID[current.event.id];
    $('#scrambleText').textContent = current.text;
    renderPreview(ev);
  }

  function renderPreview(ev) {
    const box = $('#previewBox');
    box.innerHTML = '';
    if (!ev.preview) return;
    if (!S.settings.preview) return;
    if (ev.preview === 'clock') {
      const c = new PZ.ClockPuzzle().applyScramble(current.text);
      box.innerHTML = PZ.clockSVG(c);
    } else {
      const colors = PZ.scrambleState(ev.preview, current.text);
      box.innerHTML = PZ.svgFor(ev.preview, colors, { size: 300 });
    }
  }

  /* ======================================================= solve handling == */
  function onSolve(res) {
    const evId = S.settings.event;
    const before = recsOf(evId).slice();
    const prevBest = bestOf(before);
    const rec = { ms: res.ms, pen: res.pen || null, ts: Date.now(), scr: current ? current.text : '' };
    if (res.splits && res.splits.length) rec.splits = res.splits;
    (S.records[evId] = S.records[evId] || []).push(rec);
    S.stats.solves = (S.stats.solves | 0) + 1;
    S.stats.events = S.stats.events || {};
    S.stats.events[evId] = (S.stats.events[evId] | 0) + 1;

    const value = eff(rec);
    const isPb = value !== DNF && (prevBest === null || value < prevBest);
    if (isPb) {
      S.stats.pbs = (S.stats.pbs | 0) + 1;
      Confetti.fire(110);
      Sound.pb();
      toast('새 PB! ' + fmt(value) + ' · ' + BY_ID[evId].name, 'pb', '🏆');
    }

    const ev = BY_ID[evId];
    addXp(ev.xp || 10, !!isPb);
    questOnSolve(evId, value);
    checkAchievements();

    lastSplits = res.splits && res.splits.length ? res.splits : lastSplits;
    renderSolveList();
    renderStatsStrip();
    renderChart();
    renderSplitBar(null);
    renderQuests();
    renderHud();
    if (viewNow === 'stats') renderStats();
    save();

    setTimeout(() => {
      if (!timer.isBusy()) newScramble();
    }, 620);
  }

  function renderSolveList() {
    const evId = S.settings.event;
    const list = $('#solveList');
    const recs = recsOf(evId);
    $('#solveCount').textContent = recs.length ? '(' + recs.length + ')' : '';
    const pb = bestOf(recs);
    list.innerHTML = '';
    let shown = 0;
    for (let i = recs.length - 1; i >= 0 && shown < 40; i--, shown++) {
      const r = recs[i];
      const row = h('li', 'solve-row');
      row.appendChild(h('span', 's-idx', '#' + (i + 1)));
      const t = h('span', 's-time', fmt(eff(r)));
      if (r.pen === 'dnf') t.className = 's-time dnf';
      else if (r.pen === '+2') t.className = 's-time plus2';
      row.appendChild(t);
      if (eff(r) === pb && pb !== null) row.appendChild(h('span', 's-badge', 'PB'));
      row.appendChild(h('span', 's-spacer'));
      const b2 = h('button', 's-btn' + (r.pen === '+2' ? ' on' : ''), '+2');
      b2.type = 'button';
      b2.dataset.act = 'plus2';
      b2.dataset.i = String(i);
      b2.setAttribute('aria-label', '+2 페널티');
      const bd = h('button', 's-btn' + (r.pen === 'dnf' ? ' on' : ''), 'DNF');
      bd.type = 'button';
      bd.dataset.act = 'dnf';
      bd.dataset.i = String(i);
      bd.setAttribute('aria-label', 'DNF 처리');
      const bx = h('button', 's-btn', '✕');
      bx.type = 'button';
      bx.dataset.act = 'del';
      bx.dataset.i = String(i);
      bx.setAttribute('aria-label', '기록 삭제');
      row.append(b2, bd, bx);
      list.appendChild(row);
    }
  }

  function renderStatsStrip() {
    const r = recsOf(S.settings.event);
    const put = (sel, v) => {
      $(sel).textContent = v === null ? '—' : fmt(v);
    };
    put('#stAo5', averageOf(r, 5));
    put('#stAo12', averageOf(r, 12));
    put('#stAo50', averageOf(r, 50));
    put('#stAo100', averageOf(r, 100));
    const best = bestOf(r);
    $('#stBest').textContent = best === null ? '—' : fmt(best);
    $('#stBest').classList.toggle('pb', best !== null);
    put('#stMean', meanOf(r));
    renderTier();
  }

  function renderTier() {
    const badge = $('#tierBadge');
    if (!badge) return;
    const best = bestOf(recsOf(S.settings.event));
    const ti = tierFor(S.settings.event, best);
    if (!ti) {
      badge.textContent = '—';
      badge.dataset.tier = '0';
      $('#tierFill').style.width = '0%';
      $('#tierNext').textContent = '이 종목은 티어 기준이 없어요';
      $('#tierPb').textContent = best == null ? '—' : fmt(best);
      return;
    }
    badge.textContent = ti.name.toUpperCase();
    badge.dataset.tier = String(ti.level);
    $('#tierFill').style.width = ti.pct + '%';
    $('#tierPb').textContent = best == null ? '—' : fmt(best);
    if (ti.gap == null) {
      $('#tierNext').textContent = ti.level === 5 ? '최고 티어 · World Class 🏅' : '기록을 만들면 등급이 올라가요';
    } else if (ti.level === 5) {
      $('#tierNext').textContent = '최고 티어 · World Class 🏅';
    } else {
      $('#tierNext').textContent = '다음 ' + ti.next + '까지 -' + fmtGap(ti.gap);
    }
  }

  /* ---------------------------------------------------------------- chart -- */
  function svgHead(w, hh, cls) {
    return (
      '<svg class="pz-svg ' + cls + '" viewBox="0 0 ' + w + ' ' + hh +
      '" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
    );
  }

  function renderChart() {
    const box = $('#chartBox');
    if (!box) return;
    const recs = recsOf(S.settings.event).slice(-50);
    if (recs.length < 2) {
      box.innerHTML = '<div class="chart-empty">솔브가 2개 이상이면 추이가 그려집니다</div>';
      return;
    }
    const vals = recs.map(eff);
    const fin = vals.filter((v) => v !== DNF);
    if (!fin.length) {
      box.innerHTML = '<div class="chart-empty">유효 기록이 없어요</div>';
      return;
    }
    const W = 640;
    const H = 186;
    const pl = 48;
    const pr = 12;
    const pt = 14;
    const pb = 18;
    let lo = Math.min.apply(null, fin);
    let hi = Math.max.apply(null, fin);
    if (hi - lo < 800) {
      hi += 400;
      lo -= 400;
    }
    const span = hi - lo;
    lo -= span * 0.12;
    hi += span * 0.12;
    const X = (i) => pl + (i / Math.max(1, recs.length - 1)) * (W - pl - pr);
    const Y = (v) => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
    let out = svgHead(W, H, 'chart');
    for (let k = 0; k <= 3; k++) {
      const v = lo + ((hi - lo) * k) / 3;
      const y = Y(v);
      out +=
        '<line x1="' + pl + '" y1="' + y.toFixed(1) + '" x2="' + (W - pr) + '" y2="' + y.toFixed(1) +
        '" stroke="currentColor" stroke-opacity=".1"/>';
      out +=
        '<text x="' + (pl - 7) + '" y="' + (y + 3.5).toFixed(1) +
        '" text-anchor="end" font-size="9" fill="currentColor" opacity=".5" font-family="ui-monospace,monospace">' +
        fmt(v) + '</text>';
    }
    // PB line
    const best = bestOf(recs);
    if (best != null) {
      const y = Y(best);
      out += '<line class="pb-line" x1="' + pl + '" y1="' + y.toFixed(1) + '" x2="' + (W - pr) + '" y2="' + y.toFixed(1) + '"/>';
    }
    // single line (broken at DNF)
    let d = '';
    let open = false;
    vals.forEach((v, i) => {
      if (v === DNF) {
        open = false;
        return;
      }
      d += (open ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1);
      open = true;
    });
    out += '<path class="ln-single" d="' + d + '"/>';
    // Ao5 rolling line
    let d2 = '';
    let open2 = false;
    for (let i = 0; i < recs.length; i++) {
      const a = averageOf(recs.slice(0, i + 1), 5);
      if (a == null || a === DNF) {
        open2 = false;
        continue;
      }
      d2 += (open2 ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(a).toFixed(1);
      open2 = true;
    }
    out += '<path class="ln-ao5" d="' + d2 + '"/>';
    // dots + dnf marks
    vals.forEach((v, i) => {
      if (v === DNF) {
        const x = X(i);
        out += '<path class="dnf-mark" d="M' + (x - 3).toFixed(1) + ' ' + (pt + 3) + 'L' + (x + 3).toFixed(1) + ' ' + (pt + 9) +
          'M' + (x + 3).toFixed(1) + ' ' + (pt + 3) + 'L' + (x - 3).toFixed(1) + ' ' + (pt + 9) + '"/>';
      } else if (recs.length <= 30 || i % Math.ceil(recs.length / 30) === 0) {
        out += '<circle class="dot" cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="2.4"/>';
      }
    });
    out += '</svg>';
    box.innerHTML = out;
  }

  /* --------------------------------------------------------------- splits -- */
  const SPLIT_NAMES = ['CROSS', 'F2L', 'OLL', 'PLL'];
  let lastSplits = null;

  function renderSplitBar(live) {
    const bar = $('#splitBar');
    if (!bar) return;
    bar.innerHTML = '';
    if (!S.settings.splits) {
      const row = h('div', 'split-off');
      row.appendChild(h('span', null, '스플릿 측정 꺼짐 · Cross / F2L / OLL / PLL 구간 기록'));
      const b = h('button', null, '켜기');
      b.type = 'button';
      b.addEventListener('click', () => {
        S.settings.splits = true;
        const cb = $('#setSplits');
        if (cb) cb.checked = true;
        save();
        renderSplitBar(null);
        toast('스플릿 모드 ON · 풀면서 화면을 탭하면 구간이 나뉩니다', 'good', '⏱');
      });
      row.appendChild(b);
      bar.appendChild(row);
      return;
    }
    const vals = live || lastSplits;
    for (let i = 0; i < 4; i++) {
      const seg = h('div', 'split-seg');
      seg.appendChild(h('span', null, SPLIT_NAMES[i]));
      const v = vals && vals[i] != null ? fmt(vals[i]) : '—';
      seg.appendChild(h('b', null, v));
      if (vals && vals[i] != null) seg.classList.add('on');
      if (live && live.length === i) seg.classList.add('cur');
      bar.appendChild(seg);
    }
  }

  /* ================================================================ quests == */
  const QUEST_POOL = {
    count: [
      { id: 'any3', icon: '🎯', type: 'any', target: 3, xp: 60, label: '아무 종목이나 3회 풀기' },
      { id: 'any5', icon: '🎯', type: 'any', target: 5, xp: 90, label: '아무 종목이나 5회 풀기' },
      { id: 'distinct2', icon: '🧩', type: 'distinct', target: 2, xp: 70, label: '서로 다른 2종목 풀기' }
    ],
    event: [
      { id: 'fto3', icon: '✨', type: 'event', event: 'fto', target: 3, xp: 90, label: 'FTO 3회 풀기' },
      { id: 'clock2', icon: '⏰', type: 'event', event: 'clock', target: 2, xp: 80, label: 'Clock 2회 풀기' },
      { id: 'pyra3', icon: '🔺', type: 'event', event: 'pyram', target: 3, xp: 70, label: 'Pyraminx 3회 풀기' },
      { id: 'skewb3', icon: '💠', type: 'event', event: 'skewb', target: 3, xp: 70, label: 'Skewb 3회 풀기' },
      { id: 'sub30', icon: '⚡', type: 'sub', event: '333', targetMs: 30000, target: 1, xp: 90, label: '3x3 30초 이내 1회' },
      { id: 'sub60', icon: '🌱', type: 'sub', event: '333', targetMs: 60000, target: 1, xp: 60, label: '3x3 1분 이내 1회' }
    ],
    special: [
      { id: 'battle1', icon: '🤝', type: 'battle', target: 1, xp: 100, label: '프렌드 배틀 1회 완료' },
      { id: 'minigame', icon: '🎮', type: 'minigame', target: 1, xp: 80, label: '미니게임 1회 클리어' }
    ]
  };

  function buildQuests(dateStr) {
    const rng = SCR.mulberry32(SCR.hashStr('quest|' + dateStr));
    const pickFrom = (arr) => arr[Math.floor(rng() * arr.length)];
    const a = pickFrom(QUEST_POOL.count);
    const b = pickFrom(QUEST_POOL.event);
    const pool = QUEST_POOL.special.concat(
      QUEST_POOL.count.filter((q) => q.id !== a.id),
      QUEST_POOL.event.filter((q) => q.id !== b.id)
    );
    const c = pickFrom(pool);
    return [a, b, c].map((q) =>
      Object.assign({}, q, { progress: 0, done: false, claimed: false })
    );
  }

  function ensureDaily() {
    const today = todayStr();
    if (S.quests.date === today && S.quests.items && S.quests.items.length) return;
    const y = todayStr(new Date(Date.now() - 86400000));
    if (S.quests.date === y) S.quests.streak = (S.quests.streak | 0) + 1;
    else S.quests.streak = 1;
    S.quests.date = today;
    S.quests.items = buildQuests(today);
    S.quests.todayEvents = {};
    save();
  }

  function questOnSolve(evId, value) {
    const q = S.quests;
    if (!q.items) return;
    q.todayEvents = q.todayEvents || {};
    q.todayEvents[evId] = true;
    let changed = false;
    q.items.forEach((it) => {
      if (it.done) return;
      if (it.type === 'any') {
        it.progress = Math.min(it.target, it.progress + 1);
      } else if (it.type === 'event' && it.event === evId) {
        it.progress = Math.min(it.target, it.progress + 1);
      } else if (it.type === 'sub' && it.event === evId && value !== DNF && value <= it.targetMs) {
        it.progress = Math.min(it.target, it.progress + 1);
      } else if (it.type === 'distinct') {
        it.progress = Math.min(it.target, Object.keys(q.todayEvents).length);
      }
      if (it.progress >= it.target && !it.done) {
        it.done = true;
        changed = true;
        toast('퀘스트 달성! ' + it.label, 'good', it.icon);
        Sound.win();
      }
    });
    if (changed) save();
  }

  function questSpecial(type) {
    const q = S.quests;
    if (!q.items) return;
    q.items.forEach((it) => {
      if (it.type !== type || it.done) return;
      it.progress = Math.min(it.target, it.progress + 1);
      if (it.progress >= it.target) {
        it.done = true;
        toast('퀘스트 달성! ' + it.label, 'good', it.icon);
        Sound.win();
      }
    });
    renderQuests();
    save();
  }

  function renderQuests() {
    const box = $('#questList');
    if (!box) return;
    box.innerHTML = '';
    (S.quests.items || []).forEach((q) => {
      const row = h('div', 'quest' + (q.done ? ' done' : ''));
      row.appendChild(h('span', 'q-ico', q.icon || '✦'));
      const main = h('div', 'q-main');
      main.appendChild(h('div', 'q-title', q.label));
      const bar = h('div', 'q-bar');
      const fill = h('i');
      fill.style.width = Math.round((Math.min(q.progress, q.target) / q.target) * 100) + '%';
      bar.appendChild(fill);
      main.appendChild(bar);
      row.appendChild(main);
      row.appendChild(h('span', 'q-xp', '+' + q.xp));
      if (q.done && !q.claimed) {
        const btn = h('button', 'btn primary sm', '받기');
        btn.type = 'button';
        btn.dataset.quest = q.id;
        row.appendChild(btn);
      } else if (q.claimed) {
        row.appendChild(h('span', 'tag good', '완료'));
      } else {
        row.appendChild(h('span', 'tag soft', q.progress + '/' + q.target));
      }
      box.appendChild(row);
    });
    $('#questStreak').textContent = '🔥 ' + (S.quests.streak | 0) + '일 연속';
  }

  /* ========================================================== achievements == */
  const ACH = [
    { id: 'first', icon: '🎉', name: '첫 솔브', desc: '아무 종목 1회 기록', check: () => S.stats.solves >= 1 },
    { id: 'pb', icon: '⚡', name: '첫 PB', desc: '개인 최고 기록 갱신', check: () => (S.stats.pbs | 0) >= 1 },
    { id: 'fto', icon: '✨', name: 'FTO 개척자', desc: 'FTO 5회 풀기', check: () => (S.stats.events.fto | 0) >= 5 },
    { id: 'clock', icon: '⏰', name: '굿바이 클락', desc: 'Clock 1회 풀기', check: () => (S.stats.events.clock | 0) >= 1 },
    { id: 'ao5', icon: '📊', name: 'Ao5 마스터', desc: '한 종목 Ao5 5회', check: () => Object.keys(S.records).some((k) => (S.records[k] || []).length >= 5) },
    { id: 'sub20', icon: '🚀', name: 'Sub-20', desc: '3x3 20초 이내', check: () => (bestOf(recsOf('333')) || DNF) <= 20000 },
    { id: 'sub10', icon: '🔥', name: 'Sub-10', desc: '3x3 10초 이내', check: () => (bestOf(recsOf('333')) || DNF) <= 10000 },
    { id: 'battleJoin', icon: '🤝', name: '배틀 참가', desc: '배틀 링크 생성·참가', check: () => !!S.flags.battleJoined },
    { id: 'battleWin', icon: '🏆', name: '배틀 승리', desc: '리더보드 1위', check: () => !!S.flags.battleWon },
    { id: 'clockGame', icon: '🎮', name: '클락 정복', desc: '클락 시뮬레이터 클리어', check: () => S.minigame.clockBest != null },
    { id: 'challenge', icon: '🧠', name: '암기왕', desc: '스크램블 챌린지 성공', check: () => S.minigame.chalBest != null },
    { id: 'solves50', icon: '💪', name: '50 솔브', desc: '누적 50회', check: () => S.stats.solves >= 50 },
    { id: 'solves200', icon: '👑', name: '200 솔브', desc: '누적 200회', check: () => S.stats.solves >= 200 },
    { id: 'allround', icon: '🧩', name: '올라운더', desc: '서로 다른 5종목', check: () => Object.keys(S.stats.events || {}).length >= 5 },
    { id: 'streak7', icon: '🔥', name: '7일 연속', desc: '7일 연속 출석', check: () => (S.quests.streak | 0) >= 7 },
    { id: 'lv10', icon: '⭐', name: 'Lv.10', desc: '레벨 10 달성', check: () => levelInfo(S.profile.xp).level >= 10 },
    { id: 'night', icon: '🌙', name: '올빼미', desc: '자정~4시 솔브', check: () => !!S.flags.nightOwl }
  ];

  function checkAchievements() {
    let got = false;
    ACH.forEach((a) => {
      if (S.ach[a.id]) return;
      let ok = false;
      try {
        ok = !!a.check();
      } catch (e) {
        ok = false;
      }
      if (ok) {
        S.ach[a.id] = Date.now();
        got = true;
        toast('업적 달성 · ' + a.name, 'good', a.icon);
        Sound.win();
      }
    });
    if (got) {
      Confetti.fire(60);
      renderHud();
      if (viewNow === 'stats') renderStats();
      save();
    }
  }

  /* =============================================================== battle == */
  function encBytes(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decBytes(str) {
    let s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }
  function encode(obj) {
    return encBytes(new TextEncoder().encode(JSON.stringify(obj)));
  }
  function decode(str) {
    try {
      const txt = new TextDecoder().decode(decBytes(str));
      const o = JSON.parse(txt);
      return o && typeof o === 'object' ? o : null;
    } catch (e) {
      return null;
    }
  }
  function encRounds(rounds) {
    return rounds.map((r) => {
      if (!r) return -1;
      if (r.pen === 'dnf') return 3;
      return Math.round(r.ms) * 4 + (r.pen === '+2' ? 1 : 0);
    });
  }
  function decRounds(arr) {
    return (arr || []).map((v) => {
      if (v === -1) return null;
      if (v === 3) return { ms: 0, pen: 'dnf' };
      const pen = v % 4;
      return { ms: Math.floor(v / 4), pen: pen === 1 ? '+2' : null };
    });
  }
  function baseUrl() {
    return location.href.split('#')[0];
  }

  /* ------------------------------------------------ AI ghost rivals ---- */
  /* An AI rival replays a believable five-round set for its tier. Times are
     derived from the same tier table the player is graded by, and from the
     battle seed, so the same link shows the same bot times everywhere. */
  const AI_LEVEL = { Challenger: 1, Pro: 2, Master: 3, Grandmaster: 4 };
  const AI_BOTS = {
    Challenger: { key: 'Challenger', name: '🤖 Challenger Bot', spread: 0.12 },
    Pro: { key: 'Pro', name: '🤖 Pro Bot', spread: 0.1 },
    Master: { key: 'Master', name: '🤖 Master Bot', spread: 0.085 },
    Grandmaster: { key: 'Grandmaster', name: '🤖 Grandmaster Bot', spread: 0.07 }
  };
  /* Events whose tier numbers are not single times (FMC counts moves) fall
     back to a per-tier time budget instead. */
  const AI_FALLBACK_MS = { '333fm': 300000, '333mbf': 420000 };
  const AI_FALLBACK_SCALE = { 1: 1.3, 2: 1.0, 3: 0.85, 4: 0.7 };
  /* 이 종목들의 티어 수치는 회전 수(moves)라서 시간(ms) 기준으로 쓸 수 없다. */
  const AI_MOVE_EVENTS = { '333fm': 1, '333mbf': 1 };

  function aiBaseMs(eventId, tier) {
    const lvl = AI_LEVEL[tier] || 1;
    const t = TIER_TIMES[eventId];
    // 그 티어의 기준 기록을 봇의 "평균적인 한 판"으로 쓴다.
    if (t && !AI_MOVE_EVENTS[eventId]) return t[5 - lvl];
    return (AI_FALLBACK_MS[eventId] || 20000) * (AI_FALLBACK_SCALE[lvl] || 1);
  }

  function aiRounds(eventId, seed, tier) {
    const bot = AI_BOTS[tier] || AI_BOTS.Challenger;
    const base = aiBaseMs(eventId, tier);
    const rng = SCR.mulberry32((((SCR.hashStr('ai|' + bot.key + '|' + eventId) ^ (seed >>> 0)) >>> 0) || 7));
    const out = [];
    for (let i = 0; i < 5; i++) {
      const jitter = (rng() * 2 - 1) * bot.spread;
      let ms = base * (1 + jitter);
      // 가끔 한 판이 크게 흔들리는 사람 같은 편차
      if (rng() < 0.12) ms *= 1 + rng() * 0.18;
      ms = Math.max(120, Math.round(ms));
      if (eventId === '333fm' || eventId === '333mbf') ms = Math.round(ms / 500) * 500;
      out.push({ ms: ms, pen: rng() < 0.035 ? '+2' : null });
    }
    return out;
  }

  function aiEntry(eventId, seed, tier) {
    const bot = AI_BOTS[tier];
    if (!bot) return null;
    return { name: bot.name, r: aiRounds(eventId, seed, tier), bot: bot.key };
  }

  function opponentChoice() {
    const sel = $('#battleOpponent');
    const ch = sel ? sel.value : 'friend';
    if (ch.indexOf('ai:') === 0 && AI_BOTS[ch.slice(3)]) return { ai: ch.slice(3), name: null };
    const inp = $('#battleOppName');
    const nm = inp ? (inp.value || '').trim().slice(0, 12) : '';
    return { ai: null, name: nm || null };
  }

  /* Opponent who is expected but has not sent a result yet. */
  function pendingOppName(b) {
    if (!b) return '';
    const names = (b.entries || []).map((en) => en.name);
    const nm = b.opp || (b.invite && !names.length ? '친구' : '');
    if (!nm) return '';
    return names.indexOf(nm) === -1 ? nm : '';
  }

  function battleVsLabel(b) {
    if (!b) return '';
    const short = (n) => String(n).replace('🤖 ', '');
    const names = (b.entries || []).map((en) => short(en.name));
    if (names.length) {
      return 'VS ' + names[0] + (names.length > 1 ? ' 외 ' + (names.length - 1) + '명' : '');
    }
    const pend = pendingOppName(b);
    return pend ? 'VS ' + short(pend) : '';
  }

  function inviteUrl(b) {
    const payload = { t: 'b', e: b.e, s: b.s, n: b.host || b.name };
    if (b.ai) payload.a = b.ai;
    return baseUrl() + '#battle=' + encode(payload);
  }

  let battleTimer = null;

  function battleScramble(round) {
    const b = S.battle;
    return SCR.scrambleFor(b.e, (b.s + round * 7919) >>> 0);
  }

  function ensureBattleName() {
    const inp = $('#battleName');
    const name = (inp.value || '').trim().slice(0, 12) || 'Cuber';
    return name;
  }

  function createBattle(seedIn) {
    const e = $('#battleEvent').value || S.settings.event;
    const name = ensureBattleName();
    const pick = opponentChoice();
    const seed = (seedIn || SCR.randomSeed()) >>> 0;
    S.profile.name = name;
    S.battle = {
      e: e,
      s: seed,
      name: name,
      host: name,
      ai: pick.ai,
      opp: pick.ai ? AI_BOTS[pick.ai].name : pick.name,
      rounds: [],
      entries: [],
      done: false,
      startedAt: Date.now()
    };
    if (pick.ai) S.battle.entries.push(aiEntry(e, seed, pick.ai));
    S.flags.battleJoined = true;
    checkAchievements();
    save();
    renderBattleAll();
  }

  function renderBattleVs() {
    const tag = $('#battleVsTag');
    if (!tag) return;
    const b = S.battle;
    const label = battleVsLabel(b);
    tag.textContent = label || 'VS';
    tag.hidden = !label;
    tag.classList.toggle('waiting', !!(b && label && !(b.entries || []).length));
  }

  function renderBattleEventSelect() {
    const sel = $('#battleEvent');
    if (!sel || sel.options.length) return;
    EVENTS.forEach((ev) => {
      const o = document.createElement('option');
      o.value = ev.id;
      o.textContent = ev.name + (ev.badge ? '  ·  ' + ev.badge : '');
      sel.appendChild(o);
    });
    sel.value = S.settings.event;
  }

  function renderBattleAll() {
    const b = S.battle;
    const has = !!b;
    $('#battleSetup').hidden = has;
    $('#battleLinkPanel').hidden = true;
    $('#battleRun').hidden = true;
    $('#battleResult').hidden = true;
    $('#battleBoard').hidden = !has;
    if (has) {
      $('#battleEventTag').textContent = BY_ID[b.e] ? BY_ID[b.e].name : b.e;
      $('#resultEventTag').textContent = BY_ID[b.e] ? BY_ID[b.e].name : b.e;
      renderBattleVs();
      renderBattleBoard();
      renderBattleRounds();
      if (b.rounds.length >= 5 && !b.done) b.done = true;
      if (b.done) {
        $('#battleResult').hidden = false;
        $('#battleRun').hidden = true;
        $('#resultSummary').innerHTML = '';
        const ao5 = averageOf(b.rounds, 5);
        const best = bestOf(b.rounds);
        addSummary('#resultSummary', [['Ao5', fmt(ao5)], ['Best', fmt(best)], ['라운드', b.rounds.length + '/5']]);
        const rival = boardRows().filter((r) => !r.me && !r.pending)[0];
        if (rival) addSummary('#resultSummary', [[rival.name, rival.ao5 == null ? '—' : fmt(rival.ao5)]]);
        $('#resultLinkOut').value = baseUrl() + '#result=' + encode({ t: 'r', e: b.e, s: b.s, n: b.name, r: encRounds(b.rounds) });
      } else {
        // 진행 중(또는 아직 0라운드)인 배틀은 새로고침·재진입해도 타이머 화면을 바로 띄운다.
        $('#battleRun').hidden = false;
        renderBattleRound();
        renderBattleRounds();
      }
    }
    if (!has) {
      $('#battleBoard').hidden = true;
    }
  }

  function addSummary(sel, pairs) {
    const box = $(sel);
    pairs.forEach((p) => {
      const d = h('div');
      d.appendChild(h('b', null, p[1]));
      d.appendChild(h('span', null, p[0]));
      box.appendChild(d);
    });
  }

  function startBattleRun() {
    if (!S.battle) return;
    const b = S.battle;
    b.rounds = [];
    b.done = false;
    save();
    $('#battleSetup').hidden = true;
    $('#battleLinkPanel').hidden = true;
    $('#battleResult').hidden = true;
    $('#battleRun').hidden = false;
    $('#battleBoard').hidden = false;
    $('#battleEventTag').textContent = BY_ID[b.e] ? BY_ID[b.e].name : b.e;
    renderBattleVs();
    if (battleTimer) battleTimer.reset();
    renderBattleRound();
    renderBattleRounds();
    renderBattleBoard();
  }

  function renderBattleRound() {
    const b = S.battle;
    if (!b) return;
    const round = b.rounds.length;
    $('#battleRoundLabel').textContent = '라운드 ' + Math.min(round + 1, 5) + ' / 5';
    const sc = battleScramble(Math.min(round, 4));
    $('#battleScramble').textContent = sc.text;
    const dots = $('#battleProgress');
    dots.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const d = h('i');
      if (i < round) d.className = b.rounds[i] && b.rounds[i].pen === 'dnf' ? 'dnf' : 'on';
      dots.appendChild(d);
    }
    if (battleTimer) battleTimer.reset();
  }

  function renderBattleRounds() {
    const box = $('#battleRounds');
    if (!box) return;
    const b = S.battle;
    box.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const cell = h('div');
      cell.appendChild(h('span', null, 'R' + (i + 1)));
      const r = b && b.rounds[i];
      cell.appendChild(document.createTextNode(r ? fmt(eff(r)) : '—'));
      if (r && r.pen === 'dnf') cell.style.color = 'var(--bad)';
      box.appendChild(cell);
    }
  }

  function battleRoundDone(res) {
    const b = S.battle;
    b.rounds.push(res);
    questSpecial('battle');
    addXp(12, true);
    save();
    if (b.rounds.length >= 5) {
      b.done = true;
      save();
      renderBattleAll();
      renderBattleBoard();
      Sound.win();
      Confetti.fire(90);
      toast('배틀 완료! 결과 링크를 친구에게 보내보세요', 'good', '🎉');
    } else {
      renderBattleRound();
      renderBattleRounds();
      renderBattleBoard();
    }
  }

  function boardRows() {
    const b = S.battle;
    if (!b) return [];
    const rows = [{ name: b.name + ' (나)', me: true, rounds: b.rounds.slice() }];
    (b.entries || []).forEach((en) => rows.push({ name: en.name, me: false, rounds: en.r.slice(), bot: !!en.bot }));
    const pend = pendingOppName(b);
    if (pend) rows.push({ name: pend, me: false, rounds: [], pending: true });
    rows.forEach((r) => {
      r.ao5 = r.rounds.length >= 5 ? averageOf(r.rounds, 5) : null;
      r.best = bestOf(r.rounds);
    });
    rows.sort((x, y) => {
      const a = x.ao5 == null ? DNF : x.ao5;
      const c = y.ao5 == null ? DNF : y.ao5;
      if (a !== c) return a - c;
      return (x.best == null ? DNF : x.best) - (y.best == null ? DNF : y.best);
    });
    return rows;
  }

  function renderBattleBoard() {
    const box = $('#battleBoardBody');
    if (!box) return;
    const b = S.battle;
    if (!b) return;
    renderBattleVs();
    const rows = boardRows();
    box.innerHTML = '';
    if (!rows.length) {
      box.appendChild(h('div', 'board-empty', '아직 기록이 없어요'));
      return;
    }
    const table = h('table', 'board-table');
    const thead = h('thead');
    const hr = h('tr');
    ['#', '플레이어', 'R1', 'R2', 'R3', 'R4', 'R5', 'Ao5', 'Best'].forEach((t) => hr.appendChild(h('th', null, t)));
    thead.appendChild(hr);
    table.appendChild(thead);
    const tb = h('tbody');
    const complete = rows.filter((r) => !r.pending && r.rounds.length >= 5 && r.ao5 != null && r.ao5 !== DNF);
    const winner = complete.length ? complete[0].name : null;
    const rivalDone = complete.some((r) => !r.me);
    rows.forEach((r, i) => {
      const tr = h('tr', r.me ? 'me' : r.pending ? 'waiting' : '');
      tr.appendChild(h('td', null, i === 0 && winner ? '🏆' : String(i + 1)));
      tr.appendChild(h('td', 'pname', r.name));
      for (let k = 0; k < 5; k++) {
        const rec = r.rounds[k];
        let cls = '';
        let txt = rec ? fmt(eff(rec)) : '·';
        if (rec) {
          if (rec.pen === 'dnf') cls = 'dnf';
          else if (rec.pen === '+2') cls = 'plus2';
        }
        tr.appendChild(h('td', cls, txt));
      }
      tr.appendChild(h('td', r.pending ? 'wait' : null, r.pending ? '대기 중...' : r.ao5 == null ? '—' : fmt(r.ao5)));
      tr.appendChild(h('td', null, r.best == null ? '—' : fmt(r.best)));
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    box.appendChild(table);
    renderBattleDiffs(rows);
    if (winner && rivalDone) {
      const me = rows.length > 1 && rows[0] && rows[0].me;
      if (me && !S.flags.battleWon) {
        S.flags.battleWon = true;
        checkAchievements();
        save();
      }
    }
  }

  function addFriendResult(payload) {
    const b = S.battle;
    if (!b) return;
    const rounds = decRounds(payload.r || []);
    const name = (payload.n || '친구').slice(0, 16);
    const key = JSON.stringify(rounds);
    const dup = (b.entries || []).some((en) => JSON.stringify(en.r) === key && en.name === name);
    if (!dup) {
      b.entries = b.entries || [];
      b.entries.push({ name: name, r: rounds });
    }
    if (!b.opp) b.opp = name;
    save();
    renderBattleBoard();
    renderBattleAll();
  }

  function handleHash() {
    const hash = location.hash || '';
    if (hash.indexOf('#battle=') === 0) {
      const p = decode(hash.slice(8));
      if (p && p.t === 'b' && BY_ID[p.e]) {
        const seed = p.s >>> 0;
        const ai = p.a && AI_BOTS[p.a] ? p.a : null;
        const hostName = (p.n || '친구').slice(0, 16);
        S.battle = {
          e: p.e,
          s: seed,
          name: (S.profile.name || 'Cuber').slice(0, 12),
          host: hostName,
          ai: ai,
          opp: ai ? AI_BOTS[ai].name : hostName,
          rounds: [],
          entries: [],
          done: false
        };
        if (ai) S.battle.entries.push(aiEntry(p.e, seed, ai));
        S.flags.battleJoined = true;
        checkAchievements();
        save();
        showView('battle');
        renderBattleAll();
        toast(
          ai ? 'AI 라이벌 ' + AI_BOTS[ai].name.replace('🤖 ', '') + '와의 배틀에 참가했어요 · ' + BY_ID[p.e].name
             : hostName + '님의 배틀에 참가했어요 · ' + BY_ID[p.e].name,
          'good', '🤝');
        startBattleRun();
        goClean();
      }
    } else if (hash.indexOf('#result=') === 0) {
      const p = decode(hash.slice(8));
      if (p && p.t === 'r' && BY_ID[p.e]) {
        const friendName = (p.n || '친구').slice(0, 16);
        const fresh = !S.battle || S.battle.s !== (p.s >>> 0) || S.battle.e !== p.e;
        if (fresh) {
          S.battle = {
            e: p.e,
            s: p.s >>> 0,
            name: (S.profile.name || 'Cuber').slice(0, 12),
            host: null,
            opp: friendName,
            rounds: [],
            entries: [],
            done: false
          };
          S.flags.battleJoined = true;
          checkAchievements();
          save();
        }
        showView('battle');
        addFriendResult(p);
        const b = S.battle;
        if (b && !b.done && !b.rounds.length) {
          // 친구의 5라운드 기록을 리더보드에 띄운 채로 1라운드부터 대결
          startBattleRun();
          toast(friendName + '님의 기록에 도전! 라운드 1부터 시작해요', 'good', '⚔️');
        } else {
          renderBattleAll();
          toast(friendName + '님의 결과를 불러왔어요', 'good', '📥');
        }
        goClean();
      }
    }
  }

  function goClean() {
    try {
      history.replaceState(null, '', location.pathname + location.search);
    } catch (e) {
      /* file:// or sandboxed — the hash stays, which is harmless */
    }
  }

  /* =============================================================== view == */
  let viewNow = 'timer';

  function showView(name) {
    viewNow = name;
    $$('.view').forEach((v) => v.classList.toggle('is-active', v.id === 'view-' + name));
    $$('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.view === name));
    if (name === 'stats') renderStats();
    if (name === 'battle') renderBattleAll();
    try {
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    } catch (e) {
      window.scrollTo(0, 0);
    }
  }

  /* ================================================================ hud ==== */
  function renderHud() {
    const li = levelInfo(S.profile.xp);
    $('#hudLvText').textContent = 'Lv.' + li.level;
    $('#hudXpFill').style.width = li.pct + '%';
    $('#hudXpText').textContent = li.into + '/' + li.need;
    $('#hudStreakText').textContent = S.quests.streak | 0;
    $('#btnSound').textContent = S.settings.sound ? '🔊' : '🔇';
    $('#btnSound').setAttribute('aria-label', S.settings.sound ? '효과음 끄기' : '효과음 켜기');
    $('#btnTheme').textContent = S.settings.theme === 'dark' ? '🌙' : '☀️';
    document.documentElement.dataset.theme = S.settings.theme;
  }

  /* =============================================================== stats === */
  function renderStats() {
    const li = levelInfo(S.profile.xp);
    $('#heroLv').textContent = 'Lv.' + li.level;
    $('#heroXpFill').style.width = li.pct + '%';
    $('#heroXpText').textContent = li.into + ' / ' + li.need + ' XP  (총 ' + S.profile.xp + ')';
    $('#heroSolves').textContent = S.stats.solves | 0;
    $('#heroStreak').textContent = S.quests.streak | 0;
    $('#heroBadges').textContent = Object.keys(S.ach).length;
    $('#heroEvents').textContent = Object.keys(S.stats.events || {}).length;

    const pb = $('#pbTable');
    pb.innerHTML = '';
    const head = h('div', 'pb-row pb-head');
    head.appendChild(h('span', null, '종목'));
    head.appendChild(h('b', null, 'Best'));
    head.appendChild(h('b', null, 'Ao5'));
    head.appendChild(h('span', 'pb-cnt', '기록'));
    pb.appendChild(head);
    let rows = 0;
    EVENTS.forEach((ev) => {
      const recs = recsOf(ev.id);
      if (!recs.length) return;
      rows++;
      const s = evStats(ev.id);
      const row = h('div', 'pb-row');
      row.appendChild(h('span', 'pb-name', ev.name));
      row.appendChild(h('b', null, s.best === null ? '—' : fmt(s.best)));
      row.appendChild(h('b', null, s.ao5 === null ? '—' : fmt(s.ao5)));
      row.appendChild(h('span', 'pb-cnt', s.count + '회'));
      pb.appendChild(row);
    });
    if (!rows) {
      pb.innerHTML = '';
      pb.appendChild(h('div', 'board-empty', '아직 기록이 없어요 · 타이머에서 첫 솔브를!'));
    }
    $('#pbEventTag').textContent = EVENTS.length + '종목';

    const grid = $('#badgeGrid');
    grid.innerHTML = '';
    ACH.forEach((a) => {
      const got = !!S.ach[a.id];
      const b = h('div', 'badge' + (got ? ' got' : ''));
      b.appendChild(h('div', 'b-ico', a.icon));
      b.appendChild(h('div', 'b-name', a.name));
      b.appendChild(h('div', 'b-desc', a.desc));
      grid.appendChild(b);
    });
    $('#badgeCount').textContent = Object.keys(S.ach).length + ' / ' + ACH.length;

    $('#setInspection').checked = !!S.settings.inspection;
    $('#setPreview').checked = !!S.settings.preview;
    $('#setSound').checked = !!S.settings.sound;
    $('#setTheme').checked = S.settings.theme === 'light';
    $('#setSplits').checked = !!S.settings.splits;
  }

  /* ============================================================== picker === */
  function openPicker() {
    const body = $('#modalBody');
    body.innerHTML = '';
    const groups = [
      { key: 'new', title: '2027 · 신설 & 레거시' },
      { key: 'cube', title: '큐브' },
      { key: 'big', title: '빅큐브' },
      { key: 'blind', title: '블라인드' },
      { key: 'other', title: '기타 퍼즐' }
    ];
    groups.forEach((g) => {
      const list = EVENTS.filter((e) => e.group === g.key);
      if (!list.length) return;
      body.appendChild(h('div', 'ev-group-title', g.title));
      const grid = h('div', 'ev-grid');
      list.forEach((ev) => {
        const b = h('button', 'ev-item' + (ev.id === S.settings.event ? ' is-active' : ''));
        b.type = 'button';
        const top = h('div', 'ei-top');
        top.appendChild(h('span', 'ei-name', ev.name));
        if (ev.badge) top.appendChild(h('span', 'tag ' + (ev.badgeKind === 'new' ? 'new' : 'legacy'), ev.badge));
        b.appendChild(top);
        b.appendChild(
          h('div', 'ei-ko', ev.ko + ' · ' + (ev.format === 'ao5' ? 'Ao5' : ev.format === 'mo3' ? 'Mo3' : 'Best'))
        );
        b.addEventListener('click', () => {
          setEvent(ev.id);
          closeModal();
        });
        grid.appendChild(b);
      });
      body.appendChild(grid);
    });
    openModal('종목 선택');
  }

  function openModal(title) {
    $('#modalTitle').textContent = title;
    const m = $('#modal');
    m.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    $('#modal').hidden = true;
    document.body.style.overflow = '';
  }

  function setEvent(id) {
    if (!BY_ID[id]) return;
    S.settings.event = id;
    save();
    const ev = BY_ID[id];
    $('#evName').textContent = ev.name;
    const badge = $('#evBadge');
    if (ev.badge) {
      badge.hidden = false;
      badge.textContent = ev.badge;
      badge.className = 'tag ' + (ev.badgeKind === 'new' ? 'new' : 'legacy');
    } else {
      badge.hidden = true;
    }
    timer.reset();
    lastSplits = null;
    newScramble(id);
    renderSolveList();
    renderStatsStrip();
    renderChart();
    renderSplitBar(null);
  }

  /* =============================================================== games === */
  const CG = { puzzle: null, side: 'front', moves: 0, start: 0, running: false, raf: 0 };

  function buildClockBoard() {
    const board = $('#clockBoard');
    board.innerHTML = '';
    const corners = { 0: 'UL', 2: 'UR', 6: 'DL', 8: 'DR' };
    for (let i = 0; i < 9; i++) {
      const cell = h('div', 'cell');
      const dial = h('button', 'dial');
      dial.type = 'button';
      dial.dataset.i = String(i);
      dial.innerHTML = '<span class="tick"></span><span class="hand"></span><span class="hub"></span>';
      dial.setAttribute('aria-label', '다이얼 ' + (i + 1));
      if (corners[i]) dial.dataset.corner = corners[i];
      cell.appendChild(dial);
      if (corners[i]) {
        const wb = h('div', 'wheel-btns');
        const minus = h('button', null, '−');
        minus.type = 'button';
        minus.dataset.corner = corners[i];
        minus.dataset.dir = '-1';
        minus.setAttribute('aria-label', corners[i] + ' 휠 반시계');
        const plus = h('button', null, '+');
        plus.type = 'button';
        plus.dataset.corner = corners[i];
        plus.dataset.dir = '1';
        plus.setAttribute('aria-label', corners[i] + ' 휠 시계');
        wb.append(minus, plus);
        cell.appendChild(wb);
      }
      board.appendChild(cell);
    }
    ['UL', 'UR', 'DL', 'DR'].forEach((p) => {
      const btn = h('button', 'pin', p);
      btn.type = 'button';
      btn.dataset.pin = p;
      btn.setAttribute('aria-label', '핀 ' + p);
      board.appendChild(btn);
    });
  }

  function cgNew() {
    const moves = PZ.clockScrambleMoves(14);
    CG.puzzle = PZ.scrambledClock(moves);
    /* start every round with the pins down, as a player would pick it up */
    CG.puzzle.setPins({});
    CG.side = 'front';
    CG.moves = 0;
    CG.running = false;
    CG.start = 0;
    cancelAnimationFrame(CG.raf);
    $('#cgTime').textContent = '0.00';
    renderClock();
    $('#cgBest').textContent = S.minigame.clockBest != null ? '최고 ' + fmt(S.minigame.clockBest) : '아직 기록 없음';
  }

  function renderClock() {
    const p = CG.puzzle;
    if (!p) return;
    $$('#clockBoard .dial').forEach((d) => {
      const i = parseInt(d.dataset.i, 10);
      const v = p[CG.side][i];
      const hand = d.querySelector('.hand');
      hand.style.transform = 'translate(-50%,-100%) rotate(' + v * 30 + 'deg)';
      d.classList.toggle('done', v === 0);
    });
    const pv = p.pinsOn(CG.side);
    $$('#clockBoard .pin').forEach((b) => {
      b.classList.toggle('up', !!pv[b.dataset.pin]);
    });
    $('#cgCorrect').textContent = p.correct() + ' / 18';
    $('#cgMoves').textContent = CG.moves + '수';
  }

  function cgTick() {
    if (!CG.running) return;
    $('#cgTime').textContent = fmt(performance.now() - CG.start);
    CG.raf = requestAnimationFrame(cgTick);
  }

  function cgTurn(corner, dir) {
    if (!CG.puzzle) return;
    if (!CG.running) {
      if (CG.puzzle.isSolved()) return;
      CG.running = true;
      CG.start = performance.now();
      cgTick();
    }
    CG.puzzle.turnWheel(corner, CG.side === 'front' ? dir : -dir);
    CG.moves++;
    Sound.tick();
    renderClock();
    save();
    if (CG.puzzle.isSolved()) cgWin();
  }

  function cgWin() {
    CG.running = false;
    cancelAnimationFrame(CG.raf);
    const ms = Math.round(performance.now() - CG.start);
    $('#cgTime').textContent = fmt(ms);
    const isBest = S.minigame.clockBest == null || ms < S.minigame.clockBest;
    if (isBest) S.minigame.clockBest = ms;
    save();
    Sound.win();
    Confetti.fire(90);
    toast(isBest ? '클락 클리어! 최고 기록 ' + fmt(ms) : '클락 클리어! ' + fmt(ms), 'good', '⏰');
    addXp(45);
    questSpecial('minigame');
    checkAchievements();
    $('#cgBest').textContent = '최고 ' + fmt(S.minigame.clockBest);
    renderClock();
  }

  /* ----------------------------------------------------- scramble challenge */
  const CH = { seq: [], idx: 0, phase: 'idle', t0: 0, mistakes: 0, timer: 0 };

  function chalSeq(n) {
    const faces = ['U', 'R', 'F', 'L', 'D', 'B'];
    const out = [];
    let prev = '';
    for (let i = 0; i < n; i++) {
      let f;
      do {
        f = faces[(Math.random() * faces.length) | 0];
      } while (f === prev);
      prev = f;
      out.push(f + (Math.random() < 0.5 ? "'" : ''));
    }
    return out;
  }

  function buildChalKeys() {
    const box = $('#chalKeys');
    box.innerHTML = '';
    ['U', 'R', 'F', 'L', 'D', 'B'].forEach((f) => {
      [f, f + "'"].forEach((m) => {
        const b = h('button', null, m);
        b.type = 'button';
        b.dataset.move = m;
        box.appendChild(b);
      });
    });
  }

  function chalStart() {
    const level = S.minigame.chalLevel || 1;
    const n = 3 + Math.min(5, level);
    CH.seq = chalSeq(n);
    CH.idx = 0;
    CH.mistakes = 0;
    CH.phase = 'show';
    renderChal();
    clearTimeout(CH.timer);
    const showMs = 900 + n * 620;
    CH.timer = setTimeout(() => {
      if (CH.phase !== 'show') return;
      CH.phase = 'input';
      CH.t0 = performance.now();
      renderChal();
      chalTick();
    }, showMs);
  }

  function chalTick() {
    if (CH.phase !== 'input') return;
    $('#chalDesc').textContent = '진행 중 · ' + fmt(performance.now() - CH.t0);
    requestAnimationFrame(chalTick);
  }

  function renderChal() {
    const box = $('#chalTarget');
    box.innerHTML = '';
    CH.seq.forEach((m, i) => {
      let cls = 'chip-move';
      let text = '?';
      if (CH.phase === 'show') {
        cls += ' cur';
        text = m;
      } else if (i < CH.idx) {
        cls += ' ok';
        text = m;
      } else if (i === CH.idx) {
        cls += ' cur';
      }
      const c = h('div', cls, text);
      box.appendChild(c);
    });
    $('#chalLevelTag').textContent = 'Lv.' + (S.minigame.chalLevel || 1);
    $('#chalBest').textContent = S.minigame.chalBest != null ? '최고 ' + fmt(S.minigame.chalBest) : '아직 기록 없음';
    if (CH.phase === 'show') $('#chalDesc').textContent = '잘 기억하세요…';
    if (CH.phase === 'idle') $('#chalDesc').textContent = '스크램블을 잠깐 보여줍니다. 사라지면 순서대로 다시 입력하세요.';
  }

  function chalTap(move) {
    if (CH.phase !== 'input') return;
    if (move === CH.seq[CH.idx]) {
      CH.idx++;
      Sound.tick();
      renderChal();
      if (CH.idx >= CH.seq.length) chalFinish();
    } else {
      CH.mistakes++;
      Sound.bad();
      const b = $('#chalKeys button[data-move="' + move + '"]');
      if (b) {
        b.classList.remove('bad');
        void b.offsetWidth;
        b.classList.add('bad');
        setTimeout(() => b.classList.remove('bad'), 320);
      }
    }
  }

  function chalFinish() {
    const ms = Math.round(performance.now() - CH.t0);
    CH.phase = 'idle';
    const isBest = S.minigame.chalBest == null || ms < S.minigame.chalBest;
    if (isBest) S.minigame.chalBest = ms;
    if (CH.mistakes === 0) S.minigame.chalLevel = Math.min(5, (S.minigame.chalLevel || 1) + 1);
    save();
    Sound.win();
    Confetti.fire(70);
    toast('챌린지 성공! ' + fmt(ms) + (CH.mistakes ? ' (실수 ' + CH.mistakes + ')' : ' · 노미스!'), 'good', '🧠');
    addXp(40);
    questSpecial('minigame');
    checkAchievements();
    renderChal();
  }

  /* ------------------------------------------------- battle: round diffs -- */
  function renderBattleDiffs(rows) {
    const box = $('#battleDiffs');
    if (!box) return;
    box.innerHTML = '';
    const me = rows.filter((r) => r.me)[0];
    const rivals = rows.filter((r) => !r.me && r.rounds.length >= 1);
    if (!me || !rivals.length || !me.rounds.length) {
      box.hidden = true;
      return;
    }
    const rival = rivals[0];
    box.hidden = false;
    box.appendChild(h('div', 'diff-title', '라운드별 차이 · ' + rival.name + ' 기준 (내 기록 − 상대)'));
    for (let i = 0; i < 5; i++) {
      const a = me.rounds[i];
      const b2 = rival.rounds[i];
      const chip = h('span', 'diff-chip');
      chip.appendChild(h('small', null, 'R' + (i + 1)));
      let txt = '—';
      if (a && b2 && eff(a) !== DNF && eff(b2) !== DNF) {
        const d = eff(a) - eff(b2);
        txt = (d > 0 ? '+' : '−') + (Math.abs(d) / 1000).toFixed(2) + 's';
        chip.classList.add(d <= 0 ? 'win' : 'lose');
      }
      chip.appendChild(document.createTextNode(txt));
      box.appendChild(chip);
    }
    const myA = averageOf(me.rounds, 5);
    const rvA = averageOf(rival.rounds, 5);
    if (myA != null && rvA != null && myA !== DNF && rvA !== DNF) {
      const d = myA - rvA;
      const chip = h('span', 'diff-chip');
      chip.appendChild(h('small', null, 'Ao5'));
      chip.appendChild(document.createTextNode((d > 0 ? '+' : '−') + (Math.abs(d) / 1000).toFixed(2) + 's'));
      chip.classList.add(d <= 0 ? 'win' : 'lose');
      box.appendChild(chip);
    }
  }

  /* ------------------------------------------------- battle: result card -- */
  function roundRect(g, x, y, w, hh, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + hh, r);
    g.arcTo(x + w, y + hh, x, y + hh, r);
    g.arcTo(x, y + hh, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function saveResultCard() {
    const b = S.battle;
    if (!b) return;
    const ev = BY_ID[b.e] || { name: b.e };
    const rows = boardRows();
    const W = 1080;
    const H = Math.max(900, 720 + Math.min(4, rows.length) * 116);
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    const F = (weight, size) =>
      weight + ' ' + size + 'px "Pretendard", "Malgun Gothic", Roboto, "Noto Sans KR", "Liberation Sans", Arial, system-ui, sans-serif';
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#080e20');
    bg.addColorStop(0.5, '#0b1130');
    bg.addColorStop(1, '#170f33');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    const g1 = g.createRadialGradient(W * 0.15, 0, 0, W * 0.15, 0, W * 0.95);
    g1.addColorStop(0, 'rgba(34,211,238,0.26)');
    g1.addColorStop(1, 'rgba(34,211,238,0)');
    g.fillStyle = g1;
    g.fillRect(0, 0, W, H);
    const g2 = g.createRadialGradient(W * 0.92, H * 0.12, 0, W * 0.92, H * 0.12, W * 0.85);
    g2.addColorStop(0, 'rgba(168,85,247,0.3)');
    g2.addColorStop(1, 'rgba(168,85,247,0)');
    g.fillStyle = g2;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(130,175,255,0.3)';
    g.lineWidth = 3;
    roundRect(g, 26, 26, W - 52, H - 52, 46);
    g.stroke();

    g.fillStyle = 'rgba(233,237,255,0.55)';
    g.font = F(800, 24);
    g.fillText('C U B E   A R E N A', 76, 122);
    g.fillStyle = '#e9edff';
    g.font = F(800, 76);
    g.fillText('FRIEND BATTLE', 76, 208);
    const evName = (ev.name || '') + '  ·  ' + rows.length + ' PLAYERS';
    g.fillStyle = '#22d3ee';
    g.font = F(700, 34);
    g.fillText(evName, 76, 262);

    // winner banner
    const champ = rows[0];
    const bannerY = 320;
    const bg2 = g.createLinearGradient(76, 0, W - 76, 0);
    bg2.addColorStop(0, 'rgba(34,211,238,0.16)');
    bg2.addColorStop(1, 'rgba(168,85,247,0.14)');
    g.fillStyle = bg2;
    roundRect(g, 76, bannerY, W - 152, 148, 28);
    g.fill();
    g.strokeStyle = 'rgba(34,211,238,0.5)';
    g.lineWidth = 2;
    roundRect(g, 76, bannerY, W - 152, 148, 28);
    g.stroke();
    // crown
    g.fillStyle = '#fbbf24';
    g.beginPath();
    g.moveTo(126, bannerY + 92);
    g.lineTo(126, bannerY + 52);
    g.lineTo(146, bannerY + 70);
    g.lineTo(166, bannerY + 44);
    g.lineTo(186, bannerY + 70);
    g.lineTo(206, bannerY + 52);
    g.lineTo(206, bannerY + 92);
    g.closePath();
    g.fill();
    g.fillStyle = '#f8fafc';
    g.font = F(800, 52);
    g.fillText(champ ? champ.name : '—', 240, bannerY + 66);
    g.fillStyle = 'rgba(233,237,255,0.65)';
    g.font = F(600, 28);
    const champLine = champ && champ.ao5 != null ? 'Ao5 ' + fmt(champ.ao5) + '   ·   Best ' + fmt(champ.best) : '기록 없음';
    g.fillText(champLine, 240, bannerY + 110);

    // table
    const top = 540;
    const colName = 76;
    const colStart = 380;
    const colW = 92;
    g.font = F(700, 22);
    g.fillStyle = 'rgba(233,237,255,0.5)';
    g.fillText('PLAYER', colName, top);
    ['R1', 'R2', 'R3', 'R4', 'R5', 'AO5', 'BEST'].forEach((t, i) => {
      g.fillText(t, colStart + i * colW, top);
    });
    g.strokeStyle = 'rgba(130,175,255,0.22)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(76, top + 20);
    g.lineTo(W - 76, top + 20);
    g.stroke();
    rows.slice(0, 4).forEach((r, ri) => {
      const y = top + 78 + ri * 108;
      g.font = F(800, 34);
      g.fillStyle = ri === 0 ? '#22d3ee' : '#e9edff';
      g.fillText(String(ri + 1), colName, y);
      const nm = r.name.length > 12 ? r.name.slice(0, 12) + '…' : r.name;
      g.font = F(700, 32);
      g.fillStyle = '#e9edff';
      g.fillText(nm, colName + 54, y);
      g.font = F(700, 30);
      for (let i = 0; i < 5; i++) {
        const rec = r.rounds[i];
        g.fillStyle = !rec ? 'rgba(233,237,255,0.3)' : rec.pen === 'dnf' ? '#fb7185' : rec.pen === '+2' ? '#fbbf24' : 'rgba(233,237,255,0.9)';
        g.fillText(rec ? fmt(eff(rec)) : '·', colStart + i * colW, y);
      }
      g.fillStyle = '#a855f7';
      g.font = F(800, 30);
      g.fillText(r.ao5 == null ? '—' : fmt(r.ao5), colStart + 5 * colW, y);
      g.fillStyle = 'rgba(233,237,255,0.75)';
      g.font = F(700, 28);
      g.fillText(r.best == null ? '—' : fmt(r.best), colStart + 6 * colW, y);
      g.strokeStyle = 'rgba(130,175,255,0.12)';
      g.beginPath();
      g.moveTo(76, y + 44);
      g.lineTo(W - 76, y + 44);
      g.stroke();
    });

    g.fillStyle = 'rgba(233,237,255,0.4)';
    g.font = F(600, 24);
    g.fillText('CUBE ARENA · 같은 스크램블 5개, Ao5 트림 평균 승부', 76, H - 96);
    g.fillStyle = '#22d3ee';
    g.font = F(800, 24);
    g.fillText(todayStr(), W - 240, H - 96);

    cv.toBlob((blob) => {
      if (!blob) {
        toast('카드를 만들지 못했어요', null, '⚠️');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cube-arena-battle-' + todayStr() + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('결과 카드를 저장했어요 (PNG)', 'good', '🖼');
    }, 'image/png');
  }

  /* ---------------------------------------------------- sudden death ----- */
  /* WCA 18종목 전부. 종목 난이도에 맞춘 시작 목표(base)·라운드당 감소폭(step)·하한(min).
     목록은 EVENTS 순서를 그대로 따르므로, 새 종목이 늘어도 여기 조정값만 없으면
     기본값(SD_FALLBACK)으로 자동 포함됩니다. */
  const SD_TUNE = {
    '222': { base: 8000, step: 1000, min: 1500 },
    pyram: { base: 8000, step: 1000, min: 1500 },
    skewb: { base: 8000, step: 1000, min: 1500 },
    '333': { base: 15000, step: 2000, min: 3000 },
    clock: { base: 15000, step: 2000, min: 4000 },
    '333oh': { base: 28000, step: 3000, min: 8000 },
    sq1: { base: 30000, step: 3500, min: 8000 },
    fto: { base: 45000, step: 5000, min: 12000 },
    '444': { base: 55000, step: 6000, min: 15000 },
    '555': { base: 100000, step: 10000, min: 30000 },
    minx: { base: 120000, step: 12000, min: 40000 },
    '666': { base: 180000, step: 15000, min: 60000 },
    '777': { base: 210000, step: 15000, min: 70000 },
    '333bf': { base: 180000, step: 15000, min: 60000 },
    '444bf': { base: 240000, step: 20000, min: 90000 },
    '555bf': { base: 300000, step: 20000, min: 120000 },
    '333fm': { base: 300000, step: 20000, min: 120000 },
    '333mbf': { base: 300000, step: 20000, min: 120000 }
  };
  const SD_FALLBACK = { base: 20000, step: 2500, min: 5000 };
  const SD_EVENTS = {};
  EVENTS.forEach((ev) => {
    const t = SD_TUNE[ev.id] || SD_FALLBACK;
    const step = Math.max(500, Math.min(t.step, t.base - 800));
    SD_EVENTS[ev.id] = { base: t.base, step: step, min: Math.min(t.min, t.base - step) };
  });
  const SD = { ev: '333', round: 1, target: 15000, active: false, last: null, pending: null };
  let sdTimer = null;

  function sdCfg() {
    return SD_EVENTS[SD.ev] || SD_EVENTS['333'];
  }
  function sdBestOf(ev) {
    S.minigame.sdBest = S.minigame.sdBest || {};
    return S.minigame.sdBest[ev] | 0;
  }
  function sdRender() {
    if (!$('#sdTarget')) return;
    $('#sdRoundTag').textContent = SD.active ? '라운드 ' + SD.round : (SD.last ? '탈락' : '대기');
    $('#sdTarget').textContent = fmt(SD.active || SD.last != null ? SD.target : sdCfg().base);
    $('#sdLast').textContent = SD.last == null ? '—' : fmt(SD.last);
    $('#sdBest').textContent = sdBestOf(SD.ev);
    const sel = $('#sdEvent');
    if (sel && sel.value !== SD.ev) sel.value = SD.ev;
    const card = $('#sdCard');
    if (card) card.classList.toggle('dead', !SD.active && !!SD.last);
    if (!SD.active && !SD.last) {
      $('#sdScramble').textContent = SD.pending
        ? SD.pending.text
        : '시작을 누르면 스크램블이 나옵니다';
      $('#sdHint').textContent = SD.pending ? '시작을 누르면 이 스크램블로' : '시작을 누르세요';
    }
  }
  function sdStart() {
    SD.ev = ($('#sdEvent') && $('#sdEvent').value) || SD.ev;
    SD.active = true;
    SD.round = 1;
    SD.target = sdCfg().base;
    SD.last = null;
    sdNewRound();
    toast('서든데스 시작 · 목표 ' + fmt(SD.target), 'good', '💀');
    Sound.ready();
  }
  function sdNewRound() {
    /* 종목을 고르는 순간 보여준 스크램블이 있으면 1라운드는 그것으로 시작한다. */
    const sc = SD.round === 1 && SD.pending ? SD.pending : SCR.scrambleFor(SD.ev, SCR.randomSeed());
    SD.pending = null;
    $('#sdScramble').textContent = sc.text;
    $('#sdHint').textContent = '목표 ' + fmt(SD.target) + ' 안에 맞추세요';
    if (sdTimer) sdTimer.reset();
    sdRender();
  }
  function sdRoundDone(res) {
    const ms = res.pen === 'dnf' ? DNF : res.ms + (res.pen === '+2' ? 2000 : 0);
    SD.last = ms;
    if (ms === DNF) {
      sdFail('DNF');
      return;
    }
    if (ms <= SD.target) {
      const done = SD.round;
      if (done > sdBestOf(SD.ev)) {
        S.minigame.sdBest = Object.assign({}, S.minigame.sdBest, { [SD.ev]: done });
        save();
      }
      addXp(6 + done * 2, true);
      questSpecial('minigame');
      SD.round++;
      SD.target = Math.max(sdCfg().min, SD.target - sdCfg().step);
      toast('라운드 ' + done + ' 클리어 · 다음 목표 ' + fmt(SD.target), 'good', '🔥');
      Sound.win();
      sdNewRound();
    } else {
      sdFail(fmt(ms));
    }
  }
  function sdFail(t) {
    const done = SD.round - 1;
    SD.active = false;
    $('#sdHint').textContent = done > 0 ? '탈락 · 라운드 ' + done + '까지 생존 (' + t + ')' : '탈락 · 목표 ' + t + ' 초과';
    const prev = sdBestOf(SD.ev);
    if (done > prev) {
      S.minigame.sdBest = Object.assign({}, S.minigame.sdBest, { [SD.ev]: done });
      Confetti.fire(90);
      Sound.pb();
      toast('신기록! 라운드 ' + done + '까지 생존', 'good', '🏅');
    } else {
      toast('탈락! ' + t + ' · 라운드 ' + done + '까지', null, '💀');
      Sound.bad();
    }
    checkAchievements();
    save();
    sdRender();
  }

  /* ============================================================== binding == */
  function bindTopbar() {
    $('#btnSound').addEventListener('click', () => {
      S.settings.sound = !S.settings.sound;
      save();
      renderHud();
      renderStats();
      if (S.settings.sound) Sound.ready();
    });
    $('#btnTheme').addEventListener('click', () => {
      S.settings.theme = S.settings.theme === 'dark' ? 'light' : 'dark';
      save();
      renderHud();
      renderStats();
    });
    $('#hudLevel').addEventListener('click', () => showView('stats'));
    $('#hudStreak').addEventListener('click', () => showView('stats'));
  }

  function bindTabs() {
    $$('.tab').forEach((t) => {
      t.addEventListener('click', () => showView(t.dataset.view));
    });
  }

  /* =============================================================== guide == */
  function isGuideOpen() {
    const m = $('#guideModal');
    return !!m && !m.hidden;
  }
  function openGuide() {
    const m = $('#guideModal');
    if (!m || !m.hidden) return;
    m.hidden = false;
    document.body.style.overflow = 'hidden';
    const body = $('#guideBody');
    if (body) body.scrollTop = 0;
    const close = $('#guideClose');
    if (close) close.focus({ preventScroll: true });
    Sound.tick();
  }
  function closeGuide() {
    const m = $('#guideModal');
    if (!m || m.hidden) return;
    m.hidden = true;
    document.body.style.overflow = '';
    const btn = $('#btnGuide');
    if (btn) btn.focus({ preventScroll: true });
  }
  function bindGuide() {
    const btn = $('#btnGuide');
    const m = $('#guideModal');
    if (!btn || !m) return;
    btn.addEventListener('click', openGuide);
    $('#guideClose').addEventListener('click', closeGuide);
    m.addEventListener('click', (e) => {
      if (e.target.dataset.guide === 'close') closeGuide();
    });
    // 설명서가 열려 있는 동안은 Space/Esc 가 타이머로 새어 나가지 않게 막는다.
    document.addEventListener(
      'keydown',
      (e) => {
        if (!isGuideOpen()) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          closeGuide();
        } else if (e.code === 'Space') {
          e.stopPropagation();
        } else if (e.key === 'Tab') {
          // 설명서 밖으로 포커스가 새지 않게 모달 안에서만 돌린다.
          const body = $('#guideBody');
          const close = $('#guideClose');
          const stops = body && close ? [close, body] : [];
          if (!stops.length) return;
          const cur = stops.indexOf(document.activeElement);
          const next = (cur + (e.shiftKey ? stops.length - 1 : 1) + stops.length) % stops.length;
          e.preventDefault();
          e.stopPropagation();
          stops[next].focus({ preventScroll: true });
        }
      },
      true
    );
  }

  function isTyping(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  function bindTimer() {
    const pad = $('#timerPad');
    pad.addEventListener('pointerdown', (e) => {
      if (e.button && e.button > 0) return;
      e.preventDefault();
      Sound.init();
      try {
        if (pad.setPointerCapture && e.pointerId != null) pad.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      timer.press();
    });
    pad.addEventListener('pointerup', (e) => {
      e.preventDefault();
      timer.release();
    });
    pad.addEventListener('pointercancel', () => timer.release());
    pad.addEventListener('contextmenu', (e) => e.preventDefault());
    pad.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') e.preventDefault();
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat && !isTyping(e.target)) {
        if (viewNow === 'timer') {
          e.preventDefault();
          Sound.init();
          timer.press();
        } else if (viewNow === 'battle' && battleTimer && !$('#battleRun').hidden) {
          e.preventDefault();
          Sound.init();
          battleTimer.press();
        }
      }
      if (e.code === 'Escape') {
        if (battleTimer && viewNow === 'battle') battleTimer.reset();
        else timer.reset();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' && !isTyping(e.target)) {
        if (viewNow === 'timer') {
          e.preventDefault();
          timer.release();
        } else if (viewNow === 'battle' && battleTimer && !$('#battleRun').hidden) {
          e.preventDefault();
          battleTimer.release();
        }
      }
    });

    $('#btnNewScramble').addEventListener('click', () => {
      timer.reset();
      newScramble();
      Sound.tick();
    });
    $('#btnPreview').addEventListener('click', () => {
      S.settings.preview = !S.settings.preview;
      $('#btnPreview').setAttribute('aria-pressed', S.settings.preview ? 'true' : 'false');
      save();
      renderPreview(BY_ID[S.settings.event]);
      renderStats();
    });
    $('#eventPill').addEventListener('click', openPicker);
    $('#modalClose').addEventListener('click', closeModal);
    $('#modal').addEventListener('click', (e) => {
      if (e.target.dataset.close) closeModal();
    });

    $('#solveList').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const i = parseInt(btn.dataset.i, 10);
      const recs = S.records[S.settings.event] || [];
      const rec = recs[i];
      if (!rec) return;
      const act = btn.dataset.act;
      if (act === 'plus2') rec.pen = rec.pen === '+2' ? null : '+2';
      else if (act === 'dnf') rec.pen = rec.pen === 'dnf' ? null : 'dnf';
      else if (act === 'del') recs.splice(i, 1);
      save();
      renderSolveList();
      renderStatsStrip();
      if (viewNow === 'stats') renderStats();
      Sound.tick();
    });

    $$('.stat-strip .stat[data-avg]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const n = parseInt(btn.dataset.avg, 10);
        const v = averageOf(recsOf(S.settings.event), n);
        const t = v === null ? '기록이 모자라요 (필요 ' + n + '회)' : fmt(v);
        toast('Ao' + n + ' · ' + t + ' (최고·최저 ' + trimCount(n) + '개씩 제외)', null, '📊');
      });
    });

    $('#btnClearSolves').addEventListener('click', () => {
      const ev = BY_ID[S.settings.event];
      if (!recsOf(ev.id).length) return;
      if (!window.confirm(ev.name + ' 기록 ' + recsOf(ev.id).length + '개를 지울까요?')) return;
      S.records[ev.id] = [];
      save();
      renderSolveList();
      renderStatsStrip();
      toast('기록을 지웠어요', null, '🧹');
    });
  }

  function bindQuests() {
    $('#questList').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-quest]');
      if (!btn) return;
      const id = btn.dataset.quest;
      const q = (S.quests.items || []).find((it) => it.id === id);
      if (!q || q.claimed || !q.done) return;
      q.claimed = true;
      addXp(q.xp);
      Sound.win();
      renderQuests();
      renderHud();
      save();
    });
  }

  function bindBattle() {
    renderBattleEventSelect();
    $('#battleName').value = S.profile.name || 'Cuber';
    battleTimer = createTimer({
      pad: $('#battlePad'),
      time: $('#battleTime'),
      overlay: $('#battleInspect'),
      onFinish: (res) => battleRoundDone(res)
    });
    const bpad = $('#battlePad');
    bpad.addEventListener('pointerdown', (e) => {
      if (e.button && e.button > 0) return;
      e.preventDefault();
      Sound.init();
      battleTimer.press();
    });
    bpad.addEventListener('pointerup', (e) => {
      e.preventDefault();
      battleTimer.release();
    });
    bpad.addEventListener('pointercancel', () => battleTimer.release());
    bpad.addEventListener('contextmenu', (e) => e.preventDefault());

    const oppSel = $('#battleOpponent');
    const oppField = $('#battleOppNameField');
    function syncOppField() {
      if (!oppField || !oppSel) return;
      oppField.hidden = oppSel.value.indexOf('ai:') === 0;
    }
    if (oppSel) {
      oppSel.addEventListener('change', syncOppField);
      syncOppField();
    }

    $('#btnCreateBattle').addEventListener('click', () => {
      createBattle();
      const b = S.battle;
      $('#battleLinkOut').value = inviteUrl(b);
      if (!b.ai && !b.invite) {
        b.invite = true;
        save();
      }
      renderBattleBoard();
      $('#linkEventTag').textContent = BY_ID[b.e].name;
      $('#battleLinkPanel').hidden = false;
      $('#battleSetup').hidden = true;
      // 링크를 막 만든 단계에서는 타이머 대신 초대 링크만 보여 준다.
      $('#battleRun').hidden = true;
      $('#battleBoard').hidden = false;
      toast(b.ai ? 'AI 라이벌을 리더보드에 올렸어요 · 링크로 친구도 부를 수 있어요' : '초대 링크를 만들었어요', 'good', '🔗');
      Sound.win();
    });
    $('#btnStartSolo').addEventListener('click', () => {
      createBattle();
      $('#battleSetup').hidden = true;
      startBattleRun();
      const b = S.battle;
      if (b && b.ai) {
        const bot = AI_BOTS[b.ai];
        toast(bot.name + '와의 대결 시작! 상대 기록은 리더보드에 있어요', 'good', '⚔️');
      }
    });
    $('#btnBattleGo').addEventListener('click', () => {
      $('#battleLinkPanel').hidden = true;
      startBattleRun();
    });
    $('#btnCopyInvite').addEventListener('click', () => {
      const b = S.battle;
      if (!b) return;
      copyText(inviteUrl(b), '초대 링크를 복사했어요 · 친구에게 붙여넣기');
    });
    $('#btnCopyLink').addEventListener('click', () => copyField('#battleLinkOut', '초대 링크를 복사했어요'));
    $('#btnCopyResult').addEventListener('click', () => copyField('#resultLinkOut', '결과 링크를 복사했어요'));
    $('#btnCopyShare').addEventListener('click', () => {
      const b = S.battle;
      if (!b) return;
      const ev = BY_ID[b.e] ? BY_ID[b.e].name : b.e;
      const text = b.ai
        ? '[Cube Arena] ' + b.name + '님의 ' + ev + ' AI 라이벌(' + b.ai + ') 배틀!\n같은 스크램블 5개로 겨뤄봐요 👇\n' + inviteUrl(b)
        : '[Cube Arena] ' + b.name + '님의 ' + ev + ' 프렌드 배틀!\n같은 스크램블 5개로 겨뤄봐요 👇\n' + inviteUrl(b);
      copyText(text, '공유 문구를 복사했어요 · 카톡에 붙여넣기');
    });
    $('#btnJoin').addEventListener('click', () => {
      const v = ($('#joinLink').value || '').trim();
      const m = /#(battle|result)=(.+)$/.exec(v);
      if (!m) {
        toast('링크 형식이 아니에요', null, '⚠️');
        return;
      }
      location.hash = '#' + m[1] + '=' + m[2];
      handleHash();
      $('#joinLink').value = '';
    });
    $('#btnBattleAgain').addEventListener('click', () => {
      S.battle = null;
      save();
      renderBattleAll();
      $('#battleSetup').hidden = false;
      $('#battleResult').hidden = true;
      $('#battleBoard').hidden = true;
      $('#battleRun').hidden = true;
    });
    $('#btnBattleQuit').addEventListener('click', () => {
      if (battleTimer) battleTimer.reset();
      S.battle = null;
      save();
      renderBattleAll();
      $('#battleSetup').hidden = false;
      $('#battleRun').hidden = true;
      $('#battleBoard').hidden = true;
    });
    // 어떤 상태에서도 배틀 설정 화면으로 돌아가는 안전 버튼
    const boardReset = $('#btnBoardReset');
    if (boardReset) {
      boardReset.addEventListener('click', () => {
        if (battleTimer) battleTimer.reset();
        S.battle = null;
        save();
        renderBattleAll();
      });
    }
    $('#btnSaveCard').addEventListener('click', saveResultCard);
    $('#btnLoadFriend').addEventListener('click', () => {
      const row = $('#loadFriendRow');
      row.hidden = !row.hidden;
    });
    $('#btnApplyFriend').addEventListener('click', () => {
      const v = ($('#friendResultLink').value || '').trim();
      const m = /#result=(.+)$/.exec(v);
      if (!m) {
        toast('결과 링크가 아니에요', null, '⚠️');
        return;
      }
      const p = decode(m[1]);
      if (!p || p.t !== 'r') {
        toast('링크를 읽을 수 없어요', null, '⚠️');
        return;
      }
      if (!S.battle || S.battle.s !== (p.s >>> 0) || S.battle.e !== p.e) {
        S.battle = {
          e: p.e,
          s: p.s >>> 0,
          name: S.profile.name || 'Cuber',
          host: null,
          opp: (p.n || '친구').slice(0, 16),
          rounds: [],
          entries: [],
          done: false
        };
      }
      addFriendResult(p);
      $('#friendResultLink').value = '';
      if (!S.battle.done && !S.battle.rounds.length) {
        startBattleRun();
        toast('친구 기록에 도전! 라운드 1부터 시작해요', 'good', '⚔️');
      } else {
        toast('친구 결과를 리더보드에 올렸어요', 'good', '📥');
      }
    });
  }

  function copyField(sel, msg) {
    const input = $(sel);
    input.select();
    input.setSelectionRange(0, input.value.length);
    copyText(input.value, msg);
  }
  function copyText(text, msg) {
    const done = () => toast(msg, 'good', '📋');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallback());
    } else fallback();
    function fallback() {
      const ta = h('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        done();
      } catch (e) {
        toast('복사가 안 되면 길게 눌러 직접 복사하세요', null, 'ℹ️');
      }
      ta.remove();
    }
  }

  function bindGames() {
    buildClockBoard();
    buildChalKeys();
    cgNew();
    renderChal();
    $('#clockBoard').addEventListener('click', (e) => {
      const pin = e.target.closest('.pin');
      if (pin) {
        const p = pin.dataset.pin;
        const view = CG.puzzle.pinsOn(CG.side);
        const obj = {};
        PZ.CLOCK_ORDER.forEach((k) => (obj[k] = view[k]));
        obj[p] = !obj[p];
        const front = {};
        PZ.CLOCK_ORDER.forEach((k) => (front[k] = CG.side === 'front' ? obj[k] : !obj[k]));
        CG.puzzle.setPins(front);
        Sound.tick();
        renderClock();
        return;
      }
      const wb = e.target.closest('button[data-corner]');
      if (wb) {
        cgTurn(wb.dataset.corner, parseInt(wb.dataset.dir, 10));
        return;
      }
      const dial = e.target.closest('.dial');
      if (dial && dial.dataset.corner) cgTurn(dial.dataset.corner, 1);
      else if (dial) Sound.bad();
    });
    $('#cgNew').addEventListener('click', () => {
      cgNew();
      Sound.tick();
    });
    $('#cgFlip').addEventListener('click', () => {
      CG.side = CG.side === 'front' ? 'back' : 'front';
      renderClock();
      Sound.tick();
    });
    $('#chalStart').addEventListener('click', () => {
      CH.phase = 'idle';
      chalStart();
      Sound.ready();
    });
    $('#chalKeys').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-move]');
      if (b) chalTap(b.dataset.move);
    });
  }

  function sdPreview() {
    SD.pending = SCR.scrambleFor(SD.ev, SCR.randomSeed());
    return SD.pending;
  }

  function bindSuddenDeath() {
    const sel = $('#sdEvent');
    Object.keys(SD_EVENTS).forEach((id) => {
      const o = document.createElement('option');
      o.value = id;
      const name = BY_ID[id] ? BY_ID[id].name : id;
      o.textContent = name + ' · ' + fmt(SD_EVENTS[id].base);
      sel.appendChild(o);
    });
    sel.value = SD.ev;
    sel.addEventListener('change', () => {
      SD.ev = sel.value;
      SD.active = false;
      SD.last = null;
      SD.round = 1;
      SD.target = sdCfg().base;
      sdPreview();
      if (sdTimer) sdTimer.reset();
      sdRender();
      toast(
        (BY_ID[SD.ev] ? BY_ID[SD.ev].name : SD.ev) + ' · 목표 ' + fmt(SD.target) + '부터 시작',
        null,
        '💀'
      );
    });
    $('#sdStart').addEventListener('click', () => {
      if (SD.active) {
        SD.active = false;
        if (sdTimer) sdTimer.reset();
        sdRender();
      } else sdStart();
    });
    $('#sdQuit').addEventListener('click', () => {
      SD.active = false;
      if (sdTimer) sdTimer.reset();
      sdRender();
    });
    sdTimer = createTimer({
      pad: $('#sdPad'),
      time: $('#sdTime'),
      overlay: null,
      noInspection: true,
      onFinish: sdRoundDone
    });
    const pad = $('#sdPad');
    pad.addEventListener('pointerdown', (e) => {
      if (e.button && e.button > 0) return;
      e.preventDefault();
      if (!SD.active) {
        sdStart();
        return;
      }
      Sound.init();
      sdTimer.press();
    });
    pad.addEventListener('pointerup', (e) => {
      e.preventDefault();
      sdTimer.release();
    });
    pad.addEventListener('pointercancel', () => sdTimer.release());
    pad.addEventListener('contextmenu', (e) => e.preventDefault());
    sdPreview();
    sdRender();
  }

  function bindStats() {
    $('#setInspection').addEventListener('change', (e) => {
      S.settings.inspection = e.target.checked;
      save();
    });
    $('#setPreview').addEventListener('change', (e) => {
      S.settings.preview = e.target.checked;
      $('#btnPreview').setAttribute('aria-pressed', S.settings.preview ? 'true' : 'false');
      save();
      renderPreview(BY_ID[S.settings.event]);
    });
    $('#setSplits').addEventListener('change', (e) => {
      S.settings.splits = e.target.checked;
      save();
      lastSplits = null;
      renderSplitBar(null);
    });
    $('#setSound').addEventListener('change', (e) => {
      S.settings.sound = e.target.checked;
      save();
      renderHud();
    });
    $('#setTheme').addEventListener('change', (e) => {
      S.settings.theme = e.target.checked ? 'light' : 'dark';
      save();
      renderHud();
    });
    $('#btnResetAll').addEventListener('click', () => {
      if (!window.confirm('모든 기록·XP·업적을 지우고 처음 상태로 돌아갑니다. 계속할까요?')) return;
      const keepTheme = S.settings.theme;
      S = defaults();
      S.settings.theme = keepTheme;
      save();
      setEvent(S.settings.event);
      renderAll();
      toast('모든 기록을 지웠어요', null, '🧹');
    });
  }

  /* ================================================================ init === */
  const timer = createTimer({
    pad: $('#timerPad'),
    time: $('#timerTime'),
    overlay: $('#inspectOverlay'),
    allowSplit: () => !!S.settings.splits,
    onSplit: (segs) => {
      lastSplits = null;
      renderSplitBar(segs);
    },
    onFinish: (res) => onSolve(res)
  });

  function renderAll() {
    renderHud();
    renderQuests();
    renderSolveList();
    renderStatsStrip();
    renderChart();
    renderSplitBar(null);
    renderStats();
    renderBattleAll();
    renderChal();
    sdRender();
  }

  function init() {
    Confetti.init();
    ensureDaily();
    bindTopbar();
    bindTabs();
    bindGuide();
    bindTimer();
    bindQuests();
    bindBattle();
    bindGames();
    bindSuddenDeath();
    bindStats();
    setEvent(S.settings.event || '333');
    $('#btnPreview').setAttribute('aria-pressed', S.settings.preview ? 'true' : 'false');
    renderHud();
    renderQuests();
    renderSolveList();
    renderStatsStrip();
    renderChart();
    renderSplitBar(null);
    renderStats();
    renderBattleAll();
    sdRender();
    handleHash();
    window.addEventListener('hashchange', handleHash);
    // a fresh record for "오늘 처음 방문" toast
    if ((S.quests.streak | 0) === 1 && !S.flags.welcomed) {
      S.flags.welcomed = true;
      save();
      setTimeout(() => toast('Cube Arena에 온 것을 환영해요 · ' + (S.quests.items || []).length + '개 퀘스트가 기다려요', 'good', '🧊'), 700);
    }
    checkAchievements();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
