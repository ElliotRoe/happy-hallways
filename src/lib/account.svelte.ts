import { defaultAllowance, passCounts, skipsAllowance, windowStart } from './allowance';
import { defaultDestinations, knownIcon } from './destinations';
import { countsTowardClassLimit } from './limits';
import type { IconName } from './icons';
import { endUnseen, mergeInto, newId, now } from './passes';
import { displayName, type ImportPlan, type RosterCandidate } from './roster';
import { blankSchedule, clockOf, noPassAt, scheduledClassAt, withRulesOnPeriods } from './schedule';
import { arrivalStatus, periodFor, today } from './attendance';
import type {
  ClassVisibility,
  Member,
  MergeRecord,
  Account,
  ActiveClass,
  AttendanceMark,
  AttendanceOptions,
  Class,
  ClassStudent,
  Destination,
  DoorSetup,
  LineSpot,
  OfflineArrival,
  OfflineReturn,
  Pass,
  PassAllowance,
  PassRequest,
  Room,
  Schedule,
  Student,
} from './types';
import { newsIds, seenBefore } from './popups';
import { randomPin } from './pins';

/**
 * The teacher's whole Account, kept in this browser's local storage. There is
 * no server: this object is the record. See docs/adr/0005.
 */
/**
 * Where the Account is kept. This version keeps it under its own key, so a
 * tab still running an older version (which reads and writes `legacyKey`)
 * never reads data it can't understand, or saves an older shape over it. The
 * old key is left untouched, as it was, as a way back. See docs/adr/0005.
 */
const storageKey = 'hallway.account.v2';
const legacyKey = 'hallway.account';
/** The shape of the saved Account, so a later version can tell older or newer data. */
export const accountVersion = 2;
/** What this version's teacher's computer understands from a kiosk: 2 is a kiosk that asks it for everything (docs/adr/0014). */
export const doorProtocol = 2;

/**
 * Attendance is one mark per student, class and day, so a year of it is large.
 * It's saved compactly: by class, then day, then student, as
 * [status, minutes after midnight they arrived, minutes tardy, flags, name].
 */
type StoredMark = [status: 'p' | 't' | 'a', arrived?: number | null, tardy?: number | null, flags?: number, name?: string];
type AttendanceLog = Record<string, Record<string, Record<string, StoredMark>>>;
const statusCode = { present: 'p', tardy: 't', absent: 'a' } as const;
const statusOf = { p: 'present', t: 'tardy', a: 'absent' } as const;

function packAttendance(marks: AttendanceMark[]): AttendanceLog {
  const log: AttendanceLog = {};
  for (const mark of marks) {
    const arrived = mark.arrivedAt ? new Date(mark.arrivedAt) : null;
    const flags = (mark.excused ? 1 : 0) | (mark.goneForDay ? 2 : 0) | (mark.corrected ? 4 : 0);
    const stored: StoredMark = [statusCode[mark.status], arrived ? arrived.getHours() * 60 + arrived.getMinutes() + arrived.getSeconds() / 60 : null, mark.tardyMinutes ?? null, flags, mark.studentName];
    ((log[mark.classId] ??= {})[mark.day] ??= {})[mark.studentId] = stored;
  }
  return log;
}

function unpackAttendance(log: AttendanceLog, setAside: unknown[] = []): AttendanceMark[] {
  const marks: AttendanceMark[] = [];
  for (const [classId, days] of Object.entries(log)) {
    for (const [day, students] of Object.entries(days)) {
      // A day that isn't a date can't be a mark; it's set aside, not allowed to make the whole Account unreadable.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !students || typeof students !== 'object') {
        setAside.push({ classId, day, students });
        continue;
      }
      for (const [studentId, stored] of Object.entries(students)) {
        if (!Array.isArray(stored) || !(stored[0] in statusOf)) {
          setAside.push({ classId, day, students: { [studentId]: stored } });
          continue;
        }
        const [status, arrived, tardy, flags = 0, name = ''] = stored as StoredMark;
        const [year, month, date] = day.split('-').map(Number);
        const arrivedAt =
          typeof arrived === 'number' ? new Date(year, month - 1, date, 0, 0, Math.round(arrived * 60)).toISOString() : undefined;
        const mark: AttendanceMark = {
          id: `${classId}|${day}|${studentId}`,
          classId,
          studentId,
          studentName: name,
          day,
          status: statusOf[status],
          updatedAt: arrivedAt ?? new Date(year, month - 1, date).toISOString(),
        };
        if (arrivedAt) mark.arrivedAt = arrivedAt;
        if (typeof tardy === 'number') mark.tardyMinutes = tardy;
        if (flags & 1) mark.excused = true;
        if (flags & 2) mark.goneForDay = true;
        if (flags & 4) mark.corrected = true;
        marks.push(mark);
      }
    }
  }
  return marks;
}

/** The Account as saved: attendance compact, everything else as it is. */
function storedText(value: Account) {
  const { attendance, ...rest } = $state.snapshot(value) as Account;
  return JSON.stringify({ ...rest, attendance: [], attendanceLog: packAttendance(attendance) });
}

function blankAccount(): Account {
  return {
    version: accountVersion,
    laptopPeerId: `hallway-${newId()}`,
    roster: [],
    classes: [],
    destinations: defaultDestinations(newId),
    passes: [],
    lineEnabled: false,
    line: [],
    limitMode: 'destination',
    classLimit: 1,
    passAllowance: defaultAllowance(),
    schedules: [],
    currentScheduleId: null,
    manualNoPass: null,
    requests: [],
    deniedRequests: [],
    // Nothing changed under a brand-new teacher, so there is no news to show them.
    seenPopups: Object.fromEntries(newsIds().map((id) => [id, now()])),
    pin: '',
    kiosk: null,
    activeClass: null,
    replacedKiosks: [],
    networkBlocked: false,
    studentLink: null,
    claims: [],
    attendance: [],
  };
}

/**
 * Accounts saved by older versions are shaped differently, and are brought up
 * to date here so nothing the teacher set is lost:
 * - Destinations used to be a list on each class; they became one shared list.
 * - The Pass Limit used to be one number for every destination (and before
 *   that, one per class); each destination now has its own. See docs/adr/0007.
 *   A teacher may since choose one Class Limit instead; everyone who saved
 *   before that keeps a limit on each destination. See docs/adr/0010.
 * - The teacher used to give Permissions from the laptop ahead of time;
 *   students now send Requests instead, so unused ones are dropped. See
 *   docs/adr/0009.
 * - "What's changed" used to remember only the newest news seen.
 * - No-pass times used to be clock times on each class; they moved to the
 *   teacher's first schedule. See docs/adr/0008.
 * - "First N minutes of every class" used to be rules across a schedule; each
 *   period now has its own. See EdgeRule.
 */
/** How a student was kept before the Roster: one entry per class. See docs/adr/0015. */
type OlderStudent = { id: string; firstName: string; lastPrefix: string; status: 'current' | 'former'; exempt?: boolean; alwaysGo?: boolean; pin?: string };

type SavedAccount = Omit<Account, 'destinations' | 'classes' | 'schedules' | 'seenPopups' | 'limitMode' | 'classLimit' | 'roster'> & {
  roster?: Student[];
  limitMode?: Account['limitMode'];
  classLimit?: number;
  schedules?: Schedule[];
  destinations?: (Omit<Destination, 'limit'> & { limit?: number | null })[];
  passLimit?: number;
  permissions?: unknown[];
  relayedAnswers?: unknown[];
  extraPassGifts?: unknown[];
  seenUpdate?: string;
  seenPopups?: Record<string, string>;
  classes: (Omit<Class, 'members'> & {
    members?: Class['members'];
    /** PINs used to be turned on class by class. */
    studentPins?: boolean;
    students?: OlderStudent[];
    destinations?: { label: string; minutes: number }[];
    limit?: number;
    noPassTimes?: { start: string; end: string }[];
  })[];
};

function upgrade(saved: SavedAccount): Account {
  const oldLimit = saved.passLimit ?? saved.classes[0]?.limit ?? 1;
  if (!saved.destinations) {
    const old = saved.classes.find((cls) => cls.destinations?.length)?.destinations;
    const defaults = defaultDestinations(newId);
    saved.destinations = old
      ? old.map((each): Destination => ({
          ...(defaults.find((preset) => preset.label === each.label) ?? defaults[defaults.length - 1]),
          id: newId(),
          label: each.label,
          minutes: each.minutes || null,
          limit: oldLimit,
        }))
      : defaults;
  }
  for (const destination of saved.destinations) {
    destination.icon = knownIcon(destination.icon);
    if (destination.limit === undefined) destination.limit = oldLimit;
  }
  delete saved.passLimit;
  saved.limitMode ??= 'destination';
  saved.classLimit ??= 1;
  saved.passAllowance ??= defaultAllowance();
  delete saved.permissions;
  delete saved.relayedAnswers;
  delete saved.extraPassGifts;
  saved.requests ??= [];
  saved.deniedRequests ??= [];
  saved.seenPopups ??= seenBefore(saved.seenUpdate, now());
  delete saved.seenUpdate;
  if (!saved.schedules) {
    const schedule = blankSchedule(newId(), 'My Schedule');
    const copied = new Set<string>();
    for (const time of saved.classes.flatMap((cls) => cls.noPassTimes ?? [])) {
      if (copied.has(time.start + time.end)) continue;
      copied.add(time.start + time.end);
      schedule.noPassTimes.push({ id: newId(), start: time.start, end: time.end });
    }
    saved.schedules = schedule.noPassTimes.length ? [schedule] : [];
  }
  saved.schedules = saved.schedules.map(withRulesOnPeriods);
  if (!saved.schedules.some((schedule) => schedule.id === saved.currentScheduleId)) {
    saved.currentScheduleId = saved.schedules[0]?.id ?? null;
  }
  saved.manualNoPass ??= null;
  saved.claims ??= [];
  saved.attendance ??= [];
  // Attendance used to be on or off for each class; it's one setting now. The first class that took it keeps its minutes.
  if (saved.attendanceRules === undefined) {
    const took = saved.classes.find((cls) => cls.attendance);
    if (took?.attendance) saved.attendanceRules = took.attendance;
  }
  for (const cls of saved.classes) delete cls.attendance;
  // The Student link used to be one lasting link; it's now a Room per class period (docs/adr/0019).
  const link = saved.studentLink as { open: boolean; room?: Room | null } | null;
  saved.studentLink = link ? { open: link.open, room: link.room ?? null } : null;
  delete (saved as { claimsEndWithClass?: boolean }).claimsEndWithClass;
  for (const cls of saved.classes) {
    delete cls.destinations;
    delete cls.limit;
    delete cls.noPassTimes;
  }
  // Each class used to keep its own students. Each becomes one Roster entry, with the same id,
  // so every pass still points at them; the same child in two classes is offered for merging.
  if (!saved.roster) {
    const roster: Student[] = [];
    for (const cls of saved.classes) {
      cls.members = (cls.students ?? []).map(({ id, firstName, lastPrefix, status, exempt, alwaysGo, pin }) => {
        const student: Student = { id, firstName };
        if (exempt) student.exempt = true;
        if (alwaysGo) student.alwaysGo = true;
        if (pin) student.pin = pin;
        roster.push(student);
        return { studentId: id, lastPrefix, status };
      });
    }
    saved.roster = roster;
    // A brand-new teacher, or one whose classes held nobody, has nothing to merge.
    if (!roster.length) saved.rosterMergeSeen = true;
  }
  // PINs used to be turned on class by class; a student now has one PIN in every class,
  // so they're on for everyone if any class had them.
  if (saved.classes.some((cls) => cls.studentPins)) saved.studentPins = true;
  for (const cls of saved.classes) {
    cls.members ??= [];
    delete cls.students;
    delete cls.studentPins;
  }
  return saved as Account;
}

/** Fields a saved account must not borrow from a blank one, so upgrade() can tell an older account by their absence. */
const fromOlderVersions = {
  roster: undefined,
  destinations: undefined,
  seenPopups: undefined,
  schedules: undefined,
  currentScheduleId: undefined,
};

/**
 * Set when the saved Account couldn't be read. Nothing is saved over it then:
 * the teacher sees a screen to download it and write to support, and a copy is
 * kept under its own key in case anything goes wrong after.
 */
export const unreadable = $state({ raw: null as string | null, error: '' });

/** A short fingerprint of saved text, to notice when a tab on the older version has changed the older key. */
function fingerprint(text: string) {
  let hash = 5381;
  for (let index = 0; index < text.length; index++) hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  return `${text.length}:${(hash >>> 0).toString(36)}`;
}

/** The Requests in an older copy, by id, so only ones new since are taken in later. */
function legacyRequestIdsOf(text: string) {
  try {
    return (readAccount(text)?.requests ?? []).map((request) => request.id);
  } catch {
    return [];
  }
}

/** Saved text that can't be read is copied aside once (each different copy once), for support. */
function keepUnreadableCopy(text: string) {
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)!;
      if (key.startsWith('hallway.account.unreadable.') && localStorage.getItem(key) === text) return;
    }
    localStorage.setItem(`hallway.account.unreadable.${Date.now()}`, text);
  } catch {
    // No room for a copy; the original is still where it was, since nothing saves over it.
  }
}

/** Reads one saved Account. Throws when it can't; returns null when it holds nothing (`{}`, `null`, `[]`). */
function readAccount(text: string): Account | null {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length === 0) return null;
  if (!Array.isArray(parsed.classes)) throw new Error('The saved data has no classes.');
  if (parsed.attendanceLog) {
    const setAside: unknown[] = [];
    parsed.attendance = [...(parsed.attendance ?? []), ...unpackAttendance(parsed.attendanceLog, setAside)];
    // Kept as it was, so nothing is thrown away; it's just not shown.
    if (setAside.length) parsed.unreadableAttendance = [...(parsed.unreadableAttendance ?? []), ...setAside];
    delete parsed.attendanceLog;
  }
  // Marks saved before they were kept compactly had ids of their own; they take the same kind of id now.
  for (const mark of parsed.attendance ?? []) mark.id = `${mark.classId}|${mark.day}|${mark.studentId}`;
  const account = upgrade({ ...blankAccount(), ...fromOlderVersions, ...parsed });
  account.version = accountVersion;
  return account;
}

function load(): Account {
  let saved: string | null = null;
  let legacy: string | null = null;
  try {
    saved = localStorage.getItem(storageKey);
    legacy = localStorage.getItem(legacyKey);
  } catch {
    // Storage blocked: start empty rather than not at all. Saving will fail the same way, so nothing is overwritten.
    return blankAccount();
  }
  for (const [text, key] of [
    [saved, storageKey],
    [legacy, legacyKey],
  ] as const) {
    if (!text) continue;
    try {
      const read = readAccount(text);
      if (!read) {
        // Holds nothing: keep a copy, and fall back to the older key.
        if (key === storageKey) keepUnreadableCopy(text);
        continue;
      }
      // Remember which version of the older key this has taken in, so later changes to it are noticed.
      if (key === legacyKey) {
        read.legacySeen = fingerprint(text);
        read.legacyRequestIds = read.requests.map((request) => request.id);
      }
      else read.legacySeen ??= legacy ? fingerprint(legacy) : undefined;
      return read;
    } catch (error) {
      unreadable.raw = text;
      unreadable.error = error instanceof Error ? error.message : String(error);
      keepUnreadableCopy(text);
      return blankAccount();
    }
  }
  return blankAccount();
}

export const account: Account = $state(load());

/** Called after every save, so a connected kiosk, and students watching the Student link, hear about the change. */
const afterSave: (() => void)[] = [];
export function onSave(listener: () => void) {
  afterSave.push(listener);
}

/** Set when this browser has no room left to save: the teacher is asked to download a Backup. */
export const storage = $state({ full: false });

/** Whether this version's key already holds a copy that reads back. */
function ownCopyIsSafe() {
  const text = localStorage.getItem(storageKey);
  if (!text) return false;
  try {
    return readAccount(text) !== null;
  } catch {
    return false;
  }
}

function isQuotaError(error: unknown) {
  return error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22 || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
}

/**
 * Writes the Account, unless what was saved couldn't be read: then nothing is
 * ever written over it. When the browser is out of room, it makes room by
 * letting go of the older version's copy, then copies kept for support, and
 * tries again; if it still can't, the teacher is told to download a Backup.
 */
function write() {
  if (unreadable.raw !== null) return false;
  const text = storedText(account);
  // Copies kept for support go first. The older version's copy goes only once this version's own copy is
  // safely saved and readable: before that, it's the only copy there is.
  const spare = () => [
    ...Object.keys(localStorage).filter((key) => key.startsWith('hallway.account.unreadable.') || key.startsWith('hallway.door.unreadable.')),
    ...(ownCopyIsSafe() ? [legacyKey] : []),
  ];
  for (let attempt = 0; ; attempt++) {
    try {
      localStorage.setItem(storageKey, text);
      storage.full = false;
      return true;
    } catch (error) {
      if (!isQuotaError(error)) throw error;
      storage.full = true;
      const next = spare().find((key) => localStorage.getItem(key) !== null);
      if (!next || attempt > 50) return false;
      localStorage.removeItem(next);
    }
  }
}

function save() {
  if (!write()) return;
  for (const listener of afterSave) listener();
}

/**
 * Teachers often have Happy Hallways open in more than one tab. Each save
 * writes the whole Account, so a tab working from an old copy would undo the
 * others' changes, and only one tab can hold the laptop's address for the
 * kiosk. So when another tab saves, this one takes its copy straight away.
 */
const afterReload: (() => void)[] = [];
export function onReload(listener: () => void) {
  afterReload.push(listener);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.newValue === null || unreadable.raw !== null) return;
    // A tab still on the older version recorded something: take in its passes, without losing anything here.
    if (event.key === legacyKey && localStorage.getItem(storageKey) !== null) {
      foldLegacy();
      return;
    }
    // Before this version has saved, the older key is still the record.
    const watched = event.key === storageKey || (event.key === legacyKey && localStorage.getItem(storageKey) === null);
    if (!watched) return;
    const fresh = load();
    for (const key of Object.keys(account)) if (!(key in fresh)) delete account[key as keyof Account];
    Object.assign(account, fresh);
    for (const listener of afterReload) listener();
  });
}

/**
 * A tab still on the older version keeps writing the older key after this
 * version has started saving under its own. Whatever it recorded since (passes,
 * returns, Requests) is folded in here, by id, the way a kiosk's copies are:
 * nothing only this version knows is ever replaced.
 */
function foldLegacy() {
  let text: string | null = null;
  try {
    text = localStorage.getItem(legacyKey);
  } catch {
    return;
  }
  if (!text || localStorage.getItem(storageKey) === null) return;
  const seen = fingerprint(text);
  if (account.legacySeen === seen) return;
  let older: Account | null = null;
  try {
    older = readAccount(text);
  } catch {
    // The older tab's copy can't be read; ours stands.
  }
  account.legacySeen = seen;
  if (older) {
    // A pass of a class removed here stays removed; one this version has, or a new one, comes in.
    const classIds = new Set(account.classes.map((cls) => cls.id));
    foldPasses(older.passes.filter((pass) => classIds.has(pass.classId)));
    // Only Requests new in the older tab since last time: one answered here doesn't come back.
    const seenBefore = new Set(account.legacyRequestIds ?? []);
    const known = new Set([...account.requests, ...account.deniedRequests].map((request) => request.id));
    for (const request of older.requests) {
      if (!known.has(request.id) && !seenBefore.has(request.id) && classIds.has(request.classId)) account.requests.push(request);
    }
    account.legacyRequestIds = older.requests.map((request) => request.id);
  }
  save();
}

if (typeof window !== 'undefined') queueMicrotask(foldLegacy);

export function findClass(id: string | null | undefined) {
  return account.classes.find((cls) => cls.id === id);
}

export function classPasses(classId: string) {
  return account.passes.filter((pass) => pass.classId === classId);
}

export function openPasses(classId?: string) {
  return account.passes.filter((pass) => !pass.inAt && (!classId || pass.classId === classId));
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

export function createClass(name: string) {
  const cls: Class = {
    id: newId(),
    name,
    members: [],
    createdAt: now(),
  };
  account.classes.push(cls);
  if (!account.activeClass) account.activeClass = { id: cls.id, changedAt: now() };
  refreshRoom();
  save();
  return cls.id;
}

export function updateClass(id: string, changes: Partial<Pick<Class, 'name'>>) {
  const cls = findClass(id);
  if (!cls) return;
  Object.assign(cls, changes);
  save();
}

/**
 * The teacher's classes are listed in the order they're saved, everywhere:
 * the sidebar, Home, History, the schedule and the kiosk. Moving one here
 * moves it in all of them.
 */
export function moveClass(id: string, toIndex: number) {
  const fromIndex = account.classes.findIndex((cls) => cls.id === id);
  const to = Math.max(0, Math.min(account.classes.length - 1, toIndex));
  if (fromIndex === -1 || fromIndex === to) return;
  const [cls] = account.classes.splice(fromIndex, 1);
  account.classes.splice(to, 0, cls);
  save();
}

/**
 * Deleting a class deletes its history too. The page asks before calling
 * this. Its periods stay, with no class in them.
 */
export function deleteClass(id: string) {
  account.classes = account.classes.filter((cls) => cls.id !== id);
  account.passes = account.passes.filter((pass) => pass.classId !== id);
  forgetUnusedStudents();
  for (const schedule of account.schedules) {
    for (const period of schedule.periods) {
      if (period.classId !== id) continue;
      period.classId = null;
      delete period.noPass;
    }
  }
  if (account.activeClass?.onSchedule) {
    account.activeClass = { id: scheduledClassAt(currentSchedule()), changedAt: now(), onSchedule: true };
  } else if (account.activeClass?.id === id) {
    const next = account.classes[0];
    account.activeClass = next ? { id: next.id, changedAt: now() } : null;
  }
  refreshRoom();
  save();
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

/** The schedule the teacher last picked, if they have any. */
export function currentSchedule(): Schedule | undefined {
  return account.schedules.find((schedule) => schedule.id === account.currentScheduleId) ?? account.schedules[0];
}

/** The schedule the kiosk is following right now, if any. */
export function liveSchedule() {
  return account.activeClass?.onSchedule ? currentSchedule() : undefined;
}

export function findSchedule(id: string) {
  return account.schedules.find((schedule) => schedule.id === id);
}

/** A brand-new, empty schedule. Returns its id. */
export function addSchedule(name: string) {
  const schedule = blankSchedule(newId(), name);
  account.schedules.push(schedule);
  save();
  return schedule.id;
}

/** A copy of a schedule with all its periods and No-Pass Times, quickest way to make B Day from A Day. */
export function duplicateSchedule(id: string) {
  const original = findSchedule(id);
  if (!original) return id;
  const copy: Schedule = {
    ...$state.snapshot(original),
    id: newId(),
    name: `${original.name} (copy)`,
  };
  for (const each of [...copy.periods, ...copy.noPassTimes]) each.id = newId();
  account.schedules.push(copy);
  save();
  return copy.id;
}

/** Replaces a schedule with an edited copy. On Schedule, the kiosk follows the change. */
export function saveSchedule(schedule: Schedule) {
  const index = account.schedules.findIndex((each) => each.id === schedule.id);
  if (index === -1) return;
  account.schedules[index] = schedule;
  if (schedule.id === account.currentScheduleId) followSchedule();
  save();
}

/** Deleting the schedule the kiosk follows takes the kiosk off schedule, on the class it has now. */
export function deleteSchedule(id: string) {
  if (liveSchedule()?.id === id) stopFollowingSchedule();
  account.schedules = account.schedules.filter((schedule) => schedule.id !== id);
  if (account.currentScheduleId === id) account.currentScheduleId = account.schedules[0]?.id ?? null;
  save();
}

/** Off schedule: the kiosk keeps the class it has, and the teacher changes it by hand. */
export function stopFollowingSchedule() {
  const active = account.activeClass;
  if (!active?.onSchedule) return;
  setActiveClass({ id: active.id, changedAt: now() });
}

/** The class a schedule would put on the kiosk right now. */
export function classScheduledNow(scheduleId = account.currentScheduleId) {
  return scheduledClassAt(scheduleId ? findSchedule(scheduleId) : undefined);
}

/**
 * Picks a schedule and puts the kiosk On Schedule, at whatever period the
 * clock is in now, not wherever the teacher left off.
 */
export function useSchedule(id: string) {
  if (!findSchedule(id)) return;
  account.currentScheduleId = id;
  setActiveClass({ id: classScheduledNow(id), changedAt: now(), onSchedule: true });
}

/**
 * On Schedule, moves the kiosk to whatever class the clock says, ending
 * passes still open in the class it leaves. The device acting as the kiosk
 * calls this as the clock ticks. Returns whether anything changed; the caller saves.
 */
function followSchedule() {
  const active = account.activeClass;
  if (!active?.onSchedule) return false;
  const id = scheduledClassAt(currentSchedule());
  if (id === active.id) return false;
  moveActiveClass({ id, changedAt: now(), onSchedule: true });
  return true;
}

/** Called regularly on the teacher's computer, which keeps the door to the schedule. */
export function keepToSchedule() {
  if (followSchedule()) save();
}

/** Stops passes by hand, any time, until the teacher opens them again, whatever class comes on. */
export function startNoPassTime() {
  account.manualNoPass = { classId: account.activeClass?.id ?? null, startedAt: now() };
  save();
}

export function endNoPassTime() {
  account.manualNoPass = null;
  save();
}

/** The class on the kiosk, as the teacher should read it. */
export function activeClassLabel() {
  const active = account.activeClass;
  if (active?.onSchedule && !active.id) return 'No class right now';
  return findClass(active?.id)?.name ?? 'No class chosen';
}

/**
 * Whether students may leave right now, in a word: passes are open, it's a
 * No-Pass Time, it's between periods, or no class is on the kiosk.
 */
export type PassStatus = 'open' | 'no-pass' | 'between' | 'no-class';

export function passStatus(at = Date.now()): PassStatus {
  const active = account.activeClass;
  // Stopped by hand, it's "no passes" whatever else is going on: that's what the teacher chose.
  if (account.manualNoPass) return 'no-pass';
  if (!active?.id) return active?.onSchedule ? 'between' : 'no-class';
  return noPassNow(active.id, at) ? 'no-pass' : 'open';
}

export const passStatusText: Record<PassStatus, string> = {
  open: 'Passes open',
  'no-pass': 'No passes',
  between: 'Between classes',
  'no-class': 'No class',
};

/** Each status's icon, for the badge on Home and the corner of the sidebar box. */
export const passStatusIcon: Record<PassStatus, IconName> = {
  open: 'door',
  'no-pass': 'ban',
  between: 'pause',
  'no-class': 'circle-slash',
};

/** Whose passes picking a schedule would end, when it moves the kiosk to another class. */
export function useWarning(scheduleId: string) {
  const leaving = findClass(account.activeClass?.id);
  if (!leaving || classScheduledNow(scheduleId) === leaving.id) return null;
  const out = openPasses(leaving.id).length;
  if (!out) return null;
  return `The kiosk will move from ${leaving.name} now. ${out} ${out === 1 ? 'student is' : 'students are'} still out there; their passes will end with an unknown return time.`;
}

/** What decides No-Pass Time, as the laptop knows it. */
function noPassSources() {
  return { schedule: currentSchedule(), activeClass: account.activeClass, manualNoPass: account.manualNoPass };
}

/** The No-Pass Time a class is in right now, if it's on the kiosk and in one. */
export function noPassNow(classId: string, at = Date.now()) {
  return account.activeClass?.id === classId ? noPassAt(noPassSources(), classId, at) : null;
}

/**
 * What the teacher should know before moving the kiosk by hand: that it takes
 * them off schedule, and whose passes it ends. Null when there's nothing to say.
 */
export function moveWarning(toClassId: string) {
  const warnings: string[] = [];
  if (account.activeClass?.onSchedule) {
    warnings.push(
      "This takes the kiosk off your schedule. It won't switch classes or keep your scheduled no-pass times until you turn the schedule back on.",
    );
  }
  const leaving = findClass(account.activeClass?.id);
  const out = leaving && leaving.id !== toClassId ? openPasses(leaving.id).length : 0;
  if (leaving && out) {
    warnings.push(
      `${out} ${out === 1 ? 'student is' : 'students are'} still out in ${leaving.name}. Their passes will end with an unknown return time.`,
    );
  }
  return warnings.length ? warnings.join(' ') : null;
}

// ---------------------------------------------------------------------------
// Pass Options and the Line
// ---------------------------------------------------------------------------

/**
 * Switching between a limit on each destination and one Class Limit keeps the
 * other way's numbers, so switching back finds them as they were.
 */
export function setPassOptions(options: Partial<Pick<Account, 'lineEnabled' | 'limitMode' | 'classLimit'>>) {
  Object.assign(account, options);
  if (account.lineEnabled === false) account.line = [];
  save();
}

/**
 * Changing the number never resets anyone's count. Switching to "until I reset
 * it" starts counting from now, as pressing Reset does.
 */
export function setPassAllowance(changes: Partial<Omit<PassAllowance, 'since'>>) {
  const startsCounting = changes.per === 'reset' && account.passAllowance.per !== 'reset';
  Object.assign(account.passAllowance, changes);
  if (startsCounting) account.passAllowance.since = now();
  save();
}

/** Starts a fresh count for every student in every class, say at the start of a quarter. */
export function resetPassAllowance() {
  account.passAllowance.since = now();
  save();
}

/** The teacher's computer keeps every Line. See docs/adr/0014. */
export function setLine(line: LineSpot[]) {
  account.line = line;
  save();
}

// ---------------------------------------------------------------------------
// Destinations
// ---------------------------------------------------------------------------

export function saveDestination(destination: Destination) {
  const index = account.destinations.findIndex((each) => each.id === destination.id);
  if (index === -1) account.destinations.push(destination);
  else account.destinations[index] = destination;
  save();
}

/**
 * Destinations are listed in the order they're saved, everywhere: here, on
 * the kiosk and on students' devices. Moving one here moves it in all of them.
 */
export function moveDestination(id: string, toIndex: number) {
  const fromIndex = account.destinations.findIndex((each) => each.id === id);
  const to = Math.max(0, Math.min(account.destinations.length - 1, toIndex));
  if (fromIndex === -1 || fromIndex === to) return;
  const [destination] = account.destinations.splice(fromIndex, 1);
  account.destinations.splice(to, 0, destination);
  save();
}

/** Past passes keep the name, so removing a destination never rewrites history. */
export function deleteDestination(id: string) {
  account.destinations = account.destinations.filter((each) => each.id !== id);
  save();
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

export function findStudent(id: string | undefined) {
  return account.roster.find((student) => student.id === id);
}

/** A class's students, each as they are in that class. */
export function classStudents(cls: Class | undefined): ClassStudent[] {
  return (cls?.members ?? []).flatMap((member) => {
    const student = findStudent(member.studentId);
    return student ? [{ ...student, lastPrefix: member.lastPrefix, status: member.status }] : [];
  });
}

/** One student as they are in one class. */
export function classStudent(classId: string, studentId: string) {
  return classStudents(findClass(classId)).find((student) => student.id === studentId);
}

function memberOf(classId: string, studentId: string) {
  return findClass(classId)?.members.find((member) => member.studentId === studentId);
}

/** The names of the classes a student is in right now. */
export function classesOf(studentId: string) {
  return account.classes
    .filter((cls) => cls.members.some((member) => member.studentId === studentId && member.status === 'current'))
    .map((cls) => cls.name);
}

/**
 * Students already on the Roster but not in this class, for an import to
 * recognise. All that is known of a student imported before full names were
 * kept is the prefix shown in one of their classes.
 */
export function rosterCandidates(classId: string): RosterCandidate[] {
  const cls = findClass(classId);
  return account.roster
    .filter((student) => !cls?.members.some((member) => member.studentId === student.id))
    .map((student) => ({
      student,
      prefix: account.classes.flatMap((each) => each.members).find((member) => member.studentId === student.id)?.lastPrefix ?? '',
      classes: classesOf(student.id),
    }));
}

/**
 * Saves an import. A student who already has a PIN or a last name keeps it:
 * the list only fills in what's missing, and a different PIN is used only for
 * the students in `acceptPins`, whom the teacher confirmed.
 */
export function applyImport(classId: string, plan: ImportPlan, removeIds: string[], acceptPins: Set<string> = new Set()) {
  const cls = findClass(classId);
  if (!cls || plan.error) return;
  const setPin = (student: Student, pin: string | undefined) => {
    if (pin && (!student.pin || acceptPins.has(student.id))) student.pin = pin;
  };
  for (const change of plan.matched) {
    const member = cls.members.find((each) => each.studentId === change.student.id);
    const student = findStudent(change.student.id);
    if (member) member.lastPrefix = change.lastPrefix;
    // Pasting a class list again fills in the full names of students imported before they were kept.
    if (student && change.lastName && !student.lastName) student.lastName = change.lastName;
    if (student) setPin(student, change.pin);
  }
  const joined = new Set(cls.members.map((member) => member.studentId));
  const newStudentIds = new Set<string>();
  for (const entry of plan.added) {
    let student = entry.rosterMatch ? findStudent(entry.rosterMatch.studentId) : undefined;
    // Never two places in one class for one student.
    if (student && joined.has(student.id)) student = undefined;
    if (student) {
      if (entry.lastName && !student.lastName) student.lastName = entry.lastName;
      setPin(student, entry.pin);
    } else {
      student = { id: newId(), firstName: entry.firstName };
      if (entry.lastName) student.lastName = entry.lastName;
      if (entry.pin) student.pin = entry.pin;
      account.roster.push(student);
      newStudentIds.add(student.id);
    }
    joined.add(student.id);
    cls.members.push({ studentId: student.id, lastPrefix: entry.lastPrefix, status: 'current' });
  }
  for (const id of removeIds) removeStudentFrom(cls, id);
  // Only students new to the Roster get a PIN; students who had none before stay without one until the teacher asks.
  if (account.studentPins) giveEveryonePins(newStudentIds);
  save();
}

/**
 * Hands a random PIN to every student on the Roster who has none, unique on
 * the Roster and never the teacher's.
 */
function giveEveryonePins(only?: Set<string>) {
  const taken = new Set([account.pin, ...account.roster.flatMap((student) => (student.pin ? [student.pin] : []))]);
  for (const student of account.roster) {
    if (student.pin || (only && !only.has(student.id))) continue;
    student.pin = randomPin(taken);
    taken.add(student.pin);
  }
}

/**
 * Turns PINs on or off for every class: at the kiosk, and for setting up a
 * device on the Student link. Turning them on gives a PIN to anyone without
 * one; turning them off stops every device acting as a student, since a Claim
 * needs a PIN. See docs/adr/0016.
 */
export function setStudentPins(on: boolean) {
  account.studentPins = on || undefined;
  if (on) giveEveryonePins();
  else account.claims = [];
  save();
}

/** The caller has already checked the PIN with pinProblem(). A student has one PIN in every class. */
export function setStudentPin(studentId: string, pin: string) {
  const student = findStudent(studentId);
  if (!student) return;
  student.pin = pin;
  save();
}

/** Whether any student on the Roster has this PIN, so the teacher doesn't choose it as their own. */
export function isStudentPin(pin: string) {
  return account.roster.some((student) => student.pin === pin);
}

/** The first name and full last name belong to the student; the letters shown belong to this class. */
export function renameStudent(classId: string, studentId: string, firstName: string, lastPrefix: string, lastName?: string) {
  const student = findStudent(studentId);
  const member = memberOf(classId, studentId);
  if (!student || !member) return;
  student.firstName = firstName;
  if (lastName !== undefined) student.lastName = lastName || undefined;
  member.lastPrefix = lastPrefix;
  save();
}

/**
 * A student with history in this class becomes a Former Student of it, so the
 * class's record stays whole; they stay in any other class. One who is out
 * right now from this class has that pass ended with an unknown return.
 */
function removeStudentFrom(cls: Class, studentId: string) {
  const open = account.passes.filter((pass) => pass.studentId === studentId && pass.classId === cls.id && !pass.inAt);
  mergeInto(account.passes, open.map((pass) => endUnseen(pass, 'removed')));
  // Passes and Attendance are both history: a student with either stays, as a former student.
  const hasHistory =
    account.passes.some((pass) => pass.studentId === studentId && pass.classId === cls.id) ||
    account.attendance.some((mark) => mark.studentId === studentId && mark.classId === cls.id);
  if (hasHistory) {
    const member = cls.members.find((each) => each.studentId === studentId);
    if (member) member.status = 'former';
  } else {
    cls.members = cls.members.filter((each) => each.studentId !== studentId);
  }
  forgetUnusedStudents();
}

/** A student in no class, with no passes or Attendance anywhere, leaves the Roster. */
function forgetUnusedStudents() {
  account.roster = account.roster.filter(
    (student) =>
      account.classes.some((cls) => cls.members.some((member) => member.studentId === student.id)) ||
      account.passes.some((pass) => pass.studentId === student.id) ||
      account.attendance.some((mark) => mark.studentId === student.id),
  );
}

export function removeStudent(classId: string, studentId: string) {
  const cls = findClass(classId);
  if (!cls) return;
  removeStudentFrom(cls, studentId);
  save();
}

/** Exempt belongs to the student, so it applies in every class they're in. */
export function setExempt(studentId: string, exempt: boolean) {
  const student = findStudent(studentId);
  if (!student) return;
  student.exempt = exempt || undefined;
  save();
}

/** An Always-Go Student is never held back by any rule, in any of their classes. See docs/adr/0011. */
export function setAlwaysGo(studentId: string, alwaysGo: boolean) {
  const student = findStudent(studentId);
  if (!student) return;
  student.alwaysGo = alwaysGo || undefined;
  save();
}

export function restoreStudent(classId: string, studentId: string) {
  const cls = findClass(classId);
  const member = memberOf(classId, studentId);
  if (!cls || !member) return;
  member.status = 'current';
  if (account.studentPins) giveEveryonePins(new Set([studentId]));
  save();
}

/**
 * Makes two Roster entries one child: everything of `dropId` (their classes,
 * passes, place in a Line, Requests) becomes `keepId`'s. Only offered for
 * students never in the same class. See docs/adr/0015.
 */
/**
 * Two students who are one child become one: the kept student takes the other's
 * classes, passes, Line spots, Requests, Attendance and Claims. `pinFrom` says
 * whose PIN to keep when both have one. The merge is recorded so it can be
 * undone, and the merged-away id is remembered so a kiosk that missed it can't
 * bring that student back.
 */
export function mergeStudents(keepId: string, dropId: string, pinFrom: string = keepId) {
  const keep = findStudent(keepId);
  const drop = findStudent(dropId);
  if (!keep || !drop || keepId === dropId) return;
  const record: MergeRecord = {
    id: newId(),
    at: now(),
    keep: $state.snapshot(keep) as Student,
    drop: $state.snapshot(drop) as Student,
    memberships: [],
    keepClassIds: account.classes.filter((cls) => cls.members.some((each) => each.studentId === keepId)).map((cls) => cls.id),
    passIds: [],
    requestIds: [],
    deniedIds: [],
    attendanceIds: [],
    removedMarks: [],
    removedClaims: [],
  };
  for (const cls of account.classes) {
    const member = cls.members.find((each) => each.studentId === dropId);
    if (!member) continue;
    record.memberships.push({ classId: cls.id, member: $state.snapshot(member) as Member });
    if (cls.members.some((each) => each.studentId === keepId)) cls.members = cls.members.filter((each) => each !== member);
    else member.studentId = keepId;
  }
  const moved = now();
  for (const pass of account.passes) {
    if (pass.studentId !== dropId) continue;
    pass.studentId = keepId;
    pass.updatedAt = moved;
    record.passIds.push(pass.id);
  }
  // The Line lasts minutes, so a spot just moves to the kept student and isn't undone.
  for (const spot of account.line) if (spot.studentId === dropId) spot.studentId = keepId;
  for (const each of account.requests) if (each.studentId === dropId) (each.studentId = keepId), record.requestIds.push(each.id);
  for (const each of account.deniedRequests) if (each.studentId === dropId) (each.studentId = keepId), record.deniedIds.push(each.id);
  // One mark per class and day: where the kept student already has one, theirs stands.
  for (const mark of [...account.attendance]) {
    if (mark.studentId !== dropId) continue;
    if (attendanceMark(mark.classId, keepId, mark.day)) {
      record.removedMarks.push($state.snapshot(mark) as AttendanceMark);
      account.attendance = account.attendance.filter((each) => each !== mark);
    } else {
      mark.studentId = keepId;
      mark.id = markId(mark.classId, mark.day, keepId);
      mark.updatedAt = moved;
      record.attendanceIds.push(mark.id);
    }
  }
  // One device per student: the merged-away student's devices stop acting for anyone.
  record.removedClaims = account.claims.filter((claim) => claim.studentId === dropId).map((claim) => ({ ...claim }));
  account.claims = account.claims.filter((claim) => claim.studentId !== dropId);
  keep.lastName ??= drop.lastName;
  if (pinFrom === dropId && drop.pin) keep.pin = drop.pin;
  else keep.pin ??= drop.pin;
  if (drop.exempt) keep.exempt = true;
  if (drop.alwaysGo) keep.alwaysGo = true;
  account.roster = account.roster.filter((student) => student.id !== dropId);
  account.mergedIds = { ...account.mergedIds, [dropId]: keepId };
  account.merges = [...(account.merges ?? []), record].slice(-20);
  save();
}

/** Puts two merged students back as they were. Anything that happened since stays with the kept student. */
export function undoMerge(recordId: string) {
  const record = account.merges?.find((each) => each.id === recordId);
  if (!record) return;
  const keep = findStudent(record.keep.id);
  if (keep) Object.assign(keep, { lastName: record.keep.lastName, pin: record.keep.pin, exempt: record.keep.exempt, alwaysGo: record.keep.alwaysGo });
  if (!findStudent(record.drop.id)) account.roster.push(record.drop);
  for (const { classId, member } of record.memberships) {
    const cls = findClass(classId);
    if (!cls) continue;
    if (record.keepClassIds.includes(classId)) {
      // Both were in this class; the merged-away student's place was removed, so it comes back.
      cls.members.push(member);
    } else {
      // Only the merged-away student was; the kept student's place here was theirs.
      const theirs = cls.members.find((each) => each.studentId === record.keep.id);
      if (theirs) Object.assign(theirs, member);
      else cls.members.push(member);
    }
  }
  const back = (ids: string[], list: { id: string; studentId: string; updatedAt?: string }[]) => {
    for (const each of list) {
      if (!ids.includes(each.id)) continue;
      each.studentId = record.drop.id;
      if ('updatedAt' in each) each.updatedAt = now();
    }
  };
  back(record.passIds, account.passes);
  back(record.requestIds, account.requests);
  back(record.deniedIds, account.deniedRequests);
  for (const mark of account.attendance) {
    if (!record.attendanceIds.includes(mark.id)) continue;
    mark.studentId = record.drop.id;
    mark.id = markId(mark.classId, mark.day, record.drop.id);
    mark.updatedAt = now();
  }
  account.attendance.push(...record.removedMarks);
  account.claims.push(...record.removedClaims.filter((claim) => !account.claims.some((each) => each.token === claim.token)));
  if (account.mergedIds) {
    const { [record.drop.id]: _undone, ...rest } = account.mergedIds;
    account.mergedIds = rest;
  }
  account.merges = account.merges!.filter((each) => each.id !== recordId);
  save();
}

/** The teacher said these two are different students: never offer them again. */
export function dismissMerge(firstId: string, secondId: string) {
  const key = [firstId, secondId].sort().join('|');
  account.dismissedMerges = [...new Set([...(account.dismissedMerges ?? []), key])];
  save();
}

/** The teacher has seen the offer to merge students who may be one child. */
export function dismissRosterMerge() {
  account.rosterMergeSeen = true;
  save();
}

// ---------------------------------------------------------------------------
// What students can see (docs/adr/0022)
// ---------------------------------------------------------------------------

/** What students can see in a class: everything, unless the teacher turned something off. */
export function visibilityOf(cls: { visibility?: Partial<ClassVisibility> } | null | undefined): ClassVisibility {
  return { names: true, where: true, lineNames: true, ...cls?.visibility };
}

export function setVisibility(classId: string, key: keyof ClassVisibility, on: boolean) {
  const cls = findClass(classId);
  if (!cls) return;
  const next = { ...cls.visibility };
  if (on) delete next[key];
  else next[key] = false;
  if (Object.keys(next).length) cls.visibility = next;
  else delete cls.visibility;
  save();
}

// ---------------------------------------------------------------------------
// Attendance (docs/adr/0020)
// ---------------------------------------------------------------------------

/** Turns Attendance on (with these options) or off, for every class. */
export function setAttendance(options: AttendanceOptions | null) {
  if (options) account.attendanceRules = options;
  else delete account.attendanceRules;
  save();
}

export function attendanceMark(classId: string, studentId: string, day = today()) {
  return account.attendance.find((mark) => mark.classId === classId && mark.studentId === studentId && mark.day === day);
}

/** Today's marks for a class. */
export function attendanceToday(classId: string) {
  const day = today();
  return account.attendance.filter((mark) => mark.classId === classId && mark.day === day);
}

/** Whether a student is Absent from a class today, and so hidden from the door. */
export function isAbsent(classId: string, studentId: string) {
  return attendanceMark(classId, studentId)?.status === 'absent';
}

/** One mark per student, class and day, so its id is just those. Saved marks carry no id of their own. */
function markId(classId: string, day: string, studentId: string) {
  return `${classId}|${day}|${studentId}`;
}

function newMark(classId: string, studentId: string, day: string): AttendanceMark {
  const student = classStudent(classId, studentId);
  const mark: AttendanceMark = {
    id: markId(classId, day, studentId),
    classId,
    studentId,
    studentName: student ? displayName(student) : '',
    day,
    status: 'absent',
    updatedAt: now(),
  };
  account.attendance.push(mark);
  return mark;
}

/** When a class's Absent clock started today: its period's start on the Schedule, or when it came on the door. */
function absentClockStart(classId: string, at: number) {
  const period = account.activeClass?.onSchedule ? periodFor(currentSchedule(), classId, at) : null;
  if (period) return { start: new Date(new Date(at).setHours(...(period.start.split(':').map(Number) as [number, number]), 0, 0)).getTime(), period };
  return { start: new Date(account.activeClass?.changedAt ?? at).getTime(), period: null };
}

/**
 * An Arrival: at the kiosk, or by the teacher. It counts as Tardy after the
 * period's start plus grace; a student already marked Absent who arrives is
 * Tardy. Only the first Arrival counts. Returns whether anything changed; the
 * caller saves.
 */
function arrive(classId: string, studentId: string, at: string, byTeacher: boolean) {
  const rules = account.attendanceRules;
  if (!findClass(classId) || !rules) return false;
  const existing = attendanceMark(classId, studentId, today(at));
  if (existing?.arrivedAt) return false;
  const counted = arrivalStatus(currentSchedule(), classId, rules, at);
  const mark = existing ?? newMark(classId, studentId, today(at));
  mark.arrivedAt = at;
  if (existing?.status === 'absent') {
    // Arriving after being marked Absent is always Tardy.
    const { start } = absentClockStart(classId, new Date(at).getTime());
    mark.status = 'tardy';
    mark.tardyMinutes = counted.status === 'tardy' ? counted.tardyMinutes : Math.max(0, Math.round((new Date(at).getTime() - start) / 60_000));
    delete mark.goneForDay;
  } else {
    mark.status = counted.status;
    if (counted.status === 'tardy') mark.tardyMinutes = counted.tardyMinutes;
  }
  if (byTeacher && existing) mark.corrected = true;
  mark.updatedAt = now();
  return true;
}

/** A student tapped in at the kiosk (or a disconnected kiosk handed over their tap). */
export function recordArrival(classId: string, studentId: string, at = now()) {
  if (arrive(classId, studentId, at, false)) save();
}

export function receiveArrivals(arrivals: OfflineArrival[]) {
  let changed = false;
  for (const each of arrivals) {
    const studentId = keptStudentId(each.studentId);
    // A mark the teacher set by hand stands over a kiosk's late hand-over.
    if (attendanceMark(each.classId, studentId, today(each.at))?.corrected) continue;
    changed = arrive(each.classId, studentId, each.at, false) || changed;
  }
  if (changed) save();
}

/**
 * The teacher marks a student by hand: arrived now, Tardy, Absent, or back to
 * nothing yet. Changing a mark that was already there is a Correction.
 */
export function markAttendance(classId: string, studentId: string, status: 'present' | 'tardy' | 'absent' | 'clear') {
  const day = today();
  const existing = attendanceMark(classId, studentId, day);
  if (status === 'clear') {
    account.attendance = account.attendance.filter((mark) => mark !== existing);
    save();
    return;
  }
  // Arriving after being marked Absent is a late Arrival, so Tardy.
  if (status === 'present' && existing?.status === 'absent' && arrive(classId, studentId, now(), true)) {
    save();
    return;
  }
  if (!existing && status !== 'absent' && arrive(classId, studentId, now(), true)) {
    const mark = attendanceMark(classId, studentId, day)!;
    if (status === 'tardy' && mark.status !== 'tardy') mark.status = 'tardy';
    if (status === 'present' && mark.status !== 'present') {
      mark.status = 'present';
      delete mark.tardyMinutes;
    }
    save();
    return;
  }
  const mark = existing ?? newMark(classId, studentId, day);
  mark.status = status;
  if (status === 'present') delete mark.tardyMinutes;
  if (status !== 'tardy') delete mark.excused;
  if (status === 'absent') delete mark.arrivedAt;
  if (status !== 'absent') mark.arrivedAt ??= now();
  if (existing) mark.corrected = true;
  mark.updatedAt = now();
  save();
}

export function setExcused(markId: string, excused: boolean) {
  const mark = account.attendance.find((each) => each.id === markId);
  if (!mark || mark.status !== 'tardy') return;
  mark.excused = excused || undefined;
  mark.corrected = true;
  mark.updatedAt = now();
  save();
}

/**
 * "Gone for the day": Absent in the teacher's classes still to come today, and
 * in the class on now if they haven't arrived in it. With a Schedule, "still to
 * come" means periods that haven't started; without one, every other class
 * taking Attendance that has no mark for them yet.
 */
export function goneForTheDay(studentId: string) {
  const day = today();
  const clock = clockOf(Date.now());
  const schedule = currentSchedule();
  for (const cls of account.classes) {
    if (!account.attendanceRules || !cls.members.some((member) => member.studentId === studentId && member.status === 'current')) continue;
    const existing = attendanceMark(cls.id, studentId, day);
    if (existing?.arrivedAt) continue;
    const isOn = account.activeClass?.id === cls.id;
    const later = schedule
      ? schedule.periods.some((period) => period.classId === cls.id && period.start > clock)
      : !existing;
    if (!isOn && !later) continue;
    const mark = existing ?? newMark(cls.id, studentId, day);
    mark.status = 'absent';
    mark.goneForDay = true;
    mark.updatedAt = now();
  }
  save();
}

/**
 * Marks Absent every current student of the class on the door who hasn't
 * arrived, once its minutes have passed or its period has ended, whichever is
 * first. Only for a class that came on the door today (so a cancelled period
 * never marks a whole class absent). Returns whether anything changed.
 */
function markAbsences(at = Date.now(), leaving = false) {
  const active = account.activeClass;
  const cls = findClass(active?.id);
  const rules = account.attendanceRules;
  if (!active?.id || !cls || !rules || today(active.changedAt) !== today(at)) {
    // A class on the door since before today came on today when the day began, if it's on the Schedule today.
    if (!(active?.id && cls && rules && active.onSchedule && periodFor(currentSchedule(), active.id, at))) return false;
  }
  const { start, period } = absentClockStart(cls!.id, at);
  const due = start + rules!.absentAfterMinutes * 60_000;
  const ended = period ? at >= new Date(new Date(at).setHours(...(period.end.split(':').map(Number) as [number, number]), 0, 0)).getTime() : false;
  if (!(at >= due || ended || (leaving && (active!.onSchedule || at >= due)))) return false;
  const day = today(at);
  let changed = false;
  for (const member of cls!.members) {
    if (member.status !== 'current' || attendanceMark(cls!.id, member.studentId, day)) continue;
    newMark(cls!.id, member.studentId, day);
    changed = true;
  }
  return changed;
}

/** Called regularly on the teacher's computer, which decides Attendance like everything else at the door. */
export function keepAttendance() {
  if (markAbsences()) save();
}

// ---------------------------------------------------------------------------
// Passes
// ---------------------------------------------------------------------------

/** Every pass the door starts or ends is recorded here, on the teacher's computer. */
export function receivePasses(passes: Pass[]) {
  foldPasses(passes);
  save();
}

/** Takes in other copies of passes (a kiosk's, an older tab's), keeping everything the teacher changed here. */
function foldPasses(passes: Pass[]) {
  const before = new Map(account.passes.map((pass) => [pass.id, $state.snapshot(pass) as Pass]));
  // A kiosk that hasn't heard about a merge still has the merged-away student.
  mergeInto(account.passes, passes.map((pass) => ({ ...pass, studentId: keptStudentId(pass.studentId) })));
  for (const pass of account.passes) {
    const mine = before.get(pass.id);
    if (mine) keepTeacherEdits(pass, mine);
  }
}

/**
 * What only the teacher changes, on this computer, always beats a kiosk's
 * copy of the same pass, however new: their note, a cancel, a correction, and
 * which student it belongs to after a merge.
 */
function keepTeacherEdits(pass: Pass, mine: Pass) {
  if (mine.note !== undefined) pass.note = mine.note;
  else delete pass.note;
  pass.studentId = mine.studentId;
  pass.studentName = mine.studentName;
  if (mine.cancelledBy) {
    pass.cancelledBy = mine.cancelledBy;
    pass.endedBeforeCancel = mine.endedBeforeCancel;
    pass.endedBy = mine.endedBy;
    pass.inAt = mine.inAt;
  }
  if (mine.corrected) {
    pass.corrected = true;
    pass.outAt = mine.outAt;
    if (mine.inAt) {
      pass.inAt = mine.inAt;
      pass.endedBy = mine.endedBy;
    }
  }
  if (mine.updatedAt > pass.updatedAt) pass.updatedAt = mine.updatedAt;
}

/** The student a merged-away student became, or the same student. */
export function keptStudentId(studentId: string) {
  let id = studentId;
  for (let hops = 0; account.mergedIds?.[id] && hops < 10; hops++) id = account.mergedIds[id];
  return id;
}

/**
 * Students who signed back in at a kiosk that couldn't reach this computer.
 * When the teacher also marked them back, the earlier time wins.
 */
export function receiveReturns(returns: OfflineReturn[]) {
  for (const back of returns) {
    const pass = account.passes.find((each) => each.id === back.passId);
    if (!pass || (pass.inAt && pass.inAt <= back.inAt)) continue;
    // A cancel, or a return time the teacher set, stands; an open pass they corrected still takes the return.
    // Either way the kiosk is told it was received.
    if (pass.cancelledBy || (pass.corrected && pass.inAt)) continue;
    Object.assign(pass, { inAt: back.inAt, endedBy: 'student', updatedAt: now() });
  }
  save();
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** The teacher's computer keeps every waiting Request. See docs/adr/0014. */
export function setRequests(requests: PassRequest[]) {
  account.requests = requests;
  save();
}

/** The waiting Requests from the class on the kiosk, oldest first. */
export function waitingRequests() {
  return account.requests
    .filter((request) => request.classId === account.activeClass?.id)
    .sort((a, b) => a.askedAt.localeCompare(b.askedAt));
}

/** The teacher answered: the Request ends, and a "no" is kept for History. */
export function answered(request: PassRequest, approve: boolean) {
  account.requests = account.requests.filter((each) => each.id !== request.id);
  if (!approve) account.deniedRequests.push({ ...$state.snapshot(request), deniedAt: now() });
  save();
}

export function markReturned(passId: string) {
  const pass = account.passes.find((each) => each.id === passId);
  if (!pass || pass.inAt) return;
  const at = now();
  Object.assign(pass, { inAt: at, endedBy: 'teacher', updatedAt: at });
  save();
}

/**
 * Cancels a pass after the fact and gives it back, or counts it again. It's a
 * Correction (docs/adr/0006): the pass stays in History, marked, but a cancelled
 * one counts toward neither the Pass Allowance nor the numbers.
 */
export function cancelPass(passId: string, cancel: boolean) {
  const pass = account.passes.find((each) => each.id === passId);
  if (!pass) return;
  if (cancel && pass.cancelledBy !== 'teacher') {
    pass.endedBeforeCancel = pass.endedBy ?? 'teacher';
    pass.endedBy = 'cancelled';
    pass.cancelledBy = 'teacher';
    pass.inAt ??= now();
  } else if (!cancel && pass.cancelledBy === 'teacher') {
    pass.endedBy = pass.endedBeforeCancel ?? 'teacher';
    delete pass.cancelledBy;
    delete pass.endedBeforeCancel;
  } else return;
  pass.corrected = true;
  pass.updatedAt = now();
  save();
}

/** The teacher's note on a pass. A note isn't a Correction: it changes nothing about the trip. */
export function setPassNote(passId: string, note: string) {
  const pass = account.passes.find((each) => each.id === passId);
  if (!pass) return;
  const text = note.trim();
  if ((pass.note ?? '') === text) return;
  if (text) pass.note = text;
  else delete pass.note;
  pass.updatedAt = now();
  save();
}

/** A Correction changes the pass in place and marks it. See docs/adr/0006. */
export function correctPass(passId: string, changes: { student?: ClassStudent; outAt?: string; inAt?: string }) {
  const pass = account.passes.find((each) => each.id === passId);
  if (!pass) return;
  if (changes.student) {
    pass.studentId = changes.student.id;
    pass.studentName = displayName(changes.student);
  }
  if (changes.outAt) pass.outAt = changes.outAt;
  if (changes.inAt) {
    pass.inAt = changes.inAt;
    pass.endedBy ??= 'teacher';
  }
  pass.corrected = true;
  pass.updatedAt = now();
  save();
}

// ---------------------------------------------------------------------------
// The kiosk
// ---------------------------------------------------------------------------

/**
 * Moves the kiosk to another class (or, between periods, to none). Every pass
 * still open in the class being left ends with an unknown return: those
 * students are no longer in front of the door screen that could sign them
 * back in. Moving it by hand takes the teacher off schedule; pass
 * `onSchedule` when the schedule moved it.
 */
export function setActiveClass(activeClass: ActiveClass) {
  if (account.activeClass && account.activeClass.changedAt >= activeClass.changedAt) return;
  moveActiveClass(activeClass);
  save();
}

function moveActiveClass(activeClass: ActiveClass) {
  const leaving = account.activeClass?.id;
  // The class ending: anyone who never arrived is Absent (docs/adr/0020).
  if (leaving && leaving !== activeClass.id) markAbsences(Date.now(), true);
  if (leaving && leaving !== activeClass.id) {
    mergeInto(account.passes, openPasses(leaving).map((pass) => endUnseen(pass, 'switch')));
  }
  account.activeClass = activeClass;
  refreshRoom();
  if (leaving !== activeClass.id) {
    // The Line and Requests belong to the class at the door; a new class starts with none.
    account.line = [];
    account.requests = [];
    // A No-Pass Time started by hand carries on into the new class.
    if (account.manualNoPass) account.manualNoPass.classId = activeClass.id;
  }
}

export function setOverdueChime(on: boolean) {
  account.overdueChime = on || undefined;
  save();
}

export function setPin(pin: string) {
  account.pin = pin;
  save();
}

export function useThisComputer() {
  retireDevice();
  account.kiosk = { kind: 'this-computer', locked: false };
  save();
}

export function setDoorLocked(locked: boolean) {
  if (account.kiosk?.kind !== 'this-computer') return;
  account.kiosk.locked = locked;
  save();
}

export function pairDevice(kioskId: string, secret: string) {
  retireDevice();
  account.kiosk = { kind: 'device', kioskId, secret, pairedAt: now() };
  account.networkBlocked = false;
  save();
}

/** A replaced device may still be holding passes; it is allowed to hand them over once. */
function retireDevice() {
  if (account.kiosk?.kind === 'device') {
    account.replacedKiosks.push({ kioskId: account.kiosk.kioskId, secret: account.kiosk.secret });
  }
}

export function forgetReplacedKiosk(kioskId: string) {
  account.replacedKiosks = account.replacedKiosks.filter((each) => each.kioskId !== kioskId);
  save();
}

export function removeKiosk() {
  retireDevice();
  account.kiosk = null;
  save();
}

export function markKioskSeen() {
  if (account.kiosk?.kind !== 'device') return;
  account.kiosk.lastSeenAt = now();
  write();
}

export function setNetworkBlocked(blocked: boolean) {
  account.networkBlocked = blocked;
  save();
}

/** A Room code: six digits, never starting with 0. */
function newRoomCode() {
  return String(100_000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900_000));
}

/**
 * Keeps the Room matching the class on the door: each class period has its
 * own Room and code, and there is none between classes. A new Room ends every Claim, so students check in to each class
 * again. See docs/adr/0019.
 */
function refreshRoom() {
  const link = account.studentLink;
  const classId = account.activeClass?.id;
  if (!link) return;
  // Closing the link for a moment keeps the Room: opening it again in the same class brings the same code back.
  if (!classId) {
    if (link.room) account.claims = [];
    link.room = null;
    return;
  }
  if (link.room?.classId === classId) return;
  link.room = { code: newRoomCode(), classId, startedAt: now() };
  account.claims = [];
}

/** Opens or closes the Student link. Opening it during a class starts that class's Room. */
export function setStudentLink(open: boolean) {
  account.studentLink = { open, room: account.studentLink?.room ?? null };
  refreshRoom();
  save();
}

/**
 * A new code for the class on now: the old one stops working at once, and
 * every device has to join again. Also used when another teacher's Room
 * happens to have the same code.
 */
export function newRoom() {
  const room = account.studentLink?.room;
  if (!room) return;
  room.code = newRoomCode();
  room.startedAt = now();
  account.claims = [];
  save();
}

// ---------------------------------------------------------------------------
// Claims on the Student link
// ---------------------------------------------------------------------------

export function findClaim(token: string | undefined) {
  return token ? account.claims.find((claim) => claim.token === token) : undefined;
}

/** Makes a device act as this student. A student has at most one claimed device, so any older Claim ends. */
export function addClaim(studentId: string) {
  const token = newId() + newId();
  account.claims = [...account.claims.filter((claim) => claim.studentId !== studentId), { token, studentId, claimedAt: now() }];
  save();
  return token;
}

export function endClaim(token: string) {
  account.claims = account.claims.filter((claim) => claim.token !== token);
  save();
}

export function endAllClaims() {
  account.claims = [];
  save();
}

/** Who has arrived today in the class on the door, if it takes Attendance. */
function arrivalsOnTheDoor() {
  const cls = findClass(account.activeClass?.id);
  if (!cls || !account.attendanceRules) return null;
  const marks = attendanceToday(cls.id);
  return {
    classId: cls.id,
    studentIds: marks.filter((mark) => mark.arrivedAt).map((mark) => mark.studentId),
    absentCount: marks.filter((mark) => mark.status === 'absent').length,
    pinsOn: !!account.studentPins,
  };
}

/** What the kiosk shows: the door as this computer decides it. */
export function doorSetup(): DoorSetup {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const since = today.toISOString();
  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  return $state.snapshot({
    protocol: doorProtocol,
    classes: account.classes.map((cls) => ({
      id: cls.id,
      name: cls.name,
      // An Absent student is hidden from the door (docs/adr/0020).
      students: classStudents(cls)
        .filter((student) => student.status === 'current' && !isAbsent(cls.id, student.id))
        .map((student) => ({
          id: student.id,
          name: displayName(student),
          exempt: skipsAllowance(student) || undefined,
          alwaysGo: student.alwaysGo,
          pin: account.studentPins ? student.pin : undefined,
        }))
        // A to Z by the name on the tile, so a student finds theirs quickly.
        .sort((a, b) => a.name.localeCompare(b.name)),
      ...(visibilityOf(cls).where ? {} : { hideWhere: true as const }),
      ...(visibilityOf(cls).lineNames ? {} : { hideLineNames: true as const }),
    })),
    destinations: account.limitMode === 'class' ? classLimitOnEachDestination() : account.destinations,
    lineEnabled: account.lineEnabled,
    limitMode: account.limitMode,
    classLimit: account.classLimit,
    passAllowance: account.passAllowance,
    countedPasses: account.passAllowance.enabled ? countedPasses() : [],
    activeClass: account.activeClass,
    schedule: currentSchedule(),
    manualNoPass: account.manualNoPass,
    pin: account.pin,
    ...forOlderKiosks(),
    passes: account.passes.filter((pass) => !pass.inAt || pass.outAt >= since),
    line: account.line,
    requests: account.requests,
    room: account.studentLink?.open && account.studentLink.room ? { code: account.studentLink.room.code } : null,
    arrivals: arrivalsOnTheDoor(),
    denied: account.deniedRequests
      .filter((request) => request.deniedAt >= minuteAgo)
      .map((request) => ({
        studentId: request.studentId,
        secondsAgo: Math.round((Date.now() - new Date(request.deniedAt).getTime()) / 1000),
      })),
  });
}

/**
 * A kiosk on the version before Class Limits, until it refreshes, knows only a
 * limit on each destination. Giving every destination that counts the Class
 * Limit is the closest it can come: the Nurse still never waits, though each
 * destination fills on its own rather than together. A kiosk on this version
 * reads `limitMode` and ignores these.
 */
function classLimitOnEachDestination() {
  return account.destinations.map((destination) => ({
    ...destination,
    limit: countsTowardClassLimit(destination) ? account.classLimit : null,
  }));
}

/**
 * A kiosk still on the version before per-destination limits enforces one
 * limit on everyone out at once: the Class Limit, if the teacher has one.
 * Otherwise the largest destination limit keeps it working as it did before
 * the update, until the teacher changes a destination or the kiosk refreshes.
 */
function forOlderKiosks() {
  if (account.limitMode === 'class') return { passLimit: account.classLimit };
  const limits = account.destinations.flatMap((destination) => (destination.limit === null ? [] : [destination.limit]));
  return { passLimit: limits.length ? Math.max(...limits) : 99 };
}

function countedPasses() {
  const since = windowStart(account.passAllowance).toISOString();
  return account.passes
    .filter((pass) => pass.outAt >= since && passCounts(pass))
    .map(({ id, classId, studentId, outAt }) => ({ id, classId, studentId, outAt }));
}

/** The teacher closed a Popup, so it won't show again. */
export function markPopupsSeen(ids: string[]) {
  for (const id of ids) account.seenPopups[id] ??= now();
  save();
}

// ---------------------------------------------------------------------------
// Export and import
// ---------------------------------------------------------------------------

export function exportAccount() {
  account.lastExportedAt = now();
  save();
  return JSON.stringify({ app: 'hallway', ...$state.snapshot(account) }, null, 2);
}

/**
 * Replaces everything in this browser with an exported file, including the
 * kiosk pairing, so the teacher is back exactly where they were.
 */
export function importAccount(text: string, own = true) {
  const parsed = JSON.parse(text);
  if (parsed?.app !== 'hallway' || typeof parsed.version !== 'number' || !Array.isArray(parsed.classes)) {
    throw new Error('That file is not a Happy Hallways backup.');
  }
  if (parsed.version > accountVersion) {
    throw new Error('That backup was made by a newer version of Happy Hallways. Reload this page to get the newest version, then try again.');
  }
  delete parsed.app;
  const restored = upgrade({ ...blankAccount(), ...fromOlderVersions, ...parsed });
  restored.version = accountVersion;
  if (!own) {
    // Someone else's backup: their classes and passes, but not their kiosk, laptop address, Room or students' devices.
    restored.laptopPeerId = `hallway-${newId()}`;
    restored.kiosk = null;
    restored.replacedKiosks = [];
    restored.studentLink = restored.studentLink ? { open: false, room: null } : null;
    restored.claims = [];
  }
  // Whatever this computer's older copy holds isn't part of the backup, so it's never folded into it.
  const legacy = localStorage.getItem(legacyKey);
  restored.legacySeen = legacy ? fingerprint(legacy) : undefined;
  restored.legacyRequestIds = legacy ? legacyRequestIdsOf(legacy) : undefined;
  unreadable.raw = null;
  localStorage.setItem(storageKey, storedText(restored));
}
