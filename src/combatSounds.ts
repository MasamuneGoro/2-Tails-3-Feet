// ─── Combat Sound Effects ─────────────────────────────────────────────────────
// Synthesised via Web Audio API — no audio files, instant playback.
// "pierce" delegates to sfx_harvest_drill (real recording).
// "scoop"  delegates to sfx_harvest_scoop (real recording).

import { playSfx } from "./sound";

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

function noise(ac: AudioContext, dur: number): AudioBufferSourceNode {
  const len = Math.ceil(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  return src;
}
function osc(ac: AudioContext, type: OscillatorType, freq: number): OscillatorNode {
  const o = ac.createOscillator(); o.type = type; o.frequency.value = freq; return o;
}
function gn(ac: AudioContext, val: number): GainNode {
  const g = ac.createGain(); g.gain.value = val; return g;
}
function bpf(ac: AudioContext, freq: number, q: number): BiquadFilterNode {
  const f = ac.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q; return f;
}
function lpf(ac: AudioContext, freq: number): BiquadFilterNode {
  const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = freq; return f;
}
function hpf(ac: AudioContext, freq: number): BiquadFilterNode {
  const f = ac.createBiquadFilter(); f.type = "highpass"; f.frequency.value = freq; return f;
}

function playImpactLight(ac: AudioContext) {
  const t = ac.currentTime;
  const n = noise(ac, 0.18), fi = bpf(ac, 1800, 2.5), g = gn(ac, 0);
  n.connect(fi); fi.connect(g); g.connect(ac.destination);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.55, t+0.008); g.gain.exponentialRampToValueAtTime(0.001, t+0.18);
  n.start(t); n.stop(t+0.2);
  const o = osc(ac, "sine", 900), og = gn(ac, 0);
  o.connect(og); og.connect(ac.destination);
  og.gain.setValueAtTime(0.25, t); og.gain.exponentialRampToValueAtTime(0.001, t+0.06);
  o.frequency.exponentialRampToValueAtTime(400, t+0.06);
  o.start(t); o.stop(t+0.07);
}

function playImpactHeavy(ac: AudioContext) {
  const t = ac.currentTime;
  const sub = osc(ac, "sine", 80), subG = gn(ac, 0);
  sub.connect(subG); subG.connect(ac.destination);
  subG.gain.setValueAtTime(0.8, t); subG.gain.exponentialRampToValueAtTime(0.001, t+0.28);
  sub.frequency.setValueAtTime(80, t); sub.frequency.exponentialRampToValueAtTime(35, t+0.25);
  sub.start(t); sub.stop(t+0.3);
  const n = noise(ac, 0.35), lf = lpf(ac, 600), ng = gn(ac, 0);
  n.connect(lf); lf.connect(ng); ng.connect(ac.destination);
  ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(0.7, t+0.01); ng.gain.exponentialRampToValueAtTime(0.001, t+0.35);
  n.start(t); n.stop(t+0.4);
  const cn = noise(ac, 0.04), cf = hpf(ac, 3000), cg = gn(ac, 0.45);
  cn.connect(cf); cf.connect(cg); cg.connect(ac.destination);
  cn.start(t); cn.stop(t+0.04);
}

function playStomp(ac: AudioContext) {
  const t = ac.currentTime;
  const sub = osc(ac, "sine", 55), subG = gn(ac, 0);
  sub.connect(subG); subG.connect(ac.destination);
  subG.gain.setValueAtTime(0.9, t); subG.gain.exponentialRampToValueAtTime(0.001, t+0.4);
  sub.frequency.exponentialRampToValueAtTime(28, t+0.35);
  sub.start(t); sub.stop(t+0.45);
  const n = noise(ac, 0.25), lf = lpf(ac, 400), ng = gn(ac, 0.6);
  n.connect(lf); lf.connect(ng); ng.connect(ac.destination);
  ng.gain.setValueAtTime(0.6, t); ng.gain.exponentialRampToValueAtTime(0.001, t+0.25);
  n.start(t); n.stop(t+0.3);
  const o = osc(ac, "sine", 200), og = gn(ac, 0);
  o.connect(og); og.connect(ac.destination);
  og.gain.setValueAtTime(0.18, t+0.03); og.gain.exponentialRampToValueAtTime(0.001, t+0.45);
  o.frequency.setValueAtTime(200, t+0.03); o.frequency.linearRampToValueAtTime(80, t+0.4);
  o.start(t+0.03); o.stop(t+0.5);
}

function playScrape(ac: AudioContext) {
  const t = ac.currentTime;
  const n = noise(ac, 0.45), bf = bpf(ac, 2000, 1.2), ng = gn(ac, 0);
  n.connect(bf); bf.connect(ng); ng.connect(ac.destination);
  ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(0.42, t+0.04); ng.gain.setValueAtTime(0.42, t+0.3); ng.gain.exponentialRampToValueAtTime(0.001, t+0.45);
  bf.frequency.setValueAtTime(2000, t); bf.frequency.linearRampToValueAtTime(800, t+0.4);
  n.start(t); n.stop(t+0.5);
  const n2 = noise(ac, 0.4), hf = hpf(ac, 4000), ng2 = gn(ac, 0);
  n2.connect(hf); hf.connect(ng2); ng2.connect(ac.destination);
  ng2.gain.setValueAtTime(0, t); ng2.gain.linearRampToValueAtTime(0.15, t+0.05); ng2.gain.exponentialRampToValueAtTime(0.001, t+0.4);
  n2.start(t); n2.stop(t+0.5);
}

function playLace(ac: AudioContext) {
  const t = ac.currentTime;
  [880, 1320, 1760, 2200].forEach((freq, i) => {
    const o = osc(ac, "sine", freq), og = gn(ac, 0);
    o.connect(og); og.connect(ac.destination);
    const s = t + i*0.04;
    og.gain.setValueAtTime(0, s); og.gain.linearRampToValueAtTime(0.12 - i*0.02, s+0.05); og.gain.exponentialRampToValueAtTime(0.001, s+0.35);
    o.start(s); o.stop(s+0.4);
  });
  const n = noise(ac, 0.15), lf = lpf(ac, 800), ng = gn(ac, 0);
  n.connect(lf); lf.connect(ng); ng.connect(ac.destination);
  ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(0.18, t+0.03); ng.gain.exponentialRampToValueAtTime(0.001, t+0.2);
  n.start(t); n.stop(t+0.25);
}

function playPoison(ac: AudioContext) {
  const t = ac.currentTime;
  [600, 480, 380, 290].forEach((freq, i) => {
    const o = osc(ac, "sawtooth", freq), lf = lpf(ac, 1200), og = gn(ac, 0);
    o.connect(lf); lf.connect(og); og.connect(ac.destination);
    const s = t + i*0.055;
    og.gain.setValueAtTime(0.22, s); og.gain.exponentialRampToValueAtTime(0.001, s+0.28);
    o.frequency.exponentialRampToValueAtTime(freq*0.5, s+0.28);
    o.start(s); o.stop(s+0.35);
  });
  const n = noise(ac, 0.06), bf = bpf(ac, 600, 2), ng = gn(ac, 0.5);
  n.connect(bf); bf.connect(ng); ng.connect(ac.destination);
  n.start(t); n.stop(t+0.07);
}

function playCrystal(ac: AudioContext) {
  const t = ac.currentTime;
  const vols = [0.25, 0.15, 0.1, 0.06];
  [1800, 2700, 3600, 5400].forEach((freq, i) => {
    const o = osc(ac, "sine", freq), og = gn(ac, 0);
    o.connect(og); og.connect(ac.destination);
    og.gain.setValueAtTime(vols[i], t); og.gain.exponentialRampToValueAtTime(0.001, t+0.6-i*0.05);
    o.start(t); o.stop(t+0.65);
  });
  const n = noise(ac, 0.03), hf = hpf(ac, 5000), ng = gn(ac, 0.3);
  n.connect(hf); hf.connect(ng); ng.connect(ac.destination);
  n.start(t); n.stop(t+0.04);
}

function playChomp(ac: AudioContext) {
  const t = ac.currentTime;
  function bite(when: number) {
    const n = noise(ac, 0.12), bf = bpf(ac, 2200, 2.5), lf = lpf(ac, 3500), ng = gn(ac, 0);
    n.connect(bf); bf.connect(lf); lf.connect(ng); ng.connect(ac.destination);
    ng.gain.setValueAtTime(0, when); ng.gain.linearRampToValueAtTime(0.6, when+0.012); ng.gain.exponentialRampToValueAtTime(0.001, when+0.12);
    n.start(when); n.stop(when+0.15);
    const o = osc(ac, "sine", 280), og = gn(ac, 0);
    o.connect(og); og.connect(ac.destination);
    og.gain.setValueAtTime(0.2, when); og.gain.exponentialRampToValueAtTime(0.001, when+0.05);
    o.frequency.exponentialRampToValueAtTime(140, when+0.05);
    o.start(when); o.stop(when+0.06);
  }
  bite(t); bite(t+0.14);
}

function playCounterattack(ac: AudioContext) {
  const t = ac.currentTime;
  const o = osc(ac, "sawtooth", 660), lf = lpf(ac, 2000), og = gn(ac, 0);
  o.connect(lf); lf.connect(og); og.connect(ac.destination);
  og.gain.setValueAtTime(0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t+0.35);
  o.frequency.setValueAtTime(660, t); o.frequency.exponentialRampToValueAtTime(180, t+0.3);
  o.start(t); o.stop(t+0.4);
  const sub = osc(ac, "sine", 70), subG = gn(ac, 0);
  sub.connect(subG); subG.connect(ac.destination);
  subG.gain.setValueAtTime(0.7, t+0.05); subG.gain.exponentialRampToValueAtTime(0.001, t+0.5);
  sub.frequency.exponentialRampToValueAtTime(30, t+0.45);
  sub.start(t+0.05); sub.stop(t+0.55);
  const n = noise(ac, 0.1), bf = bpf(ac, 1400, 1.5), ng = gn(ac, 0.45);
  n.connect(bf); bf.connect(ng); ng.connect(ac.destination);
  n.start(t); n.stop(t+0.12);
}

function playPrecisionJab(ac: AudioContext) {
  const t = ac.currentTime;
  // Three-beat bouncy launch: ascending boing boing boing
  [0, 0.12, 0.24].forEach((delay, i) => {
    const freq = 180 + i * 60;
    const o = osc(ac, "sine", freq), og = gn(ac, 0);
    o.connect(og); og.connect(ac.destination);
    og.gain.setValueAtTime(0.35 - i * 0.05, t + delay);
    og.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.09);
    o.frequency.exponentialRampToValueAtTime(freq * 2.8, t + delay + 0.09);
    o.start(t + delay); o.stop(t + delay + 0.12);
    // Spring snap noise per bounce
    const n = noise(ac, 0.05), hf = hpf(ac, 2000), ng = gn(ac, 0.2 - i * 0.04);
    n.connect(hf); hf.connect(ng); ng.connect(ac.destination);
    n.start(t + delay); n.stop(t + delay + 0.05);
  });
  // Impact: wet crunch through chitin
  const impact = t + 0.42;
  const sub = osc(ac, "sine", 90), subG = gn(ac, 0);
  sub.connect(subG); subG.connect(ac.destination);
  subG.gain.setValueAtTime(0.9, impact); subG.gain.exponentialRampToValueAtTime(0.001, impact + 0.3);
  sub.frequency.exponentialRampToValueAtTime(30, impact + 0.28);
  sub.start(impact); sub.stop(impact + 0.35);
  const n2 = noise(ac, 0.08), bf2 = bpf(ac, 2800, 3), ng2 = gn(ac, 0.7);
  n2.connect(bf2); bf2.connect(ng2); ng2.connect(ac.destination);
  n2.start(impact); n2.stop(impact + 0.1);
  const crack = noise(ac, 0.03), hf2 = hpf(ac, 5000), cg = gn(ac, 0.5);
  crack.connect(hf2); hf2.connect(cg); cg.connect(ac.destination);
  crack.start(impact); crack.stop(impact + 0.04);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function playCombatSound(effect: string): void {
  if (effect === "pierce") { playSfx("sfx_harvest_drill"); return; }
  if (effect === "scoop")  { playSfx("sfx_harvest_scoop"); return; }
  const ac = getCtx();
  switch (effect) {
    case "impact_light":  playImpactLight(ac);  break;
    case "impact_heavy":  playImpactHeavy(ac);  break;
    case "stomp":         playStomp(ac);         break;
    case "scrape":        playScrape(ac);        break;
    case "lace":          playLace(ac);          break;
    case "poison":        playPoison(ac);        break;
    case "crystal":       playCrystal(ac);       break;
    case "chomp":         playChomp(ac);         break;
    case "counterattack": playCounterattack(ac); break;
    case "precision_jab": playPrecisionJab(ac);  break;
  }
}
