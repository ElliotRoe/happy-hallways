import type { DataConnection, Peer } from 'peerjs';
import {
  account,
  answered,
  classStudents,
  doorSetup,
  findClass,
  isAbsent,
  keepToSchedule,
  receivePasses,
  recordArrival,
  setActiveClass,
  setLine,
  setRequests,
} from './account.svelte';
import { destinationCounts, passesLeftText, skipsAllowance, usedBy, usedUpText } from './allowance';
import { connectionReport, watchConnection, type ConnectionWatch } from './diagnostics';
import { limitFor, lineOf } from './limits';
import { dueTime, endUnseen, newId, now } from './passes';
import { createPeer, keepAlive, pairingPrefix } from './peer';
import { displayName } from './roster';
import { formatClock, noPassAt } from './schedule';
import type {
  Block,
  DoorAction,
  DoorNoticeMessage,
  DoorSetup,
  KioskMessage,
  LaptopMessage,
  LineSpot,
  OfflineArrival,
  OfflineReturn,
  Pass,
  PassRequest,
} from './types';

/**
 * The door: the student-facing screen by the classroom door. Only the
 * teacher's computer decides who may leave, the Line and Requests; a paired
 * kiosk shows what the teacher's computer tells it and asks it for everything
 * a student does. While it can't reach the teacher's computer, a kiosk only
 * records students coming back. See docs/adr/0014.
 */

/** What a paired kiosk remembers between reloads. */
type PairedDevice = {
  laptopPeerId: string;
  kioskId: string;
  secret: string;
  /** The latest the teacher's computer has shown it. */
  setup: DoorSetup;
  /** Students who signed back in while it couldn't reach the teacher's computer, not yet handed over. */
  returns: OfflineReturn[];
  /** Students who arrived while it couldn't reach the teacher's computer, not yet handed over (docs/adr/0020). */
  arrivals?: OfflineArrival[];
  /** Passes saved by an older version of the kiosk, handed over once. */
  legacyPasses?: Pass[];
};

export type DoorNotice = DoorNoticeMessage;

/**
 * Where a paired kiosk keeps itself. This version uses its own key, so a tab
 * still on an older version never reads (or overwrites) the new shape; the
 * older key is read once and left as it was until the kiosk is unpaired.
 */
const storageKey = 'hallway.door.v2';
const legacyKey = 'hallway.door';
/** Saved kiosk data that couldn't be read: kept, and never removed or saved over. */
let unreadableDevice = false;

/** Older kiosks kept passes, the Line and Requests themselves; anything not handed over yet is still sent. */
type SavedDevice = PairedDevice & { passes?: Pass[]; outbox?: string[] };

function loadDevice(): PairedDevice | null {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(storageKey) ?? localStorage.getItem(legacyKey);
    if (!saved) return null;
    const device: SavedDevice = JSON.parse(saved);
    device.setup = fromOlderLaptop(device.setup);
    device.returns ??= [];
    if (device.outbox?.length) {
      device.legacyPasses = (device.passes ?? []).filter((pass) => device.outbox!.includes(pass.id));
    }
    delete device.passes;
    delete device.outbox;
    return device;
  } catch {
    if (saved) {
      unreadableDevice = true;
      try {
        // One copy of each different unreadable save, kept for support.
        const kept = Object.keys(localStorage).some((key) => key.startsWith('hallway.door.unreadable.') && localStorage.getItem(key) === saved);
        if (!kept) localStorage.setItem(`hallway.door.unreadable.${Date.now()}`, saved);
      } catch {
        // No room for a copy; the original stays where it was.
      }
    }
    return null;
  }
}

/**
 * A laptop still on the version before per-destination limits (until it
 * refreshes) sends one Pass Limit for every destination. Read it the new way.
 */
function fromOlderLaptop(setup: DoorSetup): DoorSetup {
  setup.passes ??= [];
  for (const destination of setup.destinations) {
    if (destination.limit === undefined) destination.limit = setup.passLimit ?? 1;
  }
  return setup;
}

export const door = $state({
  device: loadDevice(),
  /** Only meaningful on a paired device. */
  status: 'offline' as 'offline' | 'live' | 'replaced',
  pairing: {
    state: 'idle' as 'idle' | 'connecting' | 'error',
    message: '',
    slow: false,
    /** Technical details of a failed attempt, for the teacher to send to support. */
    problem: null as null | { code: string; text: string },
  },
  notice: null as DoorNotice | null,
  /** Students the teacher just said no to, and when, so their name says so for a minute. */
  denied: {} as Record<string, number>,
  /** The teacher's computer is on an older version that can't answer this kiosk, until it reloads. */
  laptopOutdated: false,
  /** What this kiosk saved couldn't be read. A copy is kept; pairing again starts afresh. */
  unreadableSaved: unreadableDevice,
});

/** Whether this kiosk can ask the teacher's computer right now: connected, and on a version that answers. */
export function reachesTeacher() {
  return door.status === 'live' && !door.laptopOutdated;
}

/** True when this browser is the teacher's laptop acting as its own kiosk. */
export function isLocal() {
  return account.kiosk?.kind === 'this-computer';
}

/** True when this browser is a paired kiosk device. Such a browser is never a teacher workspace. */
export function isPairedDevice() {
  return !!door.device;
}

/** Whether this browser is the teacher's computer, which decides everything at the door. */
function inCharge() {
  return !door.device;
}

function saveDevice() {
  if (unreadableDevice) return;
  if (door.device) localStorage.setItem(storageKey, JSON.stringify(door.device));
  else {
    // Unpairing on purpose: the older copy goes too, so it can't come back as a kiosk.
    localStorage.removeItem(storageKey);
    localStorage.removeItem(legacyKey);
  }
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export function setup(): DoorSetup | null {
  if (inCharge()) return doorSetup();
  return door.device?.setup ?? null;
}

function currentActiveClass() {
  return inCharge() ? account.activeClass : door.device?.setup.activeClass;
}

function activeClassId() {
  return currentActiveClass()?.id;
}

/** Whether the door is following the Current Schedule. */
export function onSchedule() {
  return !!currentActiveClass()?.onSchedule && !!setup()?.schedule;
}

export function activeDoorClass() {
  const id = activeClassId();
  return setup()?.classes.find((cls) => cls.id === id) ?? null;
}

function allPasses(): Pass[] {
  if (inCharge()) return account.passes;
  const shown = door.device?.setup.passes ?? [];
  // Passes an older version of this kiosk saved, not handed over yet: a student out on one can still come back.
  const legacy = (door.device?.legacyPasses ?? []).filter((pass) => !shown.some((each) => each.id === pass.id));
  return legacy.length ? [...shown, ...legacy] : shown;
}

function allLines(): LineSpot[] {
  return inCharge() ? account.line : (door.device?.setup.line ?? []);
}

function allRequests(): PassRequest[] {
  return inCharge() ? account.requests : (door.device?.setup.requests ?? []);
}

export function openPassFor(studentId: string) {
  return allPasses().find((pass) => pass.studentId === studentId && !pass.inAt);
}

export function outCount(classId: string) {
  return allPasses().filter((pass) => pass.classId === classId && !pass.inAt).length;
}

export function destinationNamed(label: string) {
  return setup()?.destinations.find((each) => each.label === label);
}

/** Whether the teacher has one Class Limit, rather than a limit on each destination. */
export function hasClassLimit() {
  return setup()?.limitMode === 'class';
}

/** The Line and Pass Limit a trip to this destination waits for, or null when nothing limits it. */
function limitAt(destination: string) {
  const current = setup();
  return current ? limitFor(current, destination) : null;
}

/**
 * How a destination may be named where students can see: its name, or just
 * "Out" for a Private one (docs/adr/0021). The teacher's own screens always use the real name.
 */
export function shownTo(destination: string) {
  return destinationNamed(destination)?.private || !showsWhere() ? null : destination;
}

/** Whether the class on the kiosk shows where students went; off, every pass is "Out" (docs/adr/0022). */
export function showsWhere() {
  return !activeDoorClass()?.hideWhere;
}

/** Whether the class on the kiosk shows who's in each Line; off, only how many (docs/adr/0022). */
export function showsLineNames() {
  return !activeDoorClass()?.hideLineNames;
}

/** Whether a trip there has a Pass Limit, and so a Line. */
export function isLimited(destination: string) {
  return !!limitAt(destination);
}

function lineAt(destination: string) {
  const current = setup();
  return current ? lineOf(current, destination) : null;
}

/**
 * How many students from the class on the door are taking up the spots a
 * trip to this destination needs: those at the destination itself, or, under
 * a Class Limit, those anywhere that counts toward it. An Always-Go Student's
 * trip takes no spot, so it never keeps anyone else waiting.
 */
export function outAt(destination: string) {
  const classId = activeClassId();
  const shared = lineAt(destination);
  return allPasses().filter(
    (pass) =>
      pass.classId === classId &&
      !pass.inAt &&
      !pass.alwaysGo &&
      (pass.destination === destination || (shared !== null && lineAt(pass.destination) === shared)),
  ).length;
}

/** Whether a destination's Pass Limit (or the Class Limit) is reached. One with no limit is never full. */
export function isFull(destination: string) {
  const limited = limitAt(destination);
  return !!limited && outAt(destination) >= limited.limit;
}

/**
 * The Lines for the class on the door, first in line first. Pass a
 * destination to get just the line it waits in: its own, or the Class Line.
 */
export function line(destination?: string): LineSpot[] {
  const classId = activeClassId();
  const which = destination === undefined ? null : lineAt(destination);
  return allLines().filter(
    (spot) =>
      spot.classId === classId &&
      (destination === undefined || spot.destination === destination || (which !== null && lineAt(spot.destination) === which)),
  );
}

/** Where a student is waiting, if anywhere, with their place in that line. */
export function lineSpotFor(studentId: string) {
  const spot = line().find((each) => each.studentId === studentId);
  if (!spot) return null;
  return { ...spot, position: line(spot.destination).indexOf(spot) + 1 };
}

/** The No-Pass Time the class on the door is in right now, if any. */
export function noPassNow(at = Date.now()) {
  const current = setup();
  return noPassAt(
    { schedule: current?.schedule, activeClass: currentActiveClass(), manualNoPass: current?.manualNoPass },
    activeClassId(),
    at,
  );
}

/** "Passes open again at 9:15 AM", or, for one the teacher started, that the teacher will open them. */
export function whenPassesOpen(noPass: { end: string | null }) {
  return noPass.end ? `Passes open at ${formatClock(noPass.end)}.` : 'Your teacher will open passes again.';
}

/**
 * Whether a student may go to a destination without waiting: nothing limits
 * it, or there is a spot free once those ahead of them in its line have theirs.
 */
function hasRoom(studentId: string, destination: string) {
  const limited = limitAt(destination);
  if (!limited) return true;
  const waiting = line(destination);
  const place = waiting.findIndex((spot) => spot.studentId === studentId);
  const ahead = place === -1 ? waiting.length : place;
  return outAt(destination) + ahead < limited.limit;
}

/**
 * Students in line who may go now, and are **Up Next**: a spot has opened for
 * them, and passes are allowed.
 */
export function upNext(at = Date.now()): LineSpot[] {
  if (noPassNow(at)) return [];
  return line().filter((spot) => hasRoom(spot.studentId, spot.destination));
}

/** Whether a student on the door is an Always-Go Student, whom no rule holds back. See docs/adr/0011. */
function canAlwaysGo(studentId: string) {
  return !!activeDoorClass()?.students.find((each) => each.id === studentId)?.alwaysGo;
}

/**
 * Where one student stands with the Pass Allowance, or null when it doesn't
 * apply to them (it's off, or they're an Exempt or Always-Go Student).
 */
export function allowanceFor(studentId: string) {
  const current = setup();
  const cls = activeDoorClass();
  const allowance = current?.passAllowance;
  const student = cls?.students.find((each) => each.id === studentId);
  if (!current || !cls || !allowance?.enabled || !student || skipsAllowance(student)) return null;
  const used = usedBy(allowance, studentId, [...(current.countedPasses ?? []), ...allPasses()]);
  const left = Math.max(0, allowance.passes - used);
  return {
    left,
    usedUp: left === 0,
    text: left ? passesLeftText(allowance, left) : usedUpText(allowance),
    whenUsedUp: allowance.whenUsedUp,
  };
}

export function checkPin(pin: string) {
  return pin === setup()?.pin;
}

/** Whether a student must type their PIN after tapping their name. The laptop sends PINs only for classes that ask for them. */
export function needsPin(studentId: string) {
  return !!activeDoorClass()?.students.find((each) => each.id === studentId)?.pin;
}

/** The student's own PIN lets them through, and so does the teacher's, for a student who forgot theirs. */
export function checkStudentPin(studentId: string, entered: string) {
  const student = activeDoorClass()?.students.find((each) => each.id === studentId);
  return !!entered && (entered === student?.pin || entered === setup()?.pin);
}

/**
 * What stops a student going to a destination right now, if anything:
 * - a used-up Pass Allowance (unless it only warns)
 * - No-Pass Time
 * - a full destination, or others ahead of them in its line
 * A student already in that destination's line was checked against their
 * allowance when they joined, so it never stops them there. Nothing ever
 * stops an Always-Go Student.
 */
export function blocksFor(studentId: string, destination: string): Block[] {
  const place = destinationNamed(destination);
  if (!place || canAlwaysGo(studentId)) return [];
  const inThisLine = lineSpotFor(studentId)?.destination === destination;
  const allowance = destinationCounts(place) ? allowanceFor(studentId) : null;
  const blocks: Block[] = [];
  if (allowance?.usedUp && allowance.whenUsedUp === 'stop' && !inThisLine) blocks.push('allowance');
  if (noPassNow()) blocks.push('no-pass');
  if (!hasRoom(studentId, destination)) blocks.push('full');
  return blocks;
}

/** The waiting Requests from the class on the door. */
export function requests(): PassRequest[] {
  const classId = activeClassId();
  return allRequests().filter((request) => request.classId === classId);
}

export function requestFor(studentId: string) {
  return requests().find((request) => request.studentId === studentId);
}

/** Whether the class on the door takes Attendance and this student hasn't arrived yet today. See docs/adr/0020. */
export function needsArrival(studentId: string) {
  const arrivals = setup()?.arrivals;
  return !!arrivals && arrivals.classId === activeClassId() && !arrivals.studentIds.includes(studentId);
}

// ---------------------------------------------------------------------------
// Notices
// ---------------------------------------------------------------------------

/**
 * Where the next notice goes. On the teacher's computer acting for a kiosk (or
 * a student's device), it goes back to that device; otherwise it shows here.
 */
let reply: ((notice: DoorNotice, seconds: number) => void) | null = null;
/** Set while acting for a student's own claimed device, so the pass is marked as made from the Student link. */
let fromLink = false;

let noticeTimer = 0;
function showNotice(notice: DoorNotice, seconds: number) {
  if (reply) {
    reply(notice, seconds);
    return;
  }
  clearTimeout(noticeTimer);
  door.notice = notice;
  noticeTimer = window.setTimeout(() => (door.notice = null), seconds * 1000);
}

export function dismissNotice() {
  clearTimeout(noticeTimer);
  door.notice = null;
}

// ---------------------------------------------------------------------------
// Deciding, on the teacher's computer
// ---------------------------------------------------------------------------

/**
 * Does what a student (or the teacher with the PIN) did at the door. Only the
 * teacher's computer calls this: for its own door screen, or for a kiosk or a
 * student's device, whose notices go back to it through `sendNotice`.
 */
export function perform(
  action: DoorAction,
  sendNotice?: (notice: DoorNotice, seconds: number) => void,
  source: 'door' | 'link' = 'door',
) {
  reply = sendNotice ?? null;
  fromLink = source === 'link';
  try {
    if (action.kind === 'pass') startPass(action.studentId, action.destination, action.approvedBy);
    if (action.kind === 'back') endPass(action.studentId);
    if (action.kind === 'join') lineUp(action.studentId, action.destination);
    if (action.kind === 'leave') setLine(line().filter((spot) => spot.studentId !== action.studentId));
    if (action.kind === 'ask') ask(action.studentId, action.destination);
    if (action.kind === 'cancel-request') dropRequest(action.studentId);
    if (action.kind === 'undo') undo(action.passId);
    if (action.kind === 'change-class') setActiveClass({ id: action.classId, changedAt: now() });
    if (action.kind === 'arrive') tapIn(action.studentId);
    if (action.kind === 'arrive-late') arriveLate(action.firstName, action.pin ?? '');
    if (action.kind === 'clear-line') setLine([]);
  } finally {
    reply = null;
    fromLink = false;
  }
}

function endPass(studentId: string) {
  const pass = openPassFor(studentId);
  if (!pass) return;
  const at = now();
  receivePasses([{ ...$state.snapshot(pass), inAt: at, endedBy: 'student', updatedAt: at }]);
  // The spot they leave is held for whoever is first in the line it belongs to.
  const freed = lineAt(pass.destination);
  const next = upNext().find((spot) => freed !== null && lineAt(spot.destination) === freed);
  showNotice(
    {
      kind: 'returned',
      title: `Welcome back, ${pass.studentName}`,
      // A student's own device never hears another student's name (docs/adr/0018).
      message: next && !fromLink ? `${next.studentName}, it's your turn. Tap your name to go.` : 'Welcome back.',
    },
    4,
  );
}

/** A student tapped in as they came into class. The door never says "tardy" (docs/adr/0020). */
function tapIn(studentId: string) {
  const cls = activeDoorClass();
  const student = cls?.students.find((each) => each.id === studentId);
  if (!cls || !student || !needsArrival(studentId)) return;
  recordArrival(cls.id, studentId);
  showNotice({ kind: 'returned', eyebrow: 'Arrived', title: `Welcome, ${student.name}`, message: 'Thanks for tapping in.' }, 4);
}

/** Wrong "Just arrived?" tries at the door in the last minute, and until when it's paused. Same limits as Room setup. */
let lateTries: number[] = [];
let latePausedUntil = 0;

/**
 * "Just arrived?": a student already marked Absent is hidden from the door, so
 * they type their first name (and PIN, when PINs are on) instead of finding
 * their name in a list. The match is made here, on the teacher's computer,
 * against today's Absent students only; an Arrival then makes them Tardy. With
 * PINs off, only one Absent student with that first name counts as a match.
 * See docs/adr/0018 and 0020.
 */
function arriveLate(firstName: string, pin: string) {
  const cls = findClass(account.activeClass?.id);
  if (!cls || !account.attendanceRules) return;
  const askTeacher = (title: string, message: string) => showNotice({ kind: 'denied', eyebrow: 'Just arrived', title, message }, 10);
  const now = Date.now();
  if (now < latePausedUntil) return askTeacher('Ask your teacher', 'Too many tries. Your teacher can mark you here.');
  const typed = firstName.trim().toLowerCase();
  const absent = classStudents(cls).filter(
    (student) => student.status === 'current' && isAbsent(cls.id, student.id) && student.firstName.toLowerCase() === typed,
  );
  const match = account.studentPins ? absent.filter((student) => !!student.pin && student.pin === pin) : absent;
  if (match.length !== 1) {
    if (account.studentPins) {
      lateTries = [...lateTries.filter((at) => now - at < 60_000), now];
      if (lateTries.length >= 5) latePausedUntil = now + 60_000;
      return askTeacher("That didn't match", 'Check your first name and PIN, or ask your teacher.');
    }
    return askTeacher('Ask your teacher', 'Your teacher can mark you here.');
  }
  lateTries = [];
  recordArrival(cls.id, match[0].id);
  showNotice({ kind: 'returned', eyebrow: 'Arrived', title: `Welcome, ${displayName(match[0])}`, message: 'Thanks for tapping in.' }, 4);
}

/**
 * Grants a pass if nothing stops the student, or turns them away with the
 * reason, offering the line where there is one, and a way to ask the teacher.
 * Once the teacher has approved (on Home, or with the PIN at the door) nothing
 * stops them, and the pass is marked with each rule it went past. A refusal
 * gives a count, never who is out.
 */
function startPass(studentId: string, destination: string, approvedBy?: 'home' | 'pin') {
  const cls = activeDoorClass();
  const student = cls?.students.find((each) => each.id === studentId);
  const place = destinationNamed(destination);
  if (!cls || !student || !place || openPassFor(studentId)) return;
  // A student who hasn't arrived taps in first: at the kiosk, taking a pass records the Arrival; a claimed device never can.
  if (needsArrival(studentId)) {
    if (fromLink) {
      showNotice({ kind: 'denied', eyebrow: 'Not here yet', title: 'Tap in at the kiosk first', message: 'Tap your name at the kiosk when you arrive.' }, 8);
      return;
    }
    recordArrival(cls.id, studentId);
  }
  const spot = lineSpotFor(studentId);
  const inThisLine = spot?.destination === destination;
  const offerTeacher = { studentId, destination };
  const blocks = blocksFor(studentId, destination);
  const allowance = destinationCounts(place) ? allowanceFor(studentId) : null;

  if (!approvedBy && blocks.includes('allowance')) {
    showNotice(
      { kind: 'denied', eyebrow: 'Out of passes', title: allowance!.text, message: 'Ask your teacher.', offerTeacher },
      15,
    );
    return;
  }

  const blocked = blocks.includes('no-pass') ? noPassNow() : null;
  if (!approvedBy && blocked) {
    const opens = whenPassesOpen(blocked);
    // During a No-Pass Time, a limited destination offers a place in its line.
    const mayLineUp = setup()?.lineEnabled && lineAt(destination) !== null && !inThisLine;
    showNotice(
      mayLineUp
        ? {
            kind: 'denied',
            eyebrow: 'No-pass time',
            title: 'Join the line?',
            message: `${opens} Join the line to go as soon as they do.`,
            offerLine: { studentId, destination },
            offerTeacher,
          }
        : { kind: 'denied', eyebrow: 'No-pass time', title: 'No passes right now', message: opens, offerTeacher },
      15,
    );
    return;
  }

  // A free spot is held for whoever is first in the line.
  if (!approvedBy && blocks.includes('full')) {
    // Already in the Class Line and changing where they're going: they keep their place.
    if (spot && !inThisLine && lineAt(spot.destination) === lineAt(destination)) {
      lineUp(studentId, destination);
      return;
    }
    const out = outAt(destination);
    const waiting = line(destination).length;
    const someone = (count: number) => `${count} ${count === 1 ? 'student is' : 'students are'}`;
    const andWaiting = waiting ? `, and ${waiting} ${waiting === 1 ? 'is' : 'are'} waiting` : '';
    // Under a Class Limit, the count is of everyone out, wherever they went.
    const shared = hasClassLimit();
    showNotice(
      setup()?.lineEnabled && !inThisLine
        ? {
            kind: 'denied',
            title: 'Join the line?',
            message: !isFull(destination)
              ? `${someone(waiting)} already waiting${shared ? '' : ` for ${destination}`}.`
              : shared
                ? `${someone(out)} already out${andWaiting}.`
                : `${destination} is full${andWaiting}.`,
            offerLine: { studentId, destination },
            offerTeacher,
          }
        : {
            kind: 'denied',
            title: 'Please wait in class',
            message: `${someone(out)} already ${shared ? 'out' : `at ${destination}`}. Try again when someone comes back.`,
            offerTeacher,
          },
      15,
    );
    return;
  }

  // A student can only be in one place: starting a pass takes them out of any line, and ends their Request.
  if (spot) setLine(line().filter((each) => each.studentId !== studentId));
  if (requestFor(studentId)) setRequests(requests().filter((each) => each.studentId !== studentId));
  const at = now();
  const pass: Pass = {
    id: newId(),
    classId: cls.id,
    studentId,
    studentName: student.name,
    destination,
    minutes: place.minutes ?? 0,
    outAt: at,
    updatedAt: at,
  };
  if (!allowance) pass.counts = false;
  if (student.alwaysGo) pass.alwaysGo = true;
  if (allowance?.usedUp) pass.extra = true;
  if (blocked) pass.noPassException = true;
  if (blocks.includes('full')) pass.lineSkip = true;
  if (approvedBy && blocks.length) pass.approvedBy = approvedBy;
  if (fromLink) pass.fromLink = true;
  receivePasses([pass]);
  // Approved from Home, the student may be back at their seat, and someone else may be at the screen.
  if (approvedBy === 'home') return;
  const back = pass.minutes ? `Back by ${dueTime(pass)}.` : 'Come straight back to class.';
  const onlyWarned = allowance?.usedUp && !approvedBy;
  showNotice(
    {
      kind: 'approved',
      title: shownTo(destination) ? `${student.name}: ${destination}` : `${student.name}: you can go`,
      message: onlyWarned
        ? `${allowance!.text} You can still go, and your teacher will see it was an extra pass. ${back}`
        : pass.minutes
          ? `Back by ${dueTime(pass)}`
          : back,
      undoPassId: pass.id,
    },
    8,
  );
}

/** "Ask my teacher": a student has at most one Request, so asking again replaces it. */
function ask(studentId: string, destination: string) {
  const cls = activeDoorClass();
  const student = cls?.students.find((each) => each.id === studentId);
  if (!cls || !student) return;
  const blocks = blocksFor(studentId, destination);
  if (!blocks.length) {
    startPass(studentId, destination);
    return;
  }
  const request: PassRequest = {
    id: newId(),
    classId: cls.id,
    studentId,
    studentName: student.name,
    destination,
    blocks,
    askedAt: now(),
  };
  setRequests([...allRequests().filter((each) => each.studentId !== studentId), request]);
  delete door.denied[studentId];
  showNotice(
    {
      kind: 'returned',
      eyebrow: 'Asked your teacher',
      title: shownTo(destination) ? `${student.name}: ${destination}` : student.name,
      message: 'If your teacher says yes, your name will say you’re out. Then go.',
    },
    6,
  );
}

function dropRequest(studentId: string) {
  setRequests(allRequests().filter((each) => each.studentId !== studentId));
}

/**
 * Joins the line a destination waits in. A student waits in one line at a
 * time, so joining another leaves the first; in the Class Line, they keep
 * their place but change where they're going.
 */
function lineUp(studentId: string, destination: string) {
  const cls = activeDoorClass();
  const student = cls?.students.find((each) => each.id === studentId);
  const current = lineSpotFor(studentId);
  if (!cls || !student || current?.destination === destination) return;
  const keepsPlace = !!current && lineAt(current.destination) !== null && lineAt(current.destination) === lineAt(destination);
  const spot: LineSpot = { studentId, studentName: student.name, classId: cls.id, destination, joinedAt: now() };
  const others = allLines().filter((each) => each.classId !== cls.id);
  setLine([
    ...others,
    ...(keepsPlace
      ? line().map((each) => (each.studentId === studentId ? { ...each, destination } : each))
      : [...line().filter((each) => each.studentId !== studentId), spot]),
  ]);
  const position = line(destination).length;
  showNotice(
    {
      kind: 'returned',
      eyebrow: 'In line',
      title: hasClassLimit()
        ? `You're ${ordinal(position)} in line`
        : `You're ${ordinal(position)} in line for ${destination}`,
      message: 'Watch for your name. When it turns green, tap it to go.',
    },
    5,
  );
}

/** "That's not me": undoes a pass given to the wrong student moments ago. */
function undo(passId: string) {
  const pass = allPasses().find((each) => each.id === passId);
  if (pass && !pass.inAt) receivePasses([endUnseen($state.snapshot(pass), 'cancelled')]);
}

/** A Request ends by itself once nothing stops the student any more, so they can just tap their name. */
export function settleRequests() {
  if (!inCharge()) return;
  const all = allRequests();
  const still = requests().filter((request) => blocksFor(request.studentId, request.destination).length);
  if (still.length !== all.length) setRequests(still);
}

/** The teacher answered a Request on Home. A yes starts the pass at once. */
export function answerRequest(request: PassRequest, approve: boolean) {
  answered(request, approve);
  if (approve) startPass(request.studentId, request.destination, 'home');
  else door.denied[request.studentId] = Date.now();
}

function ordinal(position: number) {
  if (position === 1) return '1st';
  if (position === 2) return '2nd';
  if (position === 3) return '3rd';
  return `${position}th`;
}

// ---------------------------------------------------------------------------
// What the door screen does
// ---------------------------------------------------------------------------

/**
 * Every tap at the door goes through here. The teacher's own computer decides
 * at once; a kiosk asks the teacher's computer, and while it can't reach it,
 * only lets students sign back in.
 */
function act(action: DoorAction) {
  if (inCharge()) {
    perform(action);
    return;
  }
  if (reachesTeacher()) {
    send({ type: 'act', action });
    return;
  }
  if (action.kind === 'back') signBackInOffline(action.studentId);
  else if (action.kind === 'arrive') arriveOffline(action.studentId);
  // Finding a late student needs the teacher's computer, so don't guess.
  else if (action.kind === 'arrive-late') {
    showNotice({ kind: 'denied', eyebrow: 'Just arrived', title: 'Ask your teacher', message: 'Your teacher can mark you here.' }, 8);
  }
  else showNotice(waitingNotice(), 6);
}

/** What a kiosk says when a student taps while it can't reach the teacher's computer. */
function waitingNotice(): DoorNotice {
  return {
    kind: 'denied',
    eyebrow: 'Not connected',
    title: "Waiting for your teacher's computer",
    message: 'Passes start again as soon as this kiosk reaches it. You can still come back in: tap your name.',
  };
}

export const requestPass = (studentId: string, destination: string, approvedBy?: 'pin') =>
  act({ kind: 'pass', studentId, destination, approvedBy });
export const signBackIn = (studentId: string) => act({ kind: 'back', studentId });
export const tapToArrive = (studentId: string) => act({ kind: 'arrive', studentId });
export const arriveLateAs = (firstName: string, pin?: string) => act({ kind: 'arrive-late', firstName, pin });

/** How many students are Absent from the class on the door today, so the door can offer "Just arrived?" (never who). */
export function absentCount() {
  const arrivals = setup()?.arrivals;
  return arrivals && arrivals.classId === activeClassId() ? (arrivals.absentCount ?? 0) : 0;
}

/** Whether a late arrival has to type a PIN. */
export function lateArrivalNeedsPin() {
  return !!setup()?.arrivals?.pinsOn;
}
export const joinLine = (studentId: string, destination: string) => act({ kind: 'join', studentId, destination });
export const leaveLine = (studentId: string) => act({ kind: 'leave', studentId });
export const cancelRequest = (studentId: string) => act({ kind: 'cancel-request', studentId });
export const clearLine = () => act({ kind: 'clear-line' });

/**
 * The teacher starting a pass from Home: for a student whose device is dead, or
 * to let the next one in line go while someone is still out. The teacher's
 * computer is in charge (docs/adr/0014), so it skips the checks the way
 * approving a Request does. Never reachable from a kiosk or a student device.
 */
export function startPassFromHome(studentId: string, destination: string) {
  if (!inCharge()) return;
  startPass(studentId, destination, 'home');
}

export function askTeacher(studentId: string, destination: string) {
  if (canAsk()) act({ kind: 'ask', studentId, destination });
}

export function undoPass(passId: string) {
  act({ kind: 'undo', passId });
  dismissNotice();
}

/** Changing class at the door ends every pass still open in the class being left, and takes the door off schedule. */
export function changeClass(classId: string | null) {
  act({ kind: 'change-class', classId });
}

/** Students can ask only from a kiosk the teacher's computer can hear. On the teacher's own computer, the PIN is the way past. */
export function canAsk() {
  return !!door.device && reachesTeacher();
}

/** On Schedule, the teacher's computer moves the door to whatever class the clock says. */
export function followSchedule() {
  if (inCharge()) keepToSchedule();
}

/** The Current Schedule, as the door last heard it. */
export function doorSchedule() {
  return setup()?.schedule;
}

/**
 * A student back while the kiosk can't reach the teacher's computer: that's a
 * fact, not a decision, so the kiosk notes the time and hands it over later.
 */
function signBackInOffline(studentId: string) {
  const device = door.device;
  const pass = openPassFor(studentId);
  if (!device || !pass) return;
  const at = now();
  Object.assign(pass, { inAt: at, endedBy: 'student', updatedAt: at });
  device.returns = [...device.returns, { passId: pass.id, inAt: at }];
  saveDevice();
  showNotice(
    {
      kind: 'returned',
      title: `Welcome back, ${pass.studentName}`,
      message: "Welcome back. This kiosk will tell your teacher's computer when it reconnects.",
    },
    4,
  );
}

/** An Arrival is a fact too, so a kiosk that can't reach the teacher's computer records it and hands it over later. */
function arriveOffline(studentId: string) {
  const device = door.device;
  const arrivals = device?.setup.arrivals;
  const student = activeDoorClass()?.students.find((each) => each.id === studentId);
  if (!device || !arrivals || !student || !needsArrival(studentId)) return;
  arrivals.studentIds = [...arrivals.studentIds, studentId];
  device.arrivals = [...(device.arrivals ?? []), { classId: arrivals.classId, studentId, at: now() }];
  saveDevice();
  showNotice({ kind: 'returned', eyebrow: 'Arrived', title: `Welcome, ${student.name}`, message: 'Thanks for tapping in.' }, 4);
}

/** How many returns and Arrivals were recorded here that the teacher's computer hasn't heard about yet. */
/** Everything this kiosk holds that the teacher's computer hasn't received yet, including passes from an older version. */
export function waitingCount() {
  return (door.device?.returns.length ?? 0) + (door.device?.arrivals?.length ?? 0) + (door.device?.legacyPasses?.length ?? 0);
}

// ---------------------------------------------------------------------------
// Talking to the teacher's computer
// ---------------------------------------------------------------------------

let peer: Peer | null = null;
let connection: DataConnection | null = null;
let retryTimer = 0;

function send(message: KioskMessage) {
  if (connection?.open) connection.send(message);
}

/** Keeps every offline return showing as back until the teacher's computer has it. */
function adoptSetup(device: PairedDevice, setup: DoorSetup) {
  door.laptopOutdated = !setup.protocol;
  device.setup = fromOlderLaptop(setup);
  for (const back of device.returns) {
    const pass = device.setup.passes.find((each) => each.id === back.passId);
    if (pass && !pass.inAt) Object.assign(pass, { inAt: back.inAt, endedBy: 'student', updatedAt: back.inAt });
  }
  const arrivals = device.setup.arrivals;
  for (const each of device.arrivals ?? []) {
    if (arrivals?.classId === each.classId && !arrivals.studentIds.includes(each.studentId)) arrivals.studentIds.push(each.studentId);
  }
  for (const { studentId, secondsAgo } of setup.denied ?? []) {
    door.denied[studentId] = Math.max(door.denied[studentId] ?? 0, Date.now() - secondsAgo * 1000);
  }
  saveDevice();
}

/** What the teacher's computer sends this kiosk. Exported for tests. */
export function receive(message: LaptopMessage) {
  const device = door.device;
  if (!device) return;
  if (message.type === 'setup') adoptSetup(device, message.setup);
  if (message.type === 'notice') showNotice(message.notice, message.seconds);
  if (message.type === 'returns-received') {
    device.returns = device.returns.filter((back) => !message.passIds.includes(back.passId));
    saveDevice();
  }
  if (message.type === 'arrivals-received') {
    const received = (each: OfflineArrival) => message.arrivals.some((got) => got.studentId === each.studentId && got.at === each.at);
    device.arrivals = (device.arrivals ?? []).filter((each) => !received(each));
    saveDevice();
  }
  if (message.type === 'ack') {
    device.legacyPasses = undefined;
    saveDevice();
  }
  if (message.type === 'replaced') {
    forgetDevice();
    door.status = 'replaced';
  }
}

function dial() {
  const device = door.device;
  // While the matchmaking server is unreachable, createPeer is already retrying.
  if (!peer || peer.destroyed || peer.disconnected || !device) return;
  connection?.close();
  const attempt = peer.connect(device.laptopPeerId, {
    metadata: { kioskId: device.kioskId, secret: device.secret },
    reliable: true,
  });
  connection = attempt;
  attempt.on('open', () => {
    keepAlive(attempt);
    door.status = 'live';
    if (device.legacyPasses?.length) send({ type: 'passes', passes: $state.snapshot(device.legacyPasses) });
    if (device.returns.length) send({ type: 'returns', returns: $state.snapshot(device.returns) });
    if (device.arrivals?.length) send({ type: 'arrivals', arrivals: $state.snapshot(device.arrivals) });
  });
  attempt.on('data', (data) => receive(data as LaptopMessage));
  attempt.on('close', () => {
    if (connection !== attempt) return;
    connection = null;
    if (door.status === 'live') door.status = 'offline';
  });
}

/** Finds the teacher's computer, and keeps trying for as long as this device is the kiosk. */
export async function connectToLaptop() {
  if (!door.device || peer) return;
  door.status = 'offline';
  peer = await createPeer();
  peer.on('open', dial);
  peer.on('error', () => {
    if (!connection?.open) door.status = door.status === 'replaced' ? 'replaced' : 'offline';
  });
  clearInterval(retryTimer);
  retryTimer = window.setInterval(() => {
    if (door.device && door.status === 'offline') dial();
  }, 4000);
}

/**
 * "Reconnect": try the teacher's computer right now. The kiosk keeps trying on
 * its own, but after a long outage it waits up to a minute between tries; this
 * skips the wait. It changes nothing else, so it needs no PIN.
 */
export function reconnectNow() {
  if (!door.device || door.status === 'live') return;
  if (!peer || peer.destroyed) {
    peer = null;
    connectToLaptop();
  } else if (peer.disconnected) {
    // Once the matchmaking server answers, 'open' dials the laptop.
    peer.reconnect();
  } else {
    dial();
  }
}

/** Closes the connection to the teacher's computer, keeping everything this device holds. */
function hangUp() {
  clearInterval(retryTimer);
  connection?.close();
  connection = null;
  peer?.destroy();
  peer = null;
}

/** Stops being a kiosk. Returns not yet handed over are lost, so the page warns first. */
export function forgetDevice() {
  hangUp();
  door.device = null;
  saveDevice();
}

/**
 * Dials the short code shown on the teacher's laptop. If the code is found but
 * the two devices cannot open a direct connection, this network blocks them,
 * and only the teacher's own computer can be the kiosk.
 */
export async function pairWithCode(code: string) {
  /** A device pairing again, from the teacher menu, stays the kiosk until the new pairing works. */
  const previous = door.device ? $state.snapshot(door.device) : null;
  door.pairing = { state: 'connecting', message: '', slow: false, problem: null };
  // A wrong code is only reported once the matchmaking server gives up on it,
  // which can take a while; meanwhile, suggest checking the code.
  const slowTimer = setTimeout(() => (door.pairing.slow = true), 6000);
  if (!previous) door.status = 'offline';
  const temporary = await createPeer();
  let done = false;
  let attempt: DataConnection | null = null;
  let watch: ConnectionWatch | null = null;
  let peerError = '';
  /** `report` is off for a mistyped code: the message already says what to do. */
  const fail = async (message: string, report = true) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    clearTimeout(slowTimer);
    // Read the connection's details before destroying it closes it.
    const problem = !report ? null : await connectionReport({
      problem: `Pairing with code ${code}: ${message}`,
      side: 'door device',
      connection: attempt?.peerConnection,
      watch,
      peerError,
    });
    temporary.destroy();
    door.pairing = { state: 'error', message, slow: false, problem };
  };
  const timer = setTimeout(
    () =>
      fail(
        "This network won't let the two devices connect directly. Use the teacher's computer as the kiosk instead.",
      ),
    25_000,
  );
  temporary.on('error', (error) => {
    peerError = `${error.type}: ${error.message}`;
    if (error.type === 'peer-unavailable') {
      fail("That code didn't match. Check the code on the teacher's screen. Codes expire after 10 minutes.", false);
    } else if (error.type === 'network' || error.type === 'server-error' || error.type === 'socket-error') {
      fail("Couldn't reach the internet to look up that code. Check this device's connection and try again.");
    }
  });
  temporary.on('open', () => {
    attempt = temporary.connect(pairingPrefix + code, { reliable: true });
    watch = watchConnection(attempt.peerConnection);
    attempt.on('data', (data) => {
      const message = data as LaptopMessage;
      if (message.type !== 'paired' || done) return;
      done = true;
      clearTimeout(timer);
      clearTimeout(slowTimer);
      if (previous) hangUp();
      // Pairing again after saved data couldn't be read: the copy is kept aside, and this device saves afresh.
      unreadableDevice = false;
      door.unreadableSaved = false;
      // Pairing again keeps any returns this device hasn't handed over yet.
      door.device = {
        laptopPeerId: message.laptopPeerId,
        kioskId: message.kioskId,
        secret: message.secret,
        setup: fromOlderLaptop(message.setup),
        returns: previous?.returns ?? [],
        arrivals: previous?.arrivals,
        legacyPasses: previous?.legacyPasses,
      };
      saveDevice();
      door.pairing = { state: 'idle', message: '', slow: false, problem: null };
      setTimeout(() => temporary.destroy(), 500);
      connectToLaptop();
    });
  });
}
