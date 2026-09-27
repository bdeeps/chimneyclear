// Chapter 6: ducts, bends and noise. The fan curve (what the blower can push) meets the system
// curve (what the duct, filter and make-up air resist). Where they cross is the real airflow.
// See fanP, systemP and operatingPoint in kitchen.js. Built in centimetres, 1 unit = 20 cm.
import { THREE, M, box, tube, arrow, canvasTexture, clamp } from '../kit.js';
import { makeStove, makeChimney, pathOf, flowDots, xrayable, fanP, systemP, operatingPoint, noiseDb, SPEEDS, FAN, STOVE, HOODC, fitNarrow } from '../kitchen.js';

const S = 0.05, TOP = 90, HOB = TOP + STOVE.H, HOODY = HOB + 70, WALL = -30, CEIL = 270;
const X0 = -2, Z0 = WALL + HOODC.D / 2 - 12, Y0 = HOODY + HOODC.canopy + 14 + 19;   // blower outlet collar

// The duct's route for n bends and a length in metres (drawn shorter than real so it fits the room).
function route(n, lenM) {
  const Lv = 50 + 28 * lenM;
  const P = [[X0, Y0, Z0]];
  const go = (dx, dy, dz) => { const [x, y, z] = P[P.length - 1]; P.push([x + dx, y + dy, z + dz]); };
  if (n === 0) { go(0, Math.min(Lv, 140), 0); return P; }
  const seg = clamp((Lv - 45) / n, 18, 60);
  const up = Math.min(22, CEIL - 15 - Y0);
  go(0, up, 0);
  const moves = [[1, 0, 0], [0, 1, 0], [-1, 0, 0]];
  for (let i = 0; i < n - 1; i++) { const m = moves[i]; go(m[0] * seg, m[1] * Math.min(seg, CEIL - 12 - P[P.length - 1][1]), 0); }
  const [, , z] = P[P.length - 1];
  go(0, 0, WALL - 22 - z);                                   // the last bend turns into the wall and out
  return P;
}
// Round the corners a little so the tube looks like a bent duct.
function rounded(P, r = 9) {
  const out = [P[0]];
  for (let i = 1; i < P.length - 1; i++) {
    const a = new THREE.Vector3(...P[i - 1]), b = new THREE.Vector3(...P[i]), c = new THREE.Vector3(...P[i + 1]);
    const u = a.clone().sub(b).normalize(), v = c.clone().sub(b).normalize();
    out.push(b.clone().addScaledVector(u, r).toArray(), b.clone().addScaledVector(u, r * 0.3).addScaledVector(v, r * 0.3).toArray(), b.clone().addScaledVector(v, r).toArray());
  }
  out.push(P[P.length - 1]);
  return out;
}

export default {
  id: 'duct',
  short: 'Ducts and noise',
  title: 'Where the air goes: ducts, bends and noise',
  subtitle: 'The number on the box is not the air you get. Every bend and narrow pipe steals some.',
  view: { pos: [1.2, 11.4, 15.5], target: [-2.6, 10.0, -1.0] },
  learn: `<p>A chimney sold as "1,200 m³/h" moves that much air only with nothing in its way. Real air has to squeeze through the <b>filter</b>, up a <b>duct</b>, round its <b>bends</b> and out through a flap in the wall. All of that pushes back, and the more air you try to move, the harder it pushes: resistance grows with the <b>square</b> of the flow.</p>
    <p>The blower can only push so hard. Its <b>fan curve</b> shows how its airflow drops as the back-pressure rises. The duct's <b>system curve</b> shows how much pressure each airflow needs. The chimney settles where the two curves cross. A <b>narrow 100 mm pipe</b>, a long run of crumpled <b>flexible foil duct</b> or lots of bends can cut the real airflow to half of the number on the box, while the fan gets louder, not better.</p>
    <p>And every cubic metre blown out must come back in. With the doors and windows shut, the kitchen's air pressure drops and the chimney chokes. That returning air is called <b>make-up air</b>. A <b>recirculating</b> chimney skips the duct: it blows the air through a <b>carbon filter</b> and back into the kitchen. It traps grease and some smells, but the heat, steam and carbon dioxide stay in the room.</p>
    <p class="tip"><b>Try it:</b> add bends and swap the 150 mm duct for a 100 mm one, then open the window and watch where the curves cross.</p>`,
  terms: [
    { t: 'Duct', d: 'The pipe that carries air from the chimney to the outside.' },
    { t: 'Fan curve', d: 'A graph of how much air a fan moves against each amount of back-pressure.' },
    { t: 'System curve', d: 'A graph of how much pressure a duct needs for each airflow. It rises with airflow squared.' },
    { t: 'Pascal (Pa)', d: 'A unit of pressure. 100 Pa is about the push of 1 cm of water.' },
    { t: 'Make-up air', d: 'Fresh air that comes in to replace the air an exhaust fan blows out.' },
    { t: 'Decibel (dB)', d: 'A scale for loudness. Every 10 dB more sounds about twice as loud.' },
  ],
  defaults: { speed: 3, diam: 150, bends: 2, len: 3, flex: false, window: true, mode: 'duct' },
  controls: [
    { key: 'speed', type: 'seg', label: 'Chimney speed', options: [{ v: 0, label: '1' }, { v: 1, label: '2' }, { v: 2, label: '3' }, { v: 3, label: 'Boost' }], fmt: (v) => `${Math.round(FAN.Qmax * SPEEDS[v])} m³/h on the box` },
    { key: 'mode', type: 'seg', label: 'Type', options: [{ v: 'duct', label: 'Ducted outside' }, { v: 'recirc', label: 'Recirculating' }] },
    { key: 'diam', type: 'seg', label: 'Duct size', options: [{ v: 100, label: '100 mm' }, { v: 125, label: '125 mm' }, { v: 150, label: '150 mm' }] },
    { key: 'bends', type: 'range', label: '90° bends', min: 0, max: 4, step: 1, ends: ['none', '4'], fmt: (v) => String(Math.round(v)) },
    { key: 'len', type: 'range', label: 'Duct length', min: 1, max: 6, step: 0.5, ends: ['1 m', '6 m'], fmt: (v) => v.toFixed(1) + ' m' },
    { key: 'flex', type: 'toggle', label: 'Flexible foil duct (not smooth pipe)' },
    { key: 'window', type: 'toggle', label: 'Window open for make-up air' },
  ],
  quiz: [
    { q: 'Why does a chimney move less air than the number on its box?', options: ['The box number is measured with no duct or filter pushing back', 'The motor wears out', 'Smoke is heavier than air', 'The number is for two chimneys'], answer: 0, why: 'Rated suction is measured into free air. A real filter, duct and bends push back, so the fan settles at a lower flow.' },
    { q: 'Which change usually helps airflow the most?', options: ['A narrower duct', 'More bends', 'A wider, shorter, straighter duct', 'Closing the windows'], answer: 2, why: 'Resistance falls sharply with a wider pipe, and each bend or extra metre adds some.' },
    { q: 'What does a recirculating chimney NOT remove from the kitchen?', options: ['Grease', 'Some smells', 'Heat and steam', 'Oil droplets'], answer: 2, why: 'The air comes back into the room through a carbon filter, so heat, moisture and carbon dioxide stay.' },
  ],
  reel: [
    { ms: 5800, caption: 'Every bend and narrow pipe pushes back, so a 1,200 m³/h chimney may really move half that.', set: { speed: 3, diam: 100, len: 3, flex: true, window: true, mode: 'duct' }, anim: { bends: [0, 4] }, view: { pos: [-0.8, 11.0, 13.5], target: [-3.0, 9.8, -0.5] }, spin: 0 },
  ],

  build({ stage }) {
    const fit = fitNarrow(stage);
    const root = new THREE.Group(); root.scale.setScalar(S); stage.root.add(root);
    const wall = xrayable(box(300, CEIL, 20, M.matte(0x8a857a, { transparent: true })), 0.1); wall.position.set(0, CEIL / 2, WALL - 10); wall.castShadow = false; wall.setXray(true);
    const ceil = box(300, 2, 110, M.clear(0xcfe0ff, 0.06)); ceil.position.set(0, CEIL, 25); ceil.castShadow = false;
    const counter = box(160, TOP, 60, M.matte(0x3a3a3f, { roughness: 0.5 })); counter.position.set(0, TOP / 2, 0);
    root.add(wall, ceil, counter);
    const stove = makeStove(); stove.group.position.set(0, TOP, 0); root.add(stove.group);
    const hood = makeChimney(); hood.group.position.set(0, HOODY, WALL + HOODC.D / 2); root.add(hood.group);
    hood.shells.forEach((m) => m.setXray(true));
    hood.stack.visible = false;
    const stackGhost = box(HOODC.stackW, CEIL - (HOODY + HOODC.canopy + HOODC.pyrH), HOODC.stackD, M.clear(0x9aa6b8, 0.08)); stackGhost.position.set(0, (CEIL + HOODY + HOODC.canopy + HOODC.pyrH) / 2, WALL + HOODC.stackD / 2); stackGhost.castShadow = false; root.add(stackGhost);
    // Carbon filter (recirculating mode) and side grilles.
    const carbon = box(60, 4, 30, M.matte(0x1b1c1f)); carbon.position.set(0, HOODY + HOODC.canopy + 3, WALL + 25); root.add(carbon);
    const grille = new THREE.Group();
    for (const sx of [-1, 1]) { const g = box(1, 10, 18, M.metal(0x8a909c)); g.position.set(sx * HOODC.stackW / 2, HOODY + HOODC.canopy + HOODC.pyrH + 10, WALL + 12); grille.add(g); }
    root.add(grille);
    // Window on the back wall for make-up air.
    const win = new THREE.Group();
    const frame = box(46, 60, 3, M.plastic(0xe8e8e8)); win.add(frame);
    const pane = box(40, 54, 1, M.clear(0x9fd8ff, 0.3)); pane.position.z = 1.5; win.add(pane);
    win.position.set(95, 175, WALL + 1); root.add(win);
    const inflow = [0, 1, 2].map((k) => { const a = arrow(0x5ce1a9, 18, 6, 1.1); a.rotation.z = Math.PI / 2; a.userData.home = new THREE.Vector3(80, 160 + k * 14, WALL + 8); root.add(a); return a; });

    // The duct: rebuilt when its shape changes.
    let ductObj = null, ribs = null, dots = null, path = null, key = '';
    const rebuild = (s) => {
      [ductObj, ribs, dots].forEach((o) => { if (o) { root.remove(o); o.geometry?.dispose(); } });
      ductObj = ribs = dots = null;
      const n = Math.round(s.bends);
      if (s.mode === 'recirc') {
        path = pathOf([[X0, HOODY - 5, -4], [X0, HOODY + 20, -8], [X0, Y0 - 8, Z0], [X0, Y0 + 2, Z0], [HOODC.stackW / 2 + 4, Y0 + 3, WALL + 12], [HOODC.stackW / 2 + 45, Y0 + 12, WALL + 30]]);
      } else {
        const P = rounded(route(n, s.len));
        const r = s.diam / 20;
        ductObj = tube(P, r, s.flex ? M.metal(0xdfe3ea, { roughness: 0.55, transparent: true, opacity: 0.5, depthWrite: false }) : M.plastic(0xeef0f3, { roughness: 0.35, transparent: true, opacity: 0.4, depthWrite: false }), false, 200);
        root.add(ductObj);
        if (s.flex) {
          const curve = new THREE.CatmullRomCurve3(P.map((p) => new THREE.Vector3(...p)));
          const L = curve.getLength(), k = Math.floor(L / 3.5);
          ribs = new THREE.InstancedMesh(new THREE.TorusGeometry(r + 0.25, 0.35, 6, 20), M.metal(0xc9ced6), k);
          const o = new THREE.Object3D();
          for (let i = 0; i < k; i++) { const u = (i + 0.5) / k; o.position.copy(curve.getPointAt(u)); o.lookAt(o.position.clone().add(curve.getTangentAt(u))); o.updateMatrix(); ribs.setMatrixAt(i, o.matrix); }
          root.add(ribs);
        }
        path = pathOf([[X0, HOODY - 5, -4], [X0, HOODY + 20, -8], ...P, [...P[P.length - 1].slice(0, 2), P[P.length - 1][2] - (n === 0 ? 0 : 25)]]);
      }
      dots = flowDots(path, 110, new THREE.SphereGeometry(1.4, 8, 6), 0xcfe8ff, 2.2); root.add(dots);
    };

    // Fan curve vs system curve.
    const cur = { s: null, op: null };
    const chart = canvasTexture(720, 520, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,12,18,.9)'; g.fillRect(0, 0, w, h);
      if (!cur.s) return;
      const s = cur.s, n = SPEEDS[s.speed];
      const x0 = 80, y0 = h - 70, cw = w - 120, chh = h - 150, QM = 1300, PM = 520;
      const X = (q) => x0 + (q / QM) * cw, Y = (p) => y0 - (clamp(p, 0, PM) / PM) * chh;
      g.font = '19px sans-serif'; g.lineWidth = 1;
      for (let p = 0; p <= 500; p += 100) { g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(x0, Y(p)); g.lineTo(x0 + cw, Y(p)); g.stroke(); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText(p + '', 22, Y(p) + 6); }
      for (let q = 0; q <= 1200; q += 400) g.fillText(q + '', X(q) - 16, y0 + 28);
      g.fillText('airflow, m³/h', x0 + cw - 120, h - 12);
      const curve = (fn, col, wd, qmax = QM) => { g.strokeStyle = col; g.lineWidth = wd; g.beginPath(); for (let i = 0; i <= 80; i++) { const q = (i / 80) * qmax; const p = fn(q); i ? g.lineTo(X(q), Y(p)) : g.moveTo(X(q), Y(p)); } g.stroke(); };
      curve((q) => fanP(q, n), '#ffb547', 6, FAN.Qmax * n);
      curve((q) => systemP(q, s), '#8ef0ff', 6);
      const op = cur.op;
      g.fillStyle = '#fff'; g.beginPath(); g.arc(X(op.Q), Y(op.p), 12, 0, Math.PI * 2); g.fill();
      g.setLineDash([8, 8]); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(op.Q), Y(op.p)); g.lineTo(X(op.Q), y0); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#ffb547'; g.beginPath(); g.arc(X(FAN.Qmax * n), y0, 8, 0, Math.PI * 2); g.fill();
      g.font = 'bold 26px sans-serif'; g.fillStyle = '#e8eef8'; g.fillText('Pressure (Pa) against airflow', 20, 38);
      g.font = 'bold 19px sans-serif'; g.fillStyle = '#ffb547'; g.fillText('fan curve (what the blower can push)', 20, 70);
      g.fillStyle = '#8ef0ff'; g.fillText('system curve (what the duct resists)', 20, 96);
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 3.47), new THREE.MeshBasicMaterial({ map: chart.tex, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
    stage.root.add(board);

    const outLab = stage.label('Outside', [0, 0, 0], root);
    let spin = 0, drawn = '';
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        fit();
        const k = `${s.mode}|${s.diam}|${Math.round(s.bends)}|${s.len}|${s.flex}`;
        if (k !== key) { key = k; rebuild(s); }
        const d = { ...s, bends: Math.round(s.bends) };
        const n = SPEEDS[s.speed], op = operatingPoint(n, d);
        const v = op.Q / 3600 / (Math.PI * (s.diam / 1000) ** 2 / 4);
        spin += dt * 30 * n; hood.wheel.rotation.x = -spin;
        dots.step(dt, s.mode === 'recirc' ? 60 * (op.Q / 800) : Math.min(260, 12 * v));
        carbon.visible = grille.visible = s.mode === 'recirc';
        win.children[1].position.x = s.window ? 20 : 0;
        const inflowOn = s.mode === 'duct';
        inflow.forEach((a, i) => { a.visible = inflowOn && s.window; a.position.copy(a.userData.home); a.position.x -= ((spin * 0.05 + i * 0.33) % 1) * 25; });
        const last = path.points[path.points.length - 1];
        outLab.position.set(last.x, last.y + 18, Math.min(last.z, WALL - 25));
        outLab.visible = s.mode === 'duct';
        const dk = `${k}|${s.speed}|${s.window}`;
        if (dk !== drawn) { drawn = dk; cur.s = d; cur.op = op; chart.redraw(); }
        const narrow = stage.host.clientWidth < 560;
        board.position.set(narrow ? 0 : -6.6, narrow ? 16.2 : 7.2, narrow ? -1.5 : 1.2); board.rotation.y = narrow ? 0 : 0.3;
        board.visible = !narrow;
      },
      readout: (s) => {
        const d = { ...s, bends: Math.round(s.bends) }, n = SPEEDS[s.speed];
        const op = operatingPoint(n, d), rated = FAN.Qmax * n;
        const v = op.Q / 3600 / (Math.PI * (s.diam / 1000) ** 2 / 4);
        const b = d.bends, alt = operatingPoint(n, { ...d, bends: b < 4 ? b + 1 : b - 1 });
        const perBend = Math.abs(1 - (b < 4 ? alt.Q / op.Q : op.Q / alt.Q)) * 100;
        const Aw = s.window ? 0.5 : 0.03, dp = 0.5 * 1.2 * (op.Q / 3600 / (0.6 * Aw)) ** 2;
        return `<div class="big ${op.Q / rated < 0.55 ? 'no' : ''}">${Math.round(op.Q)} m³/h really moved</div>
          <div class="row"><span>Number on the box</span><b>${Math.round(rated)} m³/h (${Math.round((op.Q / rated) * 100)}%)</b></div>
          ${s.mode === 'duct' ? `<div class="row"><span>Air speed in the duct</span><b>${v.toFixed(1)} m/s</b></div>
          <div class="row"><span>Each extra bend costs</span><b>about ${perBend.toFixed(0)}% of the airflow</b></div>
          <div class="row"><span>Kitchen pressure</span><b>${dp < 1 ? 'about normal' : `−${Math.round(dp)} Pa`}${s.window ? '' : ', window shut'}</b></div>` : '<div class="row"><span>Air goes</span><b>back into the kitchen</b></div>'}
          <div class="row"><span>Noise at 1 m</span><b>about ${Math.round(noiseDb(n))} dB</b></div>
          <small>${s.mode === 'recirc' ? 'The carbon filter traps grease and some smells. Heat, steam and CO₂ stay in the room.' : 'Fan: 1,200 m³/h free air, 480 Pa shut off, on boost. Losses from ASHRAE duct-fitting data.'}</small>`;
      },
    };
  },
};
