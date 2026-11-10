# Each class keeps its code, which works only while the class is on

Supersedes the "new code for each class period" part of ADR 0019.

Under ADR 0019 each class period got a new random code whenever the Active
Class changed. Teachers found this frustrating: switching away from a class and
back, even by mistake, gave it a new code, and nobody could post a code on the
wall or keep the link. What made a code safe was never that it was new; it was
that the teacher's computer answers only the class that's on. So each class now
keeps one code. The class's Room is still per class period: it opens with that
code when the class goes on (by the Schedule or by hand) and closes when it goes
off, and between classes there's no Room at all. A student who keeps the link
gets in again next time their class is on, and outside it sees "Period 1 isn't
on right now", and the page opens by itself when the class starts.

## Consequences

- Claims still end with each class period, so a shared Chromebook is never left
  set up as the last student. Students type their first name and PIN in each
  class, as before.
- The code is shown on the class's Settings tab, with "New code", which replaces
  it for good (and ends the Room's Claims if the class is on). "New code" on
  Student devices does the same for the class on now.
- A code that lasts can reach more students outside the room than one that
  changed each period. It only works while its own class is on, the per-device
  and per-Room limits on wrong PINs still apply, and a teacher can replace it at
  any time. Classes can hide names on student devices (ADR 0022).
- Two teachers can now hold the same six-digit code at different times of day,
  so a student's saved link could reach another teacher's class. The student's
  device remembers which class the code was, and says so if it ever shows a
  different class. A clash at the same time is still caught by the teacher's
  computer, which gives its class a new code.
- The teacher's computer remembers which codes it answered in the last few
  minutes, so a class coming back on right after it ended isn't taken for a
  clash while the server still holds its old connection.
- Restoring someone else's backup gives every class a new code.
