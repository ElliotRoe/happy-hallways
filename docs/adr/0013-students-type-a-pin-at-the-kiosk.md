---
status: amended by ADR-0016
---

# Students can type a PIN at the kiosk

Teachers told us, again and again, that students tap a classmate's name at the
kiosk to sign them out or back in, as a prank or to cover for a friend, and the
day's log is then wrong in a way nobody can untangle. Many asked for students
to type their school or lunch number. We added an optional PIN instead: a few
digits each student types after tapping their name, before anything happens in
their name (going, coming back, joining or leaving a line, asking the teacher).

## Considered options

- **School ID or lunch numbers.** Rejected. They are real identifiers tied to
  school records, and keeping them would break the spirit of ADR 0001: we keep
  as little about each child as it takes to tell them apart. Happy Hallways makes
  up a PIN instead, and every screen calls it a "PIN", never an ID, so teachers
  aren't nudged into using real numbers.
- **Picture passcodes.** Friendlier for the youngest students, but much more to
  build and to print. Digits on big keys are enough to stop a casual mis-tap.
- **A lockout after wrong tries.** Rejected: it punishes the student who
  fumbles, and a determined classmate can't be stopped by a 4-digit code at a
  shared screen anyway. A wrong PIN just clears for another try.

## Decision

- Each class turns PINs on or off. Off is the default, and with it off the
  kiosk behaves exactly as before.
- Turning PINs on, or adding students to a class that has them, gives every
  student without one a random 4-digit PIN that no one else in the class has.
  The teacher can change any of them (3 to 6 digits), or put a PIN at the end
  of each line of the class list they paste.
- A student PIN may never equal the Teacher PIN, in either direction, so a
  student's own PIN can never open the teacher menu.
- A student who forgot their PIN can be let through with the Teacher PIN on the
  same keypad.
- The laptop sends a class's PINs to the kiosk with its roster only while that
  class has them turned on, and the kiosk checks them itself, so it works while
  the laptop is closed. The kiosk asks for a PIN exactly when it has one for that
  student, so a kiosk on an older version, which doesn't know about PINs, simply
  doesn't ask.

## Consequences

- PINs live in the Account, so they are in the Backup file. They are not in the
  History CSV, which is about passes.
- PINs are never shown on the kiosk. The teacher sees them on the class's
  Students page (hidden until they choose to show them) and can print a sheet
  of cut-out PIN cards.
- Like the Teacher PIN, student PINs are stored in plain text on both devices.
  They stop a classmate, not someone with the device's browser tools.
