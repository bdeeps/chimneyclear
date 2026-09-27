// Chapter 5: grease filters. Oil droplets carried by the air have to follow it round sharp bends.
// Big ones can't: they keep going (inertia) and hit the metal. This is inertial impaction.
// The model is a real-units 2D simulation of one cross-section. Air follows the channel (plug flow
// along its centre line) or, in the mesh, flows round each strand (potential flow round a cylinder).
// Each droplet obeys Stokes drag: dv/dt = (u − v)/τ with τ = ρd²/18μ (see tauOf in kitchen.js),
// integrated exactly over each small step. The readout's catch rate comes from filterCatch().
import { THREE, M, canvasTexture, clamp } from '../kit.js';
import { filterCatch, tauOf, stokes, operatingPoint, SPEEDS, fitNarrow } from '../kitchen.js';

const DUCT = { diam: 150, bends: 2, len: 3, flex: false, mode: 'duct', window: true };
// Grease slowly clogs a filter. Mesh: its resistance grows about 60% a week of heavy cooking;
// baffle: oil drains away, about 3% a week; filterless: none (the oil cup fills instead). Illustrative rates.
const CLOG = { baffle: 0.03, mesh: 0.6, filterless: 0 };
const TYPES = {
  baffle: { name: 'Baffle filter', note: '10 mm channels, two sharp turns' },
  mesh: { name: 'Mesh filter', note: '8 layers of aluminium mesh, strands 0.3 mm (one layer shown, magnified)' },
  filterless: { name: 'Filterless', note: 'one gentle turn round a curved panel, 30 mm gap' },
};

// ---------------------------------------------------------------- geometry (millimetres)
function line(pts, a, b, n) { for (let i = 0; i < n; i++) { const k = i / n; pts.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); } }
function arc(pts, c, r, t0, t1, n) { for (let i = 0; i < n; i++) { const t = t0 + (t1 - t0) * (i / n); pts.push([c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)]); } }
function channel(kind) {
  const p = [];
  let W;
  if (kind === 'baffle') {
    W = 10;
    line(p, [0, -45], [0, 0], 45); arc(p, [6, 0], 6, Math.PI, 0, 30); line(p, [12, 0], [12, -12], 12);
    arc(p, [18, -12], 6, Math.PI, 2 * Math.PI, 30); line(p, [24, -12], [24, 45], 57); p.push([24, 45]);
  } else {
    W = 30;
    line(p, [0, -60], [0, 0], 40); arc(p, [22, 0], 22, Math.PI, Math.PI / 2, 40); line(p, [22, 22], [80, 22], 40); p.push([80, 22]);
  }
  // Tangents, normals, arc length.
  const C = p.map(([z, y], i) => {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
    const dz = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dz, dy) || 1;
    return { z, y, tz: dz / L, ty: dy / L, nz: -dy / L, ny: dz / L, s: 0 };
  });
  for (let i = 1; i < C.length; i++) C[i].s = C[i - 1].s + Math.hypot(C[i].z - C[i - 1].z, C[i].y - C[i - 1].y);
  return { C, W, len: C[C.length - 1].s };
}
function nearest(ch, z, y) {
  let best = 0, bd = 1e9;
  for (let i = 0; i < ch.C.length; i++) { const c = ch.C[i], d = (c.z - z) ** 2 + (c.y - y) ** 2; if (d < bd) { bd = d; best = i; } }
  const c = ch.C[best];
  return { c, i: best, off: (z - c.z) * c.nz + (y - c.y) * c.ny, d: Math.sqrt(bd) };
}
// Mesh: 4 staggered rows of strands, 0.75 mm apart (60% open), periodic across a 3.75 mm window.
const MESH = { a: 0.15, pitch: 0.75, rows: [-1.2, -0.4, 0.4, 1.2], half: 1.875, ylo: -2.6, yhi: 2.6 };
function meshFibres() {
  const f = [];
  MESH.rows.forEach((y, r) => { for (let k = -3; k <= 3; k++) f.push([k * MESH.pitch + (r % 2 ? MESH.pitch / 2 : 0), y]); });
  return f;
}
function meshFlow(fib, U, z, y) {
  // Uniform flow up (+y) plus the potential-flow disturbance of the nearest strand.
  let best = null, bd = 1e9;
  for (const f of fib) { let dz = z - f[0]; dz -= Math.round(dz / (2 * MESH.half)) * 2 * MESH.half; const d = dz * dz + (y - f[1]) ** 2; if (d < bd) { bd = d; best = [dz, y - f[1]]; } }
  const r2 = Math.max(bd, 1e-6), a2 = MESH.a * MESH.a, [dz, dy] = best;
  // Complex potential W = U(ζ + a²/ζ) for flow along +y: velocity = U[(0,1) − a²·(2·dz·dy, dy²−dz²)/r⁴].
  const k = a2 / (r2 * r2);
  return { uz: -U * k * 2 * dz * dy, uy: U * (1 - k * (dy * dy - dz * dz)), dist: Math.sqrt(bd) };
}

export default {
  id: 'filters',
  short: 'Trapping the oil',
  title: 'How a filter traps oil you can’t see',
  subtitle: 'Air can turn a sharp corner. A heavy droplet of oil can’t, so it hits the metal.',
  view: { pos: [1.2, 3.9, 11.5], target: [1.0, 3.1, 0] },
  learn: `<p>Frying and tadka throw tiny <b>droplets of oil</b> into the air, most of them thinner than a hair. If they reach the fan, the duct and your walls, everything turns sticky. The chimney's filter has to catch them, but it can't be a fine sieve, or the air couldn't get through.</p>
    <p>A <b>baffle filter</b> uses a trick instead. Its steel blades force the air to zig-zag through narrow channels. Air is so light it follows the turns easily. A droplet of oil is about 750 times denser than air, so it carries on in a straight line, like a cyclist who can't make a hairpin bend, and <b>splats into the metal</b>. This is called <b>inertial impaction</b>. The oil then runs down the blades into the <b>oil collector</b>.</p>
    <p>A <b>mesh filter</b> catches droplets on layers of thin aluminium strands. It works well when clean, but the oil stays in the mesh, so it slowly <b>clogs</b> and the airflow drops. <b>Filterless</b> chimneys turn the air round a curved panel and let the spinning fan wheel fling oil into a cup. Some have an <b>auto-clean</b> button that heats the fan chamber so stuck oil melts and drains away.</p>
    <p class="tip"><b>Try it:</b> shrink the droplets until they slip through, then compare the three filters after a few weeks without cleaning.</p>`,
  terms: [
    { t: 'Inertia', d: 'An object’s tendency to keep moving in a straight line unless something pushes it off course.' },
    { t: 'Inertial impaction', d: 'Catching particles by making the air turn so fast that they hit a surface instead.' },
    { t: 'Micron (µm)', d: 'A thousandth of a millimetre. A hair is about 70 µm thick.' },
    { t: 'Stokes number', d: 'How far a droplet overshoots a turn compared with the turn’s size. Big numbers mean it hits the wall.' },
    { t: 'Auto-clean', d: 'A chimney feature that heats the fan chamber to melt oil into the collector.' },
  ],
  defaults: { type: 'baffle', d: 20, speed: 3, weeks: 0 },
  controls: [
    { key: 'type', type: 'seg', label: 'Filter', options: [{ v: 'baffle', label: 'Baffle' }, { v: 'mesh', label: 'Mesh' }, { v: 'filterless', label: 'Filterless' }], fmt: (v) => TYPES[v].name },
    { key: 'd', type: 'log', label: 'Droplet size', min: 1, max: 50, ends: ['1 µm', '50 µm'], fmt: (v) => (v < 10 ? v.toFixed(1) : Math.round(v)) + ' µm' },
    { key: 'speed', type: 'seg', label: 'Chimney speed', options: [{ v: 0, label: '1' }, { v: 1, label: '2' }, { v: 2, label: '3' }, { v: 3, label: 'Boost' }], fmt: (v) => ['low', 'medium', 'high', 'boost'][v] },
    { key: 'weeks', type: 'range', label: 'Weeks since cleaning', min: 0, max: 8, step: 1, ends: ['just cleaned', '2 months'], fmt: (v) => Math.round(v) + (Math.round(v) === 1 ? ' week' : ' weeks') },
  ],
  quiz: [
    { q: 'Why do oil droplets hit the blades of a baffle filter while the air gets through?', options: ['The blades are magnetic', 'The droplets are much heavier, so they can’t follow the sharp turns', 'The blades are sticky', 'The air is pushed round by the blades’ heat'], answer: 1, why: 'Heavy droplets carry on straight, by inertia, and splat into the metal.' },
    { q: 'Which droplets slip through most easily?', options: ['The biggest ones', 'The smallest ones', 'Only warm ones', 'They all get caught'], answer: 1, why: 'Tiny droplets are so light that the air drags them round the bends.' },
    { q: 'Why does a mesh filter need cleaning more often than a baffle filter?', options: ['It rusts', 'Oil stays trapped in the mesh and clogs it, cutting the airflow', 'It gets too hot', 'It catches nothing'], answer: 1, why: 'In a baffle filter the oil drains to the collector; in a mesh it builds up in the holes.' },
  ],
  reel: [
    { ms: 5800, caption: 'Air zig-zags through a baffle filter. Heavy oil droplets can’t turn in time and splat into the steel.', set: { type: 'baffle', d: 25, speed: 3, weeks: 0 }, view: { pos: [1.0, 3.4, 7.4], target: [1.0, 3.0, 0] }, spin: 0 },
  ],

  build({ stage }) {
    const fit = fitNarrow(stage);
    const root = new THREE.Group(); root.position.y = 3.3; stage.root.add(root);
    const sim = new THREE.Group(); sim.position.x = 3.0; root.add(sim);
    const wallMat = M.metal(0xc9ced6, { roughness: 0.3, side: THREE.DoubleSide });
    const DEP = 0.9;
    let built = null, ch = null, fib = null, sc = 1, zOff = 0, yOff = 0;
    const walls = new THREE.Group(); sim.add(walls);

    // Droplets (amber) and air (pale blue), plus caught oil left on the walls.
    const ND = 44, NA = 50;
    const dGeo = new THREE.SphereGeometry(1, 10, 8);
    const drops = new THREE.InstancedMesh(dGeo, M.glow(0xffb547), ND); drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage); drops.frustumCulled = false;
    const air = new THREE.InstancedMesh(dGeo, M.glow(0x8ef0ff, { transparent: true, opacity: 0.7 }), NA); air.instanceMatrix.setUsage(THREE.DynamicDrawUsage); air.frustumCulled = false;
    sim.add(drops, air);
    const D = Array.from({ length: ND }, () => ({ z: 0, y: 0, vz: 0, vy: 0, stuck: 0 }));
    const A = Array.from({ length: NA }, (_, i) => ({ s: 0, off: 0, z: 0, y: 0, ph: i / NA }));
    const fates = [];
    const R = (i) => { const x = Math.sin(i * 91.7 + 13.1) * 43758.5453; return x - Math.floor(x); };
    let seedN = 0;
    const title = stage.label('', [0, 0, 0], sim);
    const inLab = stage.label('Air and oil in', [0, 0, 0], sim), outLab = stage.label('Out to the fan', [0, 0, 0], sim);

    const toWorld = (z, y, out) => out.set((z - zOff) * sc, (y - yOff) * sc, 0);
    const spawn = (p, U) => {
      seedN++;
      if (built === 'mesh') { p.z = (R(seedN) * 2 - 1) * MESH.half; p.y = MESH.ylo; p.vz = 0; p.vy = U; }
      else { const c = ch.C[0], off = (R(seedN) * 2 - 1) * ch.W * 0.42; p.z = c.z + c.nz * off; p.y = c.y + c.ny * off + R(seedN + 7) * 8; p.vz = c.tz * U; p.vy = c.ty * U; }
      p.stuck = 0;
    };
    const ribbon = (pts) => {
      const pos = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [a, b] = [pts[i], pts[i + 1]];
        pos.push(a[0], a[1], -DEP, b[0], b[1], -DEP, b[0], b[1], DEP, a[0], a[1], -DEP, b[0], b[1], DEP, a[0], a[1], DEP);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      return new THREE.Mesh(g, wallMat);
    };
    const build = (kind) => {
      built = kind;
      walls.children.forEach((m) => m.geometry.dispose()); walls.clear();
      if (kind === 'mesh') {
        fib = meshFibres(); sc = 1.15; zOff = 0; yOff = 0;
        for (const [z, y] of fib) {
          if (Math.abs(z) > MESH.half + 0.01) continue;
          const c = new THREE.Mesh(new THREE.CylinderGeometry(MESH.a * sc, MESH.a * sc, DEP * 2, 20), M.metal(0xc9ced6, { roughness: 0.35 }));
          c.rotation.x = Math.PI / 2; c.position.set(z * sc, y * sc, 0); walls.add(c);
        }
        title.position.set(0, (MESH.yhi + 0.5) * sc, 0); inLab.position.set(0, (MESH.ylo - 0.35) * sc, 0); outLab.position.set(0, (MESH.yhi + 0.1) * sc, 0);
      } else {
        ch = channel(kind);
        const bb = ch.C.reduce((b, c) => [Math.min(b[0], c.z), Math.max(b[1], c.z), Math.min(b[2], c.y), Math.max(b[3], c.y)], [1e9, -1e9, 1e9, -1e9]);
        sc = kind === 'baffle' ? 0.072 : 0.04;
        zOff = (bb[0] + bb[1]) / 2; yOff = (bb[2] + bb[3]) / 2;
        for (const side of [-1, 1]) walls.add(ribbon(ch.C.map((c) => [(c.z + side * c.nz * ch.W / 2 - zOff) * sc, (c.y + side * c.ny * ch.W / 2 - yOff) * sc])));
        const c0 = ch.C[0], c1 = ch.C[ch.C.length - 1];
        title.position.set(0, (bb[3] - yOff) * sc + 0.75, 0);
        inLab.position.set((c0.z - zOff) * sc, (c0.y - yOff) * sc - 0.35, 0);
        outLab.position.set((c1.z - zOff) * sc + (kind === 'filterless' ? 0.3 : 0), (c1.y - yOff) * sc + 0.35, 0);
      }
      title.element.innerHTML = `<b>${TYPES[kind].name}</b> · ${TYPES[kind].note}`;
      D.forEach((p, i) => { spawn(p, 1); p.age = -i * 0.09; });
      A.forEach((a, i) => { a.s = (i / NA) * (kind === 'mesh' ? 1 : ch.len); a.off = (R(i + 50) * 2 - 1) * 0.42; if (kind === 'mesh') { a.z = (R(i + 90) * 2 - 1) * MESH.half; a.y = MESH.ylo + (i / NA) * (MESH.yhi - MESH.ylo); } });
      fates.length = 0;
    };

    // Chart: catch rate against droplet size for all three filters at the current airflow.
    const cur = { d: 20, Q: 900, type: 'baffle' };
    const COL = { baffle: '#ffb547', mesh: '#8ef0ff', filterless: '#c59bff' };
    const chart = canvasTexture(760, 520, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,12,18,.9)'; g.fillRect(0, 0, w, h);
      const x0 = 80, y0 = h - 70, cw = w - 120, chh = h - 150;
      const X = (d) => x0 + (Math.log(d) / Math.log(50)) * cw, Y = (e) => y0 - e * chh;
      g.font = '20px sans-serif'; g.lineWidth = 1;
      for (const e of [0, 0.5, 1]) { g.strokeStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.moveTo(x0, Y(e)); g.lineTo(x0 + cw, Y(e)); g.stroke(); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(Math.round(e * 100) + '%', 18, Y(e) + 7); }
      for (const d of [1, 3, 10, 30, 50]) { g.fillText(d + ' µm', X(d) - 20, y0 + 32); }
      for (const k of ['baffle', 'mesh', 'filterless']) {
        g.strokeStyle = COL[k]; g.lineWidth = k === cur.type ? 7 : 3; g.globalAlpha = k === cur.type ? 1 : 0.55; g.beginPath();
        for (let i = 0; i <= 80; i++) { const d = Math.exp((i / 80) * Math.log(50)); const e = filterCatch(k, d, cur.Q).eff; i ? g.lineTo(X(d), Y(e)) : g.moveTo(X(d), Y(e)); }
        g.stroke();
      }
      g.globalAlpha = 1;
      const e = filterCatch(cur.type, cur.d, cur.Q).eff;
      g.fillStyle = '#fff'; g.beginPath(); g.arc(X(cur.d), Y(e), 11, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e8eef8'; g.font = 'bold 26px sans-serif'; g.fillText('Share of droplets caught', 20, 38);
      g.font = 'bold 19px sans-serif'; let lx = 20;
      for (const k of ['baffle', 'mesh', 'filterless']) { g.fillStyle = COL[k]; g.fillText(TYPES[k].name, lx, 70); lx += g.measureText(TYPES[k].name).width + 26; }
      g.fillStyle = 'rgba(255,255,255,.6)'; g.font = '18px sans-serif'; g.fillText('droplet size', x0 + cw - 110, h - 10);
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 2.4), new THREE.MeshBasicMaterial({ map: chart.tex, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
    root.add(board);

    const o = new THREE.Object3D(), w = new THREE.Vector3();
    let lastDraw = '', flowNow = 900;
    const flowFor = (s) => operatingPoint(SPEEDS[s.speed], { ...DUCT, filterK: 1 + CLOG[s.type] * s.weeks }).Q;
    return {
      update(dt, s) {
        dt = Math.max(0, Math.min(dt, 0.05));
        fit();
        if (s.type !== built) build(s.type);
        flowNow = flowFor(s);
        const fc = filterCatch(s.type, s.d, flowNow), U = fc.U, tau = tauOf(s.d);
        const Lmm = built === 'mesh' ? MESH.yhi - MESH.ylo : ch.len;
        const slow = (Lmm / 1000 / U) / 3.2;                       // one pass takes about 3 s on screen
        const hmax = (built === 'mesh' ? 0.01 : 0.35) / 1000 / U;  // physical step: move at most 0.01/0.35 mm
        const T = dt * slow, n = Math.min(60, Math.ceil(T / hmax)), h = T / Math.max(1, n), e = Math.exp(-h / tau);
        const rDrop = 0.5 * s.d / 1000;                            // droplet radius, mm
        D.forEach((p, i) => {
          p.age = (p.age ?? 0) + dt;
          if (p.age < 0) { o.scale.setScalar(0.0001); o.updateMatrix(); drops.setMatrixAt(i, o.matrix); return; }
          if (p.stuck > 0) { p.stuck -= dt; p.y -= dt * (built === 'mesh' ? 0.05 : 3); if (p.stuck <= 0) spawn(p, U); }
          else for (let k = 0; k < n; k++) {
            let uz, uy, hit = false, out = false;
            if (built === 'mesh') {
              const f = meshFlow(fib, U, p.z, p.y); uz = f.uz; uy = f.uy; hit = f.dist < MESH.a + rDrop; out = p.y > MESH.yhi;
            } else {
              const nr = nearest(ch, p.z, p.y); uz = nr.c.tz * U; uy = nr.c.ty * U;
              hit = Math.abs(nr.off) > ch.W / 2 - rDrop || nr.d > ch.W / 2; out = nr.i >= ch.C.length - 2;
            }
            if (hit) { p.stuck = 1.8; fates.push(1); break; }
            if (out) { fates.push(0); spawn(p, U); p.age = -R(seedN) * 0.5; break; }
            p.vz = uz + (p.vz - uz) * e; p.vy = uy + (p.vy - uy) * e;
            p.z += p.vz * h * 1000; p.y += p.vy * h * 1000;
            if (built === 'mesh') { if (p.z > MESH.half) p.z -= 2 * MESH.half; if (p.z < -MESH.half) p.z += 2 * MESH.half; }
          }
          toWorld(p.z, p.y, w); o.position.copy(w); o.scale.setScalar(built === 'mesh' ? 0.07 : clamp(0.035 + s.d * 0.0025, 0.04, 0.16) * (p.stuck > 0 ? 1.3 : 1)); o.updateMatrix(); drops.setMatrixAt(i, o.matrix);
        });
        while (fates.length > 40) fates.shift();
        drops.instanceMatrix.needsUpdate = true;
        // Air tracers ride the flow exactly.
        A.forEach((a, i) => {
          if (built === 'mesh') {
            for (let k = 0; k < n; k++) { const f = meshFlow(fib, U, a.z, a.y); a.z += f.uz * h * 1000; a.y += f.uy * h * 1000; }
            if (a.y > MESH.yhi || !isFinite(a.y)) { a.y = MESH.ylo; a.z = (R(i + seedN) * 2 - 1) * MESH.half; }
            if (a.z > MESH.half) a.z -= 2 * MESH.half; if (a.z < -MESH.half) a.z += 2 * MESH.half;
            toWorld(a.z, a.y, w);
          } else {
            a.s = (a.s + U * T * 1000) % ch.len;
            const nr = ch.C.findIndex((c) => c.s >= a.s); const c = ch.C[Math.max(0, nr)];
            toWorld(c.z + c.nz * a.off * ch.W, c.y + c.ny * a.off * ch.W, w);
          }
          o.position.copy(w); o.scale.setScalar(0.035); o.updateMatrix(); air.setMatrixAt(i, o.matrix);
        });
        air.instanceMatrix.needsUpdate = true;
        const key = `${s.type}|${s.d.toFixed(2)}|${Math.round(flowNow)}`;
        if (key !== lastDraw) { lastDraw = key; cur.d = s.d; cur.Q = flowNow; cur.type = s.type; chart.redraw(); }
        const narrow = stage.host.clientWidth < 560;
        board.position.set(narrow ? 0 : -1.0, narrow ? -3.6 : -1.45, narrow ? 0 : 0.3); board.rotation.y = narrow ? 0 : 0.25;
        sim.position.x = narrow ? 0 : 3.0;
        board.visible = !narrow; title.visible = !narrow;
      },
      readout: (s) => {
        const Q = flowFor(s), fc = filterCatch(s.type, s.d, Q), clean = operatingPoint(SPEEDS[s.speed], DUCT).Q;
        const caught = fates.reduce((a, b) => a + b, 0);
        return `<div class="big">Catches ${Math.round(fc.eff * 100)}% of ${s.d < 10 ? s.d.toFixed(1) : Math.round(s.d)} µm droplets</div>
          <div class="row"><span>Airflow through the filter</span><b>${Math.round(Q)} m³/h${s.weeks > 0 ? ` (${Math.round((Q / clean) * 100)}% of clean)` : ''}</b></div>
          <div class="row"><span>Air speed in the ${s.type === 'mesh' ? 'mesh' : 'channel'}</span><b>${fc.U.toFixed(1)} m/s</b></div>
          <div class="row"><span>Stokes number</span><b>${fc.stk < 0.01 ? fc.stk.toExponential(1) : fc.stk.toFixed(2)}</b></div>
          <div class="row"><span>In the model: last ${fates.length} droplets</span><b>${caught} hit the metal</b></div>
          <small>${s.type === 'filterless' ? 'The panel catches the big drops; the spinning fan wheel flings more into the oil cup.' : s.type === 'mesh' ? 'Only one of eight layers is shown, magnified; the catch rate is for all eight.' : 'Oil that hits the blades runs down into the oil collector.'}</small>`;
      },
    };
  },
};
