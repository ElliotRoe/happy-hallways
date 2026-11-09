import type { DestinationColor, DestinationIcon } from './destinations';

/**
 * One child on the teacher's Roster. The same child taught in two Classes is
 * one Student, so their passes, PIN and Claim follow them. See docs/adr/0015.
 */
export type Student = {
  id: string;
  firstName: string;
  /**
   * The full last name, kept only on the teacher's computer (docs/adr/0017). The kiosk and the
   * Student link only ever get the Display Name. Missing for students imported before full names were kept.
   */
  lastName?: string;
  /** An Exempt Student: the Pass Allowance never applies to them. They still wait for limits and No-Pass Time. */
  exempt?: boolean;
  /**
   * An Always-Go Student: no rule ever holds them back — not the Pass Allowance,
   * a Pass Limit, the Line or No-Pass Time. See docs/adr/0011.
   */
  alwaysGo?: boolean;
  /**
   * The student's PIN: 3 to 6 digits they type at the kiosk after tapping their
   * name, when their class asks for one. Never a real school ID. See docs/adr/0013.
   */
  pin?: string;
};

/** A Student's place in one Class. */
export type Member = {
  studentId: string;
  /** As many leading letters of the last name as it takes to be unique in this class. Never the whole name. */
  lastPrefix: string;
  /** A Former Student has left this class but keeps every trip they took, and stays in any other class. */
  status: 'current' | 'former';
};

/** A Student as they are in one Class: their Roster entry with their place in it. */
export type ClassStudent = Student & Omit<Member, 'studentId'>;

/**
 * A place a student may go. One list serves all the teacher's classes. A trip
 * with no expected minutes is never Overdue.
 */
export type Destination = {
  id: string;
  label: string;
  /** Minutes the trip should take, or null for no time limit. */
  minutes: number | null;
  color: DestinationColor;
  icon: DestinationIcon;
  /** Whether a trip here uses up the Pass Allowance. Missing means it does. */
  countsTowardAllowance?: boolean;
  /**
   * The Pass Limit: the most students here at once, or null for no limit (and
   * so no Line). Kept, but not used, while the teacher has a Class Limit.
   */
  limit: number | null;
  /** Whether a trip here takes one of the Class Limit's spots. Missing means it does. Only used with a Class Limit. */
  countsTowardClassLimit?: boolean;
  /**
   * A Private destination, like the Nurse or the Counselor: wherever students can
   * see, a trip here shows only as "Out", never where. It never has a Pass Limit
   * or a Line. The teacher always sees where. See docs/adr/0021.
   */
  private?: boolean;
};

/**
 * How the Pass Limit works: each destination has its own limit and Line, or
 * one Class Limit and one Line are shared by every destination that counts
 * toward it. See docs/adr/0010.
 */
export type LimitMode = 'destination' | 'class';

/**
 * The Pass Allowance: how many passes each student may take in a stretch of
 * time, counted across every class they have with the teacher.
 */
export type PassAllowance = {
  enabled: boolean;
  passes: number;
  /** "reset" counts from `since`, the last time the teacher pressed Reset. */
  per: 'day' | 'week' | 'reset';
  /** What the kiosk does once a student has used them all. */
  whenUsedUp: 'stop' | 'warn';
  since: string;
};

/** What can stop a student from leaving: a used-up Pass Allowance, No-Pass Time, or a reached Pass Limit (or others ahead in its Line). */
export type Block = 'allowance' | 'no-pass' | 'full';

/**
 * A Request: a blocked student asking the teacher to let them go. The
 * teacher's computer keeps them, as it keeps the Line. See docs/adr/0009.
 */
export type PassRequest = {
  id: string;
  classId: string;
  studentId: string;
  studentName: string;
  destination: string;
  /** What was stopping them when they asked. */
  blocks: Block[];
  askedAt: string;
};

/** A Request the teacher said no to, kept for History. */
export type DeniedRequest = PassRequest & { deniedAt: string };

/** A stretch of the clock, as "HH:MM" (24-hour) times, from `start` up to (not including) `end`. */
export type ClockRange = { start: string; end: string };

/** One stretch of the clock in a Schedule, belonging to one class, or to none (lunch, planning). */
export type Period = ClockRange & {
  id: string;
  classId: string | null;
  /** No-Pass Time in the first and last minutes of this period. Only a period with a class has any. */
  noPass?: { first: number; last: number };
};

/**
 * Older versions kept "first 10 minutes of every class" as rules across a
 * schedule's periods. They are moved onto each period when an account loads,
 * so a teacher's own list is always empty; a kiosk still reads them from a
 * laptop that hasn't updated yet.
 */
export type EdgeRule = {
  id: string;
  edge: 'first' | 'last';
  minutes: number;
  /** The one class it applies to, or null for every class. */
  classId: string | null;
};

/**
 * A plan for one kind of school day ("A Day", "Early Release"): its Periods
 * and its No-Pass Times. See docs/adr/0008.
 */
export type Schedule = {
  id: string;
  name: string;
  periods: Period[];
  /** Always sent, empty, so a kiosk on an older version can still read the schedule. */
  rules: EdgeRule[];
  /** Fixed No-Pass Times drawn on this schedule. They apply to whichever class is on the kiosk. */
  noPassTimes: (ClockRange & { id: string })[];
};

/**
 * A No-Pass Time the teacher started by hand. It lasts until they end it,
 * whichever class is on the kiosk. `classId` follows the class on the kiosk
 * only so a kiosk on an older version, which checks it, keeps applying it.
 */
export type ManualNoPass = { classId: string | null; startedAt: string };

/** A group of students from the teacher's Roster seen together during one period. */
export type Class = {
  id: string;
  name: string;
  members: Member[];
  /** Before Attendance was one setting for every class: whether this class took it. Read only to carry it over. */
  attendance?: AttendanceOptions;
  /** What students can see on the kiosk and on their devices. Each is on unless set false. See docs/adr/0022. */
  visibility?: Partial<ClassVisibility>;
  /** With Student PINs on, a class can still skip asking for them, say for the youngest grades. Each student keeps their one PIN. */
  pinsOff?: true;
  createdAt: string;
};

/**
 * What students can see in one class. `names`: Watching devices see who's out
 * and who's in line, by Display Name. `where`: where each student went (off,
 * every pass is just "Out", but Lines and limits keep working). `lineNames`:
 * who's in each Line (off, only how many). See docs/adr/0022.
 */
export type ClassVisibility = { names: boolean; where: boolean; lineNames: boolean };

/** How a class takes Attendance. */
export type AttendanceOptions = {
  /** Minutes after the period starts before an Arrival is Tardy. */
  graceMinutes: number;
  /** Minutes after the class comes on before a student with no Arrival is Absent (or the period's end, if sooner). */
  absentAfterMinutes: number;
};

/**
 * One student's Attendance in one class on one school day: the teacher's own
 * log, not the school's official attendance. See docs/adr/0020.
 */
export type AttendanceMark = {
  id: string;
  classId: string;
  studentId: string;
  /** "Maya C.", frozen as it was that day. */
  studentName: string;
  /** The school day, as "YYYY-MM-DD" in local time. */
  day: string;
  status: 'present' | 'tardy' | 'absent';
  /** When they arrived, if they did. */
  arrivedAt?: string;
  /** How late, for a Tardy worked out from the Schedule. */
  tardyMinutes?: number;
  /** A Tardy the teacher excused. */
  excused?: boolean;
  /** Marked Absent because the teacher said they'd gone for the day. */
  goneForDay?: boolean;
  /** Changed by the teacher after the fact (a Correction, docs/adr/0006). */
  corrected?: boolean;
  updatedAt: string;
};

/** How a pass ended. Everything except "student" and "teacher" means nobody saw the return. */
export type EndedBy = 'student' | 'teacher' | 'switch' | 'cancelled' | 'removed';

/** One round trip: a student left for a destination and has, or has not yet, come back. */
export type Pass = {
  id: string;
  classId: string;
  studentId: string;
  /** "Maya C.", frozen when the student left so history reads the same after a rename. */
  studentName: string;
  destination: string;
  /** The destination's expected minutes, frozen when the student left. 0 means no time limit. */
  minutes: number;
  /** False when the destination didn't use up the Pass Allowance, frozen when the student left. */
  counts?: boolean;
  /** An Extra Pass: taken after the student had used up their Pass Allowance. */
  extra?: boolean;
  /** Taken during No-Pass Time, with the teacher's permission. */
  noPassException?: boolean;
  /** Taken while the Pass Limit was reached, ahead of the Line, with the teacher's permission. */
  lineSkip?: boolean;
  /** Taken by an Always-Go Student, frozen when they left. It took none of any Pass Limit's spots. */
  alwaysGo?: boolean;
  /** Where the teacher approved the student's Request: on Home, or with the PIN at the kiosk. */
  approvedBy?: 'home' | 'pin';
  /** Started from the student's own claimed device on the Student link, not at the kiosk. See docs/adr/0016. */
  fromLink?: boolean;
  outAt: string;
  inAt?: string;
  endedBy?: EndedBy;
  /** Set once a teacher has corrected this pass on the laptop. */
  corrected?: boolean;
  /**
   * The teacher cancelled it afterwards (a mis-tap, say) and gave it back: it no
   * longer counts toward the Pass Allowance or the numbers, but stays in History.
   * `endedBy` is then "cancelled"; how it ended before is kept to undo that.
   */
  cancelledBy?: 'teacher';
  endedBeforeCancel?: EndedBy;
  /** The teacher's own note about this pass, for History. */
  note?: string;
  /** When this copy last changed, so the kiosk and the laptop can tell which copy is newer. */
  updatedAt: string;
};

/**
 * One student waiting in a Line at the kiosk, and where they want to go. Each
 * destination's line is the spots that name it; under a Class Limit, every
 * spot for a destination that counts toward it is in the one Class Line.
 */
export type LineSpot = {
  studentId: string;
  studentName: string;
  classId: string;
  destination: string;
  joinedAt: string;
};

/**
 * Which class the kiosk is showing, and when it last changed. On Schedule it
 * changes by itself as each period starts, and between periods there is none.
 */
export type ActiveClass = { id: string | null; changedAt: string; onSchedule?: boolean };

/** The teacher's one kiosk: either a paired device, or this computer itself. */
export type Kiosk =
  | { kind: 'this-computer'; locked: boolean }
  | { kind: 'device'; kioskId: string; secret: string; pairedAt: string; lastSeenAt?: string };

/** Everything the teacher's laptop holds. A Backup is exactly this, written to a file. */
export type Account = {
  /** 1 before the Account moved to its own key; 2 since. A later version may raise it. */
  version: number;
  /** The fixed address a paired kiosk uses to find this laptop again. */
  laptopPeerId: string;
  /** Every student the teacher teaches, each once. See docs/adr/0015. */
  roster: Student[];
  /**
   * Whether students type their PIN after tapping their name at the kiosk, in every class, and
   * whether they can set up their own device on the Student link. Off unless the teacher turns it on.
   */
  studentPins?: boolean;
  /** Set once the teacher has seen (or dismissed) the offer to merge students who may be one child. */
  rosterMergeSeen?: boolean;
  classes: Class[];
  destinations: Destination[];
  passes: Pass[];
  /** Whether students may join a Line once its Pass Limit is reached. */
  lineEnabled: boolean;
  /** Every Line. The teacher's computer is in charge of them. */
  line: LineSpot[];
  limitMode: LimitMode;
  /** The Class Limit: how many students may be out at once, when `limitMode` is "class". Kept while it isn't. */
  classLimit: number;
  passAllowance: PassAllowance;
  /** Always at least one. */
  schedules: Schedule[];
  /** The schedule the teacher last picked. It stays picked until they pick another. */
  /** The Current Schedule, or null when the teacher has none. */
  currentScheduleId: string | null;
  manualNoPass: ManualNoPass | null;
  /** Every waiting Request. The teacher's computer is in charge of them. */
  requests: PassRequest[];
  deniedRequests: DeniedRequest[];
  /** Each Popup this teacher has closed, and when. */
  seenPopups: Record<string, string>;
  /** The teacher's PIN, needed at the kiosk to change class or unpair. */
  pin: string;
  kiosk: Kiosk | null;
  activeClass: ActiveClass | null;
  /** Kiosks that were replaced while offline. Their last passes are still welcome. */
  replacedKiosks: { kioskId: string; secret: string }[];
  /** Set when a pairing attempt showed that this network blocks device-to-device connections. */
  networkBlocked: boolean;
  /**
   * The Student link: whether it is open, and the Room students join right
   * now. Every class period gets a new Room, with a new code. See docs/adr/0019.
   */
  studentLink: { open: boolean; room: Room | null } | null;
  /** Students' own devices that act as them in the current Room. At most one per student. See docs/adr/0016. */
  claims: Claim[];
  /** A chime on the teacher's computer when a pass becomes Overdue. Off unless the teacher turns it on. */
  overdueChime?: boolean;
  /** Every Attendance mark, for classes that take Attendance. See docs/adr/0020. */
  attendance: AttendanceMark[];
  /** Attendance for every class, while the teacher has it on (one setting for now). See docs/adr/0020. */
  attendanceRules?: AttendanceOptions;
  /** Students merged away, each to the student they became, so a kiosk that missed the merge can't bring them back. */
  mergedIds?: Record<string, string>;
  /** A fingerprint of the older key as last taken in, so a tab still on the older version is noticed when it changes it. */
  legacySeen?: string;
  /** Requests in the older key as last taken in, so one answered here isn't taken in again. */
  legacyRequestIds?: string[];
  /** Saved attendance that couldn't be read, kept as it was. */
  unreadableAttendance?: unknown[];
  /** Pairs the teacher said are different students ("a|b", sorted), so they're never offered again. */
  dismissedMerges?: string[];
  /** Recent merges, newest last, each with what's needed to undo it. */
  merges?: MergeRecord[];
  lastExportedAt?: string;
};

/**
 * The Student link for one class period: a short code students type, or scan
 * as a QR code, to join. A new class on the door means a new Room, so a code
 * stops working when its class ends. See docs/adr/0019.
 */
export type Room = { code: string; classId: string; startedAt: string };

/**
 * A student's own device made to act as them on the Student link. The device
 * keeps only the token, a random secret that means nothing anywhere else.
 */
/** One merge of two students into one, kept so the teacher can undo it. */
export type MergeRecord = {
  id: string;
  at: string;
  keep: Student;
  drop: Student;
  /** Where the merged-away student was a member, as they were. */
  memberships: { classId: string; member: Member }[];
  /** The classes the kept student was in before the merge. */
  keepClassIds: string[];
  passIds: string[];
  requestIds: string[];
  deniedIds: string[];
  attendanceIds: string[];
  /** Marks of the merged-away student dropped because the kept one had a mark that day. */
  removedMarks: AttendanceMark[];
  /** Claims of the merged-away student, ended by the merge. */
  removedClaims: Claim[];
};

export type Claim = { token: string; studentId: string; claimedAt: string };

/** A class as the kiosk sees it: current students only, names already composed. */
export type DoorClass = {
  id: string;
  name: string;
  /**
   * `exempt` is sent true for an Always-Go Student too, so a kiosk on the
   * version before Always-Go, until it refreshes, at least lifts their Pass Allowance.
   * `pin` is sent only while the class asks for PINs, so the kiosk asks for one
   * exactly when a student has it. An older kiosk ignores it and asks for none.
   */
  students: { id: string; name: string; exempt?: boolean; alwaysGo?: boolean; pin?: string }[];
  /** Sent only when off; an older kiosk ignores them and shows everything. See docs/adr/0022. */
  hideWhere?: true;
  hideLineNames?: true;
};

/** Just enough of a past pass for the kiosk to count it against the Pass Allowance. */
export type CountedPass = { id: string; classId: string; studentId: string; outAt: string };

/**
 * Everything the teacher's computer shows the kiosk: who is on the door, who is
 * out, each Line and the waiting Requests. The teacher's computer decides; the
 * kiosk only shows this and asks. See docs/adr/0014.
 */
export type DoorSetup = {
  /**
   * What the teacher's computer understands from a kiosk. Missing from a
   * laptop on a version before kiosks asked it for everything; such a kiosk
   * then only records returns and arrivals, as if offline, until it reloads.
   */
  protocol?: number;
  classes: DoorClass[];
  /**
   * With a Class Limit, each destination's `limit` is sent as the Class Limit
   * (or null if it doesn't count toward it), so a kiosk on the version before
   * Class Limits, until it refreshes, still holds students back much as it should.
   */
  destinations: Destination[];
  lineEnabled: boolean;
  /** Missing from a laptop on the version before Class Limits, which means "destination". */
  limitMode?: LimitMode;
  classLimit?: number;
  passAllowance: PassAllowance;
  /** Every pass that uses up the Pass Allowance in its current window, so the kiosk can count without the laptop. */
  countedPasses: CountedPass[];
  activeClass: ActiveClass | null;
  /** The Current Schedule. Missing from a laptop on the version before schedules. */
  schedule?: Schedule;
  manualNoPass?: ManualNoPass | null;
  pin: string;
  /**
   * What a kiosk still running the version before per-destination limits
   * reads, until it refreshes: one Pass Limit on everyone out at once. A laptop
   * on that version sends this instead of `limit`.
   */
  passLimit?: number;
  /** Passes still open, plus today's, so both sides agree on who is out. */
  passes: Pass[];
  /** Every Line, as the teacher's computer keeps it. */
  line?: LineSpot[];
  /** The waiting Requests, as the teacher's computer keeps them. */
  requests?: PassRequest[];
  /** Students the teacher said no to in the last minute, and how many seconds ago. */
  denied?: { studentId: string; secondsAgo: number }[];
  /** The Room's code, for the kiosk to show, while the Student link is open. */
  room?: { code: string } | null;
  /**
   * For the class on the door, when it takes Attendance: who has arrived today, how many are Absent (never
   * who: Absent students are left off `classes`), and whether a late arrival must type a PIN.
   */
  arrivals?: { classId: string; studentIds: string[]; absentCount?: number; pinsOn?: boolean } | null;
};

/**
 * Something a student (or the teacher, with the PIN) did at the kiosk or on a
 * claimed Student link device. The teacher's computer decides what happens.
 */
export type DoorAction =
  | { kind: 'pass'; studentId: string; destination: string; approvedBy?: 'pin' }
  | { kind: 'back'; studentId: string }
  | { kind: 'join'; studentId: string; destination: string }
  | { kind: 'leave'; studentId: string }
  | { kind: 'ask'; studentId: string; destination: string }
  | { kind: 'cancel-request'; studentId: string }
  | { kind: 'undo'; passId: string }
  | { kind: 'change-class'; classId: string | null }
  | { kind: 'arrive'; studentId: string }
  /** "Just arrived?": a student marked Absent types their first name (and PIN); the teacher's computer finds them. */
  | { kind: 'arrive-late'; firstName: string; pin?: string }
  | { kind: 'clear-line' };

/** A student who signed back in while the kiosk couldn't reach the teacher's computer. */
export type OfflineReturn = { passId: string; inAt: string };

/** A student who arrived while the kiosk couldn't reach the teacher's computer. See docs/adr/0014 and 0020. */
export type OfflineArrival = { classId: string; studentId: string; at: string };

/** Messages that travel between the kiosk and the laptop. */
export type KioskMessage =
  | { type: 'act'; action: DoorAction }
  | { type: 'returns'; returns: OfflineReturn[] }
  | { type: 'arrivals'; arrivals: OfflineArrival[] }
  /** Sent only by a kiosk on an older version, or one handing over before it stands down. */
  | { type: 'passes'; passes: Pass[] }
  | { type: 'ping' };

/** What the screen shows a student after they did something: a pass, a refusal, a place in line. */
export type DoorNoticeMessage = {
  kind: 'approved' | 'denied' | 'returned';
  eyebrow?: string;
  title: string;
  message: string;
  undoPassId?: string;
  offerLine?: { studentId: string; destination: string };
  offerTeacher?: { studentId: string; destination: string };
};

export type LaptopMessage =
  | { type: 'paired'; laptopPeerId: string; kioskId: string; secret: string; setup: DoorSetup }
  | { type: 'setup'; setup: DoorSetup }
  | { type: 'notice'; notice: DoorNoticeMessage; seconds: number }
  | { type: 'returns-received'; passIds: string[] }
  | { type: 'arrivals-received'; arrivals: OfflineArrival[] }
  /** For a kiosk on an older version handing over passes. */
  | { type: 'ack'; passes: { id: string; updatedAt: string }[] }
  | { type: 'replaced' }
  | { type: 'ping' };

/**
 * What every device on the Student link is shown: how the door stands, in
 * numbers. Never a student's name: names stay on the kiosk, in the room. A
 * device's own student sees their own status apart, in OwnView. See docs/adr/0018.
 */
export type StudentView = {
  /** The class on the kiosk, or null when there is none. */
  className: string | null;
  /** Whether passes are open, it's a No-Pass Time, it's between classes, or no class is on the kiosk. */
  status: 'open' | 'no-pass' | 'between' | 'no-class';
  /** During a No-Pass Time: "Passes open at 9:15 AM.", or that the teacher will open them. */
  whenPassesOpen?: string;
  /** How many students are out, at each destination with anyone there. Private destinations are one "Out", with no name. */
  out: { destination: string; count: number; private?: boolean }[];
  /**
   * Who's out, by Display Name, when the class shows names on student devices.
   * `destination` is null for a Private destination or when the class hides where. See docs/adr/0022.
   */
  outNames?: { name: string; destination: string | null }[];
  /**
   * How many are waiting in each Line. Under a Class Limit, or when the class
   * hides where, there is one, with no destination. `names`, in order, only
   * when the class shows names and who's in line.
   */
  lines: { destination: string | null; waiting: number; names?: string[] }[];
  /** Just enough of each destination to draw its icon. */
  destinations: Pick<Destination, 'label' | 'color' | 'icon'>[];
  /** Whether a student can set up their own device: only while PINs are on. */
  claimsOpen: boolean;
};

/**
 * Messages from the teacher's computer to a student's device. "closed": the
 * teacher closed the link. "full": too many people are viewing. "old-link":
 * the teacher got a new link, so this one stops working.
 */
export type StudentLinkMessage =
  | { type: 'view'; view: StudentView }
  | { type: 'closed' }
  | { type: 'full' }
  | { type: 'old-link' }
  | { type: 'ping' }
  | { type: 'claimed'; token: string; name: string }
  | { type: 'claim-refused'; message: string }
  /** The teacher (or the student, or a new device) ended this device's Claim. */
  | { type: 'claim-ended' }
  | { type: 'me'; me: OwnView }
  | { type: 'notice'; notice: DoorNoticeMessage; seconds: number };

/**
 * What a claimed device shows its own student, and nobody else: whether they
 * can act right now, their passes left, their place in line, and how long
 * their own pass has run. See docs/adr/0016.
 */
export type OwnView = {
  studentId: string;
  name: string;
  /** Only while their class is the Active Class. */
  canAct: boolean;
  passesLeft?: string;
  out?: { destination: string; secondsOut: number; minutes: number };
  /** Their own Attendance today, when the class takes it. Only they see it. */
  attendance?: 'not-yet' | 'present' | 'tardy' | 'absent';
  line?: { destination: string; position: number; upNext: boolean };
  request?: { destination: string };
};

/** What a student's device may do on the Student link. Nothing the teacher's PIN does at the kiosk. */
export type LinkAction = Extract<DoorAction, { kind: 'pass' | 'back' | 'join' | 'leave' | 'ask' | 'cancel-request' | 'undo' }>;

/** Messages from a student's device to the teacher's computer. */
export type StudentMessage =
  | { type: 'ping' }
  /** A student sets up their device by typing their first name and PIN; no list of names is ever sent. */
  | { type: 'claim'; firstName: string; pin: string }
  | { type: 'act'; token: string; action: LinkAction }
  | { type: 'end-claim'; token: string };
