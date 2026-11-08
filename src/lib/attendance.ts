import { dayKey } from './passes';
import { clockOf, toMinutes } from './schedule';
import type { AttendanceMark, AttendanceOptions, Schedule } from './types';

/**
 * Attendance: the teacher's own log of who came to each class each day. It is
 * not the school's official attendance. See docs/adr/0020.
 */

export const defaultAttendance: AttendanceOptions = { graceMinutes: 0, absentAfterMinutes: 15 };

/** Today's school day, as Attendance marks are kept. */
export function today(at: number | string | Date = Date.now()) {
  return dayKey(new Date(at));
}

/** The class's period on the schedule that `at` falls in, or else the last one that began before it today. */
export function periodFor(schedule: Schedule | undefined, classId: string, at: number | string = Date.now()) {
  const clock = clockOf(at);
  const periods = (schedule?.periods ?? []).filter((period) => period.classId === classId).sort((a, b) => a.start.localeCompare(b.start));
  return periods.find((period) => period.start <= clock && clock < period.end) ?? periods.filter((period) => period.start <= clock).pop() ?? null;
}

/** Minutes from a clock time today ("09:00") until `at`. */
export function minutesSince(clock: string, at: number | string) {
  return toMinutes(clockOf(at)) - toMinutes(clock);
}

/**
 * How a new Arrival counts: Tardy when it came after the period began on the
 * Schedule plus the grace minutes. Without a Schedule period, it's present;
 * only the teacher marks a Tardy then.
 */
export function arrivalStatus(schedule: Schedule | undefined, classId: string, options: AttendanceOptions, at: string) {
  const period = periodFor(schedule, classId, at);
  if (!period) return { status: 'present' as const };
  const late = minutesSince(period.start, at);
  return late > options.graceMinutes ? { status: 'tardy' as const, tardyMinutes: late } : { status: 'present' as const };
}

export const statusText: Record<AttendanceMark['status'], string> = { present: 'Present', tardy: 'Tardy', absent: 'Absent' };

/** "Tardy · 6 min · excused", for the teacher. */
export function markText(mark: AttendanceMark) {
  const parts: string[] = [statusText[mark.status]];
  if (mark.status === 'tardy' && mark.tardyMinutes) parts.push(`${mark.tardyMinutes} min`);
  if (mark.excused) parts.push('excused');
  if (mark.goneForDay) parts.push('gone for the day');
  return parts.join(' · ');
}

/** The Attendance CSV: one row per student, class and day. */
export function attendanceToCsv(marks: AttendanceMark[], className: (id: string) => string) {
  const cell = (value: string | number | undefined) => {
    const text = value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = [['Date', 'Class', 'Student', 'Status', 'Arrived', 'Tardy minutes', 'Excused', 'Gone for the day', 'Corrected']];
  for (const mark of [...marks].sort((a, b) => a.day.localeCompare(b.day) || a.studentName.localeCompare(b.studentName))) {
    rows.push([
      mark.day,
      className(mark.classId),
      mark.studentName,
      statusText[mark.status],
      mark.arrivedAt ? new Date(mark.arrivedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '',
      mark.status === 'tardy' && mark.tardyMinutes ? String(mark.tardyMinutes) : '',
      mark.excused ? 'yes' : '',
      mark.goneForDay ? 'yes' : '',
      mark.corrected ? 'yes' : '',
    ]);
  }
  return rows.map((row) => row.map(cell).join(',')).join('\n');
}
