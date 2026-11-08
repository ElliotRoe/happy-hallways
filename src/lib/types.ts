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
  createdAt: string;
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
  version: 1;
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
};

/** Just enough of a past pass for the kiosk to count it against the Pass Allowance. */
export type CountedPass = { id: string; classId: string; studentId: string; outAt: string };

/**
 * Everything the teacher's computer shows the kiosk: who is on the door, who is
 * out, each Line and the waiting Requests. The teacher's computer decides; the
 * kiosk only shows this and asks. See docs/adr/0014.
 */
export type DoorSetup = {
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
  | { kind: 'clear-line' };

/** A student who signed back in while the kiosk couldn't reach the teacher's computer. */
export type OfflineReturn = { passId: string; inAt: string };

/** Messages that travel between the kiosk and the laptop. */
export type KioskMessage =
  | { type: 'act'; action: DoorAction }
  | { type: 'returns'; returns: OfflineReturn[] }
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
  /** How many students are out, at each destination with anyone there. */
  out: { destination: string; count: number }[];
  /** How many are waiting in each Line. Under a Class Limit there is one, with no destination. */
  lines: { destination: string | null; waiting: number }[];
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
