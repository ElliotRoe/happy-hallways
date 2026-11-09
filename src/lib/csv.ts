import { dayKey, duration, hasRealDuration, isOverdue, time } from './passes';
import type { HistoryRow } from './history';

/** Wraps a value so a comma, quote or newline inside it cannot break the row. */
function cell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const headings = ['Date', 'Class', 'Student', 'Destination', 'Left', 'Returned', 'Minutes out', 'Expected', 'Overdue', 'Extra', 'No-Pass Exception', 'Line Skip', 'Can Always Go', 'Approved', 'Ended by', 'Corrected', 'Note'];

const endings: Record<string, string> = {
  student: 'student',
  teacher: 'teacher',
  switch: 'class change',
  cancelled: 'cancelled at the door',
  removed: 'left the roster',
};

const approvals = { home: 'on Home', pin: 'with PIN' };

/**
 * A spreadsheet of History, exactly as filtered. Trips whose return nobody
 * saw leave the duration blank rather than reporting minutes nobody measured.
 * A denied request is a row of its own, at the time the student asked.
 */
export function historyToCsv(rows: HistoryRow[], className: (id: string) => string) {
  const lines = [...rows]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((row) => {
      if (row.kind === 'denied') {
        const request = row.request;
        const asked = [dayKey(request.askedAt), className(request.classId), request.studentName, request.destination, time(request.askedAt)];
        return [...asked, '', '', '', '', '', '', '', '', '', 'request denied', '', ''];
      }
      const pass = row.pass;
      return [
        dayKey(pass.outAt),
        className(pass.classId),
        pass.studentName,
        pass.destination,
        time(pass.outAt),
        pass.inAt ? time(pass.inAt) : '',
        pass.inAt && hasRealDuration(pass) ? duration(pass) : '',
        pass.minutes || '',
        isOverdue(pass) ? 'yes' : '',
        pass.extra ? 'yes' : '',
        pass.noPassException ? 'yes' : '',
        pass.lineSkip ? 'yes' : '',
        pass.alwaysGo ? 'yes' : '',
        pass.approvedBy ? approvals[pass.approvedBy] : '',
        pass.cancelledBy === 'teacher' ? 'cancelled by teacher' : pass.inAt ? endings[pass.endedBy ?? 'student'] : 'still out',
        pass.corrected ? 'yes' : '',
        pass.note ?? '',
      ];
    });
  return [headings, ...lines].map((line) => line.map(cell).join(',')).join('\n');
}

/** Hands the browser a file to save. */
export function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
