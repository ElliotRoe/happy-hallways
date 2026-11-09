/**
 * Short tones made in the browser, so there are no sound files to load: a
 * rising two-note "your turn" for the kiosk, and a soft falling chime for the
 * teacher when a pass becomes Overdue. Browsers only play sound after someone
 * has tapped or clicked the page, which the kiosk and the teacher's pages
 * both have by the time a sound matters.
 */
let context: AudioContext | null = null;

function play(notes: { frequency: number; at: number; length: number }[]) {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') context.resume();
    const start = context.currentTime;
    for (const note of notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = note.frequency;
      gain.gain.setValueAtTime(0.0001, start + note.at);
      gain.gain.exponentialRampToValueAtTime(0.25, start + note.at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.at + note.length);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start + note.at);
      oscillator.stop(start + note.at + note.length + 0.05);
    }
  } catch {
    // No sound available: nothing else depends on it.
  }
}

/** The kiosk's "your turn": a student in line may go now. */
export function yourTurnSound() {
  play([
    { frequency: 660, at: 0, length: 0.18 },
    { frequency: 880, at: 0.16, length: 0.3 },
  ]);
}

/** The teacher's chime when a pass becomes Overdue. Only if they turned it on. */
export function overdueChime() {
  play([
    { frequency: 784, at: 0, length: 0.35 },
    { frequency: 587, at: 0.22, length: 0.5 },
  ]);
}
