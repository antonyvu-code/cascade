# CASCADE — A Playable Incident

> *You are the on-call engineer. At 03:47 a single service fails. It cascades.
> Your cursor is the last signal alive — restore the grid before the story ends.*

A concept study in **single-saturated-accent** design (the current Awwwards
direction, e.g. Vectr) pushed into something you *play*. One saturated signal
colour (`#3df5c4`) on near-black (`#05080a`) — exactly two colours, no more.
The whole site is one dead datacenter rendered on a Canvas2D topology engine.

## The story, in four acts

1. **CALM** — the grid breathes in sync. All systems nominal. You take the shift.
2. **CASCADE (03:47)** — one node dies; failure radiates edge-by-edge until the
   grid goes dark. Only your cursor still carries signal.
3. **RESTORE (play)** — move the signal across dead nodes to revive them. Each
   reboot writes the next line of the post-mortem — you reconstruct *what happened*
   by playing.
4. **ROOT CAUSE** — reach patient-zero and the human ending reveals itself.
   (It's rarely about the machines.)

## What it demonstrates (portfolio intent)

- **Canvas2D topology engine** — 46-node graph, nearest-neighbour wiring, BFS
  critical path, `requestAnimationFrame` with delta-time (frame-rate independent).
- **Pointer as a physical force-field** — spring-eased node recovery, a proximity
  "signal field", state-machine reboot detection (dead→alive transitions only).
- **GSAP-timed narrative acts** and a live, `aria-live` post-mortem log.
- **Accessibility as a feature** — fully keyboard-playable (Tab cycles the
  critical path, Enter reboots), skip link, WCAG-minded contrast, and a
  `prefers-reduced-motion` path that auto-restores the grid (no play required).

## Run

```bash
npm install
npm run dev      # http://localhost:5621
npm run build
```

## Structure

```
index.html        # markup + the four act sections
src/main.js       # act orchestration, HUD, log, meter, keyboard play
src/topology.js   # the Canvas2D grid engine (nodes, edges, cascade, restore)
src/content.js    # all narrative copy — edit the story here
src/style.css     # two-colour system, HUD, responsive, a11y
```

Codename **SEV1**. Built by a front-end engineer who reads the logs.
