/**
 * Keeps the teacher's screen from sleeping while the door depends on it. The
 * kiosk and the Student link work only while the teacher's computer is awake
 * (see docs/adr/0014). Browsers drop the lock whenever the tab is hidden, so
 * it is asked for again each time the tab comes back.
 */
let lock: WakeLockSentinel | null = null;
let wanted = false;

async function request() {
  if (!wanted || lock || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => (lock = null));
  } catch {
    // Refused (battery saver, or the browser doesn't allow it): the setup copy still asks teachers to keep it open.
  }
}

if (typeof document !== 'undefined') document.addEventListener('visibilitychange', request);

export function keepAwake(on: boolean) {
  wanted = on;
  if (on) request();
  else {
    lock?.release();
    lock = null;
  }
}
