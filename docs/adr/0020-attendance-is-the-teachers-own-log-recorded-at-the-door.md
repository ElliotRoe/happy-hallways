# Attendance is the teacher's own log, recorded at the door

Teachers kept asking to mark students absent, to log tardies, and to have
students tap in at the start of class. Logging only the tardy students would
draw an arbitrary line: once arrivals carry a time, the same tap is attendance.
So a class can turn on Attendance: each student's Arrival is recorded, a
student arriving after the period began (plus any grace minutes) is Tardy, and
one who never arrives becomes Absent. It is one teacher's own log, like
everything else on the Roster (ADR 0015), and the product says so: it does not
replace the school's official attendance, which lives in the school's own
system.

## Considered Options

- Absent only, or Absent plus a tardy log without full attendance. Rejected:
  the line between "only late students tap in" and "everyone taps in" is
  arbitrary once arrivals are timed.
- Arrivals from claimed devices. Rejected: a claimed device has no location
  check (ADR 0016), so a student could arrive from the hallway or from home.

## Consequences

- Attendance is one setting for all the teacher's classes for now, in Pass
  Options, with one set of Tardy and Absent minutes. If teachers ask for it,
  turning it on per class is the fallback (it began that way; a class that
  took it carries its minutes over to the one setting).
- An Arrival happens only at the kiosk (with the student's PIN when the class
  uses PINs) or by the teacher. A claimed device shows its own student's
  Attendance but cannot record an Arrival.
- Absent is applied automatically only in a class that became the Active Class
  that day, so a cancelled period never marks a whole class absent.
- The kiosk never says "tardy" on its shared screen; the student sees it on
  their own claimed device and the teacher on the laptop (in the spirit of ADR
  0003).
- An Absent student is hidden from the door and cannot take a pass, join a
  Line or Claim a device; a later Arrival makes them Tardy. So that a late
  student can still arrive at the door, the kiosk offers "Just arrived?" while
  anyone is Absent: the student types their first name, and their PIN when
  PINs are on, and the teacher's computer finds them among today's Absent
  students, the same way a device is set up in a Room (ADR 0018), with the same
  wrong-try limits. No list of Absent students is ever shown. With PINs off, a
  first name only counts if exactly one Absent student has it; otherwise, and
  whenever the kiosk can't reach the teacher's computer, it says to ask the
  teacher.
- Changing a mark is a Correction (ADR 0006). The teacher can mark a Tardy as
  excused; there are no reasons, and no other behaviour is logged.
- An Arrival is a fact, like a return, so a kiosk that has lost the teacher's
  computer still records it and hands it over later (ADR 0014).
- Attendance appears in History and in its own CSV export, one row per student,
  class and day.
