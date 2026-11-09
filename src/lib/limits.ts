import type { Destination, LimitMode } from './types';

/**
 * The Pass Limit works one of two ways, as the teacher chooses in Pass Options
 * (see docs/adr/0010):
 * - each destination has its own limit, and its own Line, or none at all;
 * - one Class Limit is shared by every destination that counts toward it, with
 *   one Line, the Class Line. Destinations that don't count are never held up.
 */

/** What decides who is held back: the Account on the laptop, or the DoorSetup at the kiosk. */
type LimitRules = { destinations: Destination[]; limitMode?: LimitMode; classLimit?: number };

/** The Class Line's name, where a destination's own line would have the destination's. */
export const classLine = '(class)';

export function countsTowardClassLimit(destination: Destination) {
  // A Private destination is never limited (docs/adr/0021).
  return !destination.private && destination.countsTowardClassLimit !== false;
}

/**
 * The Line a trip to this destination waits in, and the Pass Limit it waits
 * for, or null when nothing limits the trip (and so it has no line).
 */
export function limitFor(rules: LimitRules, destination: string): { line: string; limit: number } | null {
  const place = rules.destinations.find((each) => each.label === destination);
  // A Private destination never has a limit or a Line: a line would show the room who's going there.
  if (!place || place.private) return null;
  if (rules.limitMode === 'class') {
    return countsTowardClassLimit(place) ? { line: classLine, limit: rules.classLimit ?? 1 } : null;
  }
  return place.limit === null ? null : { line: place.label, limit: place.limit };
}

/** Which Line a trip to this destination waits in, or null for none. */
export function lineOf(rules: LimitRules, destination: string) {
  return limitFor(rules, destination)?.line ?? null;
}

/** "1 at a time" or "No limit"; or, under a Class Limit, whether the destination counts toward it. */
export function limitText(rules: LimitRules, destination: Destination) {
  if (destination.private) return 'Private, no limit';
  if (rules.limitMode === 'class') return countsTowardClassLimit(destination) ? 'Counts toward class limit' : 'Not limited';
  return destination.limit === null ? 'No limit' : `${destination.limit} at a time`;
}

/** "1 student out at a time". */
export function classLimitText(limit: number) {
  return `${limit} ${limit === 1 ? 'student' : 'students'} out at a time`;
}
