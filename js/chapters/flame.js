// Chapter 2: the flame. A jet of gas pulls air into the mixing tube (the Bunsen principle),
// and how much air it gets decides whether the flame is clean blue or sooty yellow.
// Built in centimetres, scaled 1 unit = 6.7 cm.
import { THREE, M, box, arrow } from '../kit.js';
import { makeBurnerHead, makeFlames, makeMixer, makeKadhai, pathOf, flameState, panEfficiency, gramsPerHour, BURNERS, STOICH_AIR, INDUCTION_EFF, xrayable, fitNarrow } from '../kitchen.js';

const S = 0.15;

export default {
  id: 'flame',
  short: 'Blue flame, yellow flame',
  title: 'Why a good gas flame is blue',
  subtitle: 'A jet of gas drags air in with it. Enough air, and it burns clean and blue.',
  view: { pos: [2.7, 2.6, 5.2], target: [-1.1, 0.3, 1.0] },
  learn: `<p>LPG is made of <b>propane</b> and <b>butane</b>, molecules of carbon and hydrogen. When they burn, they join with <b>oxygen</b> from the air and become <b>carbon dioxide</b> and <b>water vapour</b>, giving out heat. Each litre of gas needs about <b>28 litres of air</b>.</p>
    <p>A stove mixes some of that air in <i>before</i> the flame. The gas shoots out of a tiny <b>injector</b> at high speed into a <b>mixing tube</b>, and the fast jet drags air in through the gap beside it. This is the <b>Bunsen principle</b>, the same trick as the burner in a school lab. The rest of the air, the <b>secondary air</b>, reaches the flame from around it.</p>
    <p>With about half the air premixed, the flame is <b>blue</b> with a sharp inner cone, and its hottest part reaches about <b>1,900 °C</b>. Starve it of air (a blocked tube, a dirty burner) and the fuel cannot burn completely: tiny specks of <b>soot</b> glow <b>yellow</b>, blacken your pans, and the flame gives off <b>carbon monoxide</b>, a poisonous gas.</p>
    <p class="tip"><b>Try it:</b> close the air shutter and watch the flame go lazy and yellow, then open it until it is crisp and blue.</p>`,
  terms: [
    { t: 'Combustion', d: 'Burning: fuel joining with oxygen and giving out heat and light.' },
    { t: 'Primary air', d: 'The air mixed with the gas inside the burner, before it reaches the flame.' },
    { t: 'Venturi', d: 'A tube that narrows and widens again. A fast jet through it pulls in the air around it.' },
    { t: 'Soot', d: 'Tiny specks of unburnt carbon. Glowing soot is what makes a flame yellow.' },
    { t: 'Carbon monoxide', d: 'A poisonous gas with no colour or smell, made when fuel burns without enough oxygen.' },
  ],
  defaults: { air: 0.55, kind: 'big', knob: 1, pan: false },
  controls: [
    { key: 'air', type: 'range', label: 'Air shutter (primary air)', min: 0.05, max: 1, step: 0.01, ends: ['closed', 'wide open'], fmt: (v) => Math.round(v * 100) + '% of the air it needs' },
    { key: 'kind', type: 'seg', label: 'Burner', options: [{ v: 'small', label: 'Small' }, { v: 'medium', label: 'Medium' }, { v: 'big', label: 'Big' }], fmt: (v) => BURNERS[v].kW + ' kW at full' },
    { key: 'knob', type: 'range', label: 'Knob', min: 0.25, max: 1, step: 0.01, ends: ['sim', 'full'], fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'pan', type: 'toggle', label: 'Show the pan' },
  ],
  quiz: [
    { q: 'What makes a gas flame yellow?', options: ['Too much gas pressure', 'Glowing specks of soot, because there is too little air', 'The pan being too hot', 'Water in the gas'], answer: 1, why: 'Without enough air, some carbon is left unburnt. The tiny hot soot particles glow yellow.' },
    { q: 'How does air get into the burner before the flame?', options: ['A small fan blows it in', 'The fast gas jet drags it into the mixing tube', 'It leaks in through the knob', 'It comes from the chimney'], answer: 1, why: 'A fast jet pulls the surrounding air along with it: the Bunsen principle.' },
    { q: 'Burning LPG gives carbon dioxide, heat and what else?', options: ['Water vapour', 'Hydrogen gas', 'Smoke only', 'Ozone'], answer: 0, why: 'The hydrogen in propane and butane joins with oxygen to make water. That is why a cold pan fogs up at first.' },
  ],
  reel: [
    { ms: 5400, caption: 'A jet of gas shoots into a tube and drags air in with it, just like a Bunsen burner.', set: { air: 0.55, kind: 'big', knob: 1, pan: false }, view: { pos: [2.0, 1.3, 3.3], target: [0, -0.2, 1.0] }, spin: 0 },
    { ms: 5800, caption: 'Too little air makes a lazy, sooty yellow flame. Enough air and it burns clean and blue.', set: { kind: 'big', knob: 1, pan: false }, anim: { air: [0.06, 0.6] }, view: { pos: [2.0, 1.9, 3.1], target: [0, 0.45, 0.2] }, spin: 0.15 },
  ],

  build({ stage }) {
    const fit = fitNarrow(stage);
    const root = new THREE.Group(); root.scale.setScalar(S); stage.root.add(root);
    root.position.y = 0.2;

    // A slice of the stove: glass top and the steel tray below, see-through so the tube shows.
    const glass = xrayable(box(40, 0.6, 34, new THREE.MeshPhysicalMaterial({ color: 0x0b0c10, roughness: 0.08, clearcoat: 1, transparent: true, opacity: 1 })), 0.3); glass.position.set(0, -0.3, 6);
    const tray = box(40, 0.3, 34, M.clear(0x9aa0aa, 0.12)); tray.position.set(0, -8.4, 6); tray.castShadow = false;
    root.add(glass, tray);
    glass.setXray(true);

    let head, flames, mixer, kind = null;
    const B = () => BURNERS[kind];
    const pan = makeKadhai(12); root.add(pan);
    const supports = new THREE.Group(); root.add(supports);
    const L = 13;

    // Gas and air dots.
    const N = 150;
    const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), N);
    dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage); dots.frustumCulled = false;
    for (let i = 0; i < N; i++) dots.setColorAt(i, new THREE.Color(0xffffff));
    root.add(dots);
    let gasPath, airPath;
    const ph = Float32Array.from({ length: N }, (_, i) => (i * 0.618) % 1);
    const cGas = new THREE.Color(0xffb547), cAir = new THREE.Color(0x8ef0ff), cMix = new THREE.Color(0xc59bff), col = new THREE.Color();

    // Arrows: primary air in at the shutter, secondary air round the flame.
    const airIn = [0, 1].map((k) => { const a = arrow(0x8ef0ff, 3, 1, 0.18); root.add(a); return a; });
    const sec = [0, 1, 2, 3].map(() => { const a = arrow(0x8ef0ff, 2.4, 0.8, 0.14); root.add(a); return a; });

    const labs = {
      inj: stage.label('Injector: gas jet', [0, 0, 0], root),
      shutter: stage.label('Air drawn in', [0, 0, 0], root),
      tube: stage.label('Mixing tube', [0, 0, 0], root),
      flame: stage.label('', [0, 0, 0], root, 'hot'),
      sec: stage.label('Secondary air', [0, 0, 0], root),
    };

    const rebuild = (k) => {
      kind = k;
      [head, flames, mixer].forEach((o) => { if (o) { root.remove(o); o.traverse((m) => { m.geometry?.dispose(); }); } });
      head = makeBurnerHead(B().R, B().ports); root.add(head);
      flames = makeFlames(B().R, B().ports); root.add(flames);
      mixer = makeMixer(B().R, L); root.add(mixer);
      supports.clear();
      for (let q = 0; q < 4; q++) { const a = (q / 4) * Math.PI * 2 + Math.PI / 4; const arm = box(5, 0.7, 0.7, M.metal(0x2a2c31, { roughness: 0.7 })); arm.position.set(Math.cos(a) * (B().R + 4), 3.2, Math.sin(a) * (B().R + 4)); arm.rotation.y = -a; supports.add(arm); const leg = box(0.6, 3, 0.6, M.metal(0x2a2c31)); leg.position.set(Math.cos(a) * (B().R + 6.3), 1.5, Math.sin(a) * (B().R + 6.3)); supports.add(leg); }
      const y = mixer.y;
      // Gas: injector → tube → up the riser → out through the ports (each dot picks a port).
      gasPath = pathOf([[0, y, L + 0.4], [0, y, L - 3], [0, y, 1.5], [0, y + 1, 0], [0, 0.6, 0], [0, 1.6, 0]]);
      airPath = pathOf([[3.5, y + 2.5, L + 1.5], [1.6, y + 0.6, L + 0.6], [0, y, L - 1], [0, y, 1.5], [0, y + 1, 0], [0, 0.6, 0], [0, 1.6, 0]]);
      airIn[0].position.set(3.8, y + 2.8, L + 1.2); airIn[0].rotation.z = Math.PI * 0.75;
      airIn[1].position.set(-3.8, y + 2.8, L + 1.2); airIn[1].rotation.z = -Math.PI * 0.75;
      sec.forEach((a, i) => { const ang = (i / 4) * Math.PI * 2 + 0.3; const r = B().R + 7.5; a.position.set(Math.cos(ang) * r, 1.6, Math.sin(ang) * r); a.rotation.set(0, -ang, 0); a.rotateZ(Math.PI / 2); });
      labs.inj.position.set(0, y - 2.4, L + 3.5);
      labs.shutter.position.set(7, y + 4, L + 1);
      labs.tube.position.set(-5, y - 1, 4);
      labs.flame.position.set(0, 9.5, 0);
      labs.sec.position.set(B().R + 9, 4.5, 3);
    };
    rebuild('big');

    const p = new THREE.Vector3(), o = new THREE.Object3D();
    let tt = 0, st = flameState(0.55);
    return {
      update(dt, s, time) {
        dt = Math.max(0, dt);
        fit();
        tt += dt;
        if (s.kind !== kind) rebuild(s.kind);
        st = flames.set(s.air, s.knob, time);
        pan.visible = s.pan; pan.position.set(0, 3.6, 0);
        flames.scale.set(s.pan ? 1.15 : 1, s.pan ? 0.5 : 1, s.pan ? 1.15 : 1);   // flames flatten and spread under a pan
        const narrow = stage.host.clientWidth < 560;
        labs.sec.visible = !narrow; labs.tube.visible = !narrow;
        labs.flame.element.innerHTML = st.verdict;
        labs.flame.position.y = s.pan ? 12 : 9.5;
        // Dots: a share of them are gas; the rest are air, shown in proportion to the primary air.
        // Real mixture: a × 28 volumes of air per volume of gas, too many to draw, so the balance is shown.
        const nAir = Math.round((N * 0.7) * Math.min(1, s.air / 0.7));
        const speed = 7 * (0.4 + 0.6 * s.knob);
        for (let i = 0; i < N; i++) {
          const isGas = i < N * 0.3;
          const active = isGas || i - N * 0.3 < nAir;
          ph[i] = (ph[i] + (dt * speed) / (isGas ? gasPath.total : airPath.total)) % 1;
          const path = isGas ? gasPath : airPath;
          path.at(ph[i], p);
          const u = ph[i];
          const port = (i * 2.399) % (Math.PI * 2);
          if (u > 0.93) { const k = (u - 0.93) / 0.07; p.x += Math.cos(port) * B().R * k; p.z += Math.sin(port) * B().R * k; }
          const jit = Math.sin(i * 7.1) * 0.5;
          if (p.y < mixer.y + 1.2 && p.z > 1) p.x += jit * 0.8;
          const mixing = isGas ? (u > 0.35 ? 1 : 0) : (u > 0.4 ? 1 : 0);
          col.copy(isGas ? cGas : cAir).lerp(cMix, mixing * 0.7);
          dots.setColorAt(i, col);
          o.position.copy(p); o.scale.setScalar(active ? 1 : 0.0001); o.updateMatrix(); dots.setMatrixAt(i, o.matrix);
        }
        dots.instanceMatrix.needsUpdate = true; dots.instanceColor.needsUpdate = true;
        airIn.forEach((a) => { a.set(0.8 + 2.4 * s.air); a.visible = s.air > 0.08; });
        sec.forEach((a, i) => { a.set(1.6 + 0.4 * Math.sin(tt * 3 + i)); });
        mixer.shutter.rotation.y = (1 - s.air) * 1.4;
      },
      readout: (s) => {
        const b = BURNERS[s.kind], P = b.kW * s.knob;
        const f = flameState(s.air);
        const flameR = b.R * 1.1 + 3 * Math.sqrt(s.knob) * (1 + f.yellow);
        const eff = panEfficiency({ panR: 12, flameR, yellow: f.yellow, lift: f.lift });
        const heat = P * eff;
        return `<div class="big ${f.cls}">${f.verdict}</div>
          <div class="row"><span>Burner power</span><b>${P.toFixed(2)} kW</b></div>
          <div class="row"><span>LPG burned</span><b>${Math.round(gramsPerHour(P))} g per hour</b></div>
          <div class="row"><span>Air mixed in first</span><b>${(s.air * STOICH_AIR).toFixed(0)} L per L of gas</b></div>
          <div class="row"><span>Hottest part</span><b>≈ ${f.peakC.toLocaleString('en-IN')} °C</b></div>
          <div class="row"><span>Heat into a pan</span><b>${heat.toFixed(2)} kW (${Math.round(eff * 100)}%)</b></div>
          <div class="row"><span>Induction for the same heat</span><b>${(heat / INDUCTION_EFF).toFixed(2)} kW (85%)</b></div>
          ${f.yellow > 0.5 ? '<small class="no">Unburnt fuel: soot on the pan and carbon monoxide in the air.</small>' : '<small>Pan heat: a snug pan in the BIS water-boiling test (at least 68%). Everyday cooking often gets 40–55%.</small>'}`;
      },
    };
  },
};
