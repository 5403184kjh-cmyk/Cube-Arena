/* =========================================================================
   Cube Arena — puzzle geometry & SVG previews
   Sticker-level models. Every turn is built from real 3D geometry: a sticker
   is (position, normal); a turn rotates a layer and the result is matched back
   onto the sticker table, so the permutations are always consistent.
   ========================================================================= */
(function (global) {
  'use strict';

  const EPS = 1e-4;
  const HALF_PI = Math.PI / 2;
  const TAU3 = (2 * Math.PI) / 3;

  /* ------------------------------------------------------------ linear -- */
  function scale(v, k) {
    return [v[0] * k, v[1] * k, v[2] * k];
  }
  function add(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  }
  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }
  function norm(v) {
    const l = Math.sqrt(dot(v, v)) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  function round4(v) {
    return Math.round(v * 10000) / 10000;
  }
  function vkey(p, n) {
    return (
      round4(p[0]) + ',' + round4(p[1]) + ',' + round4(p[2]) + '|' +
      round4(n[0]) + ',' + round4(n[1]) + ',' + round4(n[2])
    );
  }
  function vkey3(v) {
    return round4(v[0]) + ',' + round4(v[1]) + ',' + round4(v[2]);
  }
  function rotMatrix(axis, angle) {
    const a = norm(axis);
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const C = 1 - c;
    const x = a[0];
    const y = a[1];
    const z = a[2];
    return [
      [x * x * C + c, x * y * C - z * s, x * z * C + y * s],
      [y * x * C + z * s, y * y * C + c, y * z * C - x * s],
      [z * x * C - y * s, z * y * C + x * s, z * z * C + c]
    ];
  }
  function mulM(M, v) {
    return [
      M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
      M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
      M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]
    ];
  }

  /* ---------------------------------------------------------- palette --- */
  const PALETTE = ['#f4f7ff', '#ef4444', '#22c55e', '#fbbf24', '#f97316', '#3b82f6'];
  const PALETTE8 = ['#f4f7ff', '#ef4444', '#22c55e', '#fbbf24', '#f97316', '#3b82f6', '#a855f7', '#14b8a6'];

  /* ------------------------------------------------------------- cube --- */
  const CUBE_FACES = [
    { id: 'U', n: [0, 1, 0], r: [1, 0, 0], u: [0, 0, -1], cell: [1, 0] },
    { id: 'R', n: [1, 0, 0], r: [0, 0, -1], u: [0, 1, 0], cell: [2, 1] },
    { id: 'F', n: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0], cell: [1, 1] },
    { id: 'D', n: [0, -1, 0], r: [1, 0, 0], u: [0, 0, 1], cell: [1, 2] },
    { id: 'L', n: [-1, 0, 0], r: [0, 0, 1], u: [0, 1, 0], cell: [0, 1] },
    { id: 'B', n: [0, 0, -1], r: [-1, 0, 0], u: [0, 1, 0], cell: [3, 1] }
  ];

  const FACE_MOVE = {
    U: { ax: 1, dir: 1, sign: -1 },
    D: { ax: 1, dir: -1, sign: 1 },
    R: { ax: 0, dir: 1, sign: -1 },
    L: { ax: 0, dir: -1, sign: 1 },
    F: { ax: 2, dir: 1, sign: -1 },
    B: { ax: 2, dir: -1, sign: 1 }
  };

  function buildCube(n) {
    const m = n - 1;
    const stickers = [];
    CUBE_FACES.forEach((f, fi) => {
      for (let row = 0; row < n; row++) {
        for (let col = 0; col < n; col++) {
          const p = add(add(scale(f.n, m), scale(f.r, -m + 2 * col)), scale(f.u, m - 2 * row));
          stickers.push({ p: p, n: f.n.slice(), face: fi, faceId: f.id, row: row, col: col, color: PALETTE[fi] });
        }
      }
    });
    return { type: 'cube', n: n, stickers: stickers };
  }

  function cubeMoveSpec(model, tok) {
    const mt = /^(\d*)([URFDLB])(w?)(2|'|)$/.exec(tok);
    if (!mt) return null;
    const meta = FACE_MOVE[mt[2]];
    let depth;
    if (mt[3] === 'w') depth = mt[1] ? parseInt(mt[1], 10) : 2;
    else if (mt[1]) depth = parseInt(mt[1], 10);
    else depth = 1;
    depth = Math.max(1, Math.min(depth, model.n));
    const turns = mt[4] === '2' ? 2 : mt[4] === "'" ? -1 : 1;
    return { ax: meta.ax, dir: meta.dir, sign: meta.sign * turns, depth: depth };
  }

  function cubeLayer(model, spec) {
    const lo = model.n - 1 - 2 * (spec.depth - 1) - EPS;
    const out = [];
    model.stickers.forEach((s, i) => {
      if (s.p[spec.ax] * spec.dir >= lo) out.push(i);
    });
    return out;
  }

  /* ------------------------------------------------------------ skewb --- */
  function buildSkewb() {
    const stickers = [];
    CUBE_FACES.forEach((f, fi) => {
      for (let row = -1; row <= 1; row++) {
        for (let col = -1; col <= 1; col++) {
          if ((col === 0) !== (row === 0)) continue;
          const p =
            col === 0 && row === 0
              ? scale(f.n, 2)
              : add(add(scale(f.n, 2), scale(f.r, 2 * col)), scale(f.u, 2 * row));
          stickers.push({ p: p, n: f.n.slice(), face: fi, faceId: f.id, col: col, row: row, color: PALETTE[fi] });
        }
      }
    });
    return { type: 'skewb', stickers: stickers };
  }

  const SKEWB_AXIS = {
    R: [1, -1, 1],
    U: [-1, 1, 1],
    L: [-1, -1, -1],
    B: [1, 1, -1]
  };

  function skewbSpec(tok) {
    const mt = /^([RULB])(2|'|)$/.exec(tok);
    if (!mt) return null;
    return { axis: SKEWB_AXIS[mt[1]], turns: mt[2] === '2' ? 2 : mt[2] === "'" ? -1 : 1 };
  }

  function skewbLayer(model, spec) {
    const a = norm(spec.axis);
    const out = [];
    model.stickers.forEach((s, i) => {
      if (dot(s.p, a) >= 2 - EPS) out.push(i);
    });
    return out;
  }

  /* ------------------------------------------------ tetra / octahedron -- */
  function subTriangles(A, B, C) {
    const P = (i, j) => [
      A[0] + (i / 3) * (B[0] - A[0]) + (j / 3) * (C[0] - A[0]),
      A[1] + (i / 3) * (B[1] - A[1]) + (j / 3) * (C[1] - A[1]),
      A[2] + (i / 3) * (B[2] - A[2]) + (j / 3) * (C[2] - A[2])
    ];
    const tris = [];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3 - i; j++) tris.push([P(i, j), P(i + 1, j), P(i, j + 1)]);
    }
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2 - i; j++) tris.push([P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)]);
    }
    return tris.map((t) => ({
      v: t,
      c: [
        (t[0][0] + t[1][0] + t[2][0]) / 3,
        (t[0][1] + t[1][1] + t[2][1]) / 3,
        (t[0][2] + t[1][2] + t[2][2]) / 3
      ]
    }));
  }

  const TETRA_V = [
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1]
  ];

  function buildPoly(kind) {
    const faces = [];
    const stickers = [];
    if (kind === 'pyra') {
      TETRA_V.forEach((v, f) => {
        const vs = TETRA_V.filter((_, i) => i !== f);
        const n = norm(scale(v, -1));
        const color = PALETTE[f];
        faces.push({ verts: vs, n: n, axis: norm(v), color: color });
        subTriangles(vs[0], vs[1], vs[2]).forEach((t, k) => {
          stickers.push({ p: t.c, n: n.slice(), face: f, k: k, color: color });
        });
      });
    } else {
      const signs = [];
      [1, -1].forEach((sx) => [1, -1].forEach((sy) => [1, -1].forEach((sz) => signs.push([sx, sy, sz]))));
      const ax = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
      ];
      signs.forEach((sg, fi) => {
        const vs = ax.map((a) => [a[0] * sg[0], a[1] * sg[1], a[2] * sg[2]]);
        const n = norm(sg);
        const color = PALETTE8[fi];
        faces.push({ verts: vs, n: n, axis: n, color: color });
        subTriangles(vs[0], vs[1], vs[2]).forEach((t, k) => {
          stickers.push({ p: t.c, n: n.slice(), face: fi, k: k, color: color });
        });
      });
    }
    return { type: kind, stickers: stickers, faces: faces };
  }

  function shellLayer(model, axis, fromTop) {
    const a = norm(axis);
    const values = model.stickers.map((s) => round4(dot(s.p, a)));
    const uniq = Array.from(new Set(values)).sort((x, y) => (fromTop ? y - x : x - y));
    const keep = uniq.slice(0, 2);
    const out = [];
    values.forEach((v, i) => {
      if (keep.indexOf(v) >= 0) out.push(i);
    });
    return out;
  }

  /* --------------------------------------------------- permutation core -- */
  function permFromLayer(stickers, layer, axis, angle) {
    const M = rotMatrix(axis, angle);
    const idx = new Map();
    stickers.forEach((s, i) => idx.set(vkey(s.p, s.n), i));
    const perm = stickers.map((_, i) => i);
    const seen = new Set();
    for (let li = 0; li < layer.length; li++) {
      const i = layer[li];
      const s = stickers[i];
      const j = idx.get(vkey(mulM(M, s.p), mulM(M, s.n)));
      if (j === undefined || seen.has(j)) return null;
      seen.add(j);
      perm[i] = j;
    }
    return seen.size === layer.length ? perm : null;
  }

  /* -------------------------------------------------------- puzzle API -- */
  const CACHE = {};

  function modelFor(kind) {
    if (CACHE[kind]) return CACHE[kind];
    let m;
    if (kind === 'cube2') m = buildCube(2);
    else if (kind === 'cube4') m = buildCube(4);
    else if (kind === 'skewb') m = buildSkewb();
    else if (kind === 'pyra' || kind === 'fto') m = buildPoly(kind);
    else m = buildCube(3);
    m.permCache = new Map();
    CACHE[kind] = m;
    return m;
  }

  function axisVec(ax) {
    return ax === 0 ? [1, 0, 0] : ax === 1 ? [0, 1, 0] : [0, 0, 1];
  }

  function permFor(model, token) {
    if (model.permCache.has(token)) return model.permCache.get(token);
    let perm = null;
    if (model.type === 'cube') {
      const spec = cubeMoveSpec(model, token);
      if (spec) perm = permFromLayer(model.stickers, cubeLayer(model, spec), axisVec(spec.ax), spec.sign * HALF_PI);
    } else if (model.type === 'skewb') {
      const spec = skewbSpec(token);
      if (spec) perm = permFromLayer(model.stickers, skewbLayer(model, spec), spec.axis, spec.turns * TAU3);
    } else if (model.type === 'pyra') {
      const f = 'ULRB'.indexOf(token.replace(/'|2/g, ''));
      if (f >= 0) {
        const face = model.faces[f];
        const turns = token.indexOf("'") >= 0 ? -1 : token.indexOf('2') >= 0 ? 2 : 1;
        const layer = shellLayer(model, face.axis, false);
        perm = permFromLayer(model.stickers, layer, face.axis, turns * TAU3);
      }
    } else if (model.type === 'fto') {
      const f = ['U', 'D', 'F', 'B', 'L', 'R', 'BL', 'BR'].indexOf(token.replace(/'|2/g, ''));
      if (f >= 0) {
        const face = model.faces[f];
        const turns = token.indexOf("'") >= 0 ? -1 : token.indexOf('2') >= 0 ? 2 : 1;
        const layer = shellLayer(model, face.n, true);
        perm = permFromLayer(model.stickers, layer, face.n, turns * TAU3);
      }
    }
    model.permCache.set(token, perm || null);
    return perm || null;
  }

  function solved(kind) {
    return modelFor(kind).stickers.map((s) => s.color);
  }

  function scrambleState(kind, text) {
    const m = modelFor(kind);
    let colors = solved(kind);
    (text || '')
      .split(/\s+/)
      .filter(Boolean)
      .forEach((tok) => {
        const perm = permFor(m, tok);
        if (!perm) return;
        const next = colors.slice();
        for (let i = 0; i < perm.length; i++) next[perm[i]] = colors[i];
        colors = next;
      });
    return colors;
  }

  /* ------------------------------------------------------- svg helpers -- */
  function svgOpen(w, h, cls) {
    return (
      '<svg class="pz-svg ' + (cls || '') + '" viewBox="0 0 ' + w + ' ' + h +
      '" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
    );
  }

  function cubeSVG(kind, colors) {
    const n = modelFor(kind).n;
    const cell = n === 2 ? 27 : n === 3 ? 17 : 13;
    const gap = 2.6;
    const fs = n * cell;
    const g = 7;
    const W = 4 * fs + 3 * g;
    const H = 3 * fs + 2 * g;
    let out = svgOpen(W, H, 'pz-cube');
    CUBE_FACES.forEach((f, fi) => {
      const ox = f.cell[0] * (fs + g);
      const oy = f.cell[1] * (fs + g);
      for (let row = 0; row < n; row++) {
        for (let col = 0; col < n; col++) {
          const idx = fi * n * n + row * n + col;
          out +=
            '<rect x="' + (ox + col * cell + gap / 2).toFixed(2) +
            '" y="' + (oy + row * cell + gap / 2).toFixed(2) +
            '" width="' + (cell - gap).toFixed(2) +
            '" height="' + (cell - gap).toFixed(2) +
            '" rx="' + (cell > 20 ? 5 : 3) + '" fill="' + colors[idx] + '"/>';
        }
      }
    });
    return out + '</svg>';
  }

  function skewbSVG(colors) {
    const S = 62;
    const g = 8;
    const t = S / 3;
    const W = 4 * S + 3 * g;
    const H = 3 * S + 2 * g;
    let out = svgOpen(W, H, 'pz-skewb');
    CUBE_FACES.forEach((f, fi) => {
      const x = f.cell[0] * (S + g);
      const y = f.cell[1] * (S + g);
      const base = fi * 5;
      const tl = colors[base];
      const tr = colors[base + 1];
      const ce = colors[base + 2];
      const bl = colors[base + 3];
      const br = colors[base + 4];
      const tri = (pts, fill) =>
        '<path d="M' + pts.map((p) => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join('L') + 'Z" fill="' + fill +
        '" stroke="rgba(6,10,22,.5)" stroke-width="1"/>';
      out += tri([[x, y], [x + 2 * t, y], [x, y + 2 * t]], tl);
      out += tri([[x + S, y], [x + S - 2 * t, y], [x + S, y + 2 * t]], tr);
      out += tri([[x, y + S], [x + 2 * t, y + S], [x, y + S - 2 * t]], bl);
      out += tri([[x + S, y + S], [x + S - 2 * t, y + S], [x + S, y + S - 2 * t]], br);
      out +=
        '<rect x="' + (x + t).toFixed(2) + '" y="' + (y + t).toFixed(2) + '" width="' + t.toFixed(2) +
        '" height="' + t.toFixed(2) + '" fill="' + ce + '" stroke="rgba(6,10,22,.5)" stroke-width="1"/>';
    });
    return out + '</svg>';
  }

  /* ------------------------------------------- net unfolding (polyhedra) -- */
  function side(a, b, c) {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  }

  function equilateral(a, b, s) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const h = (s * Math.sqrt(3)) / 2;
    return [
      [mx - uy * h, my + ux * h],
      [mx + uy * h, my - ux * h]
    ];
  }

  function bary(p, A, B, C) {
    const v0 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const v1 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const v2 = [p[0] - A[0], p[1] - A[1], p[2] - A[2]];
    const d00 = dot(v0, v0);
    const d01 = dot(v0, v1);
    const d11 = dot(v1, v1);
    const d20 = dot(v2, v0);
    const d21 = dot(v2, v1);
    const den = d00 * d11 - d01 * d01 || 1;
    const b = (d11 * d20 - d01 * d21) / den;
    const c = (d00 * d21 - d01 * d20) / den;
    return [1 - b - c, b, c];
  }

  function unfold(model) {
    const faces = model.faces;
    const edgeMap = new Map();
    faces.forEach((f, i) => {
      for (let e = 0; e < 3; e++) {
        const a = f.verts[e];
        const b = f.verts[(e + 1) % 3];
        const key = [vkey3(a), vkey3(b)].sort().join('~');
        if (!edgeMap.has(key)) edgeMap.set(key, []);
        edgeMap.get(key).push(i);
      }
    });
    const s = 20;
    const p2 = new Array(faces.length).fill(null);
    p2[0] = [[0, 0], [s, 0], [s / 2, (s * Math.sqrt(3)) / 2]];
    const order = [0];
    /* tetrahedron: spread from the first face so the net is the classic
       "triforce" (one face in the middle, three around it).  octahedron:
       walk along the surface, which unrolls into the classic strip. */
    const breadth = model.type === 'pyra';
    let head = 0;
    let guard = 0;
    while (order.length < faces.length && guard++ < 500) {
      const cur = breadth ? order[head] : order[order.length - 1];
      const fcur = faces[cur];
      let advanced = false;
      for (let e = 0; e < 3; e++) {
        const a = fcur.verts[e];
        const b = fcur.verts[(e + 1) % 3];
        const key = [vkey3(a), vkey3(b)].sort().join('~');
        const adj = edgeMap.get(key) || [];
        if (adj.length !== 2) continue;
        const nf = adj[0] === cur ? adj[1] : adj[0];
        if (p2[nf]) continue;
        const ia = fcur.verts.findIndex((v) => vkey3(v) === vkey3(a));
        const ib = fcur.verts.findIndex((v) => vkey3(v) === vkey3(b));
        const ic = 3 - ia - ib;
        const A2 = p2[cur][ia];
        const B2 = p2[cur][ib];
        const C2 = p2[cur][ic];
        const cands = equilateral(A2, B2, s);
        const sgn = side(A2, B2, C2);
        const chosen = side(A2, B2, cands[0]) * sgn < 0 ? cands[0] : cands[1];
        const arr = [];
        faces[nf].verts.forEach((v, k) => {
          if (vkey3(v) === vkey3(a)) arr[k] = A2;
          else if (vkey3(v) === vkey3(b)) arr[k] = B2;
          else arr[k] = chosen;
        });
        p2[nf] = arr;
        order.push(nf);
        advanced = true;
        if (!breadth) break;
      }
      if (breadth) head++;
      else {
        if (!advanced) order.pop();
        if (!order.length) break;
      }
      if (breadth && head >= order.length) break;
    }
    return { p2: p2, order: order };
  }

  function polyNet(model) {
    const uf = unfold(model);
    const tris = [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    model.faces.forEach((f, fi) => {
      const arr = uf.p2[fi];
      subTriangles(f.verts[0], f.verts[1], f.verts[2]).forEach((t) => {
        if (!arr) {
          tris.push(null);
          return;
        }
        const pts = t.v.map((v) => {
          const w = bary(v, f.verts[0], f.verts[1], f.verts[2]);
          const q = [
            w[0] * arr[0][0] + w[1] * arr[1][0] + w[2] * arr[2][0],
            w[0] * arr[0][1] + w[1] * arr[1][1] + w[2] * arr[2][1]
          ];
          if (q[0] < minX) minX = q[0];
          if (q[1] < minY) minY = q[1];
          if (q[0] > maxX) maxX = q[0];
          if (q[1] > maxY) maxY = q[1];
          return q;
        });
        tris.push(pts);
      });
    });
    return { tris: tris, minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  function polySVG(kind, colors, opts) {
    const model = modelFor(kind);
    if (!model.net) model.net = polyNet(model);
    const net = model.net;
    const pad = 5;
    const w = net.maxX - net.minX || 1;
    const h = net.maxY - net.minY || 1;
    const size = (opts && opts.size) || 240;
    const sf = Math.min((size - pad * 2) / w, (size - pad * 2) / h);
    const W = +(w * sf + pad * 2).toFixed(1);
    const H = +(h * sf + pad * 2).toFixed(1);
    let out = svgOpen(W, H, 'pz-' + kind);
    out +=
      '<g transform="translate(' + pad + ',' + pad + ') scale(' + sf.toFixed(4) + ') translate(' +
      (-net.minX).toFixed(3) + ',' + (-net.minY).toFixed(3) + ')">';
    net.tris.forEach((pts, i) => {
      if (!pts) return;
      const d = 'M' + pts.map((p) => p[0].toFixed(3) + ' ' + p[1].toFixed(3)).join('L') + 'Z';
      out += '<path d="' + d + '" fill="' + colors[i] + '" stroke="rgba(6,10,22,.55)" stroke-width="0.5"/>';
    });
    out += '</g></svg>';
    return out;
  }

  function svgFor(kind, colors, opts) {
    if (kind === 'cube2' || kind === 'cube3' || kind === 'cube4') return cubeSVG(kind, colors);
    if (kind === 'skewb') return skewbSVG(colors);
    if (kind === 'pyra' || kind === 'fto') return polySVG(kind, colors, opts);
    return '';
  }

  /* ------------------------------------------------------------- clock -- */
  /* Face-turning linkage, following the real mechanism (WCA/TNoodle model):
     - 9 dials per side in a 3x3 grid (0=UL 1=U 2=UR / 3=L 4=C 5=R / 6=DL 7=D 8=DR)
     - a pin that is up links the four dials around it (corner + its two edges +
       the centre) to the wheel at that corner
     - several pins up merge their groups, so turning a wheel moves the union
     - the four corner dials are one piece seen from both sides, so they always
       read the same value while the other side of the piece follows
     - turning a wheel whose pin is down works the same way on the back side
     `back[]` is stored as it reads after the y2 flip.                        */
  const CLOCK_ORDER = ['UL', 'UR', 'DR', 'DL'];
  const CLOCK_BLOCK = {
    UL: [0, 1, 3, 4],
    UR: [1, 2, 4, 5],
    DR: [4, 5, 7, 8],
    DL: [3, 4, 6, 7]
  };
  const CLOCK_INDEX = { UL: 0, UR: 2, DR: 8, DL: 6 };
  const CLOCK_MIRROR = [2, 1, 0, 5, 4, 3, 8, 7, 6];

  function ClockPuzzle() {
    this.front = new Array(9).fill(0);
    this.back = new Array(9).fill(0);
    this.pins = { UL: false, UR: false, DR: false, DL: false };
  }

  ClockPuzzle.prototype.clone = function () {
    const c = new ClockPuzzle();
    c.front = this.front.slice();
    c.back = this.back.slice();
    c.pins = Object.assign({}, this.pins);
    return c;
  };

  ClockPuzzle.prototype.setPins = function (obj) {
    CLOCK_ORDER.forEach((k) => (this.pins[k] = !!obj[k]));
  };

  /* pins as they stick out on the given side (a pin is up on one side only) */
  ClockPuzzle.prototype.pinsOn = function (side) {
    const out = {};
    CLOCK_ORDER.forEach((k) => (out[k] = side === 'back' ? !this.pins[k] : this.pins[k]));
    return out;
  };

  ClockPuzzle.prototype.upOn = function (side) {
    const v = this.pinsOn(side);
    return CLOCK_ORDER.filter((k) => v[k]);
  };

  /* kFront: hours clockwise as seen from the FRONT */
  ClockPuzzle.prototype.turnWheel = function (wheel, kFront) {
    const k = ((kFront % 12) + 12) % 12;
    if (!k) return;
    if (this.pins[wheel]) {
      const set = {};
      this.upOn('front').forEach((p) => CLOCK_BLOCK[p].forEach((i) => (set[i] = 1)));
      Object.keys(set).forEach((i) => (this.front[i] = (this.front[i] + k) % 12));
      this.upOn('front').forEach((p) => {
        const i = CLOCK_MIRROR[CLOCK_INDEX[p]];
        this.back[i] = (this.back[i] + k) % 12;
      });
    } else {
      const set = {};
      this.upOn('back').forEach((p) => CLOCK_BLOCK[p].forEach((i) => (set[i] = 1)));
      Object.keys(set).forEach((i) => (this.back[i] = (this.back[i] - k + 12) % 12));
      this.upOn('back').forEach((p) => {
        const i = CLOCK_INDEX[p];
        this.front[i] = (this.front[i] - k + 12) % 12;
      });
    }
  };

  const CLOCK_PINSET = {
    UR: ['UR'],
    DR: ['DR'],
    DL: ['DL'],
    UL: ['UL'],
    U: ['UL', 'UR'],
    R: ['UR', 'DR'],
    D: ['DR', 'DL'],
    L: ['UL', 'DL'],
    ALL: ['UL', 'UR', 'DR', 'DL']
  };

  function pinsetObj(list) {
    const o = {};
    list.forEach((k) => (o[k] = true));
    return o;
  }
  function invertPinset(o) {
    const out = {};
    CLOCK_ORDER.forEach((k) => (out[k] = !o[k]));
    return out;
  }

  /* Apply one WCA clock token. Before a y2 the token names pins on the front,
     after it the same names describe the back side (where a pin is up when it
     is down on the front), and clockwise is read from that side. */
  ClockPuzzle.prototype.applyToken = function (side, token) {
    const mt = /^(UR|DR|DL|UL|U|R|D|L|ALL)(\d)([+-])$/.exec(token);
    if (!mt) return false;
    const name = mt[1];
    const amount = parseInt(mt[2], 10) * (mt[3] === '-' ? -1 : 1);
    const group = CLOCK_PINSET[name];
    if (side === 'back') {
      this.setPins(invertPinset(pinsetObj(group)));
      this.turnWheel(group[0], -amount);
    } else {
      this.setPins(pinsetObj(group));
      this.turnWheel(group[0], amount);
    }
    return true;
  };

  ClockPuzzle.prototype.applyScramble = function (text) {
    let side = 'front';
    (text || '')
      .split(/\s+/)
      .filter(Boolean)
      .forEach((t) => {
        if (t === 'y2') side = 'back';
        else this.applyToken(side, t);
      });
    return this;
  };

  ClockPuzzle.prototype.isSolved = function () {
    return this.front.every((v) => v === 0) && this.back.every((v) => v === 0);
  };

  ClockPuzzle.prototype.correct = function () {
    let n = 0;
    this.front.forEach((v) => v === 0 && n++);
    this.back.forEach((v) => v === 0 && n++);
    return n;
  };

  /* mini-game scramble: random pin configurations, always solvable */
  function clockScrambleMoves(count) {
    const out = [];
    const subsets = [
      ['UL'],
      ['UR'],
      ['DR'],
      ['DL'],
      ['UL', 'UR'],
      ['UR', 'DR'],
      ['DR', 'DL'],
      ['UL', 'DL'],
      ['UL', 'DR'],
      ['UR', 'DL'],
      ['UL', 'UR', 'DR'],
      ['UR', 'DR', 'DL'],
      ['DR', 'DL', 'UL'],
      ['DL', 'UL', 'UR'],
      ['UL', 'UR', 'DR', 'DL']
    ];
    for (let i = 0; i < count; i++) {
      const group = subsets[Math.floor(Math.random() * 11)];
      const wheel = group[Math.floor(Math.random() * group.length)];
      const amount = 1 + Math.floor(Math.random() * 11);
      out.push({ type: 'turn', pins: group, wheel: wheel, amount: amount * (Math.random() < 0.5 ? 1 : -1) });
      if (i === Math.floor(count / 2)) out.push({ type: 'flip' });
    }
    return out;
  }

  function scrambledClock(moves) {
    const c = new ClockPuzzle();
    moves.forEach((m) => {
      if (m.type === 'flip') return;
      c.setPins(pinsetObj(m.pins));
      c.turnWheel(m.wheel, m.amount);
    });
    return c;
  }

  function clockSVG(clock, opts) {
    const cell = (opts && opts.cell) || 44;
    const pad = 16;
    const faceW = cell * 3;
    const gap = 34;
    const W = (faceW + pad * 2) * 2 + gap;
    const H = faceW + pad * 2 + 28;
    let out = svgOpen(W, H, 'pz-clock');
    ['front', 'back'].forEach((side, si) => {
      const ox = pad + si * (faceW + pad * 2 + gap);
      const oy = pad + 22;
      out +=
        '<rect x="' + (ox - pad + 4) + '" y="' + (oy - 16) + '" width="' + (faceW + pad * 2 - 8) +
        '" height="' + (faceW + pad * 2 - 12) + '" rx="18" fill="rgba(255,255,255,.05)" stroke="rgba(150,180,255,.22)"/>';
      out +=
        '<text x="' + (ox + faceW / 2) + '" y="' + (oy - 6) + '" text-anchor="middle" font-size="11" fill="currentColor" opacity=".55">' +
        (side === 'front' ? '앞면' : '뒷면 (y2)') + '</text>';
      for (let i = 0; i < 9; i++) {
        const cx = ox + (i % 3) * cell + cell / 2;
        const cy = oy + Math.floor(i / 3) * cell + cell / 2;
        const v = clock[side][i];
        const ang = (v / 12) * 2 * Math.PI;
        const r = cell * 0.4;
        out +=
          '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="rgba(9,14,30,.9)" stroke="rgba(150,180,255,.35)" stroke-width="1.1"/>';
        out +=
          '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + Math.sin(ang) * r * 0.76).toFixed(2) +
          '" y2="' + (cy - Math.cos(ang) * r * 0.76).toFixed(2) + '" stroke="' + (v === 0 ? '#34d399' : '#f472b6') +
          '" stroke-width="2.2" stroke-linecap="round"/>';
        out += '<circle cx="' + cx + '" cy="' + cy + '" r="2" fill="' + (v === 0 ? '#34d399' : '#f472b6') + '"/>';
      }
      const pv = clock.pinsOn ? clock.pinsOn(side) : {};
      const pinPos = {
        UL: [ox - 9, oy - 9],
        UR: [ox + faceW + 9, oy - 9],
        DL: [ox - 9, oy + faceW + 9],
        DR: [ox + faceW + 9, oy + faceW + 9]
      };
      Object.keys(pinPos).forEach((k) => {
        out +=
          '<circle cx="' + pinPos[k][0] + '" cy="' + pinPos[k][1] + '" r="6" fill="' +
          (pv[k] ? '#22d3ee' : 'rgba(255,255,255,.07)') + '" stroke="rgba(150,180,255,.4)" stroke-width="1"/>';
      });
    });
    return out + '</svg>';
  }

  /* ------------------------------------------------------------ export -- */
  global.CA = global.CA || {};
  global.CA.PUZZLE = {
    PALETTE: PALETTE,
    modelFor: modelFor,
    solved: solved,
    scrambleState: scrambleState,
    svgFor: svgFor,
    cubeSVG: cubeSVG,
    ClockPuzzle: ClockPuzzle,
    clockSVG: clockSVG,
    clockScrambleMoves: clockScrambleMoves,
    scrambledClock: scrambledClock,
    CLOCK_ORDER: CLOCK_ORDER,
    CLOCK_BLOCK: CLOCK_BLOCK,
    CLOCK_INDEX: CLOCK_INDEX,
    CLOCK_PINSET: CLOCK_PINSET
  };
})(window);
