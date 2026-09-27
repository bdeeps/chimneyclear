// ChimneyClear's shared physics and parts: LPG and combustion numbers, the plume and
// hood-capture model, droplet (Stokes) physics for grease filters, the chimney fan and
// duct curves, and 3D builders for an Indian kitchen: counter, LPG cylinder, regulator,
// hose, a 3-burner glass-top stove with its gas valves and mixing tubes, flames, and a
// wall chimney with baffle filters, blower, oil cup and duct.
//
// All the 3D builders work in centimetres. Each chapter scales the group to fit its view.
import { THREE, M, box, tube, rod, clamp, lerp, smooth } from './kit.js';

// ---------------------------------------------------------------- LPG and burners
// Indian domestic LPG is a propane/butane mix (IS 4576). Lower heating value about 46 MJ/kg
// (propane 46.4, n-butane 45.7 MJ/kg; Engineering ToolBox, "Fuels: higher and lower calorific values").
export const LPG_LHV = 46.0;                        // MJ/kg
export const gramsPerHour = (kW) => (kW * 3600) / LPG_LHV;          // 1 kW → 78 g/h
export const CYL_KG = 14.2;                          // Indian domestic cylinder
// Typical Indian stove burners. BIS IS 4246 stoves have small burners near 1 kW and big
// "high-efficiency" burners around 2.5–3.5 kW; these are round, representative values.
export const BURNERS = {
  small: { kW: 1.0, R: 3.0, ports: 18, name: 'Small burner' },
  medium: { kW: 1.75, R: 3.9, ports: 24, name: 'Medium burner' },
  big: { kW: 3.0, R: 4.8, ports: 30, name: 'Big burner' },
};
// Stoichiometry. Propane C3H8 + 5 O2 → 3 CO2 + 4 H2O; butane C4H10 + 6.5 O2 → 4 CO2 + 5 H2O.
// Air is 20.9% O2, so propane needs 23.9 volumes of air and butane 31.1. For a 40:60
// propane:butane mix (by volume) that is about 28 volumes of air per volume of gas.
export const STOICH_AIR = 0.4 * (5 / 0.209) + 0.6 * (6.5 / 0.209);   // ≈ 28.2

// Flame look against primary air (the fraction of the air needed that is premixed before the
// flame, set by the air shutter). Domestic "Bunsen" burners run at about 40–70% primary air
// (partially premixed); the rest ("secondary air") diffuses in from around the flame.
// Below about 25–30% the flame goes yellow: soot forms, glows, and can deposit on the pan.
// Very high aeration makes a short, hard flame that can lift off the ports or flash back.
export function flameState(a) {
  const yellow = 1 - smooth((a - 0.18) / 0.3);      // 1 = fully yellow, 0 = fully blue
  const lift = smooth((a - 0.85) / 0.15);            // tendency to lift / roar
  let verdict, cls;
  if (a < 0.25) { verdict = 'Yellow and sooty'; cls = 'no'; }
  else if (a < 0.4) { verdict = 'Blue with yellow tips'; cls = 'no'; }
  else if (a <= 0.8) { verdict = 'Clean blue flame'; cls = 'ok'; }
  else { verdict = 'Short, roaring, may lift off'; cls = 'no'; }
  // Temperatures: a well-aerated blue flame reaches about 1,900 °C at the tip of the inner cone
  // (propane–air adiabatic flame temperature is about 1,980 °C). A yellow diffusion flame's
  // glowing soot is at roughly 1,000–1,200 °C.
  const peakC = Math.round(lerp(1150, 1900, 1 - yellow) / 10) * 10;
  // How completely the carbon burns to CO2. Illustrative: a starved, yellow flame that touches
  // a cold pan is chilled before it finishes burning, leaving soot and carbon monoxide.
  const complete = clamp(0.985 - 0.12 * yellow - 0.04 * lift, 0.8, 0.99);
  return { yellow, lift, verdict, cls, peakC, complete };
}

// Share of the burner's heat that ends up in the pan. BIS IS 4246 requires at least 68%
// in its standard water-boiling test (snug pan, lid, ideal setting); in everyday cooking,
// with pans that are too small or flames licking up the sides, gas often manages 40–55%.
// Induction heats the pan itself and reaches about 85% (US DOE / LBNL cooktop tests).
export function panEfficiency({ panR = 12, flameR = 7, yellow = 0, lift = 0 }) {
  const spill = clamp((flameR - panR * 0.8) / 6, 0, 1);            // flames spilling past the pan
  return clamp(0.68 - 0.25 * spill - 0.1 * yellow - 0.06 * lift, 0.3, 0.7);
}
export const INDUCTION_EFF = 0.85;

// ---------------------------------------------------------------- the plume and the hood
// Kitchen: about 10 m² floor × 2.7 m ceiling = 27 m³.
export const KITCHEN_M3 = 27;
// A 90 cm hood, 50 cm deep: face area 0.45 m².
export const HOOD = { w: 0.9, d: 0.5, A: 0.45 };
// Suction speed at a distance x (m) straight below the hood face, for a hood of face area A
// sucking Q (m³/s): DallaValle's formula for an unflanged hood, v = Q / (10 x² + A)
// (ACGIH, Industrial Ventilation manual). It falls off roughly with the square of distance.
export const suctionAt = (Q, x, A = HOOD.A) => Q / (10 * x * x + A);
// A rising plume from a point heat source (ASHRAE Handbook, "Kitchen ventilation"/"Industrial
// local exhaust" plume equations): volume flow at height z above the virtual origin
//   V(z) = 0.005 · q^(1/3) · z^(5/3)   (m³/s, q = convective heat in W, z in m)
// and centreline speed about  w = 0.128 · q^(1/3) · z^(−1/3)  (m/s).
// For a pan on a 3 kW burner we take about half the heat going up as a hot plume.
export const plumeFlow = (qW, z) => 0.005 * Math.cbrt(qW) * Math.pow(z, 5 / 3);
export const plumeSpeed = (qW, z) => 0.128 * Math.cbrt(qW) * Math.pow(Math.max(0.1, z), -1 / 3);
// Plume half-width at height z above the pan: it starts about a pan wide (0.12 m) and spreads
// at about 0.2 m per metre (a plume's edge makes an angle of roughly 11–12° with the vertical).
export const plumeHalf = (z) => 0.12 + 0.2 * z;

// Capture model. The burner sits 0.28 m out from the wall; the hood reaches 0.5 m out.
// 1. Geometry: a sideways draught (v, m/s) pushes the plume out by h·v/w before it reaches
//    the hood. The share of the plume's width still under the hood is caught.
// 2. Flow: if the plume brings more air than the hood sucks, the rest spills round the edges.
// Returns fractions and the numbers behind them.
export function capture({ Qm3h, h, draught, qW = 1500 }) {
  const Q = Qm3h / 3600;
  const zv = h + 0.25;                                   // virtual origin a little below the pan
  const w = plumeSpeed(qW, zv) * 0.75;                   // average rise speed on the way up
  const drift = (h * draught) / Math.max(0.2, w);
  const half = plumeHalf(h);
  const c = 0.28 + drift;                                // plume centre, metres out from the wall
  const lo = c - half, hi = c + half;
  const inside = clamp((Math.min(HOOD.d + 0.05 * Q / 0.3, hi) - Math.max(0, lo)) / (hi - lo), 0, 1);
  const Vp = plumeFlow(qW, zv) * (1 + 1.5 * draught);    // a draught mixes extra room air in
  const flow = clamp(Q / (Vp * 1.5), 0, 1);              // hoods need ~1.5× the plume flow (safety factor)
  const frac = inside * flow;
  return { Q, w, drift, half, c, inside, flow, frac, Vp, vFace: suctionAt(Q, 0.02), vHob: suctionAt(Q, h), ach: Qm3h / KITCHEN_M3 };
}

// ---------------------------------------------------------------- droplets (grease)
// A droplet's relaxation time: how long it takes to follow a change in the air's direction.
// tau = rho d² / (18 mu) (Stokes drag). Cooking oil ~ 910 kg/m³; hot kitchen air mu ≈ 1.9e-5 Pa·s.
export const RHO_OIL = 910, MU_AIR = 1.9e-5;
export const tauOf = (dUm) => (RHO_OIL * (dUm * 1e-6) ** 2) / (18 * MU_AIR);
// Stokes number: tau × speed / size of the turn. Much above ~0.3 and the drop can't make the turn.
export const stokes = (dUm, U, W) => (tauOf(dUm) * U) / W;
// Filter catch efficiency against droplet size.
//  - baffle: channels about 10 mm wide with two sharp turns; slot speed ~ airflow / open area.
//    Each turn catches Stk²/(Stk²+0.25²) (a standard impaction curve shape, 50% at Stk ≈ 0.25).
//  - mesh: 8 layers of expanded aluminium, strands 0.3 mm wide, 60% open, air at face speed.
//    Single-strand impaction efficiency ≈ (Stk/(Stk+0.6))² (curve-fit for cylinders).
//  - filterless: one gentle turn round a curved panel (gap 30 mm), then the spinning blower
//    wheel flings some of what is left against the scroll (modelled as one more turn, blade
//    speed 15 m/s, blade spacing 30 mm).
// These are simplified textbook models; published tests (ASHRAE RP-1033, Kuehn et al.) show
// baffle filters catching most droplets above about 10 µm and few below about 3 µm, which this matches.
const imp = (stk, s50) => (stk * stk) / (stk * stk + s50 * s50);
export function filterCatch(type, dUm, Qm3h) {
  const Q = Qm3h / 3600;
  if (type === 'baffle') {
    const U = Q / 0.08;                                   // 0.08 m² of open slots on a 90 cm hood
    const e1 = imp(stokes(dUm, U, 0.01), 0.25);
    return { eff: 1 - (1 - e1) ** 2, U, stk: stokes(dUm, U, 0.01) };
  }
  if (type === 'mesh') {
    const U = Q / (0.3 * 0.6) / 0.6;                      // face 0.3 m², 60% open → speed between strands
    const stk = stokes(dUm, U, 0.0003);
    const e = (stk / (stk + 0.6)) ** 2;
    return { eff: 1 - (1 - 0.4 * e) ** 8, U, stk };        // 8 layers, each strand blocks 40% of the path
  }
  const U = Q / 0.06;                                      // panel gap
  const stk = stokes(dUm, U, 0.03);
  const e1 = imp(stk, 0.25), e2 = imp(stokes(dUm, 15, 0.03), 0.25);
  return { eff: 1 - (1 - e1) * (1 - 0.8 * e2), U, stk };
}

// ---------------------------------------------------------------- fan and duct
// A chimney blower at full ("boost") speed: 1,200 m³/h into free air, up to 480 Pa against a
// closed outlet. A centrifugal fan curve is close to  p = pMax (1 − (Q/Qmax)²).
// Fan laws: Qmax ∝ speed, pMax ∝ speed². Rated "suction" on the box is the free-air number.
export const FAN = { Qmax: 1200, pMax: 480 };
export const SPEEDS = [0.55, 0.75, 0.9, 1];               // speeds 1, 2, 3 and boost, as a fraction of full
export const fanP = (Qm3h, n) => Math.max(0, FAN.pMax * n * n * (1 - (Qm3h / (FAN.Qmax * n)) ** 2));
// System resistance: p = ½ρv² (f·L/D + ΣK) in the duct, plus the filter and hood (about 60 Pa at
// 1,000 m³/h, ∝ Q²), plus the make-up air path (air must come back in through a window or door gaps:
// p = ½ρ(Q/(0.6·A))², orifice flow).
// Loss coefficients (ASHRAE Fundamentals, duct fitting data; typical values):
//   smooth round 90° bend K ≈ 0.4, crumpled flexible-foil bend K ≈ 1.0, exit with a flap K ≈ 1.5,
//   friction factor f ≈ 0.02 for smooth PVC/steel, ≈ 0.05 for corrugated aluminium foil duct.
export function systemP(Qm3h, d) {
  const Q = Qm3h / 3600, rho = 1.2;
  const D = d.diam / 1000, A = Math.PI * D * D / 4, v = Q / A;
  const dyn = 0.5 * rho * v * v;
  const f = d.flex ? 0.05 : 0.02, Kb = d.flex ? 1.0 : 0.4;
  let p = 60 * (d.filterK ?? 1) * (Qm3h / 1000) ** 2;         // grease filter + hood entry (filterK: clogging)
  if (d.mode === 'recirc') {
    p += 180 * (Qm3h / 1000) ** 2;                          // activated-carbon filter
    p += 0.5 * rho * (Q / 0.03) ** 2 * 0.3;                 // out through the side grille
    return p;
  }
  p += dyn * (f * d.len / D + Kb * d.bends + 1.5);
  const Aw = d.window ? 0.5 : 0.03;                         // an open window, or just gaps round shut doors (~300 cm²)
  p += 0.5 * rho * (Q / (0.6 * Aw)) ** 2;
  return p;
}
// Where the fan curve meets the system curve.
export function operatingPoint(n, d) {
  let lo = 0, hi = FAN.Qmax * n;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (fanP(m, n) > systemP(m, d)) lo = m; else hi = m; }
  const Q = (lo + hi) / 2;
  return { Q, p: fanP(Q, n) };
}
// Noise: fan sound power rises about 50·log10 of speed (fan laws for noise). A typical chimney
// is about 66–68 dB(A) at 1 m on boost and 50–55 dB on its lowest speed.
export const noiseDb = (n) => 68 + 50 * Math.log10(n);

// ---------------------------------------------------------------- paths and moving dots
export function pathOf(points) {
  const P = points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p)));
  const L = [0];
  for (let i = 1; i < P.length; i++) L.push(L[i - 1] + P[i].distanceTo(P[i - 1]));
  const total = L[L.length - 1];
  return {
    points: P, total, lengths: L,
    at(u, out = new THREE.Vector3()) {
      const d = (((u % 1) + 1) % 1) * total;
      let lo = 0, hi = L.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] <= d) lo = m; else hi = m; }
      return out.copy(P[lo]).lerp(P[hi], (d - L[lo]) / Math.max(1e-9, L[hi] - L[lo]));
    },
  };
}
export function flowDots(path, count, geo, color = 0xffffff, spread = 0) {
  const m = new THREE.InstancedMesh(geo, M.glow(color), count);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const u = Float32Array.from({ length: count }, (_, i) => i / count);
  const jit = Array.from({ length: count }, (_, i) => [Math.sin(i * 12.99) * spread, Math.cos(i * 78.2) * spread, Math.sin(i * 3.7) * spread]);
  const o = new THREE.Object3D(), p = new THREE.Vector3();
  m.step = (dt, speed) => {
    for (let i = 0; i < count; i++) {
      u[i] = (u[i] + (dt * speed) / path.total + 1) % 1;
      path.at(u[i], p);
      o.position.set(p.x + jit[i][0], p.y + jit[i][1], p.z + jit[i][2]); o.updateMatrix(); m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  };
  return m;
}

// ---------------------------------------------------------------- materials
export const MAT = {
  brass: () => M.metal(0xc9a24a, { roughness: 0.35 }),
  darkBrass: () => M.metal(0x7a5a24, { roughness: 0.5 }),
  steel: () => M.metal(0xb9bec8, { roughness: 0.3 }),
  iron: () => M.metal(0x2a2c31, { roughness: 0.7, metalness: 0.6 }),
  glassTop: () => new THREE.MeshPhysicalMaterial({ color: 0x0b0c10, roughness: 0.08, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 1 }),
  red: () => M.plastic(0xc4161c, { roughness: 0.35 }),
  hose: () => M.plastic(0xf06a1a, { roughness: 0.55 }),
};
// Something that turns see-through in X-ray mode.
export function xrayable(mesh, opacityOn = 0.12) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mats.forEach((m) => { m.transparent = true; m.userData.base = m.opacity; });
  mesh.setXray = (on) => { mats.forEach((m) => { m.opacity = on ? opacityOn : m.userData.base; m.depthWrite = !on; }); mesh.castShadow = !on; };
  return mesh;
}

// ---------------------------------------------------------------- burner parts
// A burner head (the brass crown with its ring of ports) and its loose cap.
// Origin at the glass surface; the burner axis is +Y. Sizes in cm.
export function makeBurnerHead(R = 4.8, ports = 30) {
  const g = new THREE.Group();
  const brass = MAT.brass();
  // Crown: a short brass cylinder with notched ports round its rim.
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.95, R * 1.05, 1.8, 48), brass); crown.position.y = 1.1; crown.castShadow = true;
  const flange = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.35, R * 1.35, 0.35, 48), M.metal(0x9a9da5, { roughness: 0.4 })); flange.position.y = 0.2;
  const portMat = M.matte(0x1b1510);
  const portGeo = new THREE.BoxGeometry(0.45, 0.5, 0.4);
  const pm = new THREE.InstancedMesh(portGeo, portMat, ports);
  const o = new THREE.Object3D();
  for (let i = 0; i < ports; i++) { const a = (i / ports) * Math.PI * 2; o.position.set(Math.cos(a) * R * 0.96, 1.85, Math.sin(a) * R * 0.96); o.rotation.set(0, -a, 0); o.updateMatrix(); pm.setMatrixAt(i, o.matrix); }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.98, R * 1.0, 0.8, 48), M.metal(0x2e2a26, { roughness: 0.45, metalness: 0.7 })); cap.position.y = 2.45; cap.castShadow = true;
  g.add(flange, crown, pm, cap);
  g.R = R; g.ports = ports; g.cap = cap; g.portY = 1.85;
  return g;
}

// A ring of flame tongues, one per port, for a burner of radius R. Origin at the glass.
// set(a, power, t): a = primary air fraction (0–1), power = 0–1 of full, t = time (s).
export function makeFlames(R = 4.8, ports = 30) {
  const g = new THREE.Group();
  const add = (color, op) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const innerMat = add(0x4f7dff, 0.95), outerMat = add(0x3b56ff, 0.35), lumMat = add(0xffa230, 0.8);
  const cone = new THREE.ConeGeometry(0.5, 1, 10, 1, true); cone.translate(0, 0.5, 0);
  const inner = new THREE.InstancedMesh(cone, innerMat, ports), outer = new THREE.InstancedMesh(cone, outerMat, ports), lum = new THREE.InstancedMesh(cone, lumMat, ports);
  [inner, outer, lum].forEach((m) => { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; g.add(m); });
  const o = new THREE.Object3D(), cBlue = new THREE.Color(), cY = new THREE.Color(0xffa230);
  g.set = (a, power, t) => {
    const st = flameState(a), on = power > 0.01;
    g.visible = on;
    if (!on) return st;
    const P = Math.sqrt(power);
    const outerL = (1.4 + 3.2 * st.yellow + 0.8 * (1 - a)) * P * (1 - 0.35 * st.lift);
    const innerL = (0.55 + 0.5 * (1 - a)) * P * (1 - 0.3 * st.lift) * (1 - st.yellow);
    const tilt = lerp(0.95, 0.45, st.yellow);          // blue flames fan outward; lazy yellow ones stand up
    const lift = 0.35 * st.lift;
    for (let i = 0; i < ports; i++) {
      const ang = (i / ports) * Math.PI * 2;
      const fl = 1 + (0.05 + 0.25 * st.yellow) * Math.sin(t * (9 + (i % 5)) + i * 1.7) + 0.06 * st.lift * Math.sin(t * 40 + i);
      const r = R * 1.0 + lift;
      o.position.set(Math.cos(ang) * r, 1.85, Math.sin(ang) * r);
      o.rotation.set(0, 0, 0);
      o.rotateY(-ang); o.rotateZ(-tilt);
      o.scale.set(0.9 * P + 0.3 * st.yellow, outerL * fl, 0.9 * P + 0.3 * st.yellow); o.updateMatrix(); outer.setMatrixAt(i, o.matrix);
      o.scale.set(0.55 * P, Math.max(0.001, innerL), 0.55 * P); o.updateMatrix(); inner.setMatrixAt(i, o.matrix);
      o.scale.set(0.8 * P + 0.4 * st.yellow, Math.max(0.001, outerL * 0.9 * st.yellow * fl), 0.8 * P + 0.4 * st.yellow); o.updateMatrix(); lum.setMatrixAt(i, o.matrix);
    }
    [inner, outer, lum].forEach((m) => { m.instanceMatrix.needsUpdate = true; });
    inner.visible = st.yellow < 0.95; lum.visible = st.yellow > 0.02;
    outerMat.color.copy(cBlue.set(0x3b56ff)).lerp(cY, st.yellow * 0.6);
    outerMat.opacity = 0.35 + 0.15 * st.yellow;
    lumMat.opacity = 0.85 * st.yellow;
    return st;
  };
  return g;
}

// A burner assembly seen in cutaway: injector → mixing tube (venturi) → burner head.
// The mixing tube runs along +Z from the injector (at z = L) to under the head (z = 0),
// then turns up. Origin at the glass surface above the head. Sizes in cm.
export function makeMixer(R = 4.8, L = 14) {
  const g = new THREE.Group();
  const al = M.metal(0xd6dbe4, { roughness: 0.3, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
  const y = -4.5;
  // Venturi: wide mouth at the injector, narrow throat, widening again (the diffuser).
  const venturi = new THREE.Mesh(new THREE.LatheGeometry([[1.6, 0], [1.1, 2.5], [0.8, 4], [1.2, L - 2], [1.4, L]].map(([r, z]) => new THREE.Vector2(r, z)), 32, 0, Math.PI * 2), al);
  venturi.rotation.set(-Math.PI / 2, 0, 0); venturi.position.set(0, y, L);   // lathe axis Y → −Z: mouth at z = L, outlet at z = 0
  const riser = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.4, Math.abs(y) - 0.2, 24, 1, true), al); riser.position.set(0, y / 2 - 0.1, 0);
  const elbow = new THREE.Mesh(new THREE.SphereGeometry(1.45, 20, 12), al); elbow.position.set(0, y, 0);
  // Injector: a brass nozzle with a tiny hole, facing into the venturi mouth.
  const inj = new THREE.Group();
  inj.add(rod(0, 1.8, 0.45, 0.25, MAT.brass(), 20));
  inj.rotation.y = Math.PI / 2; inj.position.set(0, y, L + 2.1);          // tip points into the mouth
  // Air shutter: a sleeve with windows at the mouth.
  const shutter = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 1.6, 24, 1, true, 0, Math.PI * 1.2), M.metal(0x7e848f, { side: THREE.DoubleSide }));
  shutter.rotation.x = Math.PI / 2; shutter.position.set(0, y, L + 0.2);
  const gasPipe = tube([[0, y, L + 2.6], [0, y, L + 6], [0, y - 1.5, L + 8]], 0.35, MAT.brass(), false, 30);
  g.add(venturi, riser, elbow, inj, shutter, gasPipe);
  g.venturi = venturi; g.shutter = shutter; g.y = y; g.L = L;
  return g;
}

// ---------------------------------------------------------------- stove (cooktop)
// A 3-burner glass-top stove, 72 × 40 cm, 9 cm tall, sitting on the counter.
// Origin at the middle of its base. Front faces +Z. Returns parts for explode and X-ray.
export const STOVE = { W: 72, D: 40, H: 9, xs: [-23, 0, 23], kinds: ['big', 'small', 'medium'], zB: -2 };
export function makeStove() {
  const g = new THREE.Group();
  const { W, D, H } = STOVE;
  const body = xrayable(box(W, H - 0.6, D, M.metal(0x9aa0aa, { roughness: 0.35 })), 0.1); body.position.y = (H - 0.6) / 2;
  const glass = box(W, 0.6, D, MAT.glassTop()); glass.position.y = H - 0.3;
  const glassX = (on) => { glass.material.opacity = on ? 0.25 : 1; glass.material.depthWrite = !on; };
  const heads = [], flames = [], supports = [], knobs = [], mixers = [], sparks = [], probes = [];
  const manifold = new THREE.Group();
  manifold.add(rod(-W / 2 + 6, W / 2 - 8, 0.6, 0.6, MAT.brass(), 16)); manifold.children[0].position.set(-1, 3.6, 15);
  STOVE.xs.forEach((x, i) => {
    const B = BURNERS[STOVE.kinds[i]];
    const h = makeBurnerHead(B.R, B.ports); h.position.set(x, H, STOVE.zB); g.add(h); heads.push(h);
    const f = makeFlames(B.R, B.ports); f.position.copy(h.position); g.add(f); flames.push(f);
    // Pan support: four enamelled iron arms on a ring.
    const sup = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(B.R * 2.2, 0.35, 8, 40), MAT.iron()); ring.rotation.x = Math.PI / 2; ring.position.y = 0.6; sup.add(ring);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; const arm = box(B.R * 1.3, 0.7, 0.7, MAT.iron()); arm.position.set(Math.cos(a) * B.R * 1.6, 2.6, Math.sin(a) * B.R * 1.6); arm.rotation.y = -a; sup.add(arm); const leg = box(0.6, 2.4, 0.6, MAT.iron()); leg.position.set(Math.cos(a) * B.R * 2.2, 1.4, Math.sin(a) * B.R * 2.2); sup.add(leg); }
    sup.position.set(x, H, STOVE.zB); g.add(sup); supports.push(sup);
    // Knob on the front face, with the gas valve behind it.
    const knob = new THREE.Group();
    const kb = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 2, 32), M.plastic(0x1d1f24, { roughness: 0.3 })); kb.rotation.x = Math.PI / 2; knob.add(kb);
    const grip = box(0.7, 3.6, 1.2, M.plastic(0x2c2f36)); grip.position.z = 1.2; knob.add(grip);
    const mark = box(0.3, 1.1, 0.2, M.glow(0xffb547)); mark.position.set(0, 1.2, 1.9); knob.add(mark);
    knob.position.set(x, H / 2 - 0.5, D / 2 + 1); g.add(knob); knobs.push(knob);
    const valve = rod(-1.6, 1.6, 1.1, 1.1, MAT.brass(), 20); valve.rotation.y = Math.PI / 2; valve.position.set(x, 3.6, 16.5); manifold.add(valve);
    // Mixing tube from the valve back to under the burner.
    const mx = makeMixer(B.R, 13); mx.position.set(x, H, STOVE.zB); mx.scale.setScalar(0.85); g.add(mx); mixers.push(mx);
    // Igniter electrode and flame-failure thermocouple beside the head.
    const ig = new THREE.Group(); const cer = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 2.4, 12), M.plastic(0xf2efe6)); cer.position.y = 1.2; ig.add(cer);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8), MAT.steel()); tip.position.y = 2.7; ig.add(tip);
    ig.position.set(x + B.R + 0.9, H, STOVE.zB + 1.2); g.add(ig); sparks.push(ig);
    const tc = new THREE.Group(); const tcb = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.8, 10), M.metal(0xd07a45)); tcb.position.y = 1.4; tc.add(tcb);
    tc.position.set(x - B.R - 0.9, H, STOVE.zB - 1.2); g.add(tc); probes.push(tc);
  });
  // Inlet nozzle on the left side, where the hose fits.
  const inlet = rod(-W / 2 - 4, -W / 2, 0.8, 0.6, MAT.brass(), 16); inlet.position.set(-W / 2 - 2, 3.6, 10);
  const feed = tube([[-W / 2 - 1, 3.6, 10], [-W / 2 + 4, 3.6, 12], [-W / 2 + 6, 3.6, 15]], 0.55, MAT.brass(), false, 20);
  g.add(body, glass, manifold, inlet, feed);
  return { group: g, body, glass, glassX, heads, flames, supports, knobs, mixers, sparks, probes, manifold, inlet };
}

// ---------------------------------------------------------------- LPG cylinder + regulator
// Indian 14.2 kg domestic cylinder: about 31.5 cm across. Origin at the floor.
export function makeCylinder() {
  const g = new THREE.Group();
  const red = MAT.red();
  const r = 15.7, bodyH = 44;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.92, 6, 40, 1, true), red); foot.position.y = 3;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, bodyH, 48), red); body.position.y = 12 + bodyH / 2;
  const top = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), red); top.scale.y = 0.55; top.position.y = 12 + bodyH;
  const bot = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), red); bot.scale.y = 0.4; bot.position.y = 12;
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 9, 40, 1, true), M.metal(0xc4161c, { side: THREE.DoubleSide, metalness: 0.3, roughness: 0.4 })); guard.position.y = 12 + bodyH + 10;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.1, r + 0.1, 5, 48, 1, true), M.plastic(0xf2f2f2)); band.position.y = 12 + bodyH - 6;
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.2, 5, 16), MAT.brass()); valve.position.y = 12 + bodyH + 9;
  [foot, body, top, bot, guard, band, valve].forEach((m) => { m.castShadow = true; });
  g.add(foot, body, top, bot, guard, band, valve);
  g.valveTop = new THREE.Vector3(0, 12 + bodyH + 11.5, 0);
  g.body = body;
  return g;
}
// Pressure regulator: clicks onto the cylinder valve, drops ~6–7 bar inside the cylinder to about
// 29 mbar (300 mm water column), the Indian domestic appliance pressure. Origin at its base.
export function makeRegulator() {
  const g = new THREE.Group();
  const bodyM = M.plastic(0x2a2d33, { roughness: 0.4 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 3, 24), M.metal(0x9aa0aa)); base.position.y = 1.5;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5.2, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), bodyM); dome.scale.y = 0.55; dome.position.y = 4.2;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 1.4, 28), bodyM); disc.position.y = 3.6;
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.6, 16), M.plastic(0xff7a1a)); knob.position.y = 7.3;
  const out = rod(0, 5, 0.8, 0.7, MAT.brass(), 16); out.position.set(6.5, 3.6, 0);
  g.add(base, dome, disc, knob, out);
  g.outlet = new THREE.Vector3(9, 3.6, 0);
  return g;
}

// ---------------------------------------------------------------- the chimney (range hood)
// A 90 cm wall chimney. Origin at the middle of the canopy's underside, which is 70 cm above the
// stove top. The back is at z = −zBack (against the wall). Sizes in cm.
export const HOODC = { W: 90, D: 50, canopy: 8, pyrH: 34, stackW: 28, stackD: 24, stackH: 55 };
export function makeChimney() {
  const g = new THREE.Group();
  const { W, D, canopy, pyrH, stackW, stackD, stackH } = HOODC;
  const zc = 0;                                            // canopy centre (z); back at −25
  const shellM = M.metal(0x1c1e24, { roughness: 0.35, metalness: 0.6, transparent: true, side: THREE.DoubleSide });
  const can = xrayable(box(W, canopy, D, shellM), 0.12); can.position.y = canopy / 2;
  // Build the frustum explicitly so its top matches the stack.
  const fr = frustum(W, D, stackW + 4, stackD + 2, pyrH, -(D - stackD - 2) / 2 + 0);
  const pyramid = xrayable(new THREE.Mesh(fr, shellM.clone()), 0.12); pyramid.position.y = canopy; pyramid.castShadow = true;
  const stack = xrayable(box(stackW, stackH, stackD, M.metal(0x2a2d34, { roughness: 0.3, metalness: 0.7, transparent: true })), 0.1);
  stack.position.set(0, canopy + pyrH + stackH / 2, -(D - stackD) / 2);
  // Baffle filters underneath: two stainless panels with angled blades.
  const filters = new THREE.Group();
  for (const sx of [-1, 1]) {
    const f = new THREE.Group();
    const frame = box(W / 2 - 4, 0.8, D - 12, M.metal(0xc9ced6, { roughness: 0.25 }));
    f.add(frame);
    for (let k = 0; k < 9; k++) { const blade = box(1.2, 1.6, D - 14, M.metal(0xdfe3ea, { roughness: 0.2 })); blade.position.set(-W / 4 + 3.5 + k * 4.4, -0.3, 0); blade.rotation.z = k % 2 ? 0.5 : -0.5; f.add(blade); }
    f.position.set(sx * W / 4, -0.2, zc + 1); filters.add(f);
  }
  // Oil collector: a small cup along the back edge.
  const cup = box(14, 2.4, 3.5, M.plastic(0xd9c38a, { roughness: 0.3, transparent: true, opacity: 0.85 })); cup.position.set(W / 2 - 16, -1, -D / 2 + 3);
  // Blower: a scroll housing with a squirrel-cage wheel, axis along X; outlet up into the duct.
  const blower = new THREE.Group();
  const scroll = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 20, 36, 1, false), M.plastic(0x3a3f4a, { transparent: true, opacity: 0.55, depthWrite: false })); scroll.rotation.z = Math.PI / 2;
  const wheel = new THREE.Group();
  const bladeGeo = new THREE.BoxGeometry(18, 0.35, 2.2);
  const wm = new THREE.InstancedMesh(bladeGeo, M.metal(0xb9bec8, { roughness: 0.4 }), 32);
  const o = new THREE.Object3D();
  for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; o.position.set(0, Math.cos(a) * 9, Math.sin(a) * 9); o.rotation.set(-a + 0.4, 0, 0); o.updateMatrix(); wm.setMatrixAt(i, o.matrix); }
  wheel.add(wm);
  const motor = rod(10, 18, 5.5, 5.5, M.metal(0x6a707c, { roughness: 0.4 }), 24);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 10, 28), M.metal(0x8a909c)); collar.position.set(0, 14, -4);
  blower.add(scroll, wheel, motor, collar);
  blower.position.set(-2, canopy + 14, -8);
  // Lights and touch controls.
  const lights = [];
  for (const x of [-28, 28]) { const l = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20), M.glow(0xfff1c8)); l.rotation.x = Math.PI / 2; l.position.set(x, -0.25, D / 2 - 6); g.add(l); lights.push(l); }
  const panel = new THREE.Group();
  for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16), M.glow(k === 4 ? 0xffb547 : 0x8ef0ff)); b.position.set(12 + k * 4, canopy / 2, D / 2 + 0.15); panel.add(b); }
  g.add(can, pyramid, stack, filters, cup, blower, panel);
  const shells = [can, pyramid, stack];
  return { group: g, can, pyramid, stack, shells, filters, cup, blower, wheel, motor, lights, panel, collarTop: new THREE.Vector3(-2, canopy + 14 + 19, -12) };
}
// A truncated rectangular pyramid (open top and bottom), bottom w0×d0, top w1×d1, height h.
// The top is shifted back by dz so it sits against the wall.
function frustum(w0, d0, w1, d1, h, dz) {
  const b = [[-w0 / 2, 0, -d0 / 2], [w0 / 2, 0, -d0 / 2], [w0 / 2, 0, d0 / 2], [-w0 / 2, 0, d0 / 2]];
  const t = [[-w1 / 2, h, -d1 / 2 + dz], [w1 / 2, h, -d1 / 2 + dz], [w1 / 2, h, d1 / 2 + dz], [-w1 / 2, h, d1 / 2 + dz]];
  const pos = [];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; pos.push(...b[i], ...b[j], ...t[j], ...b[i], ...t[j], ...t[i]); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------- a pan
export function makeKadhai(R = 13) {
  const g = new THREE.Group();
  const m = M.metal(0x4b4f58, { roughness: 0.45, side: THREE.DoubleSide });
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 16, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38), m); bowl.position.y = R; bowl.castShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R * Math.sin(Math.PI * 0.62), 0.35, 8, 48), m); rim.rotation.x = Math.PI / 2; rim.position.y = R + R * Math.cos(Math.PI * 0.62);
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(2, 0.35, 8, 16, Math.PI), m); h.position.set(s * (R * Math.sin(Math.PI * 0.62) + 1.2), rim.position.y, 0); h.rotation.set(0, s > 0 ? Math.PI / 2 : -Math.PI / 2, 0); g.add(h); }
  g.add(bowl, rim);
  g.rimY = rim.position.y; g.rimR = R * Math.sin(Math.PI * 0.62);
  return g;
}

export { clamp, lerp, smooth };

// On a phone the readout covers the top of the stage, so nudge the picture down (every chapter
// calls this each frame; it only touches the camera when the width class changes).
export function fitNarrow(stage, dy = -0.2) {
  let last = null;
  return () => { const n = stage.host.clientWidth < 560; if (n !== last) { last = n; stage.setShift(0, n ? dy : 0); } };
}
