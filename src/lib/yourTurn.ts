import type { OwnView } from './types';

/**
 * A student's own device says "It's your turn" once each time they become Up
 * Next: a sound and a buzz, and the tab title flashes while they are. Only for
 * the student on their own set-up device, never about anyone else (docs/adr/0018).
 */

/** Whether the student this device acts for is Up Next and can go. */
export function isUpNext(me: OwnView | null) {
  return !!(me?.canAct && me.line?.upNext && !me.out);
}

/**
 * Whether to alert now, and what to remember. A moment without word from the
 * teacher's computer (`me` is null, say while reconnecting) changes nothing,
 * so a reconnect never alerts twice for the same turn.
 */
export function nextAlert(alerted: boolean, me: OwnView | null): { alert: boolean; alerted: boolean } {
  if (!me) return { alert: false, alerted };
  if (isUpNext(me)) return { alert: !alerted, alerted: true };
  return { alert: false, alerted: false };
}

/** The tab title: while Up Next, every other second it says so, for a student working in another tab. */
export function turnTitle(title: string, upNext: boolean, tick: number) {
  return upNext && tick % 2 === 0 ? 'Your turn! · Happy Hallways' : title;
}
