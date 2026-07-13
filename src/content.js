// content.js — all narrative copy lives here, separated from the engine.
// Edit these to change the story without touching the animation code.

// The post-mortem is written FOR the player, one line per node they revive.
// Order matters: the log reconstructs the incident from symptom → cause.
// Keep each line short (one breath). `at` is the fake timestamp it prints.
export const POSTMORTEM = [
  { at: '03:47:02', line: 'edge-cache-04 stops answering. No alarm yet.' },
  { at: '03:47:19', line: 'Retries pile up. Every service politely waits its turn.' },
  { at: '03:47:44', line: 'The queue fills. The queue is not supposed to fill.' },
  { at: '03:48:10', line: 'auth-gateway trips its breaker. Now nobody can log in.' },
  { at: '03:48:31', line: 'Dashboards go dark — the dashboards ran on auth too.' },
  { at: '03:49:05', line: 'Pager fires. You wake. The grid is already half gone.' },
  { at: '03:51:12', line: 'You reroute traffic by hand, node by node.' },
  { at: '03:54:40', line: 'Signal returns to the core. It remembers how to breathe.' },
];

// Revealed only when the player reaches patient-zero (the last critical node).
// This is the human ending — the twist a good post-mortem always finds.
export const ROOT_CAUSE = {
  headline: 'A feature flag, flipped at 03:46.',
  lede:
    'Not a crash. Not an attack. One config value, changed by someone who had ' +
    'already closed their laptop and gone home. The grid did exactly what it ' +
    'was told. Incidents are rarely about machines.',
};

// Shown when the player clicks "What this demonstrates".
export const ABOUT = [
  'Canvas2D topology engine · requestAnimationFrame with delta-time',
  'Pointer as a physical force-field · spring-eased node recovery',
  'GSAP-timed narrative acts · single-saturated-accent discipline',
  'Fully keyboard-playable · aria-live log · reduced-motion auto-restore',
];
