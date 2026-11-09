import { pinProblem } from './pins';
import type { ClassStudent, Student } from './types';

/** A name as it arrived from a paste, before any of it is thrown away, with the student's PIN if the list had one. */
export type ParsedName = { firstName: string; lastName: string; pin?: string };

/** A student already on the Roster but not in this class, whom a pasted name may be. */
export type RosterCandidate = {
  student: Student;
  /** The letters shown for them in a class they're in, all that's known of a student imported before full names were kept. */
  prefix: string;
  classes: string[];
};

/** What an import would do, shown to the teacher before anything is saved. */
export type ImportPlan = {
  /**
   * New to this class. `rosterMatch` is a student already on the Roster the name
   * seems to be; the teacher confirms before they become the same student.
   */
  added: {
    firstName: string;
    lastName: string;
    lastPrefix: string;
    pin?: string;
    rosterMatch?: { studentId: string; label: string };
  }[];
  /** Students already in this class. Their prefix may change to keep names apart, and a PIN in the list replaces theirs. */
  matched: { student: ClassStudent; lastPrefix: string; lastName: string; pin?: string }[];
  /** In this class, but not in the pasted list. The teacher decides. */
  missing: ClassStudent[];
  /**
   * PINs in the list that differ from a PIN a student already has. Never
   * applied unless the teacher says so: the student may already know theirs.
   */
  pinChanges: { studentId: string; name: string; from: string; to: string }[];
  /** Set when two students cannot be told apart. Nothing is saved when this is set. */
  error: string;
};

/** The longest last-name prefix the kiosk or Student link ever shows. A privacy limit, not a technical one. */
export const maxPrefix = 3;

/** "Maya C." — the only form of a student's name students or passers-by ever see. */
export function displayName(student: { firstName: string; lastPrefix: string }) {
  return student.lastPrefix ? `${student.firstName} ${student.lastPrefix}.` : student.firstName;
}

/** A first line naming its columns rather than a student. */
function looksLikeHeading(line: string) {
  return /\b(first|last|surname|name|student|pupil|pin)\b/i.test(line);
}

/**
 * An optional PIN column: digits at the end of a line ("Maya Chen, 4821")
 * are the student's PIN, never part of their name.
 */
function readLine(line: string): ParsedName | null {
  const trimmed = line.trim().replace(/^["']|["']$/g, '');
  const withPin = trimmed.match(/^(.*?)[\s,]+(\d+)$/);
  if (!withPin) return readName(trimmed);
  const name = readName(withPin[1]);
  return name && { ...name, pin: withPin[2] };
}

/**
 * Reads the name on one line of a pasted roster. Teachers paste whatever their school's
 * system exported, so this accepts the shapes those systems actually produce
 * rather than asking the teacher which one is correct. Where a line is
 * genuinely ambiguous the preview is what saves us, not a cleverer rule.
 */
function readName(trimmed: string): ParsedName | null {
  if (!trimmed) return null;

  const separator = trimmed.includes('\t') ? '\t' : trimmed.includes(',') ? ',' : '';
  if (!separator) {
    const words = trimmed.split(/\s+/);
    return { firstName: words[0], lastName: words.slice(1).join(' ') };
  }

  const [left, right = ''] = trimmed.split(separator).map((part) => part.trim());
  if (!left) return null;
  if (!right) return { firstName: left, lastName: '' };
  // A spreadsheet's two columns are First then Last. A comma is the ambiguous
  // one: "Chen, Maya" is a surname first, while "Maya,C" is already shortened.
  if (separator === '\t') return { firstName: left, lastName: right };
  return right.length <= maxPrefix ? { firstName: left, lastName: right } : { firstName: right, lastName: left };
}

export function parseRoster(text: string): ParsedName[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length > 1 && looksLikeHeading(lines[0])) lines.shift();
  return lines.map(readLine).filter((name): name is ParsedName => name !== null);
}

/**
 * Hands every student the shortest last-name prefix that tells them apart from
 * everyone sharing their first name in the same Class. Students who share a
 * first name all get the same width, so the roster reads consistently.
 */
export function assignPrefixes(names: ParsedName[]) {
  const groups = new Map<string, ParsedName[]>();
  for (const name of names) {
    const key = name.firstName.toLowerCase();
    const group = groups.get(key);
    if (group) group.push(name);
    else groups.set(key, [name]);
  }

  const widths = new Map<string, number>();
  let error = '';
  for (const [key, members] of groups) {
    let width = 1;
    for (; width <= maxPrefix; width += 1) {
      const seen = new Set(members.map((member) => member.lastName.slice(0, width).toLowerCase()));
      if (seen.size === members.length) break;
    }
    if (width > maxPrefix && !error) {
      // We have run out of letters we are willing to store. Refusing is
      // deliberate: two identical names on the door screen means students sign
      // out as each other, and the day's log is wrong beyond untangling.
      const shown = members
        .map((member) => displayName({ firstName: member.firstName, lastPrefix: member.lastName.slice(0, maxPrefix) }))
        .join('" and "');
      error = `Two students would both show as "${shown}". Please give one of them a nickname or a different name.`;
    }
    widths.set(key, Math.min(width, maxPrefix));
  }

  const entries = names.map((name) => ({
    firstName: name.firstName,
    lastPrefix: name.lastName.slice(0, widths.get(name.firstName.toLowerCase()) ?? 1),
  }));
  return { entries, error };
}

/**
 * Works out what a paste would do to a Class that already has a roster. Names
 * already there are matched and kept, new ones are added, and names that have
 * disappeared are reported rather than quietly removed — a silent replace would
 * archive a third of a class without the teacher noticing.
 */
export function planImport(text: string, existing: ClassStudent[], teacherPin = '', candidates: RosterCandidate[] = []): ImportPlan {
  const parsed = parseRoster(text);
  const current = existing.filter((student) => student.status === 'current');

  /**
   * A stored prefix is only as much of the last name as we kept, so "Maya C."
   * is a prefix of Carter and of Chen alike.
   */
  const couldBe = (student: ClassStudent, name: ParsedName) =>
    student.firstName.toLowerCase() === name.firstName.toLowerCase() &&
    (student.lastName
      ? student.lastName.toLowerCase() === name.lastName.toLowerCase()
      : student.lastPrefix
        ? name.lastName.toLowerCase().startsWith(student.lastPrefix.toLowerCase())
        : !name.lastName);

  // Guessing here is exactly how one student's history would be quietly folded
  // into another's, so both directions of ambiguity are reported instead: one
  // pasted name that fits two existing students, and one existing student that
  // two pasted names would fit.
  let ambiguity = '';
  const whole = (name: ParsedName) => `${name.firstName} ${name.lastName}`.trim();
  for (const name of parsed) {
    const fits = current.filter((student) => couldBe(student, name));
    if (fits.length > 1) {
      ambiguity = `"${whole(name)}" could be more than one student already on this roster. Give one of them a nickname and import again.`;
      break;
    }
  }
  if (!ambiguity) {
    for (const student of current) {
      const rivals = parsed.filter((name) => couldBe(student, name));
      if (rivals.length > 1) {
        ambiguity = `"${displayName(student)}" is already on this roster, and both "${whole(rivals[0])}" and "${whole(rivals[1])}" could be them. Give one of them a nickname and import again.`;
        break;
      }
    }
  }

  const claimed = new Set<string>();
  const pairs: { parsed: ParsedName; student?: ClassStudent }[] = [];
  for (const name of parsed) {
    const hit = current.find((student) => !claimed.has(student.id) && couldBe(student, name));
    if (hit) claimed.add(hit.id);
    pairs.push({ parsed: name, student: hit });
  }

  const missing = current.filter((student) => !claimed.has(student.id));

  // Students being kept but absent from the paste still occupy a name, so they
  // take part in working out the prefixes. All we know of them is the prefix we
  // already stored, which is the price of never having kept the rest.
  const union: ParsedName[] = [
    ...pairs.map((pair) => pair.parsed),
    ...missing.map((student) => ({ firstName: student.firstName, lastName: student.lastName ?? student.lastPrefix })),
  ];
  const { entries, error } = assignPrefixes(union);

  const added: ImportPlan['added'] = [];
  const matched: ImportPlan['matched'] = [];
  pairs.forEach((pair, index) => {
    const entry = entries[index];
    const pin = pair.parsed.pin ? { pin: pair.parsed.pin } : {};
    const lastName = pair.parsed.lastName;
    if (pair.student) matched.push({ student: pair.student, lastPrefix: entry.lastPrefix, lastName, ...pin });
    else {
      const match = rosterMatch(pair.parsed, candidates);
      added.push({ ...entry, lastName, ...pin, ...(match ? { rosterMatch: match } : {}) });
    }
  });

  // Two pasted names that both seem to be the same Roster student: neither is, until the teacher says.
  const matchCounts = new Map<string, number>();
  for (const entry of added) if (entry.rosterMatch) matchCounts.set(entry.rosterMatch.studentId, (matchCounts.get(entry.rosterMatch.studentId) ?? 0) + 1);
  for (const entry of added) if (entry.rosterMatch && matchCounts.get(entry.rosterMatch.studentId)! > 1) delete entry.rosterMatch;

  const pinChanges: ImportPlan['pinChanges'] = [];
  for (const change of matched) {
    if (change.pin && change.student.pin && change.pin !== change.student.pin) {
      pinChanges.push({ studentId: change.student.id, name: displayName(change.student), from: change.student.pin, to: change.pin });
    }
  }
  for (const entry of added) {
    const known = entry.rosterMatch && candidates.find((each) => each.student.id === entry.rosterMatch!.studentId)?.student;
    if (known && entry.pin && known.pin && entry.pin !== known.pin) {
      pinChanges.push({ studentId: known.id, name: `${entry.firstName} ${entry.lastName}`.trim(), from: known.pin, to: entry.pin });
    }
  }

  return { added, matched, missing, pinChanges, error: error || ambiguity || pinsError(current, matched, added, teacherPin) };
}

/**
 * The one student already on the Roster a pasted name seems to be: the same full
 * name, or, for a student imported before full names were kept, the same first
 * name and a last name starting with the letters shown for them. Two or more
 * that fit is no match: guessing would fold one child's history into another's.
 */
function rosterMatch(name: ParsedName, candidates: RosterCandidate[]) {
  const last = name.lastName.toLowerCase();
  const fits = candidates.filter(({ student, prefix }) => {
    if (student.firstName.toLowerCase() !== name.firstName.toLowerCase() || !last) return false;
    return student.lastName ? student.lastName.toLowerCase() === last : !!prefix && last.startsWith(prefix.toLowerCase());
  });
  if (fits.length !== 1) return undefined;
  const [{ student, prefix, classes }] = fits;
  const shown = student.lastName ? `${student.firstName} ${student.lastName}` : displayName({ firstName: student.firstName, lastPrefix: prefix });
  return { studentId: student.id, label: classes.length ? `${shown} · ${classes.join(', ')}` : shown };
}

/** Checks each PIN in the list against the class as it would be after the import, so no two students share one. */
function pinsError(current: ClassStudent[], matched: ImportPlan['matched'], added: ImportPlan['added'], teacherPin: string) {
  const incoming = new Map(matched.map((change) => [change.student.id, change.pin]));
  const after = [
    ...current.map((student) => ({ name: displayName(student), pin: incoming.get(student.id) ?? student.pin })),
    ...added.map((entry) => ({ name: displayName(entry), pin: entry.pin })),
  ];
  const listed = new Set([...matched, ...added].map((each) => each.pin));
  for (const [index, each] of after.entries()) {
    if (!each.pin || !listed.has(each.pin)) continue;
    const others = after.filter((_, other) => other !== index).map((other) => other.pin);
    const problem = pinProblem(each.pin, others, teacherPin);
    if (problem) return `${each.name}'s PIN in your list: ${problem}`;
  }
  return '';
}
