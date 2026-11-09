import { dayKey, duration, hasRealDuration } from './passes';
import { startOfWeek } from './stats';
import type { DeniedRequest, Pass } from './types';

/**
 * History: every pass and every denied Request, across all classes, filtered
 * the way the teacher asks. See CONTEXT.md.
 */

export type FilterField = { key: string; label: string; options: { value: string; label: string }[] };
export type Filter = { field: string; values: string[] };

export type HistoryRow =
  | { kind: 'pass'; id: string; at: string; classId: string; studentId: string; destination: string; pass: Pass }
  | {
      kind: 'denied';
      id: string;
      at: string;
      classId: string;
      studentId: string;
      destination: string;
      request: DeniedRequest;
    };

/** What happened, for the Kind filter: each rule a pass went past is its own kind. */
export const rowKinds = [
  { value: 'normal', label: 'Regular pass' },
  { value: 'extra', label: 'Extra Pass' },
  { value: 'no-pass', label: 'No-Pass Exception' },
  { value: 'line-skip', label: 'Line Skip' },
  { value: 'always-go', label: 'Can always go' },
  { value: 'denied', label: 'Denied request' },
];

export function kindsOf(row: HistoryRow): string[] {
  if (row.kind === 'denied') return ['denied'];
  const { pass } = row;
  const kinds = [pass.extra && 'extra', pass.noPassException && 'no-pass', pass.lineSkip && 'line-skip', pass.alwaysGo && 'always-go'].filter(
    (kind): kind is string => !!kind,
  );
  return kinds.length ? kinds : ['normal'];
}

export type DateRange = 'today' | 'week' | 'month' | 'all' | 'custom';

export const dateRanges: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Choose dates…' },
];

/** Whether a moment falls in the range. Custom dates are "YYYY-MM-DD", both ends included. */
export function inRange(at: string, range: DateRange, from = '', to = '') {
  const today = new Date();
  if (range === 'today') return dayKey(at) === dayKey(today);
  if (range === 'week') return at >= startOfWeek(today).toISOString();
  if (range === 'month') return at >= new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  if (range === 'custom') {
    const day = dayKey(at);
    return (!from || day >= from) && (!to || day <= to);
  }
  return true;
}

export function allRows(passes: Pass[], denied: DeniedRequest[]): HistoryRow[] {
  return [
    ...passes
      // A pass cancelled at the door (a mis-tap undone at once) never happened; one the teacher cancelled later stays, marked.
      .filter((pass) => pass.endedBy !== 'cancelled' || pass.cancelledBy === 'teacher')
      .map((pass) => ({
        kind: 'pass' as const,
        id: pass.id,
        at: pass.outAt,
        classId: pass.classId,
        studentId: pass.studentId,
        destination: pass.destination,
        pass,
      })),
    ...denied.map((request) => ({
      kind: 'denied' as const,
      id: request.id,
      at: request.askedAt,
      classId: request.classId,
      studentId: request.studentId,
      destination: request.destination,
      request,
    })),
  ];
}

/** Every filter must match; a filter with nothing ticked doesn't count. */
export function matches(row: HistoryRow, filters: Filter[]) {
  return filters.every((filter) => {
    if (!filter.values.length) return true;
    if (filter.field === 'class') return filter.values.includes(row.classId);
    if (filter.field === 'student') return filter.values.includes(row.studentId);
    if (filter.field === 'destination') return filter.values.includes(row.destination);
    if (filter.field === 'kind') return kindsOf(row).some((kind) => filter.values.includes(kind));
    return true;
  });
}

/** Minutes out, for sorting: a pass with no real duration, or a denied request, sorts as none. */
export function minutesOf(row: HistoryRow, clock = Date.now()) {
  if (row.kind === 'denied') return -1;
  return !row.pass.inAt || hasRealDuration(row.pass) ? duration(row.pass, clock) : -1;
}
