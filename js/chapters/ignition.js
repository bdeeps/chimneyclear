// Chapter 3: lighting the gas, and the flame-failure device that shuts it off if the flame dies.
// Spark: breakdown voltage of air at 1 atm for a gap of d cm, V ≈ 24.4·d + 6.53·√d kV
// (the standard empirical fit to Paschen's law for air in a uniform field; about 14 kV at 4 mm).
// Thermocouple: a type-K style junction (about 41 µV/°C) whose tip sits in the flame at about
// 700 °C makes roughly 28 mV (typical flame-failure thermocouples give 25–35 mV open circuit).
// The magnet in the valve lets go when it falls to about 4 mV (typical drop-out is 2–5 mV).
// Its heating and cooling are modelled as two lags in a row (tip, then junction), about 3 s each
// when heating and 3 s + 4 s when cooling, so the valve shuts about 12 s after a blow-out.
// Codes allow up to 90 s (CSA B149.1; EN 30-1-1 has similar limits); real hobs take 10–60 s.
import { THREE, M, box, rod, spring, canvasTexture, clamp } from '../kit.js';
import { makeBurnerHead, makeFlames, xrayable, gramsPerHour, BURNERS, fitNarrow } from '../kitchen.js';

const S = 0.15;
const V_HOT = 28, V_DROP = 4, HIST = 40, SAMPLE = 0.1;
const B = BURNERS.big;
export const sparkKV = (mm) => 24.4 * (mm / 10) + 6.53 * Math.sqrt(mm / 10);

function makeSim() {
  return { t: 0, knobOn: false, pressed: 0, spark: 0, flame: false, x1: 0, V: 0, gas: false, leaked: 0, outAt: null, shutAt: null, acc: 0, hist: new Float32Array(HIST / SAMPLE), gasH: new Uint8Array(HIST / SAMPLE) };
}
function stepSim(m, dt, ffd) {
  m.t += dt;
  m.pressed = Math.max(0, m.pressed - dt);
  const holding = m.pressed > 0;
  // Gas flows if the knob is on and (no safety device) or (knob held in) or (the magnet holds the valve).
  m.gas = m.knobOn && (!ffd || holding || m.V > V_DROP);
  if (m.knobOn && !m.gas && m.shutAt === null) m.shutAt = m.t;
  if (m.spark > 0) { m.spark = Math.max(0, m.spark - dt); if (m.gas && m.spark < 1.0) m.flame = true; }
  if (!m.gas) m.flame = false;
  const target = m.flame ? V_HOT : 0;
  m.x1 += (target - m.x1) * Math.min(1, dt / 3);
  m.V += (m.x1 - m.V) * Math.min(1, dt / (m.flame ? 3 : 4));
  if (m.gas && !m.flame && m.spark <= 0) m.leaked += (gramsPerHour(B.kW) / 3600) * dt;
  m.acc += dt;
  while (m.acc >= SAMPLE) { m.acc -= SAMPLE; m.hist.copyWithin(0, 1); m.hist[m.hist.length - 1] = m.V; m.gasH.copyWithin(0, 1); m.gasH[m.gasH.length - 1] = m.gas ? 1 : 0; }
}

export default {
  id: 'ignition',
  short: 'Spark and safety',
  title: 'The spark, and the sensor that stops a gas leak',
  subtitle: 'Thousands of volts light the gas. A few millivolts keep it flowing.',
  view: { pos: [2.6, 3.4, 7.6], target: [-0.9, 1.2, 0] },
  learn: `<p>To light the burner, you push and turn the knob. Gas starts to flow, and the <b>igniter</b> fires a spark across a gap of a few millimetres between its metal tip and the burner. Air does not normally carry electricity, so it takes a big push: about <b>14,000 volts</b> for a 4 mm gap. A <b>piezo</b> lighter makes that by snapping a hammer onto a special crystal; an electronic one uses a battery and a tiny transformer.</p>
    <p>Many new stoves also have a <b>flame-failure device</b>. A thin metal probe, a <b>thermocouple</b>, sits in the flame. Two different metals joined at a hot tip make a small voltage, about <b>28 millivolts</b>. That powers a little <b>electromagnet</b> in the gas valve, which holds the valve open. That's why you must hold the knob in for a few seconds: the probe needs time to warm up.</p>
    <p>If milk boils over or a gust blows the flame out, the probe cools, the voltage falls, and below about 4 millivolts the magnet lets go. A spring snaps the valve shut, and the gas stops.</p>
    <p class="tip"><b>Try it:</b> light the burner, then blow it out. Watch the millivolts fall and the valve close. Then switch the safety device off and try again.</p>`,
  terms: [
    { t: 'Igniter', d: 'The electrode that makes a spark beside the burner to light the gas.' },
    { t: 'Piezo', d: 'Crystals that make a voltage when squeezed or struck. A click lighter uses one.' },
    { t: 'Thermocouple', d: 'Two different metals joined at a tip. Heat the tip and they make a small voltage.' },
    { t: 'Flame-failure device', d: 'A thermocouple and magnet valve that shut off the gas if the flame goes out.' },
    { t: 'Millivolt', d: 'One thousandth of a volt. A torch battery is 1,500 millivolts.' },
  ],
  defaults: { ffd: true, gap: 4 },
  controls: [
    { key: 'go', type: 'buttons', label: 'The knob', items: [
      { label: 'Push, turn and hold', act: (s, inst) => inst.light(6) },
      { label: 'Let go too soon', act: (s, inst) => inst.light(0.9) },
      { label: 'Blow it out', act: (s, inst) => inst.blow() },
      { label: 'Turn it off', act: (s, inst) => inst.off() },
    ] },
    { key: 'ffd', type: 'toggle', label: 'Flame-failure device fitted' },
    { key: 'gap', type: 'range', label: 'Spark gap', min: 2, max: 6, step: 0.1, ends: ['2 mm', '6 mm'], fmt: (v) => v.toFixed(1) + ' mm' },
  ],
  quiz: [
    { q: 'Why does the igniter need thousands of volts?', options: ['To heat the burner', 'Air is a good insulator, so a big voltage is needed to make a spark jump', 'To pump the gas', 'To charge the knob'], answer: 1, why: 'Air resists electricity until the voltage is high enough to tear electrons off its molecules: about 3,000 volts or more per millimetre.' },
    { q: 'What holds the gas valve open once the flame is lit?', options: ['Your finger', 'An electromagnet powered by a thermocouple in the flame', 'The gas pressure', 'A battery'], answer: 1, why: 'The hot thermocouple makes about 28 millivolts, enough to power a small magnet that holds the valve open.' },
    { q: 'Why must you hold the knob in for a few seconds?', options: ['To let the spark charge up', 'So the thermocouple warms up enough to hold the valve open by itself', 'To clean the burner', 'To let the regulator fill'], answer: 1, why: 'Until the probe is hot, the magnet is too weak, so your push keeps the valve open.' },
  ],
  reel: [
    { ms: 5200, caption: 'A spark of about 14,000 volts jumps a 4 mm gap and lights the gas.', set: { ffd: true, gap: 4 }, act: (s, inst) => inst.light(6), view: { pos: [1.8, 1.6, 3.0], target: [0.3, 0.35, 0] }, spin: 0 },
    { ms: 5800, caption: 'If the flame dies, the sensor cools, a magnet lets go, and the gas snaps off.', set: { ffd: true, gap: 4 }, act: (s, inst) => { inst.prime(); inst.blow(); inst.skip(8.5); }, view: { pos: [1.9, 3.0, 6.2], target: [0.6, 1.9, -0.8] }, spin: 0 },
  ],

  build({ stage }) {
    const fit = fitNarrow(stage);
    const root = new THREE.Group(); root.scale.setScalar(S); root.position.y = 0.2; stage.root.add(root);
    const glass = xrayable(box(44, 0.6, 38, new THREE.MeshPhysicalMaterial({ color: 0x0b0c10, roughness: 0.08, clearcoat: 1, transparent: true })), 0.28); glass.position.set(0, -0.3, 6); glass.setXray(true); root.add(glass);
    const head = makeBurnerHead(B.R, B.ports); root.add(head);
    const flames = makeFlames(B.R, B.ports); root.add(flames);

    // Igniter: a white ceramic post with a steel tip bent towards the burner.
    const ig = new THREE.Group();
    const cer = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 2.6, 14), M.plastic(0xf2efe6)); cer.position.y = 1.3; ig.add(cer);
    const tip = rod(0, 1.0, 0.1, 0.08, M.metal(0xd9dde4)); tip.position.set(-0.5, 2.85, 0); ig.add(tip);
    ig.position.set(B.R + 1.9, 0, 0.8); root.add(ig);
    const tipW = new THREE.Vector3(B.R + 0.9 + 0.5 - 0.4, 2.85, 0.8);
    // Thermocouple: a copper probe whose tip bends into the flame, on the other side.
    const tcM = M.metal(0xd07a45, { roughness: 0.35 });
    const tc = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 3.2, 10), tcM); post.position.y = 1.6; tc.add(post);
    const tcTip = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), M.metal(0xb9bec8)); tcTip.position.set(0.3, 3.25, 0); tc.add(tcTip);
    tc.position.set(-B.R - 1.3, 0, -0.6); root.add(tc);
    // The lead runs under the glass to the magnet unit at the back of the gas valve.
    const lead = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-B.R - 1.3, 0, -0.6], [-B.R - 1.3, -2.5, -0.6], [-B.R - 2, -4, 6], [-3, -4.5, 13], [0, -4.5, 13.5]].map((p) => new THREE.Vector3(...p))), 60, 0.18, 8), tcM); root.add(lead);
    const gasPipe = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, -4.5, 19], [0, -4.5, 22], [0, -4.5, 26]].map((p) => new THREE.Vector3(...p))), 10, 0.5, 10), M.metal(0xc9a24a)); root.add(gasPipe);
    const feed = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, -4.5, 14], [0, -4.5, 8], [0, -4.5, 1.5], [0, -3.5, 0], [0, -0.2, 0]].map((p) => new THREE.Vector3(...p))), 40, 1.1, 14), M.metal(0xd6dbe4, { transparent: true, opacity: 0.45, depthWrite: false })); root.add(feed);

    // Gas valve with its magnet unit, seen through a cut-away brass body. Axis along Z.
    const valve = new THREE.Group(); valve.position.set(0, -4.5, 16.5); root.add(valve);
    const vb = rod(-3.2, 3.2, 1.8, 1.8, M.metal(0xc9a24a, { transparent: true, opacity: 0.28, depthWrite: false })); vb.rotation.y = Math.PI / 2; valve.add(vb);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.38, 10, 28), M.metal(0xd07a45)); coil.position.z = -2.2; valve.add(coil);
    const core = rod(-0.6, 0.6, 0.55, 0.55, M.metal(0x6a707c)); core.rotation.y = Math.PI / 2; core.position.z = -2.2; valve.add(core);
    const armature = new THREE.Group(); valve.add(armature);
    const disc = rod(-0.25, 0.25, 1.35, 1.35, M.metal(0xb9bec8)); disc.rotation.y = Math.PI / 2; armature.add(disc);
    const stem = rod(0, 2.2, 0.18, 0.18, M.metal(0xb9bec8)); stem.rotation.y = Math.PI / 2; stem.position.z = 0; armature.add(stem);
    const seal = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.12, 8, 28), M.plastic(0x1d1f24)); seal.position.z = 0.9; valve.add(seal);
    const spr = spring(0, 1.6, 0.8, 0.07, 6, M.metal(0xdfe3ea)); spr.rotation.y = Math.PI / 2; spr.position.z = 2.9; valve.add(spr);
    const knob = new THREE.Group();
    const kb = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 2, 32), M.plastic(0x1d1f24, { roughness: 0.3 })); kb.rotation.x = Math.PI / 2; knob.add(kb);
    const grip = box(0.7, 3.6, 1.2, M.plastic(0x2c2f36)); grip.position.z = 1.2; knob.add(grip);
    knob.position.set(0, -4.5, 22.5); root.add(knob);
    const shaft = rod(0, 3, 0.25, 0.25, M.metal(0x9aa0aa)); shaft.rotation.y = Math.PI / 2; shaft.position.set(0, -4.5, 21.5); root.add(shaft);

    // The spark: a jagged bright line from the igniter tip to the burner rim.
    const sparkGeo = new THREE.BufferGeometry(); sparkGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * 9), 3));
    const sparkLine = new THREE.Line(sparkGeo, new THREE.LineBasicMaterial({ color: 0xd9f0ff, toneMapped: false }));
    const sparkGlow = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    root.add(sparkLine, sparkGlow);
    const rimW = new THREE.Vector3(B.R + 0.1, 2.5, 0.6);

    // Escaping gas: a faint orange cloud.
    const NG = 90;
    const cloud = new THREE.InstancedMesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb547, transparent: true, opacity: 0.16, depthWrite: false }), NG);
    cloud.instanceMatrix.setUsage(THREE.DynamicDrawUsage); cloud.frustumCulled = false; root.add(cloud);
    const seeds = Array.from({ length: NG }, (_, i) => [((i * 0.618) % 1) * Math.PI * 2, (i * 0.37) % 1, 0.6 + ((i * 0.71) % 1) * 0.8]);

    // Millivolt chart.
    let m = makeSim(), ffdNow = true;
    const chart = canvasTexture(900, 440, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,12,18,.9)'; g.fillRect(0, 0, w, h);
      const x0 = 70, y0 = h - 50, cw = w - 100, ch = h - 120, X = (i) => x0 + (i / (m.hist.length - 1)) * cw, Y = (v) => y0 - (clamp(v, 0, 32) / 32) * ch;
      g.font = '20px sans-serif'; g.lineWidth = 1;
      for (let v = 0; v <= 30; v += 10) { g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(x0, Y(v)); g.lineTo(x0 + cw, Y(v)); g.stroke(); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText(v + '', 30, Y(v) + 7); }
      g.fillText('40 s ago', x0, h - 16); g.fillText('now', x0 + cw - 40, h - 16);
      // Gas-flowing band along the bottom.
      g.fillStyle = 'rgba(255,181,71,.35)';
      for (let i = 0; i < m.gasH.length; i++) if (m.gasH[i]) g.fillRect(X(i), y0 + 4, cw / m.gasH.length + 1, 10);
      g.setLineDash([10, 8]); g.strokeStyle = '#ff7a59'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, Y(V_DROP)); g.lineTo(x0 + cw, Y(V_DROP)); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#ff7a59'; g.fillText('magnet lets go (4 mV)', x0 + cw - 230, Y(V_DROP) - 10);
      g.strokeStyle = '#8ef0ff'; g.lineWidth = 5; g.beginPath(); m.hist.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v)))); g.stroke();
      g.fillStyle = '#e8eef8'; g.font = 'bold 26px sans-serif'; g.fillText('Thermocouple voltage (millivolts)', 20, 38);
      g.font = '18px sans-serif'; g.fillStyle = 'rgba(255,181,71,.9)'; g.fillText('orange band: gas flowing', w - 250, 38);
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.25), new THREE.MeshBasicMaterial({ map: chart.tex, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
    board.position.set(0.9, 3.3, -3.2); board.rotation.y = 0.1; stage.root.add(board);

    const labs = {
      ig: stage.label('Igniter', [B.R + 2.5, 5, 0.8], root),
      tc: stage.label('Thermocouple', [-B.R - 2.5, 5.5, -0.6], root),
      valve: stage.label('', [6, -8, 15], root, 'hot'),
      knob: stage.label('Knob', [-5, -2, 23], root),
    };

    const api = {
      light: (hold) => { m.knobOn = true; m.pressed = hold; m.spark = 1.3; m.shutAt = null; },
      blow: () => { m.flame = false; m.outAt = m.t; m.leaked = 0; m.shutAt = null; },
      off: () => { m.knobOn = false; m.flame = false; m.pressed = 0; },
      prime: () => { m = makeSim(); m.knobOn = true; m.flame = true; m.x1 = V_HOT; m.V = V_HOT; m.hist.fill(V_HOT); m.gasH.fill(1); m.gas = true; },
      skip: (sec) => { for (let i = 0; i < sec * 50; i++) stepSim(m, 0.02, ffdNow); },
    };
    api.prime();
    const o = new THREE.Object3D();
    let redraw = 0;
    return {
      ...api,
      update(dt, s, time) {
        dt = Math.max(0, dt);
        fit();
        ffdNow = s.ffd;
        stepSim(m, Math.min(dt, 0.1), s.ffd);
        flames.set(0.55, m.flame ? 1 : 0, time);
        // Knob pushed in while held; the armature pulls back (open) when the valve is open.
        knob.position.z = 22.5 - (m.pressed > 0 ? 0.8 : 0);
        armature.position.z = m.gas ? -1.25 : 0.4;
        labs.valve.element.innerHTML = m.gas ? 'Magnet valve: <b>open</b>' : 'Magnet valve: <b>shut</b>';
        // Spark: a new jagged path every frame while sparking.
        const sparking = m.spark > 0 && Math.floor(time * 12) % 2 === 0;
        sparkLine.visible = sparkGlow.visible = sparking;
        if (sparking) {
          const a = sparkGeo.attributes.position;
          for (let i = 0; i < 9; i++) { const k = i / 8; const p = tipW.clone().lerp(rimW, k); if (i && i < 8) { p.y += (Math.sin(time * 97 + i * 3.1)) * 0.35; p.z += Math.cos(time * 71 + i * 2.3) * 0.3; } a.setXYZ(i, p.x, p.y, p.z); }
          a.needsUpdate = true; sparkGlow.position.copy(tipW).lerp(rimW, 0.5);
        }
        // Gas cloud builds while unburnt gas escapes.
        const leaking = m.gas && !m.flame && m.spark <= 0;
        const amt = clamp(m.leaked / 1.5, 0, 1);
        cloud.visible = leaking || amt > 0.02;
        for (let i = 0; i < NG; i++) {
          const [a, ph, sp] = seeds[i];
          const u = (ph + time * 0.12 * sp) % 1;
          const r = B.R * 0.6 + u * (6 + 8 * amt);
          o.position.set(Math.cos(a + u) * r, 2 + u * (3 + 6 * amt), Math.sin(a + u) * r);
          o.scale.setScalar(leaking ? (0.4 + u * 1.2) * (0.3 + 0.7 * amt) : 0.0001); o.updateMatrix(); cloud.setMatrixAt(i, o.matrix);
        }
        cloud.instanceMatrix.needsUpdate = true;
        if ((redraw += dt) > 0.1) { redraw = 0; chart.redraw(); }
        board.visible = stage.host.clientWidth >= 560;
      },
      readout: (s) => {
        let big, cls = '';
        if (m.flame) big = 'Burning';
        else if (m.gas && m.spark > 0) big = 'Sparking…';
        else if (m.gas) { big = s.ffd ? 'Flame out: sensor cooling' : 'Flame out: gas escaping!'; cls = 'no'; }
        else if (m.knobOn) { big = 'Gas shut off safely'; cls = 'ok'; }
        else big = 'Off';
        const lit = m.leaked / 2.0;                       // LPG vapour is about 2 kg/m³ = 2 g per litre
        return `<div class="big ${cls}">${big}</div>
          <div class="row"><span>Spark needed for a ${s.gap.toFixed(1)} mm gap</span><b>≈ ${(sparkKV(s.gap)).toFixed(1)} kV</b></div>
          <div class="row"><span>Thermocouple</span><b>${m.V.toFixed(1)} mV</b></div>
          <div class="row"><span>Gas valve</span><b>${m.gas ? (m.pressed > 0 ? 'open (knob held in)' : s.ffd ? 'open (held by magnet)' : 'open') : 'shut'}</b></div>
          <div class="row"><span>Unburnt gas escaped</span><b>${m.leaked.toFixed(2)} g (${lit.toFixed(1)} L)</b></div>
          ${!s.ffd ? '<small class="no">No safety device: gas keeps flowing until someone turns the knob off.</small>' : '<small>Big burner, 3 kW: unburnt, it would leak about 65 mg of LPG a second.</small>'}`;
      },
    };
  },
};
