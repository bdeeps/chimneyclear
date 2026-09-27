// Chapter 4: how a chimney catches smoke. The hot plume from the pan rises on its own; the hood's
// job is to swallow it before a draught pushes it out from under the edge.
// Model: see capture() in kitchen.js (ASHRAE plume equations + DallaValle suction formula).
// Built in centimetres, scaled 1 unit = 16.7 cm.
import { THREE, M, box, arrow, clamp } from '../kit.js';
import { makeStove, makeChimney, makeKadhai, capture, plumeHalf, STOVE, HOODC, fitNarrow } from '../kitchen.js';

const S = 0.06;
const TOP = 90, HOB = TOP + STOVE.H, WALL = -30;
const Q_PER_BURNER = 1200;           // W of hot convective air rising from each busy burner and pan

export default {
  id: 'capture',
  short: 'Catching the smoke',
  title: 'How a chimney catches smoke',
  subtitle: 'Hot air rises by itself. The hood just has to swallow it before a draught steals it.',
  view: { pos: [-15.4, 11.4, 9.8], target: [-2.4, 8.9, -1.2] },
  learn: `<p>You might think a chimney sucks smoke up from the pan like a vacuum cleaner. It can't. Suction dies away fast: a few centimetres below the hood the air moves quickly, but at the pan, 70 cm down, a typical chimney pulls at only about <b>0.05 metres per second</b>, slower than you can feel. Factory hoods aim for <b>0.3 to 0.5 m/s</b> at the source, and a kitchen chimney gets nowhere near that.</p>
    <p>What really lifts the smoke is <b>heat</b>. Air over a hot pan is lighter than the air around it, so it rises in a <b>plume</b> at about 1 m/s, dragging oil droplets and steam with it. The plume spreads as it climbs, so the chimney has to be <b>wide enough and low enough</b> to catch all of it, and suck at least as much air as the plume brings. That's why it hangs <b>65 to 75 cm</b> above the stove.</p>
    <p>The enemy is a <b>draught</b>: a fan, an open window, someone walking past. A sideways breeze bends the plume out from under the hood's edge, and the smoke escapes into the room.</p>
    <p class="tip"><b>Try it:</b> raise the chimney, then add a draught and see how much smoke gets away. Does more suction fix it?</p>`,
  terms: [
    { t: 'Plume', d: 'The column of warm air, steam and smoke rising from a hot pan.' },
    { t: 'Capture velocity', d: 'How fast air must move at the source to be pulled into a hood.' },
    { t: 'Suction (m³/h)', d: 'How many cubic metres of air a chimney moves each hour. Kitchen chimneys are sold at 700 to 1,400.' },
    { t: 'Air changes per hour', d: 'How many times each hour a fan could replace all the air in a room.' },
  ],
  defaults: { Q: 1100, height: 70, draught: 0, burners: 1 },
  controls: [
    { key: 'Q', type: 'range', label: 'Chimney suction', min: 300, max: 1400, step: 50, ends: ['300', '1,400 m³/h'], fmt: (v) => Math.round(v).toLocaleString('en-IN') + ' m³/h' },
    { key: 'height', type: 'range', label: 'Height above the stove', min: 50, max: 95, step: 1, ends: ['50 cm', '95 cm'], fmt: (v) => Math.round(v) + ' cm' },
    { key: 'draught', type: 'range', label: 'Room draught', min: 0, max: 0.5, step: 0.01, ends: ['still air', 'breezy'], fmt: (v) => v.toFixed(2) + ' m/s' },
    { key: 'burners', type: 'seg', label: 'Burners cooking', options: [{ v: 1, label: '1' }, { v: 2, label: '2' }, { v: 3, label: '3' }], fmt: (v) => `${v} × ${Q_PER_BURNER / 1000} kW of hot air` },
  ],
  quiz: [
    { q: 'What mostly carries cooking smoke up to the chimney?', options: ['The chimney’s suction reaching down to the pan', 'Hot air rising on its own', 'The gas pressure', 'The steam from the pan only'], answer: 1, why: 'Suction falls off quickly with distance. The hot plume rises by itself, and the hood swallows it.' },
    { q: 'Why does a chimney work worse when it is mounted higher?', options: ['The motor gets weaker', 'The plume spreads wider and a draught has longer to push it aside', 'Smoke gets heavier', 'The filters get colder'], answer: 1, why: 'A plume widens as it rises, and a breeze has more time to bend it out from under the edge.' },
    { q: 'A 1,000 m³/h chimney in a 27 m³ kitchen gives about how many air changes an hour?', options: ['About 4', 'About 37', 'About 270', 'About 1,000'], answer: 1, why: '1,000 ÷ 27 ≈ 37: it could swap all the kitchen’s air more than once every two minutes.' },
  ],
  reel: [
    { ms: 5600, caption: 'A chimney can’t suck smoke from 70 cm away. Hot air rises by itself; the hood just catches it.', set: { Q: 1100, height: 70, draught: 0, burners: 2 }, view: { pos: [-9.5, 10.2, 9.5], target: [0, 8.4, 0.6] }, spin: 0.15 },
    { ms: 5400, caption: 'A draught bends the plume out from under the edge, and smoke escapes into the room.', set: { Q: 1100, height: 85, burners: 2 }, anim: { draught: [0, 0.35] }, view: { pos: [-9.5, 10.2, 9.5], target: [0, 8.6, 0.8] }, spin: 0 },
  ],

  build({ stage }) {
    const fit = fitNarrow(stage);
    const root = new THREE.Group(); root.scale.setScalar(S); stage.root.add(root);
    const wall = box(170, 230, 6, M.matte(0x4a4842)); wall.position.set(0, 115, WALL - 3); wall.castShadow = false;
    const tiles = box(150, 90, 0.6, M.matte(0xd9d4c8)); tiles.position.set(0, TOP + 45, WALL + 0.3);
    const counter = box(150, TOP, 60, M.matte(0x3a3a3f, { roughness: 0.5 })); counter.position.set(0, TOP / 2, 0);
    root.add(wall, tiles, counter);
    const stove = makeStove(); stove.group.position.set(0, TOP, 0); root.add(stove.group);
    const pans = STOVE.xs.map((x) => { const p = makeKadhai(12); p.position.set(x, HOB + 3, STOVE.zB); root.add(p); return p; });
    const hood = makeChimney(); root.add(hood.group);
    hood.stack.visible = false;
    const stackLite = box(HOODC.stackW, 40, HOODC.stackD, M.metal(0x2a2d34, { roughness: 0.3 })); root.add(stackLite);

    // Smoke puffs.
    const N = 360;
    const puffs = new THREE.InstancedMesh(new THREE.SphereGeometry(1.6, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd6dde8, transparent: true, opacity: 0.55, roughness: 1, depthWrite: false }), N);
    puffs.instanceMatrix.setUsage(THREE.DynamicDrawUsage); puffs.frustumCulled = false; puffs.castShadow = false; root.add(puffs);
    const rnd = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
    const seed = Array.from({ length: N }, (_, i) => ({ ph: rnd(i, 1), ax: rnd(i, 2) * 2 - 1, az: rnd(i, 3) * 2 - 1, f: rnd(i, 4), src: rnd(i, 5), wob: rnd(i, 6) * 6.28 }));
    const escaped = new THREE.Color(0xffb08a), caught = new THREE.Color(0xd6dde8);
    for (let i = 0; i < N; i++) puffs.setColorAt(i, caught);

    // Draught arrows (blowing out from the wall into the room).
    const drafts = [0, 1, 2].map((k) => { const a = arrow(0x8ef0ff, 12, 4, 0.9); a.rotation.x = Math.PI / 2; a.userData.home = new THREE.Vector3(-62, HOB + 25 + k * 22, -12); root.add(a); return a; });
    const draftLab = stage.label('Draught', [-62, HOB + 95, 0], root);

    // Suction ruler under the right side of the hood: upward arrows whose length shows the air speed.
    const ruler = [0.04, 0.2, 0.4, 0.7].map(() => { const a = arrow(0xffb547, 5, 3, 0.7); root.add(a); return a; });
    const rulerLab = [stage.label('', [0, 0, 0], root), stage.label('', [0, 0, 0], root, 'hot')];
    const hLab = stage.label('', [0, 0, 0], root);
    const gap = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1, 8), M.glow(0x8ef0ff)); root.add(gap);

    const o = new THREE.Object3D();
    let t = 0;
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        fit();
        t += dt;
        const h = s.height / 100, HY = HOB + s.height;
        hood.group.position.set(0, HY, WALL + HOODC.D / 2);
        stackLite.position.set(0, HY + HOODC.canopy + HOODC.pyrH + 20, WALL + HOODC.stackD / 2);
        const c = capture({ Qm3h: s.Q, h, draught: s.draught, qW: Q_PER_BURNER * s.burners });
        const on = [0, 2, 1].slice(0, s.burners), srcs = on.map((i) => STOVE.xs[i]);
        stove.flames.forEach((f, i) => f.set(0.55, on.includes(i) ? 0.8 : 0, t));
        pans.forEach((p, i) => { p.visible = on.includes(i); });
        hood.wheel.rotation.x -= dt * 25 * (s.Q / 1400);
        // Each puff: rise through the plume, then either get swallowed or drift into the room.
        const rise = h / (c.w * 0.6);                            // seconds to climb, slowed a little to watch
        const life = rise + 2.2;
        const lip = WALL + 100 * (0.5 + (0.05 * s.Q / 3600) / 0.3);   // front edge of the hood plus its reach (as in capture())
        for (let i = 0; i < N; i++) {
          const sd = seed[i];
          const x0 = srcs[Math.floor(sd.src * srcs.length)];
          const tt = ((t / life + sd.ph) % 1) * life;
          const k = Math.min(1, tt / rise);
          const halfCm = plumeHalf(h * k) * 100;
          const zc = WALL + 100 * (0.28 + c.drift * k * k);        // the plume bends more as it climbs
          let x = x0 + sd.ax * halfCm * 0.8 + Math.sin(t * 2 + sd.wob) * 2;
          let z = zc + sd.az * halfCm;
          let y = HOB + 12 + (HY - HOB - 12) * k;
          const zTop = WALL + 100 * (0.28 + c.drift) + sd.az * plumeHalf(h) * 100;
          const inHood = zTop < lip && sd.f < c.flow;
          let sc = 0.6 + 0.9 * k, esc = false;
          if (tt > rise) {
            const a = (tt - rise) / (life - rise);
            if (inHood) { y = HY + a * 30; x = x * (1 - a) + a * -2; z = z * (1 - a) + a * (WALL + 18); sc *= 1 - a; }
            else { esc = true; y = HY + a * 40; z = Math.max(z, lip + 4) + a * (25 + 60 * s.draught); x += sd.ax * a * 30; sc *= 1.1 - 0.7 * a; }
          }
          o.position.set(x, y, z); o.scale.setScalar(Math.max(0.0001, sc)); o.updateMatrix(); puffs.setMatrixAt(i, o.matrix);
          puffs.setColorAt(i, esc ? escaped : caught);
        }
        puffs.instanceMatrix.needsUpdate = true; puffs.instanceColor.needsUpdate = true;
        // Draught arrows move with the breeze.
        drafts.forEach((a, k) => { a.visible = s.draught > 0.02; a.set(6 + 40 * s.draught); a.position.copy(a.userData.home); a.position.z += ((t * 0.8 + k * 0.33) % 1) * 20; });
        draftLab.visible = s.draught > 0.02;
        // Suction speeds below the hood face (DallaValle), drawn as arrows; length 60 cm per m/s.
        [0.04, 0.2, 0.4, h].forEach((d, k) => {
          const v = c.Q / (10 * d * d + 0.45);
          const a = ruler[k]; a.position.set(-34, HY - d * 100 - 1, -8); a.set(Math.max(0.5, v * 60));
        });
        rulerLab[0].position.set(-34, HY - 6, 12); rulerLab[0].element.textContent = `${(c.Q / (10 * 0.04 * 0.04 + 0.45)).toFixed(2)} m/s`;
        rulerLab[1].position.set(-34, HY - h * 100 + 6, 12); rulerLab[1].element.textContent = `${c.vHob.toFixed(2)} m/s at the pan`;
        gap.position.set(-58, (HOB + HY) / 2, 25); gap.scale.y = s.height;
        hLab.position.set(-58, (HOB + HY) / 2, 25); hLab.element.textContent = `${Math.round(s.height)} cm`;
        hLab.visible = stage.host.clientWidth >= 560;
      },
      readout: (s) => {
        const c = capture({ Qm3h: s.Q, h: s.height / 100, draught: s.draught, qW: Q_PER_BURNER * s.burners });
        const pct = Math.round(c.frac * 100);
        return `<div class="big ${pct >= 90 ? 'ok' : pct < 60 ? 'no' : ''}">Catches about ${pct}% of the smoke</div>
          <div class="row"><span>Plume arriving at the hood</span><b>${Math.round(c.Vp * 3600)} m³/h, rising ${c.w.toFixed(1)} m/s</b></div>
          <div class="row"><span>Suction just under the hood</span><b>${c.vFace.toFixed(2)} m/s</b></div>
          <div class="row"><span>Suction at the pan</span><b>${c.vHob.toFixed(2)} m/s</b></div>
          <div class="row"><span>Air changes per hour</span><b>${Math.round(c.ach)} (10 m² kitchen)</b></div>
          <small>${c.flow < 0.999 ? 'The hood sucks less air than the plume brings: smoke spills round the edges.' : c.inside < 0.999 ? 'The plume has been pushed partly out from under the hood.' : 'The whole plume rises into the hood.'}</small>`;
      },
    };
  },
};
