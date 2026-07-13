import './style.css';
import gsap from 'gsap';
import { Topology } from './topology.js';
import { POSTMORTEM, ROOT_CAUSE, ABOUT } from './content.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#grid');
const topo = new Topology(canvas);

// --- Render loop (delta-time so speed is frame-rate independent) --------------
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  topo.update(dt);
  topo.render();
  updateClock();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// --- Fake incident clock ------------------------------------------------------
const clockEl = $('[data-clock]');
let clockStart = null;
let clockRunning = false;
function updateClock() {
  if (!clockRunning) return;
  const t = 3 * 3600 + 47 * 60 + (performance.now() - clockStart) / 1000;
  const h = String(Math.floor(t / 3600)).padStart(2, '0');
  const m = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
  const s = String(Math.floor(t % 60)).padStart(2, '0');
  clockEl.textContent = `${h}:${m}:${s}`;
}

// --- Post-mortem log ----------------------------------------------------------
const logEl = $('[data-log]');
const logList = $('[data-log-list]');
let logIndex = 0;
function pushLogLine() {
  if (logIndex >= POSTMORTEM.length) return;
  const { at, line } = POSTMORTEM[logIndex++];
  const li = document.createElement('li');
  li.className = 'log__item';
  li.innerHTML = `<time>${at}</time><span>${line}</span>`;
  logList.appendChild(li);
  gsap.from(li, { opacity: 0, x: -12, duration: 0.5, ease: 'power2.out' });
}

// --- Restore meter ------------------------------------------------------------
const meterEl = $('[data-meter]');
const meterFill = $('[data-meter-fill]');
const meterValue = $('[data-meter-value]');
const sevEl = $('[data-sev]');
let finished = false;
function updateMeter() {
  const pct = Math.round(topo.restoredRatio() * 100);
  meterFill.style.transform = `scaleX(${pct / 100})`;
  meterValue.textContent = pct + '%';
  if (pct > 20 && !finished) sevEl.textContent = 'SEV1 · RECOVERING';
  if (!finished && topo.nodes[topo.patientZero].charge > 0.85 && pct > 82) {
    finished = true;
    endIncident();
  }
}

// Reboot event → write the next post-mortem line + advance the meter.
topo.onReboot = () => {
  pushLogLine();
  updateMeter();
};

// --- Act orchestration --------------------------------------------------------
const introAct = $('[data-act="intro"]');
const rootAct = $('[data-act="root"]');
const hud = $('[data-hud]');

function begin() {
  gsap.to(introAct, {
    opacity: 0,
    y: -20,
    duration: 0.6,
    ease: 'power2.in',
    onComplete: () => (introAct.hidden = true),
  });
  clockStart = performance.now();
  clockRunning = true;

  // Beat 1: a breath of calm, then the cascade fires.
  const wait = topo.reducedMotion ? 400 : 1600;
  setTimeout(() => {
    sevEl.textContent = 'SEV1 · CASCADE DETECTED';
    sevEl.classList.add('is-alert');
    document.body.classList.add('is-shaken');
    topo.cascade();
    logEl.hidden = false;
    meterEl.hidden = false;
    gsap.from([logEl, meterEl], { opacity: 0, y: 16, duration: 0.6, stagger: 0.1 });
    buildKeyboardTargets();
    setTimeout(() => document.body.classList.remove('is-shaken'), 700);
    if (topo.reducedMotion) autoRestore();
  }, wait);
}

// Reduced-motion path: revive the whole grid on a gentle timer, no play required.
function autoRestore() {
  const order = [...topo.nodes.keys()].sort(
    (a, b) => Number(topo.nodes[b].critical) - Number(topo.nodes[a].critical)
  );
  order.forEach((idx, k) => setTimeout(() => topo.chargeNode(idx), 300 + k * 140));
}

function endIncident() {
  sevEl.textContent = 'RESOLVED · 03:54';
  sevEl.classList.remove('is-alert');
  topo.mode = 'done';
  $('[data-root-headline]').textContent = ROOT_CAUSE.headline;
  $('[data-root-lede]').textContent = ROOT_CAUSE.lede;
  rootAct.hidden = false;
  gsap.from(rootAct, { opacity: 0, y: 24, duration: 0.9, ease: 'power3.out' });
  gsap.to([meterEl, logEl], { opacity: 0.45, duration: 0.6 });
}

// --- Keyboard play (accessibility = also a feature) ---------------------------
// Tab cycles through dead critical nodes; Enter reboots the focused one.
let kbTargets = [];
let kbIndex = -1;
function buildKeyboardTargets() {
  kbTargets = topo.criticalPath.slice();
}
window.addEventListener('keydown', (e) => {
  if (topo.mode !== 'restore') return;
  if (e.key === 'Tab') {
    e.preventDefault();
    kbIndex = (kbIndex + 1) % kbTargets.length;
    const n = topo.nodes[kbTargets[kbIndex]];
    // Move the visible signal to the focused node so it reads on screen.
    topo.pointer.x = n.x;
    topo.pointer.y = n.y;
    topo.pointer.active = true;
  }
  if (e.key === 'Enter' && kbIndex >= 0) {
    e.preventDefault();
    topo.chargeNode(kbTargets[kbIndex]);
  }
});

// --- Wiring -------------------------------------------------------------------
$('[data-begin]').addEventListener('click', begin);
$('[data-replay]').addEventListener('click', () => location.reload());
$('[data-about]').addEventListener('click', (e) => {
  e.preventDefault();
  const lines = ABOUT.map((l) => `• ${l}`).join('\n');
  alert('CASCADE demonstrates:\n\n' + lines);
});

// Reduced motion: don't make people play. Auto-restore after the cascade.
if (topo.reducedMotion) {
  $('[data-hint]').textContent = 'reduced-motion — the grid restores itself';
}
