/**
 * Student PINs: a few digits a student types at the kiosk after tapping their
 * name, so classmates can't take a pass as each other. Not the teacher's PIN,
 * and never a real school ID number. See docs/adr/0013.
 */

/** 3 to 6 digits: short enough for a child to remember, long enough to guess wrong. */
export const pinShape = /^\d{3,6}$/;

/**
 * A fresh 4-digit PIN no one else in `taken` has. It never starts with 0, so
 * a spreadsheet opening the roster can't quietly drop a digit.
 */
export function randomPin(taken: Set<string>) {
  for (;;) {
    const pin = String(1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000));
    if (!taken.has(pin)) return pin;
  }
}

/**
 * Why a PIN can't be used, or '' when it can. `others` are the PINs of the
 * rest of the Roster. A student must never be able to unlock the teacher's
 * kiosk menu with their own PIN, so it can't match the teacher's.
 */
export function pinProblem(pin: string, others: (string | undefined)[], teacherPin: string) {
  if (!pinShape.test(pin)) return 'A PIN is 3 to 6 digits.';
  if (teacherPin && pin === teacherPin) return 'That is your teacher PIN. Choose a different one.';
  if (others.includes(pin)) return 'Another student on your Roster has that PIN.';
  return '';
}
