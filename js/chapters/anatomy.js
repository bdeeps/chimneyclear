// Chapter 1: the whole kitchen setup. LPG cylinder → regulator → hose → stove, and the
// chimney above it. Everything is built in centimetres and scaled 1 unit = 20 cm.
import { THREE, M, box, tube, exploder } from '../kit.js';
import { makeStove, makeCylinder, makeRegulator, makeChimney, makeKadhai, pathOf, flowDots, xrayable, BURNERS, gramsPerHour, CYL_KG, STOVE, HOODC, fitNarrow } from '../kitchen.js';

const S = 0.05;                          // scene units per cm
const TOP = 90;                          // counter top (cm)
const HOB = TOP + STOVE.H;               // stove glass (99 cm)
const HOODY = HOB + 70;                  // chimney underside, 70 cm above the stove

export default {
  id: 'anatomy',
  short: 'Stove and chimney',
  title: 'Inside a gas stove and kitchen chimney',
  subtitle: 'A red cylinder, a regulator, a hose, three burners, and a fan in a hood.',
  view: { pos: [3.2, 8.2, 12.2], target: [-1.5, 6.3, 0] },
  learn: `<p>An Indian kitchen stove runs on <b>LPG</b>, liquefied petroleum gas. In the red <b>14.2 kg cylinder</b> it is a liquid, squeezed by its own vapour to about 5 bar on a warm day. The <b>regulator</b> clipped on top lets it out at a steady, gentle <b>29 millibar</b>, about 3% more than the air pressure around you.</p>
    <p>A rubber <b>hose</b> carries the gas to the stove. Inside, a brass pipe feeds a <b>valve</b> behind each <b>knob</b>. From the valve, gas shoots out of a tiny <b>injector</b> into a <b>mixing tube</b>, drags air in with it, and comes out of the ring of holes in the <b>brass burner</b> as a flame. Beside each burner sit an <b>igniter</b> that sparks and, on newer stoves, a <b>flame-failure sensor</b>.</p>
    <p>Above it hangs the <b>chimney</b>. A <b>blower</b> pulls smoky air up through <b>baffle filters</b> that trap oil, which drips into an <b>oil collector</b>. The air leaves through a <b>duct</b> in the wall.</p>
    <p class="tip"><b>Try it:</b> switch on X-ray and take it apart, then follow the gas from the cylinder to the flame.</p>`,
  terms: [
    { t: 'LPG', d: 'Liquefied petroleum gas: mostly propane and butane, stored as a liquid under pressure.' },
    { t: 'Regulator', d: 'The valve on the cylinder that drops the pressure to a steady 29 millibar for the stove.' },
    { t: 'Burner', d: 'The brass crown with a ring of small holes where the gas and air mixture burns.' },
    { t: 'Baffle filter', d: 'A metal filter of folded blades that makes the air zig-zag so oil droplets hit the metal.' },
    { t: 'Blower', d: 'The motor-driven fan wheel inside the chimney that sucks the air up and out.' },
  ],
  defaults: { explode: 0, xray: false, gas: true, fan: true },
  controls: [
    { key: 'explode', type: 'range', label: 'Take it apart', min: 0, max: 1, step: 0.01, ends: ['together', 'exploded'], fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'xray', type: 'toggle', label: 'X-ray view' },
    { key: 'gas', type: 'toggle', label: 'Burners lit' },
    { key: 'fan', type: 'toggle', label: 'Chimney on' },
  ],
  quiz: [
    { q: 'What does the regulator on the cylinder do?', options: ['Measures how much gas is left', 'Drops the pressure to a steady low level for the stove', 'Lights the gas', 'Mixes air into the gas'], answer: 1, why: 'Inside the cylinder the pressure changes with temperature and can be 5 bar or more. The regulator delivers a steady 29 millibar.' },
    { q: 'Why is LPG sold in heavy steel cylinders?', options: ['It is poisonous', 'It is kept as a liquid under pressure', 'It must be kept cold', 'It is very heavy gas'], answer: 1, why: 'Squeezed, propane and butane turn liquid, so a lot of fuel fits in a small space. The steel holds the pressure.' },
    { q: 'Where does the oil that a baffle filter catches go?', options: ['Into the duct and outside', 'It drips into the oil collector', 'Back into the pan', 'It burns in the motor'], answer: 1, why: 'Droplets hit the metal blades, run down and drain into the collector cup.' },
  ],
  reel: [
    { ms: 5400, caption: 'An Indian kitchen: an LPG cylinder, a gas stove, and a chimney above it.', set: { xray: false, gas: true, fan: true, explode: 0 }, view: { pos: [3.6, 8.0, 12.5], target: [0, 6.6, 0] }, spin: 0.35 },
    { ms: 5600, caption: 'Gas flows from the cylinder, through a regulator and hose, to three brass burners.', set: { xray: true, gas: true, fan: true }, anim: { explode: [0, 0.75] }, view: { pos: [3.6, 8.0, 12.5], target: [0, 6.8, 0] }, spin: 0.25 },
  ],

  build({ stage }) {
    const fit = fitNarrow(stage);
    const root = new THREE.Group(); root.scale.setScalar(S); stage.root.add(root);

    // Room: back wall (with the duct going through it), counter and cabinet.
    const wall = xrayable(box(190, 270, 12, M.matte(0x5a5750, { transparent: true })), 0.14); wall.position.set(-5, 135, -36); wall.castShadow = false;
    const tiles = box(150, 70, 0.5, M.matte(0xd9d4c8, { transparent: true, opacity: 0.9 })); tiles.position.set(0, TOP + 40, -29.8);
    const slab = box(140, 4, 62, M.matte(0x3a3a3f, { roughness: 0.35 })); slab.position.set(0, TOP - 2, 0);
    const sideL = box(3, TOP - 4, 58, M.matte(0x8a6a4a)); sideL.position.set(-68, (TOP - 4) / 2, -1);
    const sideR = box(3, TOP - 4, 58, M.matte(0x8a6a4a)); sideR.position.set(68, (TOP - 4) / 2, -1);
    const plinth = box(136, 8, 3, M.matte(0x6a5038)); plinth.position.set(0, 4, 26);
    root.add(wall, tiles, slab, sideL, sideR, plinth);
    const wallX = [wall, tiles];

    const stove = makeStove(); stove.group.position.set(0, TOP, 0); root.add(stove.group);
    const cyl = makeCylinder(); cyl.position.set(-38, 0, -2); root.add(cyl);
    const reg = makeRegulator(); reg.position.set(-38, cyl.valveTop.y, -2); root.add(reg);
    const pan = makeKadhai(13); pan.position.set(STOVE.xs[2], HOB + 3, STOVE.zB); root.add(pan);

    const hood = makeChimney(); hood.group.position.set(0, HOODY, -5); root.add(hood.group);
    // Duct: up out of the blower, a bend, and back through the wall.
    const ductM = M.metal(0xc8ccd4, { roughness: 0.35 });
    const dx = -2, dz = -5 - 12, dy0 = HOODY + HOODC.canopy + 14 + 19;
    const duct = tube([[dx, dy0, dz], [dx, 238, dz], [dx, 246, dz - 5], [dx, 248, -28], [dx, 248, -52]], 7.5, ductM, false, 80);
    const cowl = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 3, 24), M.metal(0x9aa0aa)); cowl.rotation.x = Math.PI / 2; cowl.position.set(dx, 248, -54);
    root.add(duct, cowl);

    // Hose from the regulator, round the back of the counter, to the stove's inlet.
    const hosePts = [[-29, reg.position.y + 3.6, -2], [-34, reg.position.y + 5, -14], [-47, 76, -24], [-47, 92, -24], [-45, 93.4, -6], [-43, 93.6, 8], [-40, 93.6, 10]];
    const hose = tube(hosePts, 0.9, M.plastic(0xf06a1a, { roughness: 0.55 }), false, 100); root.add(hose);

    // Gas path (to the big burner) and the smoky air path (from the pan out through the duct).
    const bx = STOVE.xs[0];
    const gasPath = pathOf([[-38, 40, -2], [-38, cyl.valveTop.y, -2], [-38, reg.position.y + 4, -2], ...hosePts, [-36, 93.6, 12], [-30, 93.6, 15], [bx, 93.6, 15], [bx, 93.6, 16.5], [bx, 95.2, 11], [bx, 95.2, -2], [bx, HOB + 2, -2]]);
    const gasDots = flowDots(gasPath, 80, new THREE.SphereGeometry(0.9, 8, 6), 0xffb547); root.add(gasDots);
    const smokePath = pathOf([[STOVE.xs[2], HOB + 16, STOVE.zB], [18, HOB + 40, -4], [14, HOODY - 2, -4], [4, HOODY + 12, -8], [dx, HOODY + 22, -12], [dx, dy0, dz], [dx, 238, dz], [dx, 246, dz - 5], [dx, 248, -28], [dx, 248, -60]]);
    const smoke = flowDots(smokePath, 120, new THREE.SphereGeometry(1.2, 8, 6), 0xcfd8e6, 3.5); root.add(smoke);

    const setExplode = exploder([
      { obj: stove.glass, off: [0, 16, 0] },
      ...stove.heads.map((h) => ({ obj: h, off: [0, 30, 0] })),
      ...stove.flames.map((h) => ({ obj: h, off: [0, 30, 0] })),
      ...stove.supports.map((h) => ({ obj: h, off: [0, 44, 0] })),
      ...stove.knobs.map((k) => ({ obj: k, off: [0, 0, 22] })),
      { obj: pan, off: [0, 62, 0] },
      { obj: reg, off: [0, 12, 12] },
      { obj: hood.filters, off: [0, -24, 12] },
      { obj: hood.cup, off: [0, -16, 18] },
      { obj: hood.blower, off: [0, 0, 44] },
      { obj: hood.stack, off: [0, 22, 0] },
    ]);

    // Main labels always; minor ones hide on narrow screens; detail labels only once it is taken apart.
    const minor = [], detail = [];
    const L = (t, parent, p, main, cls = '') => { const l = stage.label(t, p, parent, cls); if (main === 'detail') detail.push(l); else if (!main) minor.push(l); return l; };
    L('LPG cylinder, 14.2 kg', cyl, [0, 30, 18], true, 'hot');
    L('Regulator: 29 mbar out', reg, [0, 9, 0]);
    L('Rubber hose', root, [-50, 84, -20]);
    L('Gas valve and knob', stove.knobs[0], [-4, -5, 2], 'detail');
    L('Mixing tube', stove.mixers[0], [0, -9, 6], 'detail');
    L('Brass burner', stove.heads[0], [0, 5, 0], 'detail');
    L('Gas stove', stove.group, [-10, 30, 10], true);
    L('Igniter', stove.sparks[1], [4, 8, 0], 'detail');
    L('Flame-failure sensor', stove.probes[1], [-6, 14, 0], 'detail');
    L('Chimney hood', hood.group, [-30, 26, 10], true);
    L('Baffle filters', hood.filters, [-24, -4, 18], true, 'hot');
    L('Blower and motor', hood.blower, [0, 16, 8]);
    L('Oil collector', hood.cup, [4, -4, 4]);
    L('Duct to outside', root, [dx, 258, -40], true);
    L('70 cm', root, [44, HOB + 35, 20]);
    const gap = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 70, 8), M.glow(0x8ef0ff)); gap.position.set(44, HOB + 35, 20); root.add(gap);

    let t = 0, spin = 0;
    return {
      update(dt, s, time) {
        dt = Math.max(0, dt);
        fit();
        t += dt;
        setExplode(s.explode);
        const narrow = stage.host.clientWidth < 560;
        minor.forEach((l) => { l.visible = !narrow; });
        detail.forEach((l) => { l.visible = s.explode > 0.35 && !narrow; });
        [stove.body, ...hood.shells, ...wallX.filter((w) => w.setXray)].forEach((m) => m.setXray(s.xray));
        stove.glassX(s.xray);
        tiles.visible = !s.xray;
        stove.flames.forEach((f, i) => f.set(0.55, s.gas && i !== 2 ? 1 : s.gas ? 0.7 : 0, time));
        const still = s.explode < 0.05;
        gasDots.visible = s.gas && still && s.xray; if (gasDots.visible) gasDots.step(dt, 60);
        smoke.visible = s.fan && still; if (smoke.visible) smoke.step(dt, 55);
        spin += dt * (s.fan ? 25 : 0); hood.wheel.rotation.x = -spin;
        hood.lights.forEach((l) => { l.material.color.set(s.fan ? 0xfff1c8 : 0x55524a); });
        gap.visible = still;
      },
      readout: (s) => {
        const kW = BURNERS.big.kW + BURNERS.small.kW + BURNERS.medium.kW;
        const gph = gramsPerHour(kW);
        return `<div class="big">Gas in, smoke out</div>
          <div class="row"><span>Inside the cylinder</span><b>≈ 5 bar (warm day)</b></div>
          <div class="row"><span>After the regulator</span><b>29 mbar</b></div>
          <div class="row"><span>All three burners on full</span><b>${s.gas ? `${kW.toFixed(1)} kW, ${Math.round(gph)} g/h` : 'off'}</b></div>
          <div class="row"><span>A full cylinder at that rate</span><b>${Math.round((CYL_KG * 1000) / gph)} hours</b></div>
          <div class="row"><span>Chimney suction</span><b>${s.fan ? '1,100 m³/h' : 'off'}</b></div>`;
      },
    };
  },
};
