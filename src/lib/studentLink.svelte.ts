import type { DataConnection, Peer } from 'peerjs';
import {
  account,
  addClaim,
  classStudents,
  endClaim,
  findClaim,
  findClass,
  noPassNow,
  onReload,
  onSave,
  openPasses,
  passStatus,
} from './account.svelte';
import {
  activeDoorClass,
  allowanceFor,
  lineSpotFor,
  openPassFor,
  perform,
  requestFor,
  upNext as upNextAtDoor,
  whenPassesOpen,
} from './door.svelte';
import { createPeer, keepAlive, studentLinkPrefix } from './peer';
import { displayName } from './roster';
import type { LinkAction, OwnView, StudentLinkMessage, StudentMessage, StudentView } from './types';

/**
 * The Student link, on the teacher's computer. Students open the link on
 * their own Chromebook or phone, and their browser connects straight to this
 * one (PeerJS over WebRTC, relayed through Cloudflare's TURN servers when a
 * network blocks direct connections; see peer.ts), the same way the kiosk
 * does. This computer sends them what the door screen shows about the class
 * on the kiosk, and sends it again whenever it changes. Nothing is stored
 * anywhere else. See docs/adr/0012.
 *
 * A student who Claims their device (their name and PIN, once) can also act
 * from it: this computer decides, exactly as for the kiosk. See docs/adr/0016.
 */

/** Each student's browser holds its own connection to this computer, so there is a limit. Claimed devices are never turned away. */
export const maxViewers = 60;
/** Wrong PINs one device may try in a row before it has to wait a minute. */
const maxPinTries = 5;
const viewersKey = 'hallway.student-link-viewers';

export const studentLink = $state({
  /**
   * off: there is no link yet. connecting: finding the matchmaking server.
   * live: this tab answers the link. taken: another tab of Happy Hallways on
   * this computer answers it.
   */
  status: 'off' as 'off' | 'connecting' | 'live' | 'taken',
  /** How many students are watching right now. */
  viewers: 0,
});

export function studentLinkUrl() {
  return account.studentLink ? `${location.origin}/student/${account.studentLink.id}` : '';
}

let peer: Peer | null = null;
/** The address this tab answers the link on, or is trying to. */
let claimed: string | null = null;
let retryTimer = 0;
let clockTimer = 0;
const viewers = new Set<DataConnection>();
/** The Claim each claimed device holds, by its connection. */
const tokens = new Map<DataConnection, string>();
/** Wrong PINs tried by each device, and when it may try again. */
const pinTries = new Map<DataConnection, { wrong: number; until: number }>();
/** What viewers were last sent, so a save that changes nothing they see sends nothing. */
let lastSent = '';
const lastOwn = new Map<DataConnection, string>();

function send(connection: DataConnection, message: StudentLinkMessage) {
  if (connection.open) connection.send(message);
}

/** Tells a student why they can't watch, then hangs up once the message has had time to arrive. */
function turnAway(connection: DataConnection, message: StudentLinkMessage) {
  send(connection, message);
  setTimeout(() => connection.close(), 1000);
}

/** Turns away everyone watching, saying why. */
function turnAwayAll(message: StudentLinkMessage) {
  for (const viewer of viewers) turnAway(viewer, message);
  viewers.clear();
  tokens.clear();
  countViewers();
}

/** Other tabs show the count too, though only one tab answers the link. */
function countViewers() {
  studentLink.viewers = viewers.size;
  try {
    localStorage.setItem(viewersKey, String(viewers.size));
  } catch {
    // Storage blocked: other tabs just won't see the count.
  }
}

/**
 * Starts, stops or moves the link to match what the teacher chose. Call it
 * after anything about the link changes; it leaves things alone otherwise.
 * While the link is closed, this computer still answers it, only to say so.
 */
export async function serveStudentLink() {
  const address = account.studentLink ? studentLinkPrefix + account.studentLink.id : null;
  if (address === claimed) {
    if (!account.studentLink?.open) turnAwayAll({ type: 'closed' });
    pushView();
    return;
  }
  // A new link, or none: whoever watched the old one is told it stopped working.
  turnAwayAll({ type: 'old-link' });
  const previous = peer;
  setTimeout(() => previous?.destroy(), 1000);
  peer = null;
  clearTimeout(retryTimer);
  clearInterval(clockTimer);
  claimed = address;
  if (!address) {
    studentLink.status = 'off';
    return;
  }
  studentLink.status = 'connecting';
  const created = await createPeer(address);
  if (claimed !== address) {
    created.destroy();
    return;
  }
  peer = created;
  created.on('open', () => (studentLink.status = 'live'));
  created.on('disconnected', () => (studentLink.status = 'connecting'));
  created.on('connection', welcome);
  created.on('error', (error) => {
    // Another tab answers the link already. It may also be a reloaded page's
    // old connection, which the server frees shortly, so look again later.
    if (error.type !== 'unavailable-id' || peer !== created) return;
    created.destroy();
    peer = null;
    studentLink.status = 'taken';
    studentLink.viewers = Number(localStorage.getItem(viewersKey)) || 0;
    retryTimer = window.setTimeout(() => {
      claimed = null;
      serveStudentLink();
    }, 30_000);
  });
  // No-Pass Times start and end by the clock, without anything being saved.
  clockTimer = window.setInterval(pushView, 15_000);
}

function welcome(connection: DataConnection) {
  const token = (connection.metadata as { token?: string } | undefined)?.token;
  connection.on('open', () => {
    if (!account.studentLink?.open) return turnAway(connection, { type: 'closed' });
    const claimed = !!findClaim(token);
    if (viewers.size >= maxViewers) {
      if (!claimed) return turnAway(connection, { type: 'full' });
      // A claimed device takes the place of the newest device that only looks.
      const looking = [...viewers].reverse().find((viewer) => !tokens.has(viewer));
      if (looking) {
        viewers.delete(looking);
        turnAway(looking, { type: 'full' });
      }
    }
    viewers.add(connection);
    if (claimed) tokens.set(connection, token!);
    else if (token) send(connection, { type: 'claim-ended' });
    countViewers();
    keepAlive(connection);
    send(connection, { type: 'view', view: studentView() });
    sendOwn(connection, true);
  });
  connection.on('data', (data) => hear(connection, data as StudentMessage));
  connection.on('close', () => {
    tokens.delete(connection);
    pinTries.delete(connection);
    lastOwn.delete(connection);
    if (viewers.delete(connection)) countViewers();
  });
}

/** What a student's device asked for. Only a claimed device may act, and only as its own student. */
function hear(connection: DataConnection, message: StudentMessage) {
  if (!viewers.has(connection)) return;
  if (message.type === 'claim') claim(connection, message.firstName, message.pin);
  if (message.type === 'end-claim') {
    if (findClaim(message.token)) endClaim(message.token);
    tokens.delete(connection);
    send(connection, { type: 'claim-ended' });
  }
  if (message.type === 'act') {
    const held = findClaim(message.token);
    if (!held) {
      tokens.delete(connection);
      return send(connection, { type: 'claim-ended' });
    }
    if (!allowed(held.studentId, message.action)) return;
    perform(message.action, (notice, seconds) => send(connection, { type: 'notice', notice, seconds }), 'link');
  }
}

/**
 * Only the five things a student does at the kiosk, only as themselves, only
 * while PINs are on and their class is on the door. A teacher-PIN approval
 * never comes from a student's device.
 */
function allowed(studentId: string, action: LinkAction) {
  if (!account.studentPins || !activeDoorClass()?.students.some((student) => student.id === studentId)) return false;
  if (action.kind === 'undo') return account.passes.some((pass) => pass.id === action.passId && pass.studentId === studentId);
  if (action.kind === 'pass' && action.approvedBy) return false;
  return ['pass', 'back', 'join', 'leave', 'ask', 'cancel-request'].includes(action.kind) && action.studentId === studentId;
}

/**
 * A student types their first name and PIN once; the device then acts as them
 * until the Claim ends. The name list never leaves this computer: someone
 * guessing needs both a classmate's first name and their PIN. See docs/adr/0018.
 */
function claim(connection: DataConnection, firstName: string, pin: string) {
  const tries = pinTries.get(connection) ?? { wrong: 0, until: 0 };
  if (Date.now() < tries.until) {
    return send(connection, { type: 'claim-refused', message: 'Too many tries. Wait a minute, then try again.' });
  }
  if (!account.studentPins) {
    return send(connection, { type: 'claim-refused', message: "Your teacher hasn't turned on PINs yet." });
  }
  const typed = firstName.trim().toLowerCase();
  const student = classStudents(findClass(account.activeClass?.id)).find(
    (each) => each.status === 'current' && !!each.pin && each.pin === pin && each.firstName.toLowerCase() === typed,
  );
  if (!student) {
    const wrong = tries.wrong + 1;
    pinTries.set(connection, wrong >= maxPinTries ? { wrong: 0, until: Date.now() + 60_000 } : { wrong, until: 0 });
    return send(connection, {
      type: 'claim-refused',
      message: "That name and PIN don't match anyone in the class on now. Check both and try again.",
    });
  }
  pinTries.delete(connection);
  const token = addClaim(student.id);
  tokens.set(connection, token);
  send(connection, { type: 'claimed', token, name: displayName(student) });
  sendOwn(connection, true);
}

/**
 * A claimed device's own student, as only they see it. How long their own
 * pass has run is fine here: it's their screen, not the room's (ADR 0003).
 */
function ownView(studentId: string): OwnView {
  const onDoor = activeDoorClass()?.students.find((student) => student.id === studentId);
  const anyClass = account.classes.map((cls) => classStudents(cls).find((each) => each.id === studentId)).find(Boolean);
  const view: OwnView = {
    studentId,
    name: onDoor?.name ?? (anyClass ? displayName(anyClass) : 'You'),
    canAct: !!onDoor && !!account.studentPins,
  };
  const pass = openPassFor(studentId);
  if (pass) {
    view.out = {
      destination: pass.destination,
      secondsOut: Math.max(0, Math.round((Date.now() - new Date(pass.outAt).getTime()) / 1000)),
      minutes: pass.minutes,
    };
  }
  if (!onDoor) return view;
  const left = allowanceFor(studentId);
  if (left) view.passesLeft = left.text;
  const spot = lineSpotFor(studentId);
  if (spot) {
    view.line = {
      destination: spot.destination,
      position: spot.position,
      upNext: upNextAtDoor().some((each) => each.studentId === studentId),
    };
  }
  const request = requestFor(studentId);
  if (request) view.request = { destination: request.destination };
  return view;
}

/** Sends a claimed device its own student's view, if it changed (or `always`), and tells a device whose Claim ended. */
function sendOwn(connection: DataConnection, always = false) {
  const token = tokens.get(connection);
  if (!token) return;
  const held = findClaim(token);
  if (!held) {
    tokens.delete(connection);
    lastOwn.delete(connection);
    return send(connection, { type: 'claim-ended' });
  }
  const view = ownView(held.studentId);
  // The seconds tick on their own on the device; only a change in what's shown is worth sending.
  const json = JSON.stringify({ ...view, out: view.out && { ...view.out, secondsOut: 0 } });
  if (!always && json === lastOwn.get(connection)) return;
  lastOwn.set(connection, json);
  send(connection, { type: 'me', me: view });
}

/** Sends viewers the latest, if anything they see has changed. */
let pushTimer = 0;
function pushView() {
  clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    if (!viewers.size) {
      lastSent = '';
      return;
    }
    for (const viewer of viewers) sendOwn(viewer);
    const view = studentView();
    const json = JSON.stringify(view);
    if (json === lastSent) return;
    lastSent = json;
    for (const viewer of viewers) send(viewer, { type: 'view', view });
  }, 150);
}

onSave(serveStudentLink);
onReload(serveStudentLink);

if (typeof window !== 'undefined') {
  // Another tab answers the link, and tells this one how many are watching.
  window.addEventListener('storage', (event) => {
    if (event.key === viewersKey && studentLink.status === 'taken') studentLink.viewers = Number(event.newValue) || 0;
  });
  // Closing this tab ends every viewer's connection.
  window.addEventListener('pagehide', () => {
    if (studentLink.status === 'live') localStorage.setItem(viewersKey, '0');
  });
}

/**
 * What every device on the link sees: the class on the door, whether passes
 * are open, and how many are out and waiting, in numbers. Never a name, never
 * how long anyone has been out, and nothing about how a student's passes are
 * treated. See docs/adr/0018.
 */
export function studentView(at = Date.now()): StudentView {
  const classId = account.activeClass?.id ?? null;
  const status = passStatus(at);
  const noPass = classId ? noPassNow(classId, at) : null;
  const out = classId ? openPasses(classId) : [];
  const waiting = account.line.filter((spot) => spot.classId === classId);
  const lines =
    account.limitMode === 'class'
      ? [{ destination: null as string | null, waiting: waiting.length }]
      : account.destinations.map((each) => ({
          destination: each.label as string | null,
          waiting: waiting.filter((spot) => spot.destination === each.label).length,
        }));

  return {
    className: findClass(classId)?.name ?? null,
    status,
    ...(noPass ? { whenPassesOpen: whenPassesOpen(noPass) } : {}),
    out: account.destinations
      .map((each) => ({ destination: each.label, count: out.filter((pass) => pass.destination === each.label).length }))
      .filter((each) => each.count),
    lines: lines.filter((each) => each.waiting),
    destinations: account.destinations.map(({ label, color, icon }) => ({ label, color, icon })),
    claimsOpen: !!account.studentPins,
  };
}
