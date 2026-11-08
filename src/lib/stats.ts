import { dayKey, duration, hasRealDuration, isOverdue } from './passes';
import { displayName } from './roster';
import type { Class, ClassStudent, Pass } from './types';

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Midnight at the start of this week's Monday, which is how teachers count "this week". */
export function startOfWeek(from = new Date()) {
  const monday = new Date(from);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

/** Passes on each of the last `days` days, oldest first. */
export function passesByDay(passes: Pass[], days = 7) {
  const counts = [];
  for (let back = days - 1; back >= 0; back -= 1) {
    const when = new Date();
    when.setDate(when.getDate() - back);
    const key = dayKey(when);
    counts.push({
      key,
      label: weekdays[when.getDay()],
      count: passes.filter((pass) => dayKey(pass.outAt) === key && pass.endedBy !== 'cancelled').length,
    });
  }
  const most = Math.max(1, ...counts.map((day) => day.count));
  return counts.map((day) => ({ ...day, height: Math.round((day.count / most) * 100) }));
}

/** Where this class actually goes, as shares of all trips, most popular first. */
export function destinationShares(passes: Pass[]) {
  const trips = passes.filter((pass) => pass.endedBy !== 'cancelled');
  const counts = new Map<string, number>();
  for (const pass of trips) counts.set(pass.destination, (counts.get(pass.destination) ?? 0) + 1);
  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1])
    .map(([label, count]) => ({ label, count, share: Math.round((count / trips.length) * 100) }));
}

/** Minutes out of class, counting only trips whose return someone actually saw. */
export function minutesOut(passes: Pass[]) {
  return passes.filter((pass) => pass.inAt && hasRealDuration(pass)).reduce((sum, pass) => sum + duration(pass), 0);
}

export type StudentSummary = {
  id: string;
  name: string;
  former: boolean;
  today: number;
  week: number;
  minutesWeek: number;
  total: number;
  minutesTotal: number;
  overdue: number;
  passes: Pass[];
};

/**
 * The per-student view teachers asked for most: how often each student goes,
 * and how much class time that adds up to.
 */
export function studentSummaries(cls: Class, students: ClassStudent[], passes: Pass[]): StudentSummary[] {
  const today = dayKey(new Date());
  const weekStart = startOfWeek().toISOString();
  const trips = passes.filter((pass) => pass.classId === cls.id && pass.endedBy !== 'cancelled');
  return students
    .map((student) => {
      const mine = trips.filter((pass) => pass.studentId === student.id).sort((a, b) => b.outAt.localeCompare(a.outAt));
      const thisWeek = mine.filter((pass) => pass.outAt >= weekStart);
      return {
        id: student.id,
        name: displayName(student),
        former: student.status === 'former',
        today: mine.filter((pass) => dayKey(pass.outAt) === today).length,
        week: thisWeek.length,
        minutesWeek: minutesOut(thisWeek),
        total: mine.length,
        minutesTotal: minutesOut(mine),
        overdue: mine.filter((pass) => pass.inAt && isOverdue(pass)).length,
        passes: mine,
      };
    })
    .filter((summary) => !summary.former || summary.total > 0);
}
