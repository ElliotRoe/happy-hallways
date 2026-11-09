import type { Account, Student } from './types';

/**
 * Students who may be the same child in two classes. Before the Roster (docs/adr/0015),
 * the same child in two classes was two students, and only their first name and a
 * short prefix of their last name were kept, so a teacher must confirm each one.
 *
 * Two students are offered as one when:
 * - they share a first name,
 * - one's kept last-name letters start the other's (or a known full last name matches),
 * - and they are never in the same class (two children in one class are always two).
 */
export type MergeSuggestion = { keep: Student; drop: Student; keepClasses: string[]; dropClasses: string[] };

function lastLetters(student: Student, prefix: string) {
  return (student.lastName ?? prefix).toLowerCase();
}

/** The same key for a pair whichever way round, for remembering a pair the teacher said are different students. */
export function pairKey(a: string, b: string) {
  return [a, b].sort().join('|');
}

export function mergeSuggestions(account: Pick<Account, 'roster' | 'classes' | 'dismissedMerges'>): MergeSuggestion[] {
  const dismissed = new Set(account.dismissedMerges ?? []);
  const classesOf = (studentId: string) => account.classes.filter((cls) => cls.members.some((member) => member.studentId === studentId));
  const prefixOf = (studentId: string) =>
    account.classes.flatMap((cls) => cls.members).find((member) => member.studentId === studentId)?.lastPrefix ?? '';
  const suggestions: MergeSuggestion[] = [];
  const used = new Set<string>();
  for (const [index, first] of account.roster.entries()) {
    if (used.has(first.id)) continue;
    for (const second of account.roster.slice(index + 1)) {
      if (used.has(second.id) || first.firstName.toLowerCase() !== second.firstName.toLowerCase()) continue;
      if (dismissed.has(pairKey(first.id, second.id))) continue;
      const a = lastLetters(first, prefixOf(first.id));
      const b = lastLetters(second, prefixOf(second.id));
      if (first.lastName && second.lastName ? a !== b : !(a.startsWith(b) || b.startsWith(a))) continue;
      const firstClasses = classesOf(first.id);
      const secondClasses = classesOf(second.id);
      if (firstClasses.some((cls) => secondClasses.includes(cls))) continue;
      suggestions.push({
        keep: first,
        drop: second,
        keepClasses: firstClasses.map((cls) => cls.name),
        dropClasses: secondClasses.map((cls) => cls.name),
      });
      used.add(first.id);
      used.add(second.id);
      break;
    }
  }
  return suggestions;
}
