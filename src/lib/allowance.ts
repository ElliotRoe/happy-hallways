import { startOfWeek } from './stats';
import type { CountedPass, Destination, Pass, PassAllowance, Student } from './types';

/**
 * The Pass Allowance: how many passes each student may take per day, per week,
 * or since the teacher last pressed Reset. Each class counts on its own, since a
 * child in two classes is two students (docs/adr/0002).
 */

export function defaultAllowance(): PassAllowance {
  return { enabled: false, passes: 3, per: 'week', whenUsedUp: 'stop', since: new Date().toISOString() };
}

/** When the current stretch of time began: midnight, Monday morning, or the last Reset. */
export function windowStart(allowance: PassAllowance, at = new Date()) {
  if (allowance.per === 'reset') return new Date(allowance.since);
  if (allowance.per === 'week') return startOfWeek(at);
  const midnight = new Date(at);
  midnight.setHours(0, 0, 0, 0);
  return midnight;
}

/** "today", "this week", or nothing when the teacher resets it by hand. */
export function windowName(allowance: PassAllowance) {
  if (allowance.per === 'day') return 'today';
  if (allowance.per === 'week') return 'this week';
  return '';
}

/** Whether the Pass Allowance passes a student by: an Exempt Student, or an Always-Go Student. */
export function skipsAllowance(student: Pick<Student, 'exempt' | 'alwaysGo'>) {
  return !!student.exempt || !!student.alwaysGo;
}

export function destinationCounts(destination: Destination | undefined) {
  return destination?.countsTowardAllowance !== false;
}

/** A pass uses up the allowance unless it was cancelled at the door or went somewhere that doesn't count. */
export function passCounts(pass: Pass) {
  return pass.counts !== false && pass.endedBy !== 'cancelled';
}

/**
 * How many passes one student has used in the current window. The kiosk counts
 * both the laptop's list and its own passes, so the same pass may appear twice;
 * each is counted once, and a full copy that no longer counts (say, one just
 * cancelled at the door) wins over the laptop's older word for it.
 */
export function usedBy(
  allowance: PassAllowance,
  studentId: string,
  passes: (Pass | CountedPass)[],
  at = new Date(),
) {
  const since = windowStart(allowance, at).toISOString();
  // Counted across every class the student has with this teacher. See docs/adr/0015.
  const mine = passes.filter((pass) => pass.studentId === studentId && pass.outAt >= since);
  const notCounting = new Set(mine.filter((pass) => 'updatedAt' in pass && !passCounts(pass)).map((pass) => pass.id));
  return new Set(mine.map((pass) => pass.id).filter((id) => !notCounting.has(id))).size;
}

/** "2 passes left this week" */
export function passesLeftText(allowance: PassAllowance, left: number) {
  const window = windowName(allowance);
  return `${left} ${left === 1 ? 'pass' : 'passes'} left${window ? ` ${window}` : ''}`;
}

/** "You've used all your passes this week." */
export function usedUpText(allowance: PassAllowance) {
  const window = windowName(allowance);
  return `You've used all your passes${window ? ` ${window}` : ''}.`;
}
