// topology.js — the Canvas2D grid engine.
// A field of nodes wired to their nearest neighbours. Nodes have "charge":
// 1 = alive (accent), 0 = dead (near-black). The pointer is a moving signal
// source; being near it charges a node until it reboots.

const ACCENT = { r: 61, g: 245, b: 196 }; // #3DF5C4 — the one saturated colour

// Small deterministic PRNG so the layout is identical every run.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Topology {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.nodes = [];
    this.edges = [];
    this.pointer = { x: -1e4, y: -1e4, active: false };
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.mode = 'calm'; // calm | dead | restore | done
    this.onReboot = null; // callback(nodeIndex) when a node crosses alive
    this.time = 0;
    this._build();
    this._bind();
    this.resize();
  }

  _build() {
    const rand = mulberry32(20260713);
    const COUNT = 46;
    // Poisson-ish scatter in normalised [0,1] space; relaxed by rejection.
    const pts = [];
    let guard = 0;
    while (pts.length < COUNT && guard++ < 6000) {
      const p = { x: 0.08 + rand() * 0.84, y: 0.12 + rand() * 0.76 };
      if (pts.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 0.085)) pts.push(p);
    }
    this.nodes = pts.map((p, i) => ({
      i,
      nx: p.x, ny: p.y, // normalised home
      x: 0, y: 0, // pixel position (set in resize)
      charge: 1, // 1 alive, 0 dead
      target: 1,
      vel: 0,
      pulse: rand() * Math.PI * 2,
      critical: false,
      alive: true, // state machine: true→false when it dies, false→true fires onReboot
    }));

    // Wire each node to its 2–3 nearest neighbours.
    const key = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);
    const seen = new Set();
    this.nodes.forEach((n) => {
      const near = this.nodes
        .filter((m) => m !== n)
        .sort(
          (a, b) =>
            Math.hypot(a.nx - n.nx, a.ny - n.ny) -
            Math.hypot(b.nx - n.nx, b.ny - n.ny)
        )
        .slice(0, 3);
      near.forEach((m) => {
        const k = key(n.i, m.i);
        if (!seen.has(k)) {
          seen.add(k);
          this.edges.push({ a: n.i, b: m.i });
        }
      });
    });

    // The critical path = patient-zero → core. Mark a chain of nodes the
    // player must revive to finish. Pick the node nearest centre as "core"
    // and the one furthest as "patient-zero", then a greedy path between.
    const cx = 0.5, cy = 0.5;
    const core = [...this.nodes].sort(
      (a, b) => Math.hypot(a.nx - cx, a.ny - cy) - Math.hypot(b.nx - cx, b.ny - cy)
    )[0];
    const zero = [...this.nodes].sort(
      (a, b) => Math.hypot(b.nx - cx, b.ny - cy) - Math.hypot(a.nx - cx, a.ny - cy)
    )[0];
    this.criticalPath = this._path(zero.i, core.i);
    this.criticalPath.forEach((i) => (this.nodes[i].critical = true));
    this.patientZero = zero.i;
  }

  // BFS shortest path over the edge graph.
  _path(from, to) {
    const adj = new Map();
    this.edges.forEach(({ a, b }) => {
      (adj.get(a) || adj.set(a, []).get(a)).push(b);
      (adj.get(b) || adj.set(b, []).get(b)).push(a);
    });
    const prev = new Map([[from, -1]]);
    const q = [from];
    while (q.length) {
      const cur = q.shift();
      if (cur === to) break;
      (adj.get(cur) || []).forEach((nb) => {
        if (!prev.has(nb)) {
          prev.set(nb, cur);
          q.push(nb);
        }
      });
    }
    const path = [];
    let c = to;
    while (c !== undefined && c !== -1) {
      path.unshift(c);
      c = prev.get(c);
    }
    return path;
  }

  _bind() {
    const move = (x, y) => {
      const r = this.canvas.getBoundingClientRect();
      this.pointer.x = x - r.left;
      this.pointer.y = y - r.top;
      this.pointer.active = true;
    };
    window.addEventListener('pointermove', (e) => move(e.clientX, e.clientY), {
      passive: true,
    });
    window.addEventListener('pointerdown', (e) => {
      move(e.clientX, e.clientY);
      this.rebootNearest();
    });
    window.addEventListener('pointerleave', () => (this.pointer.active = false));
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.W = w;
    this.H = h;
    this.nodes.forEach((n) => {
      n.x = n.nx * w;
      n.y = n.ny * h;
    });
  }

  // Kill the grid in a cascade radiating from patient-zero.
  cascade() {
    this.mode = 'dead';
    const zero = this.nodes[this.patientZero];
    this.nodes.forEach((n) => {
      const d = Math.hypot(n.x - zero.x, n.y - zero.y);
      const delay = this.reducedMotion ? 0 : d * 1.1; // ms, spreads outward
      setTimeout(() => {
        n.target = 0;
      }, delay);
    });
    this.mode = 'restore';
  }

  // Find the dead node closest to the pointer and give it a strong shove.
  rebootNearest() {
    if (this.mode !== 'restore') return;
    let best = null;
    let bestD = 120; // px reach
    this.nodes.forEach((n) => {
      if (n.charge > 0.6) return;
      const d = Math.hypot(n.x - this.pointer.x, n.y - this.pointer.y);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    });
    if (best) best.target = 1;
  }

  // Keyboard access: focus/charge a specific node index.
  chargeNode(index) {
    const n = this.nodes[index];
    if (n) n.target = 1;
  }

  restoredRatio() {
    const alive = this.nodes.filter((n) => n.charge > 0.6).length;
    return alive / this.nodes.length;
  }

  update(dt) {
    this.time += dt;
    const p = this.pointer;
    for (const n of this.nodes) {
      // Pointer proximity charges dead nodes automatically (the "signal field").
      if (this.mode === 'restore' && n.target < 1 && p.active) {
        const d = Math.hypot(n.x - p.x, n.y - p.y);
        if (d < 90) n.target = Math.max(n.target, 1 - d / 90);
      }
      // Spring toward target charge.
      const stiff = this.reducedMotion ? 20 : 9;
      n.vel += (n.target - n.charge) * stiff * dt;
      n.vel *= 0.82;
      n.charge += n.vel * dt * 6;
      n.charge = Math.max(0, Math.min(1, n.charge));
      // State machine: mark dead once it drops, fire onReboot only on the
      // dead→alive transition (so the cascade itself doesn't count as reboots).
      if (n.alive && n.charge < 0.4) n.alive = false;
      if (!n.alive && n.charge > 0.85) {
        n.alive = true;
        this.onReboot && this.onReboot(n);
      }
      n.pulse += dt * (this.mode === 'calm' ? 1.4 : 2.2);
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    const A = ACCENT;

    // Edges — brightness = min charge of endpoints.
    ctx.lineWidth = 1;
    for (const e of this.edges) {
      const a = this.nodes[e.a];
      const b = this.nodes[e.b];
      const lit = Math.min(a.charge, b.charge);
      if (lit < 0.04) continue;
      ctx.strokeStyle = `rgba(${A.r},${A.g},${A.b},${lit * 0.32})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Nodes.
    for (const n of this.nodes) {
      const breathe = 1 + Math.sin(n.pulse) * 0.14 * n.charge;
      const base = n.critical ? 3.6 : 2.6;
      const r = base * breathe;
      // Dead-node ghost so the player can see where to aim.
      if (n.charge < 0.3) {
        ctx.fillStyle = 'rgba(120,140,150,0.16)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, base, 0, Math.PI * 2);
        ctx.fill();
      }
      if (n.charge > 0.04) {
        const glow = n.charge * (n.critical ? 26 : 16);
        ctx.shadowColor = `rgba(${A.r},${A.g},${A.b},${n.charge})`;
        ctx.shadowBlur = glow;
        ctx.fillStyle = `rgba(${A.r},${A.g},${A.b},${0.35 + n.charge * 0.65})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // The signal the player carries.
    if (this.pointer.active && (this.mode === 'restore' || this.mode === 'calm')) {
      const grad = ctx.createRadialGradient(
        this.pointer.x, this.pointer.y, 0,
        this.pointer.x, this.pointer.y, 90
      );
      grad.addColorStop(0, `rgba(${A.r},${A.g},${A.b},0.20)`);
      grad.addColorStop(1, `rgba(${A.r},${A.g},${A.b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.pointer.x, this.pointer.y, 90, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
